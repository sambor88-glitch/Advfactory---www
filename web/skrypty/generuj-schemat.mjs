/**
 * docs/schema.ts → docs/oferta.schema.json
 *
 * Kontrakt jest pisany raz, w TypeScripcie. Tu go tłumaczymy na JSON Schema,
 * żeby ten sam kontrakt mógł sprawdzać PHP po stronie CRM — bo Laravel
 * TypeScriptu nie czyta, a druga, ręcznie pisana kopia reguł rozjechałaby się
 * z pierwszą w pierwszym tygodniu.
 *
 * Wygenerowany plik jest commitowany. Zmiana kontraktu ma być widoczna
 * w diffie pull requesta, a nie wychodzić dopiero na produkcji.
 *
 * Uruchomienie: npm run schemat
 */
import { createGenerator } from 'ts-json-schema-generator';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const katalog = dirname(fileURLToPath(import.meta.url));
const korzen = join(katalog, '..', '..');

const schemat = createGenerator({
  path: join(korzen, 'docs', 'schema.ts'),
  tsconfig: join(korzen, 'web', 'tsconfig.json'),
  type: 'Oferta',
  skipTypeCheck: false,
  additionalProperties: false,   // pole spoza kontraktu to też rozjazd
}).createSchema('Oferta');

const wyjscie = join(korzen, 'docs', 'oferta.schema.json');
writeFileSync(wyjscie, JSON.stringify(schemat, null, 2) + '\n');

const ile = Object.keys(schemat.definitions ?? {}).length;
console.log(`docs/oferta.schema.json — ${ile} definicji typów`);
