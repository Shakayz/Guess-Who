-- The Purchase model was added to schema.prisma alongside the Stripe Checkout
-- work but never had an accompanying migration, so staging had no `purchases`
-- table. Every /shop/checkout call created a real Stripe session, then
-- crashed when prisma.purchase.create tried to insert into a table that
-- didn't exist — surfaced to the user as "Could not record purchase".
CREATE TABLE "purchases" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "goldCoins" INTEGER NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "currency" VARCHAR(5) NOT NULL DEFAULT 'usd',
    "stripeSessionId" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchases_pkey" PRIMARY KEY ("id")
);

-- Unique on stripeSessionId so the webhook can idempotently flip
-- pending → completed without risking duplicate rows on retries.
CREATE UNIQUE INDEX "purchases_stripeSessionId_key" ON "purchases"("stripeSessionId");

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
