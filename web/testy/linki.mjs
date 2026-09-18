/**
 * Sprawdza, czy żaden wewnętrzny link nie prowadzi w 404.
 *
 * Pilnuje tego, co łatwo zepsuć przy dokładaniu widoków: flagi `gotowe`
 * w nawigacji, linków w stopce i odnośników między stronami kierunków,
 * regionów i wypraw.
 *
 * Uruchomienie: npm run build && npm run preview & ; npm run test:linki
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const DIST = new URL('../dist/', import.meta.url).pathname;

const pliki = [];
const zbierz = (katalog) => {
  for (const wpis of readdirSync(katalog)) {
    const sciezka = join(katalog, wpis);
    if (statSync(sciezka).isDirectory()) zbierz(sciezka);
    else if (wpis.endsWith('.html')) pliki.push(sciezka);
  }
};
zbierz(DIST);

/** Adres → plik, który CloudFront zwróci dla tego adresu. */
const istnieje = (url) => {
  const czysty = url.split('#')[0].split('?')[0].replace(/\/$/, '');
  if (czysty === '') return true;
  const kandydaci = [
    join(DIST, czysty),
    join(DIST, `${czysty}.html`),
    join(DIST, czysty, 'index.html'),
  ];
  return kandydaci.some((k) => { try { return statSync(k).isFile(); } catch { return false; } });
};

const zle = [];
let sprawdzonych = 0;

for (const plik of pliki) {
  const html = readFileSync(plik, 'utf8');
  const zrodlo = '/' + relative(DIST, plik).replace(/index\.html$/, '').replace(/\/$/, '');
  for (const m of html.matchAll(/(?:href|src)="(\/[^"]*)"/g)) {
    const url = m[1];
    if (url.startsWith('//') || url.startsWith('/_astro/')) continue;
    sprawdzonych++;
    if (!istnieje(url)) zle.push(`${zrodlo || '/'} → ${url}`);
  }
}

console.log(`Sprawdzono ${sprawdzonych} odnośników na ${pliki.length} stronach.`);
if (zle.length) {
  console.log('\nMARTWE ODNOŚNIKI:');
  for (const z of [...new Set(zle)]) console.log('  ' + z);
  process.exit(1);
}
console.log('Wszystkie wewnętrzne odnośniki prowadzą do istniejących stron.');
