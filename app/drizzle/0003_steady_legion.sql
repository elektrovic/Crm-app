CREATE TABLE "synkkjoringer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"utloser" text NOT NULL,
	"start" timestamp with time zone DEFAULT now() NOT NULL,
	"slutt" timestamp with time zone,
	"ok" boolean,
	"resultat" jsonb,
	"feil" text,
	"opprettet" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "synkkjoringer" ADD CONSTRAINT "synkkjoringer_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "synkkjoring_tid_idx" ON "synkkjoringer" USING btree ("tenant_id","start");