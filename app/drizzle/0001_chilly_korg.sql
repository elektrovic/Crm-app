CREATE TABLE "medbring" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"tildeling_id" uuid NOT NULL,
	"mangel_id" uuid,
	"tekst" text NOT NULL,
	"antall" text,
	"enhet" text DEFAULT 'STK' NOT NULL,
	"pakket" boolean DEFAULT false NOT NULL,
	"pakket_tidspunkt" timestamp with time zone,
	"sortering" integer DEFAULT 0 NOT NULL,
	"opprettet" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "medbring" ADD CONSTRAINT "medbring_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medbring" ADD CONSTRAINT "medbring_tildeling_id_tildelinger_id_fk" FOREIGN KEY ("tildeling_id") REFERENCES "public"."tildelinger"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medbring" ADD CONSTRAINT "medbring_mangel_id_mangler_id_fk" FOREIGN KEY ("mangel_id") REFERENCES "public"."mangler"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "medbring_tildeling_idx" ON "medbring" USING btree ("tenant_id","tildeling_id","sortering");