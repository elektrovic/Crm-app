-- Fjerner alle demodata fra produksjonsbasen.
--
-- Kjøres i Supabase: SQL Editor -> New query -> lim inn -> Run.
--
-- BEHOLDES:
--   ansatte       (uten dem kommer ingen inn i appen)
--   prosjekter    som er aktive — de 49 ekte fra Tripletex
--   aktiviteter   som har sist_synket — de 19 ekte fra Tripletex
--   endringslogg  (en revisjonslogg man kan slette er ingen revisjonslogg)
--   synkkjoringer (driftshistorikk, ikke data)
--
-- SLETTES: alt annet. Rekkefølgen følger fremmednøklene — barna først.

begin;

delete from medbring;
delete from skjemasvar;
delete from bestillingslinjer;
delete from bestillinger;
delete from tillegg;
delete from timeforinger;
delete from mangler;
delete from adkomst;
delete from vedlegg;
delete from tildelinger;
delete from oppfolginger;
delete from kundehistorikk;
delete from reklamasjoner;
delete from garantier;
delete from henvendelser;
delete from kunder;
delete from prislinjer;
delete from skjemamaler;
delete from sms_logg;

-- De fem demoprosjektene fra prototypen. Synken har alt deaktivert dem
-- fordi de ikke finnes i Tripletex, så «ikke aktiv» treffer nøyaktig dem.
-- Blir det senere ekte prosjekter som er lukket i Tripletex, vil denne
-- linja også ta dem — så den skal ikke kjøres om igjen uten å se etter.
delete from prosjekter where not aktiv;

-- Demoaktivitetene: de som aldri kom fra en synk.
delete from aktiviteter where sist_synket is null;

commit;

-- Kontroll etterpå. Forventet: 49 prosjekter, 19 aktiviteter, 3 ansatte,
-- og null på resten.
select 'prosjekter' as tabell, count(*) from prosjekter
union all select 'aktiviteter', count(*) from aktiviteter
union all select 'ansatte', count(*) from ansatte
union all select 'kunder', count(*) from kunder
union all select 'henvendelser', count(*) from henvendelser
union all select 'tildelinger', count(*) from tildelinger
union all select 'timeforinger', count(*) from timeforinger
order by 1;
