-- Launch hardening: WhatsApp connect wizard, customer profile fields,
-- booking attribution, and the scale-time index pack.
--
-- Safe to apply against an existing production DB — all columns added
-- nullable or with defaults; all indexes use IF NOT EXISTS where the
-- planner allows.

-- ─── vendors: WhatsApp connection state (Connect Wizard) ─────────────────
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "whatsapp_provider"             varchar(20)  NOT NULL DEFAULT 'none';
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "whatsapp_status"               varchar(20)  NOT NULL DEFAULT 'not_connected';
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "whatsapp_verified_at"          timestamp;
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "whatsapp_last_error"           text;
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "whatsapp_unifonic_app_sid"     text;
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "whatsapp_unifonic_sender_id"   varchar(32);
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "whatsapp_unifonic_api_key"     text;
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "whatsapp_notifications"        jsonb DEFAULT '{}'::jsonb;
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "whatsapp_plan"                 varchar(20)  NOT NULL DEFAULT 'none';
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "whatsapp_messages_used"        integer      NOT NULL DEFAULT 0;
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "whatsapp_messages_quota"       integer      NOT NULL DEFAULT 0;
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "whatsapp_quota_reset_at"       timestamp;

-- ─── customers: profile + PDPL preference fields ─────────────────────────
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "address"                  text;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "preferred_language"       varchar(5)   DEFAULT 'ar';
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "preferred_contact_method" varchar(20)  DEFAULT 'whatsapp';
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "updated_at"               timestamp    NOT NULL DEFAULT NOW();

-- ─── bookings: deposit + marketing attribution ───────────────────────────
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "deposit_amount"  numeric(10,2)  DEFAULT 0;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "utm_source"      varchar(100);
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "utm_medium"      varchar(100);
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "utm_campaign"    varchar(100);

-- ─── Scale indexes — required for the marketing-campaign load ────────────
CREATE INDEX IF NOT EXISTS "idx_vendors_subscription_status" ON "vendors" ("subscription_status");
CREATE INDEX IF NOT EXISTS "idx_vendors_industry"            ON "vendors" ("industry");
CREATE INDEX IF NOT EXISTS "idx_vendors_active"              ON "vendors" ("is_active");
CREATE INDEX IF NOT EXISTS "idx_vendors_created"             ON "vendors" ("created_at");

CREATE INDEX IF NOT EXISTS "idx_users_email"                 ON "users" ("email");
CREATE INDEX IF NOT EXISTS "idx_users_firebase_uid"          ON "users" ("firebase_uid");

CREATE INDEX IF NOT EXISTS "idx_bookings_tracking_token"     ON "bookings" ("tracking_token");
CREATE INDEX IF NOT EXISTS "idx_bookings_utm"                ON "bookings" ("utm_source", "utm_campaign");
CREATE INDEX IF NOT EXISTS "idx_bookings_payment_status"     ON "bookings" ("vendor_id", "payment_status");

CREATE INDEX IF NOT EXISTS "idx_payments_booking_id"         ON "payments" ("booking_id");
CREATE INDEX IF NOT EXISTS "idx_payments_gateway_ref"        ON "payments" ("gateway_ref");
CREATE INDEX IF NOT EXISTS "idx_payments_vendor_status"      ON "payments" ("vendor_id", "status");

CREATE INDEX IF NOT EXISTS "idx_vendor_branches_vendor"      ON "vendor_branches" ("vendor_id");

CREATE INDEX IF NOT EXISTS "idx_whatsapp_sessions_vendor"    ON "whatsapp_sessions" ("vendor_id");
CREATE INDEX IF NOT EXISTS "idx_whatsapp_sessions_expires"   ON "whatsapp_sessions" ("expires_at");
