# Integracja strony advfactory.com z CRM

**Pliki dla programisty:** `docs/schema.ts` (kontrakt typów, oba strumienie + panel), `docs/oferta.json` (przykładowa opublikowana oferta z dzisiejszych danych), `crm/Skrzynka — panel leada WWW.dc.html` (jak lead ze strony wygląda w istniejącej Skrzynce), `Stany strony.dc.html` (7 stanów błędów i ładowania z zasadami).

Krótka specyfikacja przepływu danych między stroną publiczną a CRM. Obowiązuje dla wdrożenia.

## Zasada: dwa jednokierunkowe strumienie

**Oferta: CRM → strona.** CRM jest jedynym źródłem prawdy dla wypraw, terminarza transportów, treści (FAQ, relacje, opinie), danych firmy i magazynów. Strona wyłącznie czyta. Nie ma edycji na stronie — „Tryb edycji” to tylko linki do właściwych widoków CRM.

**Leady: strona → CRM.** Formularz, konfigurator, karta wyprawy i zapisy na powiadomienia tworzą nowe rekordy w CRM. Strona nigdy nie modyfikuje istniejących danych.

Dlaczego nie dwukierunkowo: jedno źródło prawdy, publikacja świadoma (szkic → Publikuj), publiczny front bez prawa zapisu do oferty, brak konfliktów wersji.

## Publikacja oferty

1. Biuro edytuje w CRM (Katalog wypraw, Terminarz transportów, Treści strony). Zapis oznacza rekord jako „niepublikowane zmiany”.
2. Przycisk **Publikuj** generuje statyczny plik `GET /public/oferta.json` (lub odświeża cache API) i zapisuje wpis w historii zmian (kto, kiedy, co).
3. Strona pobiera `oferta.json` przy wejściu, cache 5–15 min. Zmiany w CRM bez publikacji nie są widoczne publicznie.

Zawartość `oferta.json`:
- `wyprawy[]` — id, tytuł, slug, region, daty, ceny (kierowca/pasażer), trudność 1–10, `na_naszym_sprzecie`, opis, zawiera/nie zawiera, plan dni[], zdjęcia, status (`opublikowana` / `archiwum`), pola SEO (title, description).
- `kierunki[]` — id, nazwa, miasto odbioru, `lat`, `lon`, `cena_jedna`, `cena_obie`, `na_mapie`, `w_konfiguratorze`, `terminy[]` (pakowanie PL, dostawa, powrót z miejsca, powrót PL), miasta powrotu, treść strony kierunku (lead, akapity, FAQ).
- `faq[]`, `relacje[]`, `opinie[]` — tylko opublikowane, w kolejności z CRM.
- `firma` — nazwa, adres, NIP, REGON, e-mail, telefon, WhatsApp; `magazyny[]` — miasto, adres, uwagi, `widoczny`.

Geokodowanie: współrzędne kierunku ustala CRM przy zapisie (Nominatim po nazwie miasta, z ręczną korektą). Wynik zapisywany w bazie — strona nie geokoduje.

## Leady ze strony

`POST /leads` — token anty-spam (Turnstile/hCaptcha), limit częstości per IP, walidacja po stronie serwera.

Pola: imię i nazwisko, e-mail, telefon, treść, `zrodlo` (`formularz` / `konfigurator` / `karta_wyprawy`), `jezyk` (`pl` / `en`), `preferowany_kanal` (`whatsapp` / `email` / `telefon`), `wyprawa_id` (opcjonalnie), `konfiguracja` (kierunek, jedna/obie strony, pojazd, widelec ceny — opcjonalnie), `zgoda_rodo` (timestamp, IP, wersja polityki), `sciezka` (strona wejścia → strona formularza).

W CRM lead trafia do istniejącej **Skrzynki Zapytań** jako kolejne źródło obok WhatsApp, maila i telefonu. Nie ma osobnego widoku „leady WWW”. Skrzynka pokazuje pola z listy wyżej w panelu kontekstu. Deduplikacja po e-mailu/telefonie — dopięcie do istniejącego kontaktu.

`POST /zainteresowani` — e-mail, kierunki[], język, zgoda. Trafia na listę **Zainteresowani terminem**, nie do skrzynki ani lejka. Do lejka przechodzi po powiadomieniu o nowym terminie i zapytaniu klienta, albo ręcznie.

## Panel klienta

Konto zakłada biuro w CRM przy podpisaniu umowy; klient nie rejestruje się sam. Login mailem, reset hasła linkiem ważnym 30 min. Panel czyta z CRM: status transportu (oś czasu), płatności, dokumenty, checklistę, wątek wiadomości. Zapisuje do CRM tylko: ustawienia powiadomień, wiadomości w wątku, odhaczenia checklisty.

## Powiadomienia o statusie

Wysyłane z CRM w chwili zatwierdzenia statusu przez biuro (nie automatem z maila agencji). Kanały: WhatsApp, SMS, e-mail — wg ustawień klienta w panelu. Sześć zdarzeń: przyjęty, zapakowany, odprawa, wypłynął, dotarł, gotowy do odbioru.

## Ustawienia strony (CRM → strona)

Widok **Ustawienia strony** w CRM trzyma to, co wcześniej było w kodzie: kanały kontaktu (WhatsApp, telefon, e-mail, nadawca maili z panelu), obietnicę czasu odpowiedzi (steruje też alertem w Skrzynce), godziny biura, hero strony głównej (nadtytuł, tytuł, lead, zdjęcie), baner informacyjny (treść, link, data wygaśnięcia, ton), trzy linki YouTube, domyślne SEO (szablon tytułu, opis, obrazek OG), identyfikatory GA4 i Meta Pixel (ładowane dopiero po zgodzie cookies). Publikacja jak reszta oferty. Historia publikacji z przywracaniem całego stanu strony.

## SEO per strona

Wyprawy (Katalog) i kierunki (Terminarz) mają w szufladzie sekcję SEO: tytuł w Google (limit 60), opis (limit 155), slug generowany z tytułu z możliwością korekty, podgląd wyniku Google. Kierunki mają dodatkowo lead strony kierunku. Puste pola = wartości domyślne z tytułu/opisu. Relacje: tytuł wpisu jest tytułem strony.

## Stany błędów (skrót — pełna specyfikacja w `Stany strony.dc.html`)

Oferta: skeleton do 8 s, potem ostatnia wersja z cache z datą i auto-retry. Formularz: treść nigdy nie ginie, przy błędzie przycisk „Wyślij na WhatsApp” z prefillem, kod referencyjny do zgłoszenia. Panel: jeden komunikat dla złego maila/hasła, blokada po 5 próbach; przy braku CRM ostatni znany status z cache. Offline: service worker cache-first dla `oferta.json`, kolejka `POST /leads`.

## Wersja EN

Osobny plik `en.html`; teksty interfejsu tłumaczone, opisy wypraw i relacje po polsku z adnotacją. Pola EN w CRM (tytuł, lead) opcjonalne — brak = polski tekst.
