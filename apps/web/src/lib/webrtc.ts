/**
 * VoiceChannel — WebRTC mesh peer connections for vocal mode.
 *
 * Each player who joins runs one PeerConnection per other player. The Socket.IO
 * server only relays opaque signaling payloads (offer / answer / ICE) — it
 * never sees or processes the audio.
 *
 * Lifecycle:
 *   const vc = new VoiceChannel({ socket, selfUserId, getUsername })
 *   await vc.start()                    // requests mic, joins channel
 *   vc.setMicEnabled(true | false)      // toggle local track
 *   vc.setRemoteMuted(userId, bool)     // mute a peer's audio output
 *   vc.onPeersChanged = (ids) => ...    // updated list of connected peer userIds
 *   vc.destroy()                        // tears down peers + releases mic
 *
 * Notes:
 *   - Browser-native APIs only (no `simple-peer` / `peerjs` dependency).
 *   - Mesh topology — fine up to ~8 players, which matches the game's max.
 *   - "Polite peer" pattern using userId comparison: the lexicographically
 *     smaller id is the offer initiator, avoiding glare without negotiation
 *     state machines.
 */

import type { Socket } from 'socket.io-client'
import type { ServerToClientEvents, ClientToServerEvents } from '@imposter/shared'
import { createLogger } from './logger'

const log = createLogger('voice')

type IOSocket = Socket<ServerToClientEvents, ClientToServerEvents>

interface VoiceChannelOptions {
  socket: IOSocket
  selfUserId: string
}

interface PeerEntry {
  pc: RTCPeerConnection
  audioEl: HTMLAudioElement
  /** True if we're the offerer in this pair (lower userId initiates). */
  initiator: boolean
}

/** Public STUN servers — sufficient for most home-router NAT scenarios. A
 *  TURN server would be needed for symmetric NATs but adds infra cost; ship
 *  STUN-only for now and add TURN later if reliability demands it. */
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

export class VoiceChannel {
  private socket: IOSocket
  private selfUserId: string
  private localStream: MediaStream | null = null
  private peers = new Map<string, PeerEntry>()
  private destroyed = false
  private joined = false

  /** Called whenever the set of connected peer userIds changes. */
  onPeersChanged: ((peerUserIds: string[]) => void) | null = null
  /** Called when the local mic permission is denied or capture fails. */
  onMicError: ((err: Error) => void) | null = null

  constructor(opts: VoiceChannelOptions) {
    this.socket = opts.socket
    this.selfUserId = opts.selfUserId
  }

