/**
 * Wersja polityki prywatności — trafia do `zgoda_rodo.wersja_polityki` przy
 * każdym leadzie i do zapisu zgody cookies. Docelowo powinna przyjść z CRM
 * (widok „Treści strony"), dziś jej tam nie ma — patrz `docs/architektura.md`.
 */
export const WERSJA_POLITYKI = '2026-09-09';

/** Klucz zgody cookies w localStorage. Zmiana = ponowne pytanie wszystkich. */
export const KLUCZ_ZGODY = 'adv-cookies-v1';

/** Ile ostatnich widoków trzymamy w `sciezka` leada. */
export const DLUGOSC_SCIEZKI = 4;

/**
 * Rok pierwszego transportu — liczba z hero prototypu. Nie ma jej w `oferta.json`;
 * docelowo powinna siedzieć w „Ustawieniach strony" obok danych firmy.
 */
export const ROK_ZALOZENIA = 2008;
