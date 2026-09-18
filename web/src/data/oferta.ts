import type { Oferta, Wyprawa, Kierunek, RegionWypraw, Faq, TerminTransportu } from '../types/oferta';
import fixture from '../../../docs/oferta.json';
import schemat from '../../../docs/oferta.schema.json';

/**
 * Skąd bierzemy ofertę:
 *   dev / CI       → `docs/oferta.json` z repo (fixture), zero zależności od sieci
 *   staging / prod → OFERTA_URL, czyli plik wypchnięty na S3 przez „Publikuj" w CRM
 *
 * Build jest świadomie twardy: brak oferty = brak strony. Wolimy, żeby przebudowa
 * padła, niż żeby CloudFront dostał HTML bez cen i terminów — poprzedni build
 * zostaje wtedy na produkcji i nikt tego nie zauważy.
 */
const URL_OFERTY = import.meta.env.OFERTA_URL as string | undefined;

let cache: Oferta | null = null;

export async function pobierzOferte(): Promise<Oferta> {
  if (cache) return cache;

  if (URL_OFERTY) {
    const odp = await fetch(URL_OFERTY);
    if (!odp.ok) {
      throw new Error(`Nie udało się pobrać oferty z ${URL_OFERTY}: HTTP ${odp.status}`);
    }
    const surowa = await odp.json();
    await sprawdzKontrakt(surowa, URL_OFERTY);
    cache = surowa as Oferta;
  } else {
    // Fixture z repo sprawdza `npm run test:kontrakt` w CI — nie ma sensu
    // walidować go przy każdym buildzie deweloperskim.
    cache = fixture as unknown as Oferta;
  }

  return cache;
}

/**
 * Oferta z CRM jest walidowana ZANIM powstaną z niej strony.
 *
 * CRM i strona są budowane równolegle, przez różne osoby i w różnych językach.
 * Jedyne, co je łączy, to kształt `oferta.json`. Bez tej bramki wystarczyłoby,
 * że CRM przestanie wysyłać jedno pole, a strona wygenerowałaby 28 podstron
 * z dziurą — i nikt by tego nie zauważył, bo build byłby zielony.
 *
 * ajv wchodzi tu tylko przy publikacji z CRM. Do przeglądarki nie trafia nic.
 */
async function sprawdzKontrakt(dane: unknown, skad: string): Promise<void> {
  const { default: Ajv } = await import('ajv');
  const { default: dodajFormaty } = await import('ajv-formats');

  const ajv = new Ajv({ allErrors: true, strict: false });
  dodajFormaty(ajv);

  if (ajv.validate(schemat, dane)) return;

  const istotne = (ajv.errors ?? [])
    .filter((e) => !['anyOf', 'oneOf', 'not', 'if'].includes(e.keyword))
    .slice(0, 15)
    .map((e) => `  ${e.instancePath || '(korzeń)'} — ${e.message}`)
    .join('\n');

  throw new Error(
    `Oferta z ${skad} nie trzyma się kontraktu z docs/schema.ts.\n\n${istotne}\n\n` +
    'Przebudowa przerwana celowo: lepiej, żeby CloudFront serwował poprzednią wersję strony, ' +
    'niż żeby poszła nowa z brakującymi danymi. Sprawdź, co generuje CRM przy „Publikuj".'
  );
}

/** Wyprawy widoczne w katalogu, od najbliższego terminu. Archiwum ma własny widok. */
export function wyprawyOpublikowane(oferta: Oferta): Wyprawa[] {
  return oferta.wyprawy
    .filter((w) => w.status === 'opublikowana')
    .sort((a, b) => (a.termin.od ?? '9999').localeCompare(b.termin.od ?? '9999'));
}

/** Kierunki do terminarza i konfiguratora — w kolejności z CRM. */
export function kierunkiOpublikowane(oferta: Oferta): Kierunek[] {
  return oferta.kierunki.filter((k) => k.status === 'opublikowany');
}

export function kierunkiWKonfiguratorze(oferta: Oferta): Kierunek[] {
  return kierunkiOpublikowane(oferta).filter((k) => k.w_konfiguratorze);
}

/**
 * Terminy, na które da się jeszcze zapisać.
 *
 * Kontener, który już wypłynął, nie jest ofertą — a pokazany na stronie sprawia,
 * że cały terminarz wygląda na nieodświeżany. Wiersze bez daty pakowania zostają:
 * to kierunki obsługiwane tylko w powrocie do Polski, tam pakowania po prostu nie ma.
 *
 * Jedna reguła dla terminarza zbiorczego i dla stron kierunków — wcześniej
 * każdy widok liczył to po swojemu i pokazywały różne rzeczy.
 */
export function terminyAktualne(kierunek: Kierunek, dzisiaj = new Date()): TerminTransportu[] {
  const dzis = dzisiaj.toISOString().slice(0, 10);
  return kierunek.terminy.filter((t) => !t.pakowanie_pl || t.pakowanie_pl >= dzis);
}

export function regionyOpublikowane(oferta: Oferta): RegionWypraw[] {
  return oferta.regiony
    .filter((r) => r.status === 'opublikowany')
    .sort((a, b) => a.kolejnosc - b.kolejnosc);
}

export function faqSekcji(oferta: Oferta, sekcja: Faq['sekcja']): Faq[] {
  return oferta.faq
    .filter((f) => f.opublikowane && f.sekcja === sekcja)
    .sort((a, b) => a.kolejnosc - b.kolejnosc);
}

/** Wyprawy przypisane do strony regionu — jawnie, nie po słowach w tytule. */
export function wyprawyRegionu(oferta: Oferta, slugRegionu: string): Wyprawa[] {
  return wyprawyOpublikowane(oferta).filter((w) => w.region_strony === slugRegionu);
}
