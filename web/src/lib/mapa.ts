import { geoNaturalEarth1, geoPath, geoGraticule10 } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';  // z @types/topojson-specification
import type { FeatureCollection, Geometry } from 'geojson';
import atlas from 'world-atlas/countries-110m.json';
import type { Kierunek } from '../types/oferta';

/**
 * Mapa kierunków renderowana W BUILDZIE, nie w przeglądarce.
 *
 * Wersja z prototypu ciągnęła d3, topojson i geometrię świata z unpkg i jsDelivr
 * przy każdym wejściu. Trzy obce domeny na publicznej stronie to zbędne żądania,
 * zależność od cudzego uptime'u i temat dla RODO. Tu wychodzi samo SVG: zero JS,
 * zero third-party, działa też offline.
 *
 * Współrzędne i ceny bierzemy z `oferta.json`. Prototyp miał je wpisane na sztywno
 * w pliku mapy — czyli drugie źródło prawdy obok CRM. Zmiana ceny w CRM zostawiłaby
 * na mapie starą kwotę i nikt by tego nie zauważył.
 */

/** Magazyn w Ciechanowie — początek każdej trasy. */
const BAZA: [number, number] = [20.28, 52.30];

const SZEROKOSC = 1200;
const WYSOKOSC = 680;

const KOLORY = {
  ocean: '#12110F',
  siatka: '#26241F',
  lad: '#23221D',
  granica: '#38352E',
  trasaObie: '#F26A1B',
  trasaJedna: '#EA5A0B',
  punkt: '#F2EFE7',
  opis: '#B9B3A6',
} as const;

export interface Podpis {
  x: number;
  y: number;
  nazwa: string;
  opis: string;
  kotwica: 'start' | 'end';
  dx: number;
  /** Przesunięcie w pionie po rozsunięciu nachodzących podpisów. */
  dy: number;
}

export interface MapaSVG {
  szerokosc: number;
  wysokosc: number;
  ocean: string;
  siatka: string;
  lad: string;
  trasy: { d: string; kolor: string; kreskowana: boolean; tytul: string }[];
  punkty: Podpis[];
  baza: { x: number; y: number };
}

export function zbudujMape(kierunki: Kierunek[]): MapaSVG {
  const topo = atlas as unknown as Topology<{ countries: GeometryCollection }>;
  const swiat = feature(topo, topo.objects.countries) as unknown as FeatureCollection<Geometry>;

  const projekcja = geoNaturalEarth1().fitExtent(
    [[16, 30], [SZEROKOSC - 16, WYSOKOSC - 30]],
    { type: 'Sphere' }
  );
  // Jedno miejsce po przecinku to przy szerokości 1200 px mniej niż pół piksela,
  // a ścieżka lądów schodzi ze 163 kB do 120 kB. Wizualnie bez różnicy.
  const sciezka = geoPath(projekcja).digits(1);

  const naMapie = kierunki.filter((k) => k.na_mapie && k.geo);

  const trasy = naMapie.map((k) => {
    const obieStrony = k.cena_obie_eur !== null;
    return {
      // Wielkie koło, nie prosta — na Natural Earth trasa kontenera tak właśnie biegnie.
      d: sciezka({
        type: 'LineString',
        coordinates: [BAZA, [k.geo!.lon, k.geo!.lat]],
      }) ?? '',
      kolor: obieStrony ? KOLORY.trasaObie : KOLORY.trasaJedna,
      kreskowana: !obieStrony,
      tytul: k.nazwa,
    };
  });

  const punkty: Podpis[] = naMapie
    .map((k) => {
      const [x, y] = projekcja([k.geo!.lon, k.geo!.lat]) ?? [0, 0];
      const cena = k.cena_obie_eur !== null
        ? `⇔ ${k.cena_obie_eur} €`
        : k.cena_jedna_eur !== null
          ? `⇒ ${k.cena_jedna_eur} €`
          : '';
      // Podpisy przy prawej krawędzi uciekałyby poza kadr — odbijamy je do środka.
      const naLewo = x > SZEROKOSC * 0.72;
      return {
        x, y,
        nazwa: k.miasto_odbioru ?? k.nazwa,
        opis: cena,
        kotwica: (naLewo ? 'end' : 'start') as 'start' | 'end',
        dx: naLewo ? -9 : 9,
        dy: 0,
      };
    })
    .sort((a, b) => a.y - b.y);

  rozsunPodpisy(punkty);

  const [bx, by] = projekcja(BAZA) ?? [0, 0];

  return {
    szerokosc: SZEROKOSC,
    wysokosc: WYSOKOSC,
    ocean: sciezka({ type: 'Sphere' }) ?? '',
    siatka: sciezka(geoGraticule10()) ?? '',
    lad: sciezka(swiat) ?? '',
    trasy,
    punkty,
    baza: { x: bx, y: by },
  };
}

