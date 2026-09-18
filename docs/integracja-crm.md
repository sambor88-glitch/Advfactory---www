# Integracja strony advfactory.com z CRM

**Pliki dla programisty:** `docs/schema.ts` (kontrakt typów, oba strumienie + panel), `docs/oferta.json` (przykładowa opublikowana oferta z dzisiejszych danych), `crm/Skrzynka — panel leada WWW.dc.html` (jak lead ze strony wygląda w istniejącej Skrzynce), `Stany strony.dc.html` (7 stanów błędów i ładowania z zasadami).

Krótka specyfikacja przepływu danych między stroną publiczną a CRM. Obowiązuje dla wdrożenia.

## Zasada: dwa jednokierunkowe strumienie

**Oferta: CRM → strona.** CRM jest jedynym źródłem prawdy dla wypraw, terminarza transportów, treści (FAQ, relacje, opinie), danych firmy i magazynów. Strona wyłącznie czyta. Nie ma edycji na stronie — „Tryb edycji” to tylko linki do właściwych widoków CRM.

**Leady: strona → CRM.** Formularz, konfigurator, karta wyprawy i zapisy na powiadomienia tworzą nowe rekordy w CRM. Strona nigdy nie modyfikuje istniejących danych.

Dlaczego nie dwukierunkowo: jedno źródło prawdy, publikacja świadoma (szkic → Publikuj), publiczny front bez prawa zapisu do oferty, brak konfliktów wersji.

## Publikacja oferty

1. Biuro edytuje w CRM (Katalog wypraw, Terminarz transportów, Treści strony). Zapis oznacza rekord jako „niepublikowane zmiany”.
2. Przycisk **Publikuj** generuje statyczny plik `oferta.json`, wypycha go na S3 i zapisuje wpis w historii zmian (kto, kiedy, co).
3. Publikacja odpala przebudowę strony (SSG). Do czasu jej zakończenia stary build jest nadal serwowany — nie ma okna z pustą stroną.
4. Strona czyta `oferta.json` także w przeglądarce (ceny, terminy, konfigurator), cache 5–15 min. Zmiany w CRM bez publikacji nie są widoczne publicznie.

Szczegóły wdrożenia — hosting, przebudowa, koszty — w `docs/architektura.md`.

Zawartość `oferta.json`:
- `wyprawy[]` — id, tytuł, slug, region, daty, ceny (kierowca/pasażer), trudność 1–10, `na_naszym_sprzecie`, opis, zawiera/nie zawiera, plan dni[], zdjęcia, status (`opublikowana` / `archiwum`), pola SEO (title, description).
- `kierunki[]` — id, nazwa, kraj, miasto odbioru, `geo.lat`/`geo.lon`, `cena_jedna_eur`, `cena_obie_eur`, `na_mapie`, `w_konfiguratorze`, `terminy[]` (pakowanie PL, dostawa, powrót z miejsca, powrót PL), `strona` — treść strony kierunku (h1, lead, zdjęcie, chipy, akapity, FAQ, `regiony_wypraw[]`).
- `regiony[]` — strony SEO „Wyprawy w regionie” (np. `/wyprawy/kirgistan`): h1, lead, zdjęcie, fakty, akapity, „kiedy jechać”, FAQ, powiązany `kierunek_id`, lista `relacje[]`.
- `faq[]`, `relacje[]`, `opinie[]` — tylko opublikowane, w kolejności z CRM.
- `firma` — nazwa, adres, NIP, REGON, e-mail, telefon, WhatsApp; `magazyny[]` — miasto, adres, uwagi, `widoczny`.

Geokodowanie: współrzędne kierunku ustala CRM przy zapisie (Nominatim po nazwie miasta, z ręczną korektą). Wynik zapisywany w bazie — strona nie geokoduje.

## Leady ze strony

`POST /leads` — token anty-spam (Turnstile/hCaptcha), limit częstości per IP, walidacja po stronie serwera.

Pola: imię i nazwisko, e-mail, telefon, treść, `zrodlo` (`formularz` / `konfigurator` / `karta_wyprawy`), `jezyk` (`pl` / `en`), `preferowany_kanal` (`whatsapp` / `email` / `telefon`), `wyprawa_id` (opcjonalnie), `konfiguracja` (kierunek, jedna/obie strony, pojazd, widelec ceny — opcjonalnie), `zgoda_rodo` (timestamp, IP, wersja polityki), `sciezka` (strona wejścia → strona formularza).

W CRM lead trafia do istniejącej **Skrzynki Zapytań** jako kolejne źródło obok WhatsApp, maila i telefonu. Nie ma osobnego widoku „leady WWW”. Skrzynka pokazuje pola z listy wyżej w panelu kontekstu. Deduplikacja po e-mailu/telefonie — dopięcie do istniejącego kontaktu.

### Routing do lejka sprzedaży

Reguła po stronie CRM, strona o lejku nic nie wie.

| `zrodlo` | Skrzynka | Lejek |
|---|---|---|
| `konfigurator` | wątek | **karta na 1. etapie**, wartość szacowana = `wycena_od`–`wycena_do` |
| `karta_wyprawy` | wątek | **karta na 1. etapie**, wartość szacowana = cena wyprawy (kierowca) |
| `formularz` | wątek | nie — kartę zakłada operator, gdy zapytanie okaże się sprzedażowe |
| `strona_kierunku` | wątek | nie — jak wyżej |

