CREATE TABLE IF NOT EXISTS "mobile_app_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"vendor_id" integer NOT NULL,
	"plan_id" varchar(20) NOT NULL,
	"price_paid_sar" numeric(10, 2) NOT NULL,
	"status" varchar(30) DEFAULT 'pending_payment' NOT NULL,
	"app_name" varchar(100),
	"icon_url" text,
	"primary_color" varchar(7),
	"description" text,
	"keywords" text,
	"privacy_policy_url" text,
	"bundle_id" varchar(200),
	"payment_ref" varchar(100),
	"paid_at" timestamp,
	"android_apk_url" text,
	"ios_project_url" text,
	"github_repo_url" text,
	"manual_url" text,
	"delivered_at" timestamp,
	"support_hours_included" integer DEFAULT 2 NOT NULL,
	"support_hours_used" numeric(5, 2) DEFAULT '0' NOT NULL,
	"admin_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mobile_app_orders" ADD CONSTRAINT "mobile_app_orders_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