/**
 * Podpisy miast potrafią na siebie wejść — przy obecnych danych robią to Biszkek
 * i Władywostok. Rozsuwamy je w pionie zamiast ręcznie przesuwać pojedyncze
 * kierunki: przy następnym kierunku dodanym w CRM ręczna korekta i tak by padła.
 */
function rozsunPodpisy(punkty: Podpis[]): void {
  const WYSOKOSC_PODPISU = 26;   // nazwa + cena pod nią
  const ZNAK = 6.6;              // przybliżona szerokość znaku IBM Plex Mono 11.5 px

  const pudelko = (p: Podpis) => {
    const szerokosc = Math.max(p.nazwa.length, p.opis.length) * ZNAK;
    const lewa = p.dx < 0 ? p.x + p.dx - szerokosc : p.x + p.dx;
    return { lewa, prawa: lewa + szerokosc, srodek: p.y + p.dy };
  };

  for (let i = 1; i < punkty.length; i++) {
    const teraz = punkty[i]!;
    for (let j = 0; j < i; j++) {
      const a = pudelko(teraz);
      const b = pudelko(punkty[j]!);
      const nachodzaWPoziomie = a.lewa < b.prawa && b.lewa < a.prawa;
      if (nachodzaWPoziomie && Math.abs(a.srodek - b.srodek) < WYSOKOSC_PODPISU) {
        teraz.dy = b.srodek + WYSOKOSC_PODPISU - teraz.y;
      }
    }
  }
}

export { KOLORY as KOLORY_MAPY };

const esc = (t: string): string =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Cała mapa jako jeden plik SVG. Leci osobnym żądaniem zamiast wprost w HTML,
 * bo sama geometria lądów to ~120 kB — w każdej stronie byłby to balast,
 * a jako osobny plik siedzi w cache przeglądarki i CloudFrontu raz.
 */
export function svgMapy(kierunki: Kierunek[]): string {
  const m = zbudujMape(kierunki);
  const mono = 'IBM Plex Mono, ui-monospace, monospace';

  const trasy = m.trasy
    .map((t) =>
      `<path d="${t.d}" fill="none" stroke="${t.kolor}" stroke-width="1.6" ` +
      `stroke-opacity="${t.kreskowana ? '.75' : '.85'}" stroke-linecap="round"` +
      `${t.kreskowana ? ' stroke-dasharray="5 5"' : ''}/>`
    )
    .join('');

  const punkty = m.punkty
    .map((p) =>
      `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.4" fill="${KOLORY.punkt}"/>` +
      `<text x="${(p.x + p.dx).toFixed(1)}" y="${(p.y + p.dy - 3).toFixed(1)}" text-anchor="${p.kotwica}" ` +
      `fill="${KOLORY.punkt}" font-family="${mono}" font-size="11.5" font-weight="600">${esc(p.nazwa)}</text>` +
      (p.opis
        ? `<text x="${(p.x + p.dx).toFixed(1)}" y="${(p.y + p.dy + 11).toFixed(1)}" text-anchor="${p.kotwica}" ` +
          `fill="${KOLORY.opis}" font-family="${mono}" font-size="10.5">${esc(p.opis)}</text>`
        : '')
    )
    .join('');

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${m.szerokosc} ${m.wysokosc}" role="img">`,
    `<title>Mapa ${m.trasy.length} kierunków transportu pojazdów z magazynu w Ciechanowie</title>`,
    `<path d="${m.ocean}" fill="${KOLORY.ocean}"/>`,
    `<path d="${m.siatka}" fill="none" stroke="${KOLORY.siatka}" stroke-width=".6"/>`,
    `<path d="${m.lad}" fill="${KOLORY.lad}" stroke="${KOLORY.granica}" stroke-width=".7"/>`,
    trasy,
    `<circle cx="${m.baza.x.toFixed(1)}" cy="${m.baza.y.toFixed(1)}" r="5" fill="${KOLORY.trasaObie}"/>`,
    `<text x="${(m.baza.x + 9).toFixed(1)}" y="${(m.baza.y - 8).toFixed(1)}" fill="${KOLORY.punkt}" ` +
      `font-family="${mono}" font-size="12" font-weight="600">Ciechanów</text>`,
    punkty,
    `</svg>`,
  ].join('');
}
