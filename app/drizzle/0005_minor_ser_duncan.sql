CREATE TABLE "samtaler" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"pocket_id" text NOT NULL,
	"tittel" text,
	"startet" timestamp with time zone NOT NULL,
	"varighet_sekunder" integer,
	"sprak" text,
	"sammendrag" text,
	"transkripsjon" text,
	"ansatt_id" uuid,
	"kunde_id" uuid,
	"kobling_bekreftet" boolean DEFAULT false NOT NULL,
	"hentet" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "samtaler" ADD CONSTRAINT "samtaler_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "samtaler" ADD CONSTRAINT "samtaler_ansatt_id_ansatte_id_fk" FOREIGN KEY ("ansatt_id") REFERENCES "public"."ansatte"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "samtaler" ADD CONSTRAINT "samtaler_kunde_id_kunder_id_fk" FOREIGN KEY ("kunde_id") REFERENCES "public"."kunder"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "samtale_pocket_idx" ON "samtaler" USING btree ("tenant_id","pocket_id");--> statement-breakpoint
CREATE INDEX "samtale_tid_idx" ON "samtaler" USING btree ("tenant_id","startet");--> statement-breakpoint
CREATE INDEX "samtale_kunde_idx" ON "samtaler" USING btree ("tenant_id","kunde_id");