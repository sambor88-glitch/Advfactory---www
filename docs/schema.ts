/**
 * Kontrakt danych: strona advfactory.com ⇄ CRM.
 * Jeden plik, dwa strumienie:
 *   CRM → strona:  Oferta (GET /public/oferta.json, generowane przy „Publikuj”)
 *   strona → CRM:  LeadWWW (POST /leads), Zainteresowany (POST /zainteresowani)
 * Panel klienta czyta z CRM i zapisuje tylko to, co w sekcji Panel.
 * Nazwy pól po polsku, snake_case — jak w bazie CRM. Daty ISO 8601 (YYYY-MM-DD lub pełny timestamp).
 */

// ───────────────────────── OFERTA (CRM → strona) ─────────────────────────

export interface Oferta {
  _meta: {
    wersja: number;            // rośnie z każdą publikacją; służy do rollbacku
    opublikowano: string;
    przez: string;
    uwaga?: string | null;     // notatka publikującego, nigdzie nie pokazywana
  };
  firma: Firma;
  magazyny: Magazyn[];
  ustawienia: UstawieniaStrony;
  wyprawy: Wyprawa[];        // tylko status "opublikowana" | "archiwum"
  kierunki: Kierunek[];      // tylko status "opublikowany"
  regiony: RegionWypraw[];   // strony SEO „Wyprawy w regionie” — tylko status "opublikowany"
  faq: Faq[];                // tylko opublikowane, w kolejności
  relacje: Relacja[];
  opinie: Opinia[];
}

export interface Firma {
  nazwa: string; adres: string; nip: string; regon: string;
  email: string; telefon: string; whatsapp: string;   // E.164 lub „+48 …”
  nadawca_panelu: string;                              // adres, z którego idą maile z panelu
}

export interface Magazyn { miasto: string; adres: string | null; uwagi: string | null; widoczny: boolean }

export interface UstawieniaStrony {
  odpowiedz_w_godzinach: number;                       // obietnica na stronie + próg alertu w Skrzynce
  godziny_biura: { tekst: string; pokazuj: boolean };
  hero: { nadtytul: string; tytul: string; lead: string; zdjecie: string };
  baner: { wlaczony: boolean; tekst: string | null; link: string | null; wygasa: string | null; ton: 'accent' | 'info' | 'warn' };
  wideo_youtube: string[];                             // max 3, pierwszy = duży kadr
  seo: { szablon_tytulu: string; opis: string; og_image: string };  // {title} podmienia się na tytuł strony
  analityka: { ga4: string | null; meta_pixel: string | null };     // ładowane dopiero po zgodzie cookies
}

export type StatusWyprawy = 'szkic' | 'opublikowana' | 'archiwum';

export interface Wyprawa {
  id: string; slug: string; status: StatusWyprawy;
  tytul: string;
  region: string;                                      // filtr na liście wypraw: "Azja" | "Afryka" | "Ameryka Płd." | "Ameryka Płn."
  region_strony: string | null;                        // slug z `regiony[]`; null = wyprawa bez strony regionu
  termin: { od: string | null; do: string | null; raw?: string };
  cena: { kierowca_eur: number | null; pasazer_eur: number | null; opis: string };  // opis = tekst jak na stronie
  trudnosc: number;                                    // 1–10
  na_naszym_sprzecie: boolean;                         // Honda CRF300L w cenie
  zdjecie: string;                                     // hero karty; docelowo id z biblioteki mediów
  opis: string | null;                                 // akapity oddzielone pustą linią
  zawiera: string[]; nie_zawiera: string[];
  plan_dni: { dzien: number; tytul: string; opis: string }[];
  seo: { tytul: string | null; opis: string | null };  // null = domyślne z tytułu/opisu
  en: { tytul: string | null; lead: string | null };   // null = pokazuj PL z adnotacją
}

export type StatusKierunku = 'szkic' | 'opublikowany' | 'archiwum';

export interface Kierunek {
  id: string; slug: string; status: StatusKierunku;
  nazwa: string; kraj: string | null; miasto_odbioru: string | null; uwagi: string | null;
  geo: { lat: number; lon: number; zrodlo: 'geokoder' | 'reczne' } | null;   // ustala CRM przy zapisie; strona nie geokoduje
  cena_jedna_eur: number | null;                       // null = kierunek tylko w obie strony
  cena_obie_eur: number | null;                        // null = kierunek tylko w jedną stronę
  na_mapie: boolean; w_konfiguratorze: boolean;
  terminy: TerminTransportu[];
  strona: StronaKierunku | null;                       // null = brak strony SEO, tylko wiersz w terminarzu
  seo: { tytul: string | null; opis: string | null };
}

