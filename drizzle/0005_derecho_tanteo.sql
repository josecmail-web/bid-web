CREATE TYPE "public"."tanteo_status" AS ENUM('holder', 'best', 'pending', 'matched', 'declined', 'expired', 'nobid');--> statement-breakpoint
CREATE TABLE "tender_tanteo" (
	"tender_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"status" "tanteo_status" DEFAULT 'holder' NOT NULL,
	"best_total" numeric(14, 2),
	"original_total" numeric(14, 2),
	"decided_at" timestamp with time zone,
	CONSTRAINT "tender_tanteo_tender_id_company_id_pk" PRIMARY KEY("tender_id","company_id")
);
--> statement-breakpoint
ALTER TABLE "tenders" ADD COLUMN "tanteo_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tender_tanteo" ADD CONSTRAINT "tender_tanteo_tender_id_tenders_id_fk" FOREIGN KEY ("tender_id") REFERENCES "public"."tenders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tender_tanteo" ADD CONSTRAINT "tender_tanteo_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;