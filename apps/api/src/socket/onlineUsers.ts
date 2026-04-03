// Shared in-memory map: userId → socketId (most recent connection)
// Using a dedicated module avoids circular imports between index.ts and handlers/gameLoop
export const onlineUsers = new Map<string, string>()
