CREATE TABLE "adkomst" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"prosjekt_id" uuid NOT NULL,
	"nokkelkode" text,
	"kontaktperson" text,
	"kontakttelefon" text,
	"parkering" text,
	"merknad" text,
	"oppdatert_av" uuid,
	"oppdatert" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aktiviteter" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"tripletex_activity_id" integer NOT NULL,
	"navn" text NOT NULL,
	"nummer" text,
	"fakturerbar" boolean DEFAULT true NOT NULL,
	"standard_for_avdeling" text,
	"aktiv" boolean DEFAULT true NOT NULL,
	"sist_synket" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ansatte" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"entra_oid" text NOT NULL,
	"epost" text NOT NULL,
	"navn" text NOT NULL,
	"tripletex_employee_id" integer,
	"tripletex_token_kryptert" text,
	"abax_vehicle_id" text,
	"rolle" text DEFAULT 'montor' NOT NULL,
	"avdeling" text NOT NULL,
	"farge" text DEFAULT '#2563EB' NOT NULL,
	"initialer" text NOT NULL,
	"aktiv" boolean DEFAULT true NOT NULL,
	"opprettet" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bestillinger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"bestillingsnummer" text NOT NULL,
	"prosjekt_id" uuid NOT NULL,
	"bestilt_av" uuid NOT NULL,
	"grossist" text DEFAULT 'ahlsell' NOT NULL,
	"kundenummer" text,
	"leveringsadresse" text,
	"onsket_leveringsdato" text,
	"merknad" text,
	"status" text DEFAULT 'kladd' NOT NULL,
	"grossist_ordrenummer" text,
	"sendt" timestamp with time zone,
	"feilmelding" text,
	"opprettet" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bestillingslinjer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"bestilling_id" uuid NOT NULL,
	"mangel_id" uuid,
	"beskrivelse" text NOT NULL,
	"efo_nummer" text,
	"grossist_varenummer" text,
	"antall" numeric(10, 2) DEFAULT '1' NOT NULL,
	"enhet" text DEFAULT 'STK' NOT NULL,
	"sortering" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "endringslogg" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"ansatt_id" uuid,
	"handling" text NOT NULL,
	"tabell" text NOT NULL,
	"rad_id" text,
	"for" jsonb,
	"etter" jsonb,
	"ip_adresse" text,
	"tidspunkt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "garantier" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"kunde_id" uuid NOT NULL,
	"prosjekt_id" uuid,
	"utfort" text NOT NULL,
	"utfort_dato" text NOT NULL,
	"garanti_utloper" text,
	"anbefaling" text,
	"kontaktes_etter" text,
	"kontaktet" boolean DEFAULT false NOT NULL,
	"opprettet" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "henvendelser" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"kanal" text NOT NULL,
	"mottatt" timestamp with time zone DEFAULT now() NOT NULL,
	"innhold" text NOT NULL,
	"avsender_navn" text,
	"avsender_telefon" text,
	"avsender_epost" text,
	"kunde_id" uuid,
	"trinn" text DEFAULT 'ny' NOT NULL,
	"ansvarlig" uuid,
	"avdeling" text,
	"sum" numeric(12, 2),
	"ai_sammendrag" text,
	"ai_kategori" text,
	"ai_hastegrad" text,
	"ai_vurdert" timestamp with time zone,
	"ai_modell" text,
	"opprettet" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kundehistorikk" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"kunde_id" uuid NOT NULL,
	"hendelse" text NOT NULL,
	"dato" text NOT NULL,
	"farge" text DEFAULT '#2563EB' NOT NULL,
	"ansatt_id" uuid,
	"opprettet" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kunder" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"navn" text NOT NULL,
	"type" text,
	"orgnummer" text,
	"kontaktperson" text,
	"telefon" text,
	"epost" text,
	"adresse" text,
	"avdeling" text,
	"status" text DEFAULT 'prospekt' NOT NULL,
	"tripletex_customer_id" integer,
	"omsetning" numeric(12, 2),
	"omsetning_synket" timestamp with time zone,
	"opprettet" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mangler" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"prosjekt_id" uuid NOT NULL,
	"tekst" text NOT NULL,
	"antall" text,
	"talt_inn" boolean DEFAULT false NOT NULL,
	"efo_nummer" text,
	"enhet" text DEFAULT 'STK' NOT NULL,
	"bestilt" boolean DEFAULT false NOT NULL,
	"bestilt_tidspunkt" timestamp with time zone,
	"lagt_inn_av" uuid NOT NULL,
	"opprettet" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oppfolginger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"kunde_id" uuid,
	"henvendelse_id" uuid,
	"reklamasjon_id" uuid,
	"hva" text NOT NULL,
	"frist" text NOT NULL,
	"ansvarlig" uuid,
	"fullfort" boolean DEFAULT false NOT NULL,
	"fullfort_tidspunkt" timestamp with time zone,
	"opprettet" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prislinjer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"avdeling" text NOT NULL,
	"navn" text NOT NULL,
	"enhet" text,
	"pris" numeric(10, 2) NOT NULL,
	"sortering" integer DEFAULT 0 NOT NULL,
	"aktiv" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prosjekter" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"tripletex_project_id" integer NOT NULL,
	"nummer" text NOT NULL,
	"navn" text NOT NULL,
	"kunde" text,
	"adresse" text,
	"lat" numeric(9, 6),
	"lon" numeric(9, 6),
	"avdeling" text NOT NULL,
	"farge" text DEFAULT '#2563EB' NOT NULL,
	"aktiv" boolean DEFAULT true NOT NULL,
	"sist_synket" timestamp with time zone,
	"kunde_id" uuid,
	"geokodet_forsokt" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "reklamasjoner" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"saksnummer" text NOT NULL,
	"kunde_id" uuid NOT NULL,
	"prosjekt_id" uuid,
	"mottatt" text NOT NULL,
	"frist" text,
	"beskrivelse" text NOT NULL,
	"ansvarlig" uuid,
	"status" text DEFAULT 'ny' NOT NULL,
	"kostnad" numeric(12, 2),
	"losning" text,
	"lukket" timestamp with time zone,
	"opprettet" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skjemamaler" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"avdeling" text NOT NULL,
	"navn" text NOT NULL,
	"sporsmal" jsonb NOT NULL,
	"beskrivelse_ledetekst" text,
	"aktiv" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skjemasvar" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"prosjekt_id" uuid NOT NULL,
	"ansatt_id" uuid NOT NULL,
	"skjema_navn" text NOT NULL,
	"svar" jsonb NOT NULL,
	"beskrivelse" text,
	"fullfort" boolean DEFAULT false NOT NULL,
	"klient_nokkel" text NOT NULL,
	"opprettet" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sms_logg" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"prosjekt_id" uuid NOT NULL,
	"ansatt_id" uuid NOT NULL,
	"anledning" text NOT NULL,
	"mottaker" text NOT NULL,
	"melding" text NOT NULL,
	"sendt" boolean DEFAULT false NOT NULL,
	"leverandor_id" text,
	"feilmelding" text,
	"klient_nokkel" text NOT NULL,
	"opprettet" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" text PRIMARY KEY NOT NULL,
	"navn" text NOT NULL,
	"opprettet" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tildelinger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"prosjekt_id" uuid NOT NULL,
	"ansatt_id" uuid NOT NULL,
	"dato" text NOT NULL,
	"fra_kl" text,
	"til_kl" text,
	"notat" text,
	"opprettet" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tillegg" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"prosjekt_id" uuid NOT NULL,
	"ansatt_id" uuid NOT NULL,
	"navn" text NOT NULL,
	"enhet" text,
	"antall" numeric(8, 2) DEFAULT '1' NOT NULL,
	"enhetspris" numeric(10, 2) NOT NULL,
	"kommentar" text,
	"bilde_id" uuid,
	"signatur_id" uuid,
	"signert_av" text,
	"signert_tidspunkt" timestamp with time zone,
	"status" text DEFAULT 'i_ko' NOT NULL,
	"tripletex_underprosjekt_id" integer,
	"feilmelding" text,
	"klient_nokkel" text NOT NULL,
	"opprettet" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timeforinger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"ansatt_id" uuid NOT NULL,
	"prosjekt_id" uuid NOT NULL,
	"dato" text NOT NULL,
	"timer" numeric(5, 2) NOT NULL,
	"aktivitet_id" integer,
	"kommentar" text,
	"fra_kjorebok" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'i_ko' NOT NULL,
	"tripletex_entry_id" integer,
	"feilmelding" text,
	"forsok" integer DEFAULT 0 NOT NULL,
	"klient_nokkel" text NOT NULL,
	"opprettet" timestamp with time zone DEFAULT now() NOT NULL,
	"sendt" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "vedlegg" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"prosjekt_id" uuid NOT NULL,
	"slag" text NOT NULL,
	"mimetype" text NOT NULL,
	"data" text,
	"storrelse" integer NOT NULL,
	"lastet_opp_av" uuid NOT NULL,
	"tripletex_lastet_opp" timestamp with time zone,
	"tripletex_feilmelding" text,
	"data_slettet" timestamp with time zone,
	"opprettet" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "adkomst" ADD CONSTRAINT "adkomst_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adkomst" ADD CONSTRAINT "adkomst_prosjekt_id_prosjekter_id_fk" FOREIGN KEY ("prosjekt_id") REFERENCES "public"."prosjekter"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adkomst" ADD CONSTRAINT "adkomst_oppdatert_av_ansatte_id_fk" FOREIGN KEY ("oppdatert_av") REFERENCES "public"."ansatte"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aktiviteter" ADD CONSTRAINT "aktiviteter_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ansatte" ADD CONSTRAINT "ansatte_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestillinger" ADD CONSTRAINT "bestillinger_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestillinger" ADD CONSTRAINT "bestillinger_prosjekt_id_prosjekter_id_fk" FOREIGN KEY ("prosjekt_id") REFERENCES "public"."prosjekter"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestillinger" ADD CONSTRAINT "bestillinger_bestilt_av_ansatte_id_fk" FOREIGN KEY ("bestilt_av") REFERENCES "public"."ansatte"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestillingslinjer" ADD CONSTRAINT "bestillingslinjer_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestillingslinjer" ADD CONSTRAINT "bestillingslinjer_bestilling_id_bestillinger_id_fk" FOREIGN KEY ("bestilling_id") REFERENCES "public"."bestillinger"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestillingslinjer" ADD CONSTRAINT "bestillingslinjer_mangel_id_mangler_id_fk" FOREIGN KEY ("mangel_id") REFERENCES "public"."mangler"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "endringslogg" ADD CONSTRAINT "endringslogg_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "endringslogg" ADD CONSTRAINT "endringslogg_ansatt_id_ansatte_id_fk" FOREIGN KEY ("ansatt_id") REFERENCES "public"."ansatte"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "garantier" ADD CONSTRAINT "garantier_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "garantier" ADD CONSTRAINT "garantier_kunde_id_kunder_id_fk" FOREIGN KEY ("kunde_id") REFERENCES "public"."kunder"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "garantier" ADD CONSTRAINT "garantier_prosjekt_id_prosjekter_id_fk" FOREIGN KEY ("prosjekt_id") REFERENCES "public"."prosjekter"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "henvendelser" ADD CONSTRAINT "henvendelser_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "henvendelser" ADD CONSTRAINT "henvendelser_kunde_id_kunder_id_fk" FOREIGN KEY ("kunde_id") REFERENCES "public"."kunder"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "henvendelser" ADD CONSTRAINT "henvendelser_ansvarlig_ansatte_id_fk" FOREIGN KEY ("ansvarlig") REFERENCES "public"."ansatte"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kundehistorikk" ADD CONSTRAINT "kundehistorikk_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kundehistorikk" ADD CONSTRAINT "kundehistorikk_kunde_id_kunder_id_fk" FOREIGN KEY ("kunde_id") REFERENCES "public"."kunder"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kundehistorikk" ADD CONSTRAINT "kundehistorikk_ansatt_id_ansatte_id_fk" FOREIGN KEY ("ansatt_id") REFERENCES "public"."ansatte"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kunder" ADD CONSTRAINT "kunder_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mangler" ADD CONSTRAINT "mangler_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mangler" ADD CONSTRAINT "mangler_prosjekt_id_prosjekter_id_fk" FOREIGN KEY ("prosjekt_id") REFERENCES "public"."prosjekter"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mangler" ADD CONSTRAINT "mangler_lagt_inn_av_ansatte_id_fk" FOREIGN KEY ("lagt_inn_av") REFERENCES "public"."ansatte"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oppfolginger" ADD CONSTRAINT "oppfolginger_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oppfolginger" ADD CONSTRAINT "oppfolginger_kunde_id_kunder_id_fk" FOREIGN KEY ("kunde_id") REFERENCES "public"."kunder"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oppfolginger" ADD CONSTRAINT "oppfolginger_henvendelse_id_henvendelser_id_fk" FOREIGN KEY ("henvendelse_id") REFERENCES "public"."henvendelser"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oppfolginger" ADD CONSTRAINT "oppfolginger_reklamasjon_id_reklamasjoner_id_fk" FOREIGN KEY ("reklamasjon_id") REFERENCES "public"."reklamasjoner"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oppfolginger" ADD CONSTRAINT "oppfolginger_ansvarlig_ansatte_id_fk" FOREIGN KEY ("ansvarlig") REFERENCES "public"."ansatte"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prislinjer" ADD CONSTRAINT "prislinjer_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prosjekter" ADD CONSTRAINT "prosjekter_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reklamasjoner" ADD CONSTRAINT "reklamasjoner_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reklamasjoner" ADD CONSTRAINT "reklamasjoner_kunde_id_kunder_id_fk" FOREIGN KEY ("kunde_id") REFERENCES "public"."kunder"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reklamasjoner" ADD CONSTRAINT "reklamasjoner_prosjekt_id_prosjekter_id_fk" FOREIGN KEY ("prosjekt_id") REFERENCES "public"."prosjekter"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reklamasjoner" ADD CONSTRAINT "reklamasjoner_ansvarlig_ansatte_id_fk" FOREIGN KEY ("ansvarlig") REFERENCES "public"."ansatte"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skjemamaler" ADD CONSTRAINT "skjemamaler_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skjemasvar" ADD CONSTRAINT "skjemasvar_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skjemasvar" ADD CONSTRAINT "skjemasvar_prosjekt_id_prosjekter_id_fk" FOREIGN KEY ("prosjekt_id") REFERENCES "public"."prosjekter"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skjemasvar" ADD CONSTRAINT "skjemasvar_ansatt_id_ansatte_id_fk" FOREIGN KEY ("ansatt_id") REFERENCES "public"."ansatte"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_logg" ADD CONSTRAINT "sms_logg_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_logg" ADD CONSTRAINT "sms_logg_prosjekt_id_prosjekter_id_fk" FOREIGN KEY ("prosjekt_id") REFERENCES "public"."prosjekter"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_logg" ADD CONSTRAINT "sms_logg_ansatt_id_ansatte_id_fk" FOREIGN KEY ("ansatt_id") REFERENCES "public"."ansatte"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tildelinger" ADD CONSTRAINT "tildelinger_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tildelinger" ADD CONSTRAINT "tildelinger_prosjekt_id_prosjekter_id_fk" FOREIGN KEY ("prosjekt_id") REFERENCES "public"."prosjekter"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tildelinger" ADD CONSTRAINT "tildelinger_ansatt_id_ansatte_id_fk" FOREIGN KEY ("ansatt_id") REFERENCES "public"."ansatte"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tillegg" ADD CONSTRAINT "tillegg_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tillegg" ADD CONSTRAINT "tillegg_prosjekt_id_prosjekter_id_fk" FOREIGN KEY ("prosjekt_id") REFERENCES "public"."prosjekter"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tillegg" ADD CONSTRAINT "tillegg_ansatt_id_ansatte_id_fk" FOREIGN KEY ("ansatt_id") REFERENCES "public"."ansatte"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tillegg" ADD CONSTRAINT "tillegg_bilde_id_vedlegg_id_fk" FOREIGN KEY ("bilde_id") REFERENCES "public"."vedlegg"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tillegg" ADD CONSTRAINT "tillegg_signatur_id_vedlegg_id_fk" FOREIGN KEY ("signatur_id") REFERENCES "public"."vedlegg"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeforinger" ADD CONSTRAINT "timeforinger_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeforinger" ADD CONSTRAINT "timeforinger_ansatt_id_ansatte_id_fk" FOREIGN KEY ("ansatt_id") REFERENCES "public"."ansatte"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeforinger" ADD CONSTRAINT "timeforinger_prosjekt_id_prosjekter_id_fk" FOREIGN KEY ("prosjekt_id") REFERENCES "public"."prosjekter"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vedlegg" ADD CONSTRAINT "vedlegg_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vedlegg" ADD CONSTRAINT "vedlegg_prosjekt_id_prosjekter_id_fk" FOREIGN KEY ("prosjekt_id") REFERENCES "public"."prosjekter"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vedlegg" ADD CONSTRAINT "vedlegg_lastet_opp_av_ansatte_id_fk" FOREIGN KEY ("lastet_opp_av") REFERENCES "public"."ansatte"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "adkomst_prosjekt_idx" ON "adkomst" USING btree ("prosjekt_id");--> statement-breakpoint
