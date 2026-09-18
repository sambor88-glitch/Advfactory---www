/**
 * Jedno miejsce na całą nawigację. `gotowe: false` znaczy, że widok jeszcze nie
 * powstał (krok 1b/1c) — wtedy link się nie renderuje. Nie chcemy nagłówka,
 * który prowadzi w 404, i nie chcemy zaślepek udających gotowe strony.
 */
export interface Pozycja {
  etykieta: string;
  url: string;
  gotowe: boolean;
}

export const NAWIGACJA_GLOWNA: Pozycja[] = [
  { etykieta: 'Wyprawy', url: '/wyprawy', gotowe: true },
  { etykieta: 'Transport pojazdów', url: '/transport', gotowe: true },
  { etykieta: 'Relacje z tras', url: '/relacje', gotowe: false },
  { etykieta: 'FAQ', url: '/faq', gotowe: false },
  { etykieta: 'Kontakt', url: '/kontakt', gotowe: false },
];

export const STOPKA_OFERTA: Pozycja[] = [
  { etykieta: 'Wyprawy', url: '/wyprawy', gotowe: true },
  { etykieta: 'Transport pojazdów', url: '/transport', gotowe: true },
  { etykieta: 'Terminarz kontenerów', url: '/transport#terminarz', gotowe: true },
];

export const STOPKA_INFORMACJE: Pozycja[] = [
  { etykieta: 'O nas', url: '/o-nas', gotowe: false },
  { etykieta: 'Relacje z tras', url: '/relacje', gotowe: false },
  { etykieta: 'FAQ', url: '/faq', gotowe: false },
  { etykieta: 'Kontakt', url: '/kontakt', gotowe: false },
  { etykieta: 'Regulamin transportu', url: '/regulamin-transportu', gotowe: false },
  { etykieta: 'Warunki uczestnictwa', url: '/warunki-uczestnictwa', gotowe: false },
  { etykieta: 'Polityka prywatności', url: '/polityka-prywatnosci', gotowe: false },
  { etykieta: 'Polityka cookies', url: '/polityka-cookies', gotowe: false },
  { etykieta: 'Archiwum wypraw', url: '/archiwum', gotowe: false },
  { etykieta: 'Panel klienta', url: '/panel', gotowe: false },
];

export const gotowe = (p: Pozycja[]): Pozycja[] => p.filter((x) => x.gotowe);