export interface TerminTransportu {
  pakowanie_pl: string | null; dostawa: string | null;
  powrot_z_miejsca: string | null; powrot_pl: string | null;
}

export interface StronaKierunku {
  h1: string; lead: string;
  zdjecie: string | null;                              // hero strony kierunku
  chips: [ikona: string, tekst: string][];             // ikona = nazwa lucide
  akapity: string[];
  faq: { q: string; a: string }[];
  regiony_wypraw: string[];                            // slugi z `regiony[]` → sekcja „Wyprawy w tym regionie”; [] = sekcji nie ma
}

export type StatusRegionu = 'szkic' | 'opublikowany' | 'archiwum';

/**
 * Strona regionu wypraw (np. /wyprawy/kirgistan) — landing SEO pod frazy „wyprawy motocyklowe do…”.
 * Edytowana w CRM (widok „Strony regionów”). Wyprawy podpinają się przez `Wyprawa.region_strony`,
 * bez dopasowywania po słowach w tytule.
 */
export interface RegionWypraw {
  id: string; slug: string; status: StatusRegionu;
  nazwa: string;                                       // etykieta w nawigacji, np. „Kirgistan i Pamir”
  h1: string; lead: string; zdjecie: string;
  kierunek_id: string | null;                          // powiązany kierunek transportu → blok „Wyślij tu motocykl”
  fakty: [etykieta: string, wartosc: string][];        // tabelka sezon / trudność / motocykl / formalności
  h2: string | null;
  akapity: string[];
  kiedy_jechac: [okres: string, opis: string][];       // sekcja „Kiedy jechać”
  faq: { q: string; a: string }[];
  relacje: string[];                                   // id z `relacje[]` → sekcja „Przeczytaj”
  kolejnosc: number;
  seo: { tytul: string | null; opis: string | null };
}

export interface Faq { id: string; pytanie: string; odpowiedz: string; sekcja: 'transport' | 'wyprawy'; kolejnosc: number; opublikowane: boolean }
export interface Relacja { id: string; slug: string; tytul: string; temat: string; czas_czytania_min: number; data: string; lead: string; zdjecie: string; tresc: string; opublikowana: boolean }
export interface Opinia { id: string; imie_nazwisko: string; motocykl: string; wyprawa: string; cytat: string; zdjecie: string | null; zgoda_uczestnika: boolean; opublikowana: boolean }

// ───────────────────────── LEADY (strona → CRM) ─────────────────────────

export type ZrodloLeada = 'formularz' | 'konfigurator' | 'karta_wyprawy' | 'strona_kierunku';
export type Kanal = 'whatsapp' | 'email' | 'telefon';

/**
 * POST /zgloszenia/strona — trasa w module Lejek (ADV-81).
 * Odpowiednik po stronie CRM: `ZgloszenieZeStronyRequest` w repozytorium advfactory-crm.
 *
 * Skrzynka Zapytań i lejek to JEDNA tabela `zapytania` z kolumną `etap`, nie dwa byty.
 * Każde zgłoszenie zakłada zapytanie w etapie `nowe` z kanałem `formularz` — rozróżnienia
 * „wątek w skrzynce ALBO karta w lejku” nie ma i nie było; wcześniejszy opis tego kontraktu
 * był zgadywaniem sprzed wglądu w kod CRM.
 *
 * Czego CRM NIE zakłada drugi raz: zgłoszenie tego samego kontaktu, o ten sam produkt
 * i ten sam przedmiot, przy sprawie otwartej (etap inny niż `wygrane`/`przegrane`) dopina się
 * do niej jako wpis w historii i dostaje TEN SAM `numer_sprawy`. Odpowiedź: 201 przy nowej
 * sprawie, 200 przy dopisku.
 *
 * Uwierzytelnienie: HMAC-SHA256 z treści żądania w nagłówku `X-Advfactory-Podpis`, kluczem
 * ze wspólnego sekretu. Strona statyczna sama go nie policzy — sekret w kodzie wysyłanym
 * do przeglądarki przestaje być sekretem. Ostatni odcinek (przeglądarka → CRM) czeka
 * na decyzję: pośrednik trzymający sekret albo sprawdzanie `antyspam_token` po stronie CRM.
 */