  /**
   * Request microphone permission, capture audio, and join the room's voice
   * channel. Resolves once mic capture succeeds (peer connections are then
   * negotiated asynchronously as `voice:peer-joined` events arrive).
   */
  async start(): Promise<void> {
    if (this.destroyed) throw new Error('VoiceChannel destroyed')
    if (this.joined) return
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      })
    } catch (err) {
      const e = err as Error
      log.warn('mic permission denied or capture failed', { message: e.message })
      this.onMicError?.(e)
      throw e
    }

    this.attachSocketListeners()
    this.joined = true
    log.info('voice:join')
    this.socket.emit('voice:join')
  }

  /** Toggle the local microphone track without renegotiating peer connections. */
  setMicEnabled(enabled: boolean): void {
    if (!this.localStream) return
    for (const track of this.localStream.getAudioTracks()) {
      track.enabled = enabled
    }
  }

  /** Mute or unmute a single remote peer's audio output (local only). */
  setRemoteMuted(userId: string, muted: boolean): void {
    const peer = this.peers.get(userId)
    if (peer) peer.audioEl.muted = muted
  }

  /** Returns the current list of connected peer userIds. */
  getPeerUserIds(): string[] {
    return [...this.peers.keys()]
  }

  /** Tear down all peer connections, release the mic, and leave the channel. */
  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    if (this.joined) {
      try { this.socket.emit('voice:leave') } catch {}
      this.joined = false
    }
    this.detachSocketListeners()
    for (const [userId] of this.peers) this.removePeer(userId)
    if (this.localStream) {
      for (const t of this.localStream.getTracks()) t.stop()
      this.localStream = null
    }
  }

  // ── Socket signaling ──────────────────────────────────────────────────────

  private onPeers = ({ peerUserIds }: { peerUserIds: string[] }) => {
    log.info('voice:peers', { peerUserIds })
    for (const userId of peerUserIds) {
      // Existing peers — we initiate if our id is lexicographically smaller.
      const initiator = this.selfUserId < userId
      this.ensurePeer(userId, initiator).catch((err) =>
        log.error('ensurePeer failed', { userId, message: (err as Error).message }),
      )
    }
  }

  private onPeerJoined = ({ userId }: { userId: string }) => {
    if (userId === this.selfUserId) return
    log.info('voice:peer-joined', { userId })
    // For a fresh peer-joined event the existing peer (us) initiates if our
    // id is smaller; otherwise we wait for their offer.
    const initiator = this.selfUserId < userId
    this.ensurePeer(userId, initiator).catch((err) =>
      log.error('ensurePeer failed', { userId, message: (err as Error).message }),
    )
  }

  private onPeerLeft = ({ userId }: { userId: string }) => {
    log.info('voice:peer-left', { userId })
    this.removePeer(userId)
  }

  private onSignal = async ({ fromUserId, signal }: { fromUserId: string; signal: unknown }) => {
    const data = signal as { type?: 'offer' | 'answer'; sdp?: string; candidate?: RTCIceCandidateInit }
    let peer = this.peers.get(fromUserId)
    if (!peer) {
      // Late offer from a peer that joined before us — accept and respond.
      peer = await this.ensurePeer(fromUserId, false)
    }
    try {
      if (data.type === 'offer' && data.sdp) {
        await peer.pc.setRemoteDescription({ type: 'offer', sdp: data.sdp })
        const answer = await peer.pc.createAnswer()
        await peer.pc.setLocalDescription(answer)
        this.socket.emit('voice:signal', {
          toUserId: fromUserId,
          signal: { type: 'answer', sdp: answer.sdp },
        })
      } else if (data.type === 'answer' && data.sdp) {
        await peer.pc.setRemoteDescription({ type: 'answer', sdp: data.sdp })
      } else if (data.candidate) {
        try {
          await peer.pc.addIceCandidate(data.candidate)
        } catch (err) {
          // Ignore candidates that arrive before the remote description is set
          // — the browser will queue what it can and harmless ones can be
          // safely dropped.
          log.warn('addIceCandidate failed', { fromUserId, message: (err as Error).message })
        }
      }
    } catch (err) {
      log.error('signal handling error', { fromUserId, message: (err as Error).message })
    }
  }

  private attachSocketListeners(): void {
    // `as any` because socket.io-client's typed signature for `.on` is strict
    // about ServerToClientEvents key inference inside generic classes; the
    // shared types do declare these events.
    this.socket.on('voice:peers' as any, this.onPeers as any)
    this.socket.on('voice:peer-joined' as any, this.onPeerJoined as any)
    this.socket.on('voice:peer-left' as any, this.onPeerLeft as any)
    this.socket.on('voice:signal' as any, this.onSignal as any)
  }

  private detachSocketListeners(): void {
    this.socket.off('voice:peers' as any, this.onPeers as any)
    this.socket.off('voice:peer-joined' as any, this.onPeerJoined as any)
    this.socket.off('voice:peer-left' as any, this.onPeerLeft as any)
    this.socket.off('voice:signal' as any, this.onSignal as any)
  }

  // ── Peer connection management ────────────────────────────────────────────

  private async ensurePeer(userId: string, initiator: boolean): Promise<PeerEntry> {
    const existing = this.peers.get(userId)
    if (existing) return existing

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })

    // Attach our local audio tracks so the remote end can hear us.
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        pc.addTrack(track, this.localStream)
      }
    }

    // Hidden <audio> sink — autoplay so remote audio plays as soon as it
    // arrives. Browsers allow audio autoplay after a user gesture (the user
    // already clicked "Enable mic" to get here, which counts).
    const audioEl = document.createElement('audio')
    audioEl.autoplay = true
    // `playsinline` is not on the HTMLAudioElement DOM type but Safari still
    // respects the HTML attribute for inline playback on iOS, so set via
    // setAttribute instead of the (video-only) JS property.
    audioEl.setAttribute('playsinline', '')
    // Don't add to DOM (no UI needed) — but Safari historically required
    // the element to be in the DOM. Append hidden as a defensive measure.
    audioEl.style.display = 'none'
    document.body.appendChild(audioEl)

    pc.ontrack = (ev) => {
      // First stream wins; remote peer only sends one audio stream.
      const [stream] = ev.streams
      if (stream) audioEl.srcObject = stream
    }

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        this.socket.emit('voice:signal', {
          toUserId: userId,
          signal: { candidate: ev.candidate.toJSON() },
        })
      }
    }

    pc.onconnectionstatechange = () => {
      log.info('peer connection state', { userId, state: pc.connectionState })
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.removePeer(userId)
      }
    }

    const entry: PeerEntry = { pc, audioEl, initiator }
    this.peers.set(userId, entry)
    this.notifyPeersChanged()

    if (initiator) {
      try {
        const offer = await pc.createOffer({ offerToReceiveAudio: true })
        await pc.setLocalDescription(offer)
        this.socket.emit('voice:signal', {
          toUserId: userId,
          signal: { type: 'offer', sdp: offer.sdp },
        })
      } catch (err) {
        log.error('createOffer failed', { userId, message: (err as Error).message })
      }
    }

    return entry
  }

  private removePeer(userId: string): void {
    const peer = this.peers.get(userId)
    if (!peer) return
    try { peer.pc.close() } catch {}
    try {
      peer.audioEl.srcObject = null
      peer.audioEl.remove()
    } catch {}
    this.peers.delete(userId)
    this.notifyPeersChanged()
  }

  private notifyPeersChanged(): void {
    this.onPeersChanged?.(this.getPeerUserIds())
  }
}
