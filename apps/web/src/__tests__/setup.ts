import '@testing-library/jest-dom/vitest'

// Mock scrollIntoView for jsdom
Element.prototype.scrollIntoView = () => {}

// jsdom's HTMLMediaElement.play() returns `undefined` instead of a Promise,
// so any caller doing `audio.play().catch(...)` (e.g. lib/music.ts and
// lib/sounds.ts swallowing the autoplay-policy rejection) crashes with
// "Cannot read properties of undefined (reading 'catch')". Stub a thenable
// resolved promise — same shape the browser returns.
HTMLMediaElement.prototype.play = function () {
  return Promise.resolve()
}
HTMLMediaElement.prototype.pause = function () {
  // jsdom's pause already exists but is a no-op; defining it explicitly is
  // harmless and keeps the polyfill block self-contained.
}
