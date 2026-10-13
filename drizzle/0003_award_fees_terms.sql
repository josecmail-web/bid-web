CREATE TYPE "public"."fee_status" AS ENUM('waived_pilot', 'pending', 'invoiced', 'paid', 'cancelled');--> statement-breakpoint
CREATE TABLE "award_fees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tender_id" text NOT NULL,
	"bid_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"awarded_total" numeric(14, 2) NOT NULL,
	"rate" real NOT NULL,
	"fee_amount" numeric(14, 2) NOT NULL,
	"charged_amount" numeric(14, 2) NOT NULL,
	"status" "fee_status" NOT NULL,
	"tariff_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "award_fees_tender_id_unique" UNIQUE("tender_id")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "terms_version" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "terms_accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "award_fees" ADD CONSTRAINT "award_fees_tender_id_tenders_id_fk" FOREIGN KEY ("tender_id") REFERENCES "public"."tenders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "award_fees" ADD CONSTRAINT "award_fees_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "public"."bids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "award_fees" ADD CONSTRAINT "award_fees_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;