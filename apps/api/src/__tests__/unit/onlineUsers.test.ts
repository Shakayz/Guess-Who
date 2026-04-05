import { describe, it, expect, beforeEach } from 'vitest'
import { onlineUsers } from '@/socket/onlineUsers'

describe('onlineUsers', () => {
  beforeEach(() => {
    onlineUsers.clear()
  })

  it('starts empty', () => {
    expect(onlineUsers.size).toBe(0)
  })

  it('adds a userId -> socketId mapping', () => {
    onlineUsers.set('user-1', 'socket-abc')
    expect(onlineUsers.get('user-1')).toBe('socket-abc')
  })

  it('overwrites an existing mapping with the most recent socketId', () => {
    onlineUsers.set('user-1', 'socket-old')
    onlineUsers.set('user-1', 'socket-new')
    expect(onlineUsers.get('user-1')).toBe('socket-new')
    expect(onlineUsers.size).toBe(1)
  })

  it('removes a userId mapping', () => {
    onlineUsers.set('user-1', 'socket-abc')
    onlineUsers.delete('user-1')
    expect(onlineUsers.has('user-1')).toBe(false)
  })

  it('tracks multiple users independently', () => {
    onlineUsers.set('user-1', 'socket-1')
    onlineUsers.set('user-2', 'socket-2')
    onlineUsers.set('user-3', 'socket-3')
    expect(onlineUsers.size).toBe(3)
    expect(onlineUsers.get('user-2')).toBe('socket-2')
  })

  it('returns undefined for unknown userIds', () => {
    expect(onlineUsers.get('no-such-user')).toBeUndefined()
  })
})
