CREATE SEQUENCE "public"."case_code_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9999 START WITH 101 CACHE 1;--> statement-breakpoint
CREATE TABLE "analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"redacted_content" text NOT NULL,
	"redaction_counts" jsonb NOT NULL,
	"verdict" text NOT NULL,
	"rule" text NOT NULL,
	"inconclusive_reason" text,
	"risk_types" text[] DEFAULT '{}'::text[] NOT NULL,
	"details" jsonb NOT NULL,
	"prompt_version" text NOT NULL,
	"rules_version" text NOT NULL,
	"model_signals" text,
	"model_explain" text,
	"trace" jsonb NOT NULL,
	"latency_ms" integer NOT NULL,
	"is_seed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "analyses_redacted_content_len" CHECK (char_length("analyses"."redacted_content") <= 4000),
	CONSTRAINT "analyses_verdict_valid" CHECK ("analyses"."verdict" IN ('high_risk', 'suspicious', 'no_signal', 'inconclusive')),
	CONSTRAINT "analyses_inconclusive_reason_valid" CHECK ("analyses"."inconclusive_reason" IS NULL OR "analyses"."inconclusive_reason" IN ('insufficient_evidence', 'timeout', 'llm_invalid_output', 'llm_unavailable')),
	CONSTRAINT "analyses_inconclusive_has_reason" CHECK ("analyses"."verdict" <> 'inconclusive' OR "analyses"."inconclusive_reason" IS NOT NULL),
	CONSTRAINT "analyses_risk_types_valid" CHECK ("analyses"."risk_types" <@ ARRAY['brand_impersonation', 'otp_phishing', 'payment_request', 'fake_prize', 'other']::text[]),
	CONSTRAINT "analyses_latency_ms_nonneg" CHECK ("analyses"."latency_ms" >= 0)
);
--> statement-breakpoint
ALTER TABLE "analyses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "analysis_indicators" (
	"analysis_id" uuid NOT NULL,
	"type" text NOT NULL,
	"normalized" text NOT NULL,
	CONSTRAINT "analysis_indicators_analysis_id_type_normalized_pk" PRIMARY KEY("analysis_id","type","normalized"),
	CONSTRAINT "analysis_indicators_type_valid" CHECK ("analysis_indicators"."type" IN ('domain', 'phone', 'bank_account'))
);
--> statement-breakpoint
ALTER TABLE "analysis_indicators" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text DEFAULT 'SC-' || lpad(nextval('case_code_seq')::text, 4, '0') NOT NULL,
	"analysis_id" uuid NOT NULL,
	"status" text DEFAULT 'pending_review' NOT NULL,
	"channel" text NOT NULL,
	"reporter_note" text,
	"secret_hash" text NOT NULL,
	"engine_verdict" text NOT NULL,
	"risk_types" text[] DEFAULT '{}'::text[] NOT NULL,
	"ai_summary" jsonb,
	"summary_prompt_version" text,
	"is_seed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	CONSTRAINT "cases_code_unique" UNIQUE("code"),
	CONSTRAINT "cases_analysis_id_unique" UNIQUE("analysis_id"),
	CONSTRAINT "cases_code_valid" CHECK ("cases"."code" ~ '^SC-[0-9]{4,}$'),
	CONSTRAINT "cases_status_valid" CHECK ("cases"."status" IN ('pending_review', 'closed')),
	CONSTRAINT "cases_channel_valid" CHECK ("cases"."channel" IN ('sms', 'zalo', 'messenger', 'email', 'other')),
	CONSTRAINT "cases_reporter_note_len" CHECK ("cases"."reporter_note" IS NULL OR char_length("cases"."reporter_note") <= 1000),
	CONSTRAINT "cases_engine_verdict_valid" CHECK ("cases"."engine_verdict" IN ('high_risk', 'suspicious', 'no_signal', 'inconclusive')),
	CONSTRAINT "cases_risk_types_valid" CHECK ("cases"."risk_types" <@ ARRAY['brand_impersonation', 'otp_phishing', 'payment_request', 'fake_prize', 'other']::text[]),
	CONSTRAINT "cases_closed_at_matches_status" CHECK (("cases"."status" = 'closed') = ("cases"."closed_at" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "cases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "decisions" (
	"case_id" uuid PRIMARY KEY NOT NULL,
	"decision" text NOT NULL,
	"reason" text NOT NULL,
	"decided_by" uuid NOT NULL,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	"engine_verdict" text NOT NULL,
	"disagrees_with_engine" boolean NOT NULL,
	CONSTRAINT "decisions_decision_valid" CHECK ("decisions"."decision" IN ('confirmed_scam', 'not_scam', 'insufficient_evidence')),
	CONSTRAINT "decisions_reason_len" CHECK (char_length("decisions"."reason") BETWEEN 10 AND 500),
	CONSTRAINT "decisions_engine_verdict_valid" CHECK ("decisions"."engine_verdict" IN ('high_risk', 'suspicious', 'no_signal', 'inconclusive'))
);
--> statement-breakpoint
ALTER TABLE "decisions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "llm_daily_usage" (
	"day" date PRIMARY KEY NOT NULL,
	"calls" integer NOT NULL,
	CONSTRAINT "llm_daily_usage_calls_nonneg" CHECK ("llm_daily_usage"."calls" >= 0)
);
--> statement-breakpoint
ALTER TABLE "llm_daily_usage" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "rate_limit_counters" (
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer NOT NULL,
	CONSTRAINT "rate_limit_counters_key_window_start_pk" PRIMARY KEY("key","window_start"),
	CONSTRAINT "rate_limit_counters_count_positive" CHECK ("rate_limit_counters"."count" >= 1)
);
--> statement-breakpoint
ALTER TABLE "rate_limit_counters" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "staff_sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"staff_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staff_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "staff_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"display_name" text NOT NULL,
	"password_hash" text NOT NULL,
	"is_demo" boolean NOT NULL,
	"disabled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_users_username_unique" UNIQUE("username"),
	CONSTRAINT "staff_users_username_valid" CHECK ("staff_users"."username" = lower("staff_users"."username") AND "staff_users"."username" ~ '^[a-z0-9_]{3,32}$')
);
--> statement-breakpoint
ALTER TABLE "staff_users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "analysis_indicators" ADD CONSTRAINT "analysis_indicators_analysis_id_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_analysis_id_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."analyses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_decided_by_staff_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."staff_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_sessions" ADD CONSTRAINT "staff_sessions_staff_user_id_staff_users_id_fk" FOREIGN KEY ("staff_user_id") REFERENCES "public"."staff_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analyses_created_at_idx" ON "analyses" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "analysis_indicators_type_normalized_idx" ON "analysis_indicators" USING btree ("type","normalized");--> statement-breakpoint
CREATE INDEX "cases_status_created_at_idx" ON "cases" USING btree ("status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "cases_engine_verdict_created_at_idx" ON "cases" USING btree ("engine_verdict","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "staff_sessions_expires_at_idx" ON "staff_sessions" USING btree ("expires_at");