import type { Oferta, Wyprawa, Kierunek, RegionWypraw, Faq } from '../types/oferta';
import fixture from '../../../docs/oferta.json';

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
    cache = (await odp.json()) as Oferta;
  } else {
    cache = fixture as unknown as Oferta;
  }

  return cache;
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