Dlaczego tak: lead z konfiguratora albo z karty wyprawy niesie ze sobą intencję zakupową i kwotę, więc od razu ma miejsce w lejku. Ogólny formularz kontaktowy zbiera też pytania o fakturę, reklamacje i spam — te zaśmiecałyby prognozę sprzedaży.

Karta w lejku pokazuje źródło `WWW`, podtyp (Konfigurator / Karta wyprawy) i wartość szacowaną. **Deduplikacja:** jeśli kontakt ma już otwartą kartę w lejku, nowy lead dopina się do niej zamiast tworzyć drugą.

`POST /zainteresowani` — e-mail, kierunki[], język, zgoda. Trafia na listę **Zainteresowani terminem**, nie do skrzynki ani lejka. Do lejka przechodzi po powiadomieniu o nowym terminie i zapytaniu klienta, albo ręcznie.

## Panel klienta

Konto zakłada biuro w CRM przy podpisaniu umowy; klient nie rejestruje się sam. Login mailem, reset hasła linkiem ważnym 30 min. Panel czyta z CRM: status transportu (oś czasu), płatności, dokumenty, checklistę, wątek wiadomości. Zapisuje do CRM tylko: ustawienia powiadomień, wiadomości w wątku, odhaczenia checklisty.

## Powiadomienia o statusie

Wysyłane z CRM w chwili zatwierdzenia statusu przez biuro (nie automatem z maila agencji). Kanały: WhatsApp, SMS, e-mail — wg ustawień klienta w panelu. Sześć zdarzeń: przyjęty, zapakowany, odprawa, wypłynął, dotarł, gotowy do odbioru.

## Ustawienia strony (CRM → strona)

Widok **Ustawienia strony** w CRM trzyma to, co wcześniej było w kodzie: kanały kontaktu (WhatsApp, telefon, e-mail, nadawca maili z panelu), obietnicę czasu odpowiedzi (steruje też alertem w Skrzynce), godziny biura, hero strony głównej (nadtytuł, tytuł, lead, zdjęcie), baner informacyjny (treść, link, data wygaśnięcia, ton), trzy linki YouTube, domyślne SEO (szablon tytułu, opis, obrazek OG), identyfikatory GA4 i Meta Pixel (ładowane dopiero po zgodzie cookies). Publikacja jak reszta oferty. Historia publikacji z przywracaniem całego stanu strony.

## Strony kierunków i regionów (do dołożenia w CRM)

Strona ma dwie rodziny landingów SEO. Obie są dziś zaszyte w kodzie prototypu; docelowo edytuje je CRM.

**Strony kierunków transportu** — 7 sztuk, po jednej na kierunek (`/transport/kirgistan-biszkek`). Pole `Kierunek.strona` w `oferta.json`. Widok **Terminarz transportów** dostaje w szufladzie sekcję „Strona kierunku”: h1, lead, zdjęcie, trzy chipy (ikona lucide + tekst), akapity, FAQ, wybór regionów wypraw do sekcji „Wyprawy w tym regionie”. Dziś widok ma tylko lead i SEO.

**Strony regionów wypraw** — 6 sztuk (`/wyprawy/kirgistan`). Nowa gałąź `regiony[]` w `oferta.json` i **nowy widok CRM „Strony regionów”**: h1, lead, zdjęcie, tabelka faktów (sezon, trudność, motocykl, formalności), h2 + akapity, tabelka „kiedy jechać”, FAQ, powiązany kierunek transportu, wybór relacji do sekcji „Przeczytaj”.

Powiązanie wypraw z regionem jest **jawne** (`Wyprawa.region_strony` = slug regionu), nie po słowach kluczowych w tytule. Prototyp dopasowuje po tytule i przy nowej wyprawie potrafi ją zgubić albo wrzucić do złego regionu.

Kierunki bez własnego regionu (Islandia, Islamabad) mają `regiony_wypraw: []` — sekcja „Wyprawy w tym regionie” po prostu się nie renderuje.

## SEO per strona

Wyprawy (Katalog) i kierunki (Terminarz) mają w szufladzie sekcję SEO: tytuł w Google (limit 60), opis (limit 155), slug generowany z tytułu z możliwością korekty, podgląd wyniku Google. Kierunki mają dodatkowo lead strony kierunku. Puste pola = wartości domyślne z tytułu/opisu. Relacje: tytuł wpisu jest tytułem strony.

## Stany błędów (skrót — pełna specyfikacja w `Stany strony.dc.html`)

Oferta: skeleton do 8 s, potem ostatnia wersja z cache z datą i auto-retry. Formularz: treść nigdy nie ginie, przy błędzie przycisk „Wyślij na WhatsApp” z prefillem, kod referencyjny do zgłoszenia. Panel: jeden komunikat dla złego maila/hasła, blokada po 5 próbach; przy braku CRM ostatni znany status z cache. Offline: service worker cache-first dla `oferta.json`, kolejka `POST /leads`.

## Wersja EN

Osobny plik `en.html`; teksty interfejsu tłumaczone, opisy wypraw i relacje po polsku z adnotacją. Pola EN w CRM (tytuł, lead) opcjonalne — brak = polski tekst.
