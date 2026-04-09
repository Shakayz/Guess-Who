-- Adds the game_chat_messages table. The GameChatMessage model exists in
-- schema.prisma but was never migrated, which causes GET /api/history/:gameId
-- to return 500 (it includes chatMessages in the Prisma query) and silently
-- drops every in-game chat message persisted via the gamechat:send socket
-- handler in apps/api/src/socket/index.ts.

-- CreateTable
CREATE TABLE "game_chat_messages" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" VARCHAR(20) NOT NULL,
    "text" VARCHAR(500) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_chat_messages_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "game_chat_messages" ADD CONSTRAINT "game_chat_messages_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;
