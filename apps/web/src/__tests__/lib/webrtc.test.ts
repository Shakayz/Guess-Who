/**
 * webrtc.test.ts
 *
 * Unit tests for VoiceChannel. jsdom does not provide real WebRTC, so we
 * install stub classes on the global object before importing the module —
 * the tests exercise the signaling protocol end-to-end (polite-peer
 * initiator selection, offer/answer/ICE exchange, mute, teardown) without
 * needing a real browser or backend.
 *
 * What's deliberately NOT covered here: whether actual audio bytes flow
 * between peers over a real ICE/SRTP connection. That's a browser-interop
 * concern and only a true E2E (two real browsers + STUN) can verify it.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── RTCPeerConnection stub ────────────────────────────────────────────────
// We track every instance created so tests can inspect / drive them.

interface StubPC {
  _remoteDesc: RTCSessionDescriptionInit | null
  _localDesc: RTCSessionDescriptionInit | null
  _addedTracks: MediaStreamTrack[]
  _addedCandidates: RTCIceCandidateInit[]
  _closed: boolean
  connectionState: RTCPeerConnectionState
  onicecandidate: ((ev: { candidate: RTCIceCandidate | null }) => void) | null
  ontrack: ((ev: { streams: MediaStream[] }) => void) | null
  onconnectionstatechange: (() => void) | null
  addTrack: (t: MediaStreamTrack, s: MediaStream) => void
  setRemoteDescription: (d: RTCSessionDescriptionInit) => Promise<void>
  setLocalDescription: (d: RTCSessionDescriptionInit) => Promise<void>
  createOffer: () => Promise<RTCSessionDescriptionInit>
  createAnswer: () => Promise<RTCSessionDescriptionInit>
  addIceCandidate: (c: RTCIceCandidateInit) => Promise<void>
  close: () => void
  /** Test helper: simulate the browser firing onicecandidate. */
  _fireIce: (candidate: RTCIceCandidateInit | null) => void
  /** Test helper: simulate a remote track arriving. */
  _fireTrack: (stream: MediaStream) => void
  /** Test helper: simulate connection state change. */
  _setState: (state: RTCPeerConnectionState) => void
}

const pcInstances: StubPC[] = []

class FakeRTCPeerConnection implements StubPC {
  _remoteDesc: RTCSessionDescriptionInit | null = null
  _localDesc: RTCSessionDescriptionInit | null = null
  _addedTracks: MediaStreamTrack[] = []
  _addedCandidates: RTCIceCandidateInit[] = []
  _closed = false
  connectionState: RTCPeerConnectionState = 'new'
  onicecandidate: StubPC['onicecandidate'] = null
  ontrack: StubPC['ontrack'] = null
  onconnectionstatechange: StubPC['onconnectionstatechange'] = null

  constructor(_config?: RTCConfiguration) {
    pcInstances.push(this)
  }
  addTrack(t: MediaStreamTrack, _s: MediaStream) { this._addedTracks.push(t) }
  async setRemoteDescription(d: RTCSessionDescriptionInit) { this._remoteDesc = d }
  async setLocalDescription(d: RTCSessionDescriptionInit) { this._localDesc = d }
  async createOffer(): Promise<RTCSessionDescriptionInit> {
    return { type: 'offer', sdp: 'v=offer' }
  }
  async createAnswer(): Promise<RTCSessionDescriptionInit> {
    return { type: 'answer', sdp: 'v=answer' }
  }
  async addIceCandidate(c: RTCIceCandidateInit) { this._addedCandidates.push(c) }
  close() { this._closed = true }
  _fireIce(candidate: RTCIceCandidateInit | null) {
    this.onicecandidate?.({ candidate: candidate as unknown as RTCIceCandidate })
  }
  _fireTrack(stream: MediaStream) {
    this.ontrack?.({ streams: [stream] })
  }
  _setState(state: RTCPeerConnectionState) {
    this.connectionState = state
    this.onconnectionstatechange?.()
  }
}

// ── MediaStream stubs ─────────────────────────────────────────────────────