CREATE UNIQUE INDEX "aktivitet_tenant_tripletex_idx" ON "aktiviteter" USING btree ("tenant_id","tripletex_activity_id");--> statement-breakpoint
CREATE INDEX "aktivitet_aktiv_idx" ON "aktiviteter" USING btree ("tenant_id","aktiv");--> statement-breakpoint
CREATE UNIQUE INDEX "ansatte_entra_oid_idx" ON "ansatte" USING btree ("entra_oid");--> statement-breakpoint
CREATE INDEX "ansatte_tenant_idx" ON "ansatte" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bestilling_nummer_idx" ON "bestillinger" USING btree ("tenant_id","bestillingsnummer");--> statement-breakpoint
CREATE INDEX "bestilling_status_idx" ON "bestillinger" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "bestillingslinje_bestilling_idx" ON "bestillingslinjer" USING btree ("tenant_id","bestilling_id");--> statement-breakpoint
CREATE INDEX "endringslogg_oppslag_idx" ON "endringslogg" USING btree ("tenant_id","tabell","rad_id");--> statement-breakpoint
CREATE INDEX "garantier_kunde_idx" ON "garantier" USING btree ("tenant_id","kunde_id");--> statement-breakpoint
CREATE INDEX "henvendelser_trinn_idx" ON "henvendelser" USING btree ("tenant_id","trinn");--> statement-breakpoint
CREATE INDEX "henvendelser_mottatt_idx" ON "henvendelser" USING btree ("tenant_id","mottatt");--> statement-breakpoint
CREATE INDEX "kundehistorikk_kunde_idx" ON "kundehistorikk" USING btree ("tenant_id","kunde_id","dato");--> statement-breakpoint
CREATE INDEX "kunder_tenant_idx" ON "kunder" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "kunder_navn_idx" ON "kunder" USING btree ("tenant_id","navn");--> statement-breakpoint
CREATE INDEX "mangler_prosjekt_idx" ON "mangler" USING btree ("tenant_id","prosjekt_id","bestilt");--> statement-breakpoint
CREATE INDEX "oppfolging_frist_idx" ON "oppfolginger" USING btree ("tenant_id","fullfort","frist");--> statement-breakpoint
CREATE INDEX "oppfolging_ansvarlig_idx" ON "oppfolginger" USING btree ("tenant_id","ansvarlig");--> statement-breakpoint
CREATE INDEX "prislinjer_avdeling_idx" ON "prislinjer" USING btree ("tenant_id","avdeling","aktiv");--> statement-breakpoint
CREATE UNIQUE INDEX "prosjekt_tenant_tripletex_idx" ON "prosjekter" USING btree ("tenant_id","tripletex_project_id");--> statement-breakpoint
CREATE INDEX "prosjekt_nummer_idx" ON "prosjekter" USING btree ("tenant_id","nummer");--> statement-breakpoint
CREATE UNIQUE INDEX "reklamasjon_saksnummer_idx" ON "reklamasjoner" USING btree ("tenant_id","saksnummer");--> statement-breakpoint
CREATE INDEX "reklamasjon_status_idx" ON "reklamasjoner" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "skjemamaler_avdeling_idx" ON "skjemamaler" USING btree ("tenant_id","avdeling","aktiv");--> statement-breakpoint
CREATE UNIQUE INDEX "skjemasvar_klientnokkel_idx" ON "skjemasvar" USING btree ("tenant_id","klient_nokkel");--> statement-breakpoint
CREATE INDEX "skjemasvar_prosjekt_idx" ON "skjemasvar" USING btree ("tenant_id","prosjekt_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sms_klientnokkel_idx" ON "sms_logg" USING btree ("tenant_id","klient_nokkel");--> statement-breakpoint
CREATE INDEX "sms_prosjekt_idx" ON "sms_logg" USING btree ("tenant_id","prosjekt_id");--> statement-breakpoint
CREATE INDEX "tildeling_ansatt_dato_idx" ON "tildelinger" USING btree ("tenant_id","ansatt_id","dato");--> statement-breakpoint
CREATE INDEX "tildeling_dato_idx" ON "tildelinger" USING btree ("tenant_id","dato");--> statement-breakpoint
CREATE UNIQUE INDEX "tillegg_klientnokkel_idx" ON "tillegg" USING btree ("tenant_id","klient_nokkel");--> statement-breakpoint
CREATE INDEX "tillegg_prosjekt_idx" ON "tillegg" USING btree ("tenant_id","prosjekt_id");--> statement-breakpoint
CREATE UNIQUE INDEX "timeforing_klientnokkel_idx" ON "timeforinger" USING btree ("tenant_id","klient_nokkel");--> statement-breakpoint
CREATE INDEX "timeforing_ansatt_dato_idx" ON "timeforinger" USING btree ("tenant_id","ansatt_id","dato");--> statement-breakpoint
CREATE INDEX "timeforing_status_idx" ON "timeforinger" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "vedlegg_prosjekt_idx" ON "vedlegg" USING btree ("tenant_id","prosjekt_id","slag");