/**
 * Sprawdza, czy plik oferty trzyma się kontraktu z docs/schema.ts.
 *
 * Po co: stronę i CRM budujemy równolegle, a spotykają się wyłącznie na kształcie
 * `oferta.json`. Bez tego testu rozjazd wychodzi dopiero wtedy, gdy CRM opublikuje
 * ofertę i przebudowa strony padnie albo — gorzej — przejdzie z brakującym polem.
 *
 * Ten sam plik `docs/oferta.schema.json` może sprawdzać wyjście CRM po stronie PHP
 * (`opis/json-schema`), więc obie strony walidują przeciw jednemu kontraktowi.
 *
 * Uruchomienie:
 *   npm run test:kontrakt                      # fixture z repo
 *   npm run test:kontrakt -- sciezka.json      # dowolny plik
 *   npm run test:kontrakt -- https://…/oferta.json   # publikacja z CRM
 */
import Ajv from 'ajv';
import dodajFormaty from 'ajv-formats';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const katalog = dirname(fileURLToPath(import.meta.url));
const korzen = join(katalog, '..', '..');

const cel = process.argv[2] ?? join(korzen, 'docs', 'oferta.json');

const oferta = /^https?:\/\//.test(cel)
  ? await (await fetch(cel)).json()
  : JSON.parse(readFileSync(resolve(cel), 'utf8'));

const schemat = JSON.parse(readFileSync(join(korzen, 'docs', 'oferta.schema.json'), 'utf8'));

const ajv = new Ajv({ allErrors: true, strict: false });
dodajFormaty(ajv);
const sprawdz = ajv.compile(schemat);

console.log(`Kontrakt: docs/schema.ts\nSprawdzany plik: ${cel}\n`);

const ok = sprawdz(oferta);

if (!ok) {
  // Komunikaty ajv są po angielsku i gęste — tłumaczymy na coś, co da się
  // wkleić do zgłoszenia dla osoby pracującej po stronie CRM.
  const OPIS = {
    required: (e) => `brakuje pola „${e.params.missingProperty}"`,
    additionalProperties: (e) => `pole „${e.params.additionalProperty}" nie istnieje w kontrakcie`,
    type: (e) => `zły typ — powinno być ${e.params.type}`,
    enum: (e) => `wartość spoza listy; dozwolone: ${e.params.allowedValues.join(', ')}`,
    minItems: (e) => `za mało elementów (minimum ${e.params.limit})`,
    maxItems: (e) => `za dużo elementów (maksimum ${e.params.limit})`,
  };

  // anyOf/oneOf mnożą błędy na każdym wariancie unii — pokazujemy konkrety.
  const istotne = sprawdz.errors.filter((e) => !['anyOf', 'oneOf', 'not', 'if'].includes(e.keyword));
  const unikalne = [...new Map(istotne.map((e) => [`${e.instancePath}|${e.keyword}|${JSON.stringify(e.params)}`, e])).values()];

  console.log(`NIEZGODNOŚCI Z KONTRAKTEM: ${unikalne.length}\n`);
  for (const e of unikalne.slice(0, 40)) {
    const gdzie = e.instancePath || '(korzeń)';
    const co = OPIS[e.keyword]?.(e) ?? e.message;
    console.log(`  ${gdzie}\n      ${co}`);
  }
  if (unikalne.length > 40) console.log(`\n  …i jeszcze ${unikalne.length - 40}`);
  process.exit(1);
}

// Kształt się zgadza — teraz spójność powiązań, której JSON Schema nie sprawdzi.
const bledy = [];
const slugiRegionow = new Set(oferta.regiony.map((r) => r.slug));
const idKierunkow = new Set(oferta.kierunki.map((k) => k.id));
const idRelacji = new Set(oferta.relacje.map((r) => r.id));

for (const w of oferta.wyprawy) {
  if (w.region_strony && !slugiRegionow.has(w.region_strony)) {
    bledy.push(`wyprawa ${w.id}: region_strony „${w.region_strony}" nie istnieje w regiony[]`);
  }
}
for (const k of oferta.kierunki) {
  if (k.na_mapie && !k.geo) {
    bledy.push(`kierunek ${k.id}: na_mapie = true, ale brak geo — nie pojawi się na mapie`);
  }
  for (const slug of k.strona?.regiony_wypraw ?? []) {
    if (!slugiRegionow.has(slug)) {
      bledy.push(`kierunek ${k.id}: regiony_wypraw „${slug}" nie istnieje w regiony[]`);
    }
  }
}
for (const r of oferta.regiony) {
  if (r.kierunek_id && !idKierunkow.has(r.kierunek_id)) {
    bledy.push(`region ${r.slug}: kierunek_id „${r.kierunek_id}" nie istnieje w kierunki[]`);
  }
  for (const id of r.relacje) {
    if (!idRelacji.has(id)) bledy.push(`region ${r.slug}: relacja „${id}" nie istnieje w relacje[]`);
  }
}
// Slugi muszą być unikalne w obrębie swojej przestrzeni adresów, nie globalnie:
// /wyprawy/<slug>, /transport/<slug> i /wyprawy/region/<slug> to trzy różne miejsca.
// „wladywostok" może być i kierunkiem, i regionem — i jest.
for (const [nazwa, kolekcja] of [['wyprawy', oferta.wyprawy], ['kierunki', oferta.kierunki], ['regiony', oferta.regiony]]) {
  const licznik = {};
  for (const x of kolekcja) licznik[x.slug] = (licznik[x.slug] ?? 0) + 1;
  for (const [slug, ile] of Object.entries(licznik)) {
    if (ile > 1) bledy.push(`${nazwa}: slug „${slug}" powtarza się ${ile} razy — dwie strony pod jednym adresem`);
  }
}

// /wyprawy/region/… to ścieżka stron regionów. Wyprawa o slugu „region" przykryłaby ją.
if (oferta.wyprawy.some((w) => w.slug === 'region')) {
  bledy.push('wyprawy: slug „region" koliduje ze ścieżką stron regionów /wyprawy/region/…');
}

if (bledy.length) {
  console.log(`Kształt OK, ale ${bledy.length} niespójności w powiązaniach:\n`);
  for (const b of bledy) console.log('  ' + b);
  process.exit(1);
}

console.log('Kształt zgodny z kontraktem, powiązania spójne.');
console.log(`  wyprawy ${oferta.wyprawy.length} · kierunki ${oferta.kierunki.length} · regiony ${oferta.regiony.length} · faq ${oferta.faq.length} · relacje ${oferta.relacje.length} · opinie ${oferta.opinie.length}`);