class FakeTrack {
  enabled = true
  kind = 'audio'
  stopped = false
  stop() { this.stopped = true }
}

class FakeMediaStream {
  private _tracks: FakeTrack[]
  constructor(tracks: FakeTrack[]) { this._tracks = tracks }
  getTracks() { return this._tracks }
  getAudioTracks() { return this._tracks.filter((t) => t.kind === 'audio') }
}

// ── Install on global before importing VoiceChannel ───────────────────────

;(globalThis as any).RTCPeerConnection = FakeRTCPeerConnection

// navigator.mediaDevices isn't on jsdom — assemble a writable stub.
const getUserMediaMock = vi.fn()
Object.defineProperty(navigator, 'mediaDevices', {
  configurable: true,
  value: { getUserMedia: getUserMediaMock },
})

import { VoiceChannel } from '../../lib/webrtc'

// ── Socket stub ───────────────────────────────────────────────────────────

function makeSocket() {
  const listeners = new Map<string, Function[]>()
  const emit = vi.fn()
  const on = vi.fn((event: string, cb: Function) => {
    const arr = listeners.get(event) ?? []
    arr.push(cb)
    listeners.set(event, arr)
  })
  const off = vi.fn((event: string, cb: Function) => {
    const arr = listeners.get(event) ?? []
    listeners.set(event, arr.filter((c) => c !== cb))
  })
  return {
    emit,
    on,
    off,
    /** Fire a server-to-client event on all matching listeners. */
    _fire(event: string, payload?: any) {
      for (const cb of listeners.get(event) ?? []) cb(payload)
    },
  } as any
}

// ── Shared reset ──────────────────────────────────────────────────────────

beforeEach(() => {
  pcInstances.length = 0
  getUserMediaMock.mockReset()
  // Default: mic available with one audio track
  getUserMediaMock.mockImplementation(async () => new FakeMediaStream([new FakeTrack()]) as any)
})

afterEach(() => {
  // Clean up any <audio> elements appended by VoiceChannel
  document.querySelectorAll('audio').forEach((el) => el.remove())
})

// ── start() ───────────────────────────────────────────────────────────────

describe('VoiceChannel.start', () => {
  it('requests mic audio (no video) and emits voice:join', async () => {
    const socket = makeSocket()
    const vc = new VoiceChannel({ socket, selfUserId: 'u1' })
    await vc.start()

    expect(getUserMediaMock).toHaveBeenCalledWith(expect.objectContaining({
      audio: expect.any(Object),
      video: false,
    }))
    expect(socket.emit).toHaveBeenCalledWith('voice:join')
    vc.destroy()
  })

  it('calls onMicError and rejects when permission is denied', async () => {
    const denyErr = Object.assign(new Error('denied'), { name: 'NotAllowedError' })
    getUserMediaMock.mockRejectedValueOnce(denyErr)
    const socket = makeSocket()
    const onMicError = vi.fn()
    const vc = new VoiceChannel({ socket, selfUserId: 'u1' })
    vc.onMicError = onMicError

    await expect(vc.start()).rejects.toBe(denyErr)
    expect(onMicError).toHaveBeenCalledWith(denyErr)
    // Must NOT have joined the voice channel on the server if mic failed.
    expect(socket.emit).not.toHaveBeenCalled()
  })

  it('is idempotent — calling start twice does not double-join', async () => {
    const socket = makeSocket()
    const vc = new VoiceChannel({ socket, selfUserId: 'u1' })
    await vc.start()
    await vc.start()
    expect(socket.emit).toHaveBeenCalledTimes(1)
    expect(getUserMediaMock).toHaveBeenCalledTimes(1)
    vc.destroy()
  })
})

// ── Initiator selection (polite-peer via userId comparison) ──────────────

