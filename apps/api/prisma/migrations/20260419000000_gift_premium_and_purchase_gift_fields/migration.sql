-- Premium gifting: the Gift row can now deliver either coins (existing) or a
-- Premium extension (new). `premiumPlanId` matches a shared PremiumPlan id —
-- 'monthly' | 'yearly' — and the claim route extends the receiver's
-- premiumUntil by the plan interval on claim.
ALTER TABLE "gifts" ADD COLUMN "premiumPlanId" VARCHAR(16);

-- Shop-funded gifts. When a buyer pays real money for a gift, a Purchase row
-- is still stamped (payment trail, idempotency), but on completion we deliver
-- entitlement to `giftReceiverId` via a Gift row instead of crediting the
-- buyer. `premiumPlanId` flags premium gifts so the webhook knows which path
-- to take (coin-pack gifts vs premium gifts).
ALTER TABLE "purchases" ADD COLUMN "giftReceiverId" TEXT;
ALTER TABLE "purchases" ADD COLUMN "premiumPlanId" VARCHAR(16);
