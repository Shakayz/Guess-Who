// Browser-tab attention utilities: favicon badge, title prefix, and optional
// Web Notifications. Used to surface new invites/DMs/matches while the user is
// on a different tab.

const ORIGINAL_TITLE = typeof document !== 'undefined' ? document.title : 'Red Handed !'
const FAVICON_SELECTOR = 'link[rel="icon"]'
const FAVICON_SRC = '/masks.png'

let originalFaviconHref: string | null = null
let baseIconImage: HTMLImageElement | null = null
let currentCount = 0

function getFaviconLink(): HTMLLinkElement | null {
  if (typeof document === 'undefined') return null
  return document.querySelector<HTMLLinkElement>(FAVICON_SELECTOR)
}

function loadBaseIcon(): Promise<HTMLImageElement> {
  if (baseIconImage && baseIconImage.complete && baseIconImage.naturalWidth > 0) {
    return Promise.resolve(baseIconImage)
  }
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      baseIconImage = img
      resolve(img)
    }
    img.onerror = reject
    img.src = FAVICON_SRC
  })
}

async function renderBadgeDataUrl(count: number): Promise<string | null> {
  try {
    const img = await loadBaseIcon()
    const size = 64
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(img, 0, 0, size, size)

    const r = size * 0.32
    const cx = size - r
    const cy = r
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fillStyle = '#ef4444'
    ctx.fill()
    ctx.strokeStyle = '#0a0a0a'
    ctx.lineWidth = size * 0.05
    ctx.stroke()

    if (count > 0) {
      const label = count > 9 ? '9+' : String(count)
      ctx.fillStyle = '#ffffff'
      ctx.font = `bold ${Math.round(r * 1.1)}px Inter, system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(label, cx, cy + 1)
    }
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}

export async function setBadge(count: number): Promise<void> {
  if (typeof document === 'undefined') return
  currentCount = Math.max(0, count)

  const link = getFaviconLink()
  if (!link) return
  if (originalFaviconHref === null) originalFaviconHref = link.href

  const dataUrl = await renderBadgeDataUrl(currentCount)
  if (dataUrl) link.href = dataUrl

  document.title = currentCount > 0
    ? `(${currentCount > 9 ? '9+' : currentCount}) ${ORIGINAL_TITLE}`
    : ORIGINAL_TITLE
}

export function incrementBadge(): void {
  void setBadge(currentCount + 1)
}

export function clearBadge(): void {
  if (typeof document === 'undefined') return
  currentCount = 0
  document.title = ORIGINAL_TITLE
  const link = getFaviconLink()
  if (link && originalFaviconHref !== null) link.href = originalFaviconHref
}

let permissionRequested = false

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  if (Notification.permission !== 'default') return Notification.permission
  if (permissionRequested) return Notification.permission
  permissionRequested = true
  try {
    return await Notification.requestPermission()
  } catch {
    return Notification.permission
  }
}

export function showBrowserNotification(
  title: string,
  body: string,
  options?: { onClick?: () => void; tag?: string },
): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  // Only fire if the tab is hidden — otherwise in-app toasts already cover it.
  if (!document.hidden) return
  try {
    const n = new Notification(title, {
      body,
      icon: FAVICON_SRC,
      tag: options?.tag,
    })
    n.onclick = () => {
      try {
        window.focus()
        options?.onClick?.()
      } finally {
        n.close()
      }
    }
  } catch {
    // Some browsers throw if called from a non-user-gesture context; ignore.
  }
}