describe('VoiceChannel initiator selection', () => {
  it("initiates the offer when self userId is lexicographically smaller than the peer's", async () => {
    const socket = makeSocket()
    const vc = new VoiceChannel({ socket, selfUserId: 'a' })
    await vc.start()

    socket._fire('voice:peers', { peerUserIds: ['b'] })
    // Allow the async ensurePeer→createOffer chain to resolve.
    await new Promise((r) => setTimeout(r, 0))

    // Exactly one PC created for peer 'b'
    expect(pcInstances).toHaveLength(1)
    // We should have sent an offer via voice:signal
    expect(socket.emit).toHaveBeenCalledWith('voice:signal', {
      toUserId: 'b',
      signal: { type: 'offer', sdp: 'v=offer' },
    })
    vc.destroy()
  })

  it('does NOT initiate when self userId is lexicographically greater — waits for remote offer', async () => {
    const socket = makeSocket()
    const vc = new VoiceChannel({ socket, selfUserId: 'z' })
    await vc.start()

    socket._fire('voice:peers', { peerUserIds: ['a'] })
    await new Promise((r) => setTimeout(r, 0))

    expect(pcInstances).toHaveLength(1)
    // Only voice:join was emitted, no offer
    const signalCalls = (socket.emit as any).mock.calls.filter((c: any[]) => c[0] === 'voice:signal')
    expect(signalCalls).toHaveLength(0)
    vc.destroy()
  })

  it('creates one PC per peer from voice:peers and emits onPeersChanged', async () => {
    const socket = makeSocket()
    const vc = new VoiceChannel({ socket, selfUserId: 'm' })
    const onPeersChanged = vi.fn()
    vc.onPeersChanged = onPeersChanged
    await vc.start()

    socket._fire('voice:peers', { peerUserIds: ['a', 'z'] })
    await new Promise((r) => setTimeout(r, 0))

    expect(pcInstances).toHaveLength(2)
    expect(vc.getPeerUserIds().sort()).toEqual(['a', 'z'])
    // onPeersChanged fired at least twice (once per peer added)
    expect(onPeersChanged).toHaveBeenCalled()
  })
})

// ── voice:peer-joined / peer-left ────────────────────────────────────────

describe('VoiceChannel peer join/leave', () => {
  it('creates a PC and initiates when a smaller-id peer joins later', async () => {
    const socket = makeSocket()
    const vc = new VoiceChannel({ socket, selfUserId: 'a' })
    await vc.start()

    socket._fire('voice:peer-joined', { userId: 'b' })
    await new Promise((r) => setTimeout(r, 0))

    expect(pcInstances).toHaveLength(1)
    expect(socket.emit).toHaveBeenCalledWith('voice:signal', {
      toUserId: 'b',
      signal: { type: 'offer', sdp: 'v=offer' },
    })
    vc.destroy()
  })

  it('ignores voice:peer-joined for self (defensive)', async () => {
    const socket = makeSocket()
    const vc = new VoiceChannel({ socket, selfUserId: 'a' })
    await vc.start()

    socket._fire('voice:peer-joined', { userId: 'a' })
    await new Promise((r) => setTimeout(r, 0))

    expect(pcInstances).toHaveLength(0)
    vc.destroy()
  })

  it('closes the PC and updates peer list on voice:peer-left', async () => {
    const socket = makeSocket()
    const onPeersChanged = vi.fn()
    const vc = new VoiceChannel({ socket, selfUserId: 'a' })
    vc.onPeersChanged = onPeersChanged
    await vc.start()

    socket._fire('voice:peer-joined', { userId: 'b' })
    await new Promise((r) => setTimeout(r, 0))
    expect(pcInstances).toHaveLength(1)

    socket._fire('voice:peer-left', { userId: 'b' })
    expect(pcInstances[0]._closed).toBe(true)
    expect(vc.getPeerUserIds()).toEqual([])
    // Final callback shows empty peer list
    expect(onPeersChanged).toHaveBeenLastCalledWith([])
    vc.destroy()
  })
})

// ── Signal handling (offer / answer / ICE) ───────────────────────────────

