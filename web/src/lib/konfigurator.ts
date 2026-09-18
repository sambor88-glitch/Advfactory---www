import type { Kierunek, KonfiguracjaTransportu } from '../types/oferta';

/**
 * Wycena transportu — ten sam wzór, co w prototypie.
 *
 * Kwota bazowa jest z CRM (`cena_jedna_eur` / `cena_obie_eur`). Mnożnik pojazdu
 * i górna granica widełek to reguły handlowe, dziś zapisane tutaj. Docelowo
 * powinny trafić do „Ustawień strony" w CRM — inaczej zmiana cennika za quada
 * wymaga wdrożenia, a nie kliknięcia w CRM.
 */

export type Pojazd = 'motocykl' | 'quad' | 'samochod';

export interface DefinicjaPojazdu {
  id: Pojazd;
  etykieta: string;
  podtytul: string;
  ikona: string;
  mnoznik: number;
  /** Rozrzut w górę: im mniej typowy pojazd, tym szerzej. */
  rozrzut: number;
  notka: string;
}

export const POJAZDY: DefinicjaPojazdu[] = [
  { id: 'motocykl', etykieta: 'Motocykl', podtytul: 'do 230 cm w klatce', ikona: 'bike', mnoznik: 1, rozrzut: 1.12, notka: 'klatka standardowa' },
  { id: 'quad', etykieta: 'Quad', podtytul: 'szerszy obrys', ikona: 'package', mnoznik: 1.35, rozrzut: 1.12, notka: 'zajmuje więcej miejsca w kontenerze' },
  { id: 'samochod', etykieta: 'Samochód', podtytul: '4×4, van', ikona: 'container', mnoznik: 2.6, rozrzut: 1.25, notka: 'wycena zawsze indywidualna' },
];

export interface Wycena {
  od: number;
  do: number;
  /** Która opcja faktycznie policzona — kierunek może nie mieć obu wariantów. */
  strony: 'jedna' | 'obie';
  /** Kierunek obsługiwany tylko w jedną albo tylko w obie strony. */
  wymuszona: boolean;
  notka: string;
}

export function policz(kierunek: Kierunek, pojazdId: Pojazd, strony: 'jedna' | 'obie'): Wycena | null {
  const pojazd = POJAZDY.find((p) => p.id === pojazdId) ?? POJAZDY[0]!;

  const tylkoObie = kierunek.cena_jedna_eur === null;
  const tylkoJedna = kierunek.cena_obie_eur === null;
  const wybrane: 'jedna' | 'obie' = tylkoObie ? 'obie' : tylkoJedna ? 'jedna' : strony;

  const baza = wybrane === 'obie' ? kierunek.cena_obie_eur : kierunek.cena_jedna_eur;
  if (baza === null) return null;

  const od = Math.round(baza * pojazd.mnoznik);
  return {
    od,
    do: Math.round(od * pojazd.rozrzut),
    strony: wybrane,
    wymuszona: tylkoObie || tylkoJedna,
    notka: pojazd.notka,
  };
}

/** Payload dla leada z konfiguratora — dokładnie to, co widział klient. */
export function doLeada(kierunek: Kierunek, pojazd: Pojazd, wycena: Wycena): KonfiguracjaTransportu {
  return {
    kierunek_id: kierunek.id,
    kierunek_podrozy: wycena.strony,
    pojazd,
    wycena_od_eur: wycena.od,
    wycena_do_eur: wycena.do,
  };
}
