import * as UIExports from './index'

describe('ui barrel exports', () => {
  it('exports Button component', () => {
    expect(typeof UIExports.Button).toBe('function')
  })

  it('exports Avatar component', () => {
    expect(typeof UIExports.Avatar).toBe('function')
  })

  it('exports Badge component', () => {
    expect(typeof UIExports.Badge).toBe('function')
  })

  it('exports Timer component', () => {
    expect(typeof UIExports.Timer).toBe('function')
  })

  it('exports PlayerCard component', () => {
    expect(typeof UIExports.PlayerCard).toBe('function')
  })

  it('exports RoomCodeDisplay component', () => {
    expect(typeof UIExports.RoomCodeDisplay).toBe('function')
  })
})