describe('VoiceChannel.onSignal', () => {
  it('accepts a late offer from a peer we have not ensurePeer-ed yet and responds with an answer', async () => {
    const socket = makeSocket()
    const vc = new VoiceChannel({ socket, selfUserId: 'z' })
    await vc.start()

    // `a` is smaller-id so they initiate; we receive their offer first.
    socket._fire('voice:signal', {
      fromUserId: 'a',
      signal: { type: 'offer', sdp: 'v=from-a' },
    })
    await new Promise((r) => setTimeout(r, 0))

    expect(pcInstances).toHaveLength(1)
    expect(pcInstances[0]._remoteDesc).toEqual({ type: 'offer', sdp: 'v=from-a' })
    expect(pcInstances[0]._localDesc).toEqual({ type: 'answer', sdp: 'v=answer' })
    expect(socket.emit).toHaveBeenCalledWith('voice:signal', {
      toUserId: 'a',
      signal: { type: 'answer', sdp: 'v=answer' },
    })
    vc.destroy()
  })

  it('applies an answer as the remote description on an existing PC', async () => {
    const socket = makeSocket()
    const vc = new VoiceChannel({ socket, selfUserId: 'a' })
    await vc.start()

    socket._fire('voice:peer-joined', { userId: 'b' })
    await new Promise((r) => setTimeout(r, 0))
    // We initiated — local desc is our offer. Now the answer comes back.
    socket._fire('voice:signal', {
      fromUserId: 'b',
      signal: { type: 'answer', sdp: 'v=from-b' },
    })
    await new Promise((r) => setTimeout(r, 0))

    expect(pcInstances[0]._remoteDesc).toEqual({ type: 'answer', sdp: 'v=from-b' })
    vc.destroy()
  })

  it('forwards ICE candidates to the matching PC via addIceCandidate', async () => {
    const socket = makeSocket()
    const vc = new VoiceChannel({ socket, selfUserId: 'a' })
    await vc.start()

    socket._fire('voice:peer-joined', { userId: 'b' })
    await new Promise((r) => setTimeout(r, 0))

    const cand: RTCIceCandidateInit = { candidate: 'candidate:1 1 udp ...', sdpMid: '0', sdpMLineIndex: 0 }
    socket._fire('voice:signal', { fromUserId: 'b', signal: { candidate: cand } })
    await new Promise((r) => setTimeout(r, 0))

    expect(pcInstances[0]._addedCandidates).toEqual([cand])
    vc.destroy()
  })

  it('emits voice:signal with the ICE candidate when the PC produces one', async () => {
    const socket = makeSocket()
    const vc = new VoiceChannel({ socket, selfUserId: 'a' })
    await vc.start()

    socket._fire('voice:peer-joined', { userId: 'b' })
    await new Promise((r) => setTimeout(r, 0))

    const cand = {
      toJSON: () => ({ candidate: 'candidate:42 1 udp ...' }),
    } as unknown as RTCIceCandidate
    pcInstances[0]._fireIce(cand as any)

    expect(socket.emit).toHaveBeenCalledWith('voice:signal', {
      toUserId: 'b',
      signal: { candidate: { candidate: 'candidate:42 1 udp ...' } },
    })
    vc.destroy()
  })

  it('drops null ICE candidates (end-of-candidates) without emitting', async () => {
    const socket = makeSocket()
    const vc = new VoiceChannel({ socket, selfUserId: 'a' })
    await vc.start()

    socket._fire('voice:peer-joined', { userId: 'b' })
    await new Promise((r) => setTimeout(r, 0))

    const emitCountBefore = (socket.emit as any).mock.calls.length
    pcInstances[0]._fireIce(null)
    expect((socket.emit as any).mock.calls.length).toBe(emitCountBefore)
    vc.destroy()
  })
})

// ── Mute / remote mute ───────────────────────────────────────────────────

