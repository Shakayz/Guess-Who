// Simple proxy: forwards all HTTP + WebSocket traffic from :5174 → Docker:5173
const http = require('http')
const net = require('net')

const TARGET_PORT = 5173
const PROXY_PORT = 5174

const server = http.createServer((req, res) => {
  const opts = {
    hostname: 'localhost', port: TARGET_PORT,
    path: req.url, method: req.method, headers: req.headers,
  }
  const proxy = http.request(opts, (r) => {
    res.writeHead(r.statusCode, r.headers)
    r.pipe(res)
  })
  proxy.on('error', () => res.end())
  req.pipe(proxy)
})

// WebSocket / HMR upgrade (Vite uses this)
server.on('upgrade', (req, socket, head) => {
  const conn = net.createConnection(TARGET_PORT, 'localhost', () => {
    conn.write(
      `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n` +
      Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n') +
      '\r\n\r\n'
    )
    if (head && head.length) conn.write(head)
    socket.pipe(conn)
    conn.pipe(socket)
  })
  conn.on('error', () => socket.destroy())
  socket.on('error', () => conn.destroy())
})

server.listen(PROXY_PORT, () => console.log(`Dev proxy :${PROXY_PORT} → Docker :${TARGET_PORT}`))
