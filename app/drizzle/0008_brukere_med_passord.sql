ALTER TABLE "ansatte" ALTER COLUMN "entra_oid" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ansatte" ADD COLUMN "passord_hash" text;--> statement-breakpoint
ALTER TABLE "ansatte" ADD COLUMN "maa_bytte_passord" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ansatte" ADD COLUMN "siste_innlogging" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "ansatte_epost_idx" ON "ansatte" USING btree ("tenant_id","epost");