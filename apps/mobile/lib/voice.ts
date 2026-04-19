/**
 * VoiceChannel (mobile) — WebRTC mesh for vocal mode rounds.
 *
 * Mirrors apps/web/src/lib/webrtc.ts, with the two react-native-specific twists:
 *   1. Uses `react-native-webrtc`'s RTCPeerConnection / mediaDevices, not
 *      browser globals.
 *   2. Remote audio plays automatically once `pc.addTrack(...)` fires on the
 *      other side — there is no DOM audio element to attach. We don't even
 *      need to touch the MediaStream on our side; the native layer routes it.
 *
 * Runtime RECORD_AUDIO permission is requested on Android before calling
 * getUserMedia. iOS triggers its system prompt automatically from the
 * getUserMedia call itself thanks to NSMicrophoneUsageDescription in app.json.
 */

import { Platform, PermissionsAndroid } from 'react-native'
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  mediaDevices,
  type MediaStream,
} from 'react-native-webrtc'
import type { Socket } from 'socket.io-client'
import type { ServerToClientEvents, ClientToServerEvents } from '@red-handed/shared'
import { createLogger } from './logger'

const log = createLogger('voice')

type IOSocket = Socket<ServerToClientEvents, ClientToServerEvents>

interface VoiceChannelOptions {
  socket: IOSocket
  selfUserId: string
}

interface PeerEntry {
  pc: RTCPeerConnection
  initiator: boolean
}

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

async function ensureMicPermissionAndroid(): Promise<boolean> {
  if (Platform.OS !== 'android') return true
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: 'Microphone',
        message: 'Red Handed ! needs the microphone so other players can hear you during vocal mode.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      },
    )
    return granted === PermissionsAndroid.RESULTS.GRANTED
  } catch {
    return false
  }
}

export class VoiceChannel {
  private socket: IOSocket
  private selfUserId: string
  private localStream: MediaStream | null = null
  private peers = new Map<string, PeerEntry>()
  private destroyed = false
  private joined = false

  onPeersChanged: ((peerUserIds: string[]) => void) | null = null
  onMicError: ((err: Error) => void) | null = null

  constructor(opts: VoiceChannelOptions) {
    this.socket = opts.socket
    this.selfUserId = opts.selfUserId
  }

  async start(): Promise<void> {
    if (this.destroyed) throw new Error('VoiceChannel destroyed')
    if (this.joined) return

    const permitted = await ensureMicPermissionAndroid()
    if (!permitted) {
      const err = new Error('Microphone permission denied')
      this.onMicError?.(err)
      throw err
    }

    try {
      this.localStream = (await mediaDevices.getUserMedia({
        audio: true,
        video: false,
      })) as unknown as MediaStream
    } catch (err) {
      const e = err as Error
      log.warn('mic capture failed', { message: e.message })
      this.onMicError?.(e)
      throw e
    }

    this.attachSocketListeners()
    this.joined = true
    log.info('voice:join')
    this.socket.emit('voice:join')
  }

  setMicEnabled(enabled: boolean): void {
    if (!this.localStream) return
    for (const track of this.localStream.getAudioTracks()) {
      track.enabled = enabled
    }
  }

  getPeerUserIds(): string[] {
    return [...this.peers.keys()]
  }

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

  private onPeers = ({ peerUserIds }: { peerUserIds: string[] }) => {
    log.info('voice:peers', { peerUserIds })
    for (const userId of peerUserIds) {
      const initiator = this.selfUserId < userId
      this.ensurePeer(userId, initiator).catch((err) =>
        log.error('ensurePeer failed', { userId, message: (err as Error).message }),
      )
    }
  }

  private onPeerJoined = ({ userId }: { userId: string }) => {
    if (userId === this.selfUserId) return
    log.info('voice:peer-joined', { userId })
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
    const data = signal as { type?: 'offer' | 'answer'; sdp?: string; candidate?: any }
    let peer = this.peers.get(fromUserId)
    if (!peer) {
      peer = await this.ensurePeer(fromUserId, false)
    }
    try {
      if (data.type === 'offer' && data.sdp) {
        await peer.pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: data.sdp }))
        const answer = await peer.pc.createAnswer()
        await peer.pc.setLocalDescription(answer)
        this.socket.emit('voice:signal', {
          toUserId: fromUserId,
          signal: { type: 'answer', sdp: answer.sdp },
        })
      } else if (data.type === 'answer' && data.sdp) {
        await peer.pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: data.sdp }))
      } else if (data.candidate) {
        try {
          await peer.pc.addIceCandidate(new RTCIceCandidate(data.candidate))
        } catch (err) {
          log.warn('addIceCandidate failed', { fromUserId, message: (err as Error).message })
        }
      }
    } catch (err) {
      log.error('signal handling error', { fromUserId, message: (err as Error).message })
    }
  }

  private attachSocketListeners(): void {
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

  private async ensurePeer(userId: string, initiator: boolean): Promise<PeerEntry> {
    const existing = this.peers.get(userId)
    if (existing) return existing

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })

    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        pc.addTrack(track, this.localStream)
      }
    }

    // react-native-webrtc surfaces remote audio automatically through the
    // device's audio route — nothing to attach here, unlike the browser.
    // We keep an ontrack handler for logging only.
    ;(pc as any).addEventListener('track', (ev: any) => {
      log.info('remote track received', { userId, kind: ev.track?.kind })
    })

    ;(pc as any).addEventListener('icecandidate', (ev: any) => {
      if (ev.candidate) {
        this.socket.emit('voice:signal', {
          toUserId: userId,
          signal: {
            candidate: ev.candidate.candidate,
            sdpMid: ev.candidate.sdpMid,
            sdpMLineIndex: ev.candidate.sdpMLineIndex,
          },
        })
      }
    })

    ;(pc as any).addEventListener('connectionstatechange', () => {
      const state = (pc as any).connectionState
      log.info('peer connection state', { userId, state })
      if (state === 'failed' || state === 'closed') {
        this.removePeer(userId)
      }
    })

    const entry: PeerEntry = { pc, initiator }
    this.peers.set(userId, entry)
    this.notifyPeersChanged()

    if (initiator) {
      try {
        const offer = await pc.createOffer({ offerToReceiveAudio: true } as any)
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
    this.peers.delete(userId)
    this.notifyPeersChanged()
  }

  private notifyPeersChanged(): void {
    this.onPeersChanged?.(this.getPeerUserIds())
  }
}