describe('VoiceChannel mute controls', () => {
  it('setMicEnabled toggles track.enabled on all local audio tracks', async () => {
    const track = new FakeTrack()
    getUserMediaMock.mockResolvedValueOnce(new FakeMediaStream([track]) as any)
    const socket = makeSocket()
    const vc = new VoiceChannel({ socket, selfUserId: 'a' })
    await vc.start()

    vc.setMicEnabled(false)
    expect(track.enabled).toBe(false)
    vc.setMicEnabled(true)
    expect(track.enabled).toBe(true)
    vc.destroy()
  })

  it('setRemoteMuted mutes the <audio> element for that peer only', async () => {
    const socket = makeSocket()
    const vc = new VoiceChannel({ socket, selfUserId: 'a' })
    await vc.start()

    socket._fire('voice:peer-joined', { userId: 'b' })
    await new Promise((r) => setTimeout(r, 0))

    // Before toggling, audio is unmuted (default)
    const audioEls = document.querySelectorAll('audio')
    expect(audioEls).toHaveLength(1)
    expect((audioEls[0] as HTMLAudioElement).muted).toBe(false)

    vc.setRemoteMuted('b', true)
    expect((audioEls[0] as HTMLAudioElement).muted).toBe(true)

    vc.setRemoteMuted('b', false)
    expect((audioEls[0] as HTMLAudioElement).muted).toBe(false)
    vc.destroy()
  })

  it('setRemoteMuted is a no-op for an unknown peer (does not throw)', async () => {
    const socket = makeSocket()
    const vc = new VoiceChannel({ socket, selfUserId: 'a' })
    await vc.start()

    expect(() => vc.setRemoteMuted('nobody', true)).not.toThrow()
    vc.destroy()
  })
})

// ── Connection state + teardown ──────────────────────────────────────────

describe('VoiceChannel lifecycle', () => {
  it('drops a peer whose connection enters the "failed" state', async () => {
    const socket = makeSocket()
    const onPeersChanged = vi.fn()
    const vc = new VoiceChannel({ socket, selfUserId: 'a' })
    vc.onPeersChanged = onPeersChanged
    await vc.start()

    socket._fire('voice:peer-joined', { userId: 'b' })
    await new Promise((r) => setTimeout(r, 0))
    expect(vc.getPeerUserIds()).toEqual(['b'])

    pcInstances[0]._setState('failed')
    expect(pcInstances[0]._closed).toBe(true)
    expect(vc.getPeerUserIds()).toEqual([])
  })

  it('destroy() closes all PCs, stops local tracks, emits voice:leave, and detaches listeners', async () => {
    const track = new FakeTrack()
    getUserMediaMock.mockResolvedValueOnce(new FakeMediaStream([track]) as any)
    const socket = makeSocket()
    const vc = new VoiceChannel({ socket, selfUserId: 'a' })
    await vc.start()
    socket._fire('voice:peer-joined', { userId: 'b' })
    socket._fire('voice:peer-joined', { userId: 'c' })
    await new Promise((r) => setTimeout(r, 0))
    expect(pcInstances).toHaveLength(2)

    vc.destroy()

    // All PCs closed
    for (const pc of pcInstances) expect(pc._closed).toBe(true)
    // Local track stopped
    expect(track.stopped).toBe(true)
    // voice:leave sent to the server
    expect(socket.emit).toHaveBeenCalledWith('voice:leave')
    // All listeners detached
    expect(socket.off).toHaveBeenCalled()
    // Post-destroy state
    expect(vc.getPeerUserIds()).toEqual([])

    // A second destroy() must be a no-op — no duplicate voice:leave.
    const leaveCalls = (socket.emit as any).mock.calls.filter((c: any[]) => c[0] === 'voice:leave')
    vc.destroy()
    const leaveCallsAfter = (socket.emit as any).mock.calls.filter((c: any[]) => c[0] === 'voice:leave')
    expect(leaveCallsAfter.length).toBe(leaveCalls.length)
  })

  it('attaches received remote stream to the per-peer <audio> element on track event', async () => {
    const socket = makeSocket()
    const vc = new VoiceChannel({ socket, selfUserId: 'a' })
    await vc.start()

    socket._fire('voice:peer-joined', { userId: 'b' })
    await new Promise((r) => setTimeout(r, 0))

    const remoteStream = new FakeMediaStream([new FakeTrack()]) as unknown as MediaStream
    pcInstances[0]._fireTrack(remoteStream)

    const audioEl = document.querySelector('audio') as HTMLAudioElement
    expect(audioEl).toBeTruthy()
    expect((audioEl as any).srcObject).toBe(remoteStream)
    vc.destroy()
  })
})
