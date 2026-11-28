CREATE TABLE "confirmed_indicators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"normalized" text NOT NULL,
	"source_case_id" uuid NOT NULL,
	"confirmed_by" uuid NOT NULL,
	"confirmed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone,
	"removed_by" uuid,
	"removal_reason" text,
	CONSTRAINT "confirmed_indicators_type_valid" CHECK ("confirmed_indicators"."type" IN ('domain', 'phone', 'bank_account')),
	CONSTRAINT "confirmed_indicators_removal_complete" CHECK (("confirmed_indicators"."removed_at" IS NULL) = ("confirmed_indicators"."removed_by" IS NULL) AND ("confirmed_indicators"."removed_at" IS NULL) = ("confirmed_indicators"."removal_reason" IS NULL)),
	CONSTRAINT "confirmed_indicators_removal_reason_len" CHECK ("confirmed_indicators"."removal_reason" IS NULL OR char_length("confirmed_indicators"."removal_reason") BETWEEN 10 AND 500)
);
--> statement-breakpoint
ALTER TABLE "confirmed_indicators" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "confirmed_indicators" ADD CONSTRAINT "confirmed_indicators_source_case_id_cases_id_fk" FOREIGN KEY ("source_case_id") REFERENCES "public"."cases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "confirmed_indicators" ADD CONSTRAINT "confirmed_indicators_confirmed_by_staff_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."staff_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "confirmed_indicators" ADD CONSTRAINT "confirmed_indicators_removed_by_staff_users_id_fk" FOREIGN KEY ("removed_by") REFERENCES "public"."staff_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "confirmed_indicators_active_idx" ON "confirmed_indicators" USING btree ("type","normalized") WHERE "confirmed_indicators"."removed_at" IS NULL;