const MIESIACE = [
  'stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca',
  'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia',
];

/** "2026-10-07" → "07.10.2026". Pusta data nie udaje daty — zwraca "—". */
export function data(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [r, m, d] = iso.split('-');
  if (!r || !m || !d) return iso;
  return `${d}.${m}.${r}`;
}

/** "2026-10-07" → "7 października 2026" — do treści, nie do tabel. */
export function dataSlownie(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [r, m, d] = iso.split('-');
  if (!r || !m || !d) return iso;
  const nazwa = MIESIACE[Number(m) - 1];
  return nazwa ? `${Number(d)} ${nazwa} ${r}` : data(iso);
}

/**
 * Zakres terminu wyprawy. Skracamy rok po lewej, gdy oba końce są w tym samym
 * roku — "07.10 – 27.10.2026" zamiast dwóch pełnych dat obok siebie.
 */
export function zakresDat(od: string | null, do_: string | null): string {
  if (!od && !do_) return 'termin wkrótce';
  if (!od) return `do ${data(do_)}`;
  if (!do_) return `od ${data(od)}`;
  const tenSamRok = od.slice(0, 4) === do_.slice(0, 4);
  const lewa = tenSamRok ? data(od).slice(0, 5) : data(od);
  return `${lewa} – ${data(do_)}`;
}

/** Liczba dni wyprawy liczona włącznie z dniem przylotu i odlotu. */
export function liczbaDni(od: string | null, do_: string | null): number | null {
  if (!od || !do_) return null;
  const a = Date.parse(od);
  const b = Date.parse(do_);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86_400_000) + 1;
}

/**
 * 9750 → "9 750 €".
 *
 * `useGrouping: 'always'` jest tu świadome: polski locale domyślnie NIE rozdziela
 * tysięcy w liczbach czterocyfrowych, więc cennik wyglądałby „1250 €" obok
 * „12 500 €". W tabeli cen to gryzie oko i utrudnia porównanie kwot.
 *
 * Spacje są wąskie i niełamliwe (U+202F), żeby kwota nie pękła na końcu wiersza.
 */
const FORMAT_EUR = new Intl.NumberFormat('pl-PL', { useGrouping: 'always', maximumFractionDigits: 0 });

export function euro(kwota: number | null | undefined): string {
  if (kwota === null || kwota === undefined) return '—';
  return `${FORMAT_EUR.format(kwota).replace(/[\s\u00A0]/g, '\u202F')}\u202F€`;
}

/** Widelec z konfiguratora: "1 800 – 2 016 €". Bez górnej granicy: "od 1 800 €". */
export function widelek(od: number, do_: number | null): string {
  return do_ === null ? `od ${euro(od)}` : `${euro(od)} – ${euro(do_)}`;
}

/** Trudność 1–10 na trzy kubełki, tak jak filtr na liście wypraw. */
export function pasmoTrudnosci(trudnosc: number): 'spokojne' | 'srednie' | 'mocne' {
  if (trudnosc <= 4) return 'spokojne';
  if (trudnosc <= 6) return 'srednie';
  return 'mocne';
}

export function etykietaTrudnosci(trudnosc: number): string {
  return { spokojne: 'Spokojna', srednie: 'Średnia', mocne: 'Mocna' }[pasmoTrudnosci(trudnosc)];
}

/** Numer do wa.me — same cyfry, bez plusa i spacji. */
export function numerWhatsApp(numer: string): string {
  return numer.replace(/\D/g, '');
}

/** Akapity rozdzielone pustą linią, tak jak zapisuje je CRM. */
export function akapity(tekst: string | null | undefined): string[] {
  if (!tekst) return [];
  return tekst.split(/\n\s*\n/).map((a) => a.trim()).filter(Boolean);
}

/** Listy „zawiera / nie zawiera" CRM trzyma jako linie w jednym polu. */
export function linie(tekst: string[] | string | null | undefined): string[] {
  if (!tekst) return [];
  const tab = Array.isArray(tekst) ? tekst : tekst.split('\n');
  return tab.map((l) => l.trim()).filter(Boolean);
}