export interface LeadWWW {
  imie_nazwisko: string; email: string; telefon: string | null;
  tresc: string;
  zrodlo: ZrodloLeada;
  jezyk: 'pl' | 'en';
  preferowany_kanal: Kanal;
  wyprawa_id: string | null;                           // gdy pyta z karty wyprawy
  wyprawa_nazwa: string | null;                        // nazwa obok id — patrz niżej
  kierunek_id: string | null;                          // gdy pyta ze strony kierunku
  kierunek_nazwa: string | null;
  konfiguracja: KonfiguracjaTransportu | null;         // gdy przyszedł z konfiguratora
  // `ip` dopisuje CRM z żądania. Przeglądarka swojego publicznego adresu nie zna,
  // a gdyby go podawała, byłaby to wartość podana przez zgłaszającego — dowód niewart trzymania.
  zgoda_rodo: { timestamp: string; ip?: string; wersja_polityki: string };
  sciezka: string[];                                   // np. ["start","transport","konfigurator","formularz"]
  antyspam_token: string;                              // Turnstile / hCaptcha
}

/*
 * Dlaczego nazwy jadą obok identyfikatorów:
 * zapytanie w CRM jest zapisem historycznym i ma mówić „Pamir 2027” także wtedy, gdy wyprawa
 * dawno zeszła ze strony, a `wyp-001` wskazuje już na coś innego. Dopóki oferta na stronie nie
 * pochodzi z CRM-u, katalog strony i katalog CRM-u to dwa różne zbiory — nie ma czego wiązać
 * kluczem obcym, a sam identyfikator nic biuru nie mówi.
 */

export interface KonfiguracjaTransportu {
  kierunek_id: string; kierunek_nazwa: string; kierunek_podrozy: 'jedna' | 'obie';
  pojazd: 'motocykl' | 'quad' | 'samochod';
  wycena_od_eur: number; wycena_do_eur: number | null;  // widelec, który klient WIDZIAŁ — oferta może się różnić
}

/** Odpowiedź serwera po POST /leads. numer_sprawy pokazuje strona „dziękujemy”. */
export interface LeadOdpowiedz { ok: true; numer_sprawy: string; odpowiedz_w_godzinach: number }

/** POST /zainteresowani — osobna lista, NIE skrzynka i NIE lejek. */
export interface Zainteresowany {
  email: string; kierunki: string[];                   // nazwy regionów jak na stronie: "Patagonia", "Kirgistan"…
  jezyk: 'pl' | 'en';
  zgoda: { timestamp: string; ip: string };
}

// ───────────────────────── PANEL KLIENTA ─────────────────────────

/** GET /panel/me — wszystko, co panel pokazuje. Tylko odczyt. */
export interface PanelKlienta {
  klient: { imie_nazwisko: string; email: string; od_roku: number; opiekun: string };
  transport: TransportKlienta | null;
  wyprawa: WyprawaKlienta | null;
  platnosci: { pozycja: string; kwota_eur: number; termin: string; status: 'zaplacona' | 'oczekuje' | 'po_terminie' }[];
  dokumenty: { nazwa: string; status: 'do_podpisu' | 'podpisany' | 'informacyjny'; url: string }[];
  checklista: { id: string; tekst: string; odhaczone: boolean }[];
  watek: Wiadomosc[];
  powiadomienia: UstawieniaPowiadomien;
}

export type EtapTransportu = 'przyjety' | 'zapakowany' | 'odprawa' | 'wyplynal' | 'dotarl' | 'gotowy_do_odbioru';

export interface TransportKlienta {
  numer: string; pojazd: string; rejestracja: string; kontener: string | null;
  trasa: { z: string; do: string }; eta: string | null;
  etapy: { etap: EtapTransportu; data: string | null; meta: string | null; stan: 'zrobione' | 'teraz' | 'planowane' }[];
}

export interface WyprawaKlienta { wyprawa_id: string; tytul: string; termin: { od: string; do: string }; status: 'zaliczka' | 'oplacona' | 'zakonczona' }

export interface Wiadomosc { id: string; kanal: Kanal | 'panel'; tresc: string; timestamp: string; od_klienta: boolean }

/** PATCH /panel/powiadomienia — jedyne ustawienie, które panel zapisuje. */
export interface UstawieniaPowiadomien {
  kanaly: { whatsapp: boolean; sms: boolean; email: boolean };
  etapy: EtapTransportu[];
}

/** POST /panel/watek — wiadomość od klienta. Ląduje w tym samym wątku co WhatsApp/mail w Skrzynce. */
export interface NowaWiadomosc { tresc: string }

/** PATCH /panel/checklista/:id */
export interface OdhaczChecklista { odhaczone: boolean }

// ───────────────────────── AUTH ─────────────────────────

/** POST /auth/reset — odpowiedź zawsze 200, niezależnie czy e-mail istnieje (nie zdradzamy klientów). Link ważny 30 min, jednorazowy. */
export interface ResetHasla { email: string }
