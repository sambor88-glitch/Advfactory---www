# Strona advfactory.com — front

Statyczna strona (Astro SSG) budowana z `oferta.json`, którą publikuje CRM.
Zbudowany zakres (kroki 1 i 1b): start, lista i karty wypraw, transport
z konfiguratorem i terminarzem, 7 stron kierunków, 6 stron regionów, FAQ,
szuflada zapytania, „dziękujemy", 404, sitemap i robots.

## Uruchomienie lokalne

```bash
cd web
npm install
npm run dev          # http://localhost:4321
```

Bez zmiennych środowiskowych strona czyta `../docs/oferta.json` z repozytorium.
Nie potrzebuje sieci ani działającego CRM.

## Polecenia

| Polecenie | Co robi |
|---|---|
| `npm run dev` | serwer deweloperski z hot reloadem |
| `npm run build` | `astro check` (typy) + build do `dist/` |
| `npm run build:szybki` | sam build, bez sprawdzania typów |
| `npm run preview` | serwuje `dist/` na porcie 4321 |
| `npm run test:e2e` | test przeglądarkowy ścieżki sprzedażowej (wymaga `npm run preview` w tle) |
| `npm run test:linki` | sprawdza, czy żaden wewnętrzny odnośnik nie prowadzi w 404 (czyta `dist/`) |
| `npm run test:kontrakt` | sprawdza ofertę przeciw `docs/schema.ts`; przyjmuje ścieżkę albo URL |
| `npm run schemat` | przegenerowuje `docs/oferta.schema.json` ze `schema.ts` (commitowany, używa go CRM) |

`npm run build` celowo uruchamia `astro check` przed budowaniem: samo `astro build`
**nie sprawdza TypeScriptu**, więc bez tego błąd typu trafiłby na produkcję.

## Zmienne środowiskowe

| Zmienna | Kiedy | Domyślnie |
|---|---|---|
| `OFERTA_URL` | staging / prod — adres `oferta.json` wypchniętego przez CRM na S3 | fixture z `docs/oferta.json` |
| `SITE_URL` | adres kanoniczny w `<link rel="canonical">` i OG | `https://advfactory.com` |
| `PUBLIC_LEADS_URL` | endpoint `POST /leads` | pusty = tryb makiety, payload w konsoli |
| `PUBLIC_ZAINTERESOWANI_URL` | endpoint `POST /zainteresowani` | jak wyżej |

Zmienne `PUBLIC_*` trafiają do przeglądarki — nie wkładaj tam niczego tajnego.

Build jest świadomie twardy: gdy `OFERTA_URL` jest ustawione, a oferta nie odpowiada
**albo nie trzyma się kontraktu z `docs/schema.ts`**, przebudowa pada kodem 1 i nie
produkuje żadnego HTML-a. Wolimy, żeby CloudFront serwował poprzedni build, niż żeby
poszła strona bez cen i terminów.

Jak to się ma do równoległego rozwoju CRM — `docs/praca-rownolegla.md`.

## Wdrożenie krok po kroku

1. **Zbuduj**
   ```bash
   cd web
   npm ci
   OFERTA_URL=https://advfactory.com/data/oferta.json \
   SITE_URL=https://advfactory.com \
   PUBLIC_LEADS_URL=https://advfactory.com/api/leads \
   PUBLIC_ZAINTERESOWANI_URL=https://advfactory.com/api/zainteresowani \
   npm run build
   ```

2. **Wyślij na S3** — najpierw zasoby z odciskiem w nazwie (mogą leżeć w cache
   bezterminowo), potem HTML (musi być świeży przy każdej publikacji):
   ```bash
   aws s3 sync dist/ s3://advfactory-www-prod/ --delete \
     --exclude "*.html" --exclude "mapa-kierunkow.svg" \
     --cache-control "public,max-age=31536000,immutable"

   aws s3 sync dist/ s3://advfactory-www-prod/ --delete \
     --exclude "*" --include "*.html" --include "mapa-kierunkow.svg" \
     --cache-control "public,max-age=300,stale-while-revalidate=86400"
   ```

3. **Unieważnij cache CloudFrontu**
   ```bash
   aws cloudfront create-invalidation --distribution-id "$CF_ID" --paths "/*"
   ```

4. **Sprawdź** — `/`, `/wyprawy`, jedna karta wyprawy, `/transport`, `/dziekujemy?nr=TEST`
   i celowo nieistniejący adres (404).

Region: **eu-central-1**. Certyfikat ACM dla CloudFrontu musi stać w **us-east-1** —
to jedyny zasób poza Frankfurtem. Szacunek kosztów i schemat: `../docs/architektura.md`.

## Jak to jest zbudowane

```
src/
  data/oferta.ts        pobranie oferty (fixture albo S3) + selektory
  types/oferta.ts       re-eksport kontraktu z ../../docs/schema.ts
  lib/
    format.ts           daty, ceny, trudność, akapity
    konfigurator.ts     wycena transportu (mnożniki pojazdów, widełki)
    mapa.ts             mapa świata renderowana w buildzie
    ikony.ts            28 ikon lucide wklejonych jako ścieżki SVG
    nawigacja.ts        pozycje menu z flagą `gotowe`
    sciezka.ts          ostatnie widoki klienta → pole `sciezka` w leadzie
    stale.ts            wersja polityki, klucz zgody cookies
  components/           Naglowek, Stopka, KartaWyprawy, MapaKierunkow,
                        SzufladaZapytania, BannerCookies, PrzyciskiPlywajace, Ikona
  layouts/Base.astro    <head>, SEO, szkielet strony
  pages/                index, faq, dziekujemy, 404
                        wyprawy/          lista, [slug], region/[slug]
                        transport/        terminarz + konfigurator, [slug]
                        mapa-kierunkow.svg.ts
testy/
  e2e.mjs               test przeglądarkowy ścieżki sprzedażowej
  linki.mjs             wykrywacz martwych odnośników wewnętrznych
```

### Trzy decyzje, które warto znać

**Zero obcych domen przed zgodą.** Ikony lucide są wklejone jako ścieżki (28 sztuk
zamiast 368 kB biblioteki). Mapa świata renderuje się w buildzie z `d3-geo`
i `world-atlas`, a do przeglądarki idzie gotowy SVG — prototyp ciągnął d3, topojson
i geometrię z unpkg i jsDelivr przy każdym wejściu. Fonty też hostujemy u siebie
(`@fontsource`), bo Google Fonts z CDN-u wysyła IP odwiedzającego do Google zanim
ktokolwiek kliknie zgodę.

Stan sprawdzony w przeglądarce: przed zgodą jedyne żądanie poza nasz serwer idzie
po zdjęcia na `advfactory.com` (patrz ryzyko z WordPressem w `../docs/architektura.md`).
Po zgodzie dochodzi `youtube-nocookie.com`.

**Mapa czyta ceny z oferty.** W prototypie współrzędne i kwoty były wpisane
w pliku mapy, czyli stanowiły drugie źródło prawdy obok CRM. Zmiana ceny w CRM
zostawiłaby na mapie starą kwotę i nikt by tego nie zauważył.

**Puste pola chowają sekcje.** Dziś żadna z 9 wypraw nie ma opisu, planu dni
ani list „zawiera / nie zawiera". Zamiast nagłówka nad pustką karta mówi wprost,
że opis powstaje, i daje przycisk do zapytania.

## Czego jeszcze nie ma

Poza zbudowanym zakresem zostają: relacje z tras, o nas, archiwum wypraw,
polityki, panel klienta i wersja EN. Pozycje menu czekają w `src/lib/nawigacja.ts`
z flagą `gotowe: false` — po zbudowaniu widoku wystarczy ją przestawić.

Relacje, opinie i archiwum czekają nie na kod, tylko na dane: `oferta.json` ma
dziś `relacje: []`, `opinie: []` i zero wypraw ze statusem `archiwum`. Strony
zbudowane na pustych tablicach byłyby zaślepkami.

**Terminarz jest nieświeży.** Na 7 kierunków tylko Chile (2 terminy) i Kapsztad
(1 termin) mają datę pakowania w przyszłości; Kirgistan i Islandia mają wyłącznie
minione. Strona pokazuje wtedy „Termin na kolejny sezon ustalamy" zamiast dat,
które już wypłynęły — ale to jest do uzupełnienia w CRM, nie w kodzie.

Leady lecą dziś do makiety: bez `PUBLIC_LEADS_URL` payload ląduje w konsoli,
a strona zachowuje się jak przy sukcesie. Podpięcie do CRM czeka na decyzję,
w czym CRM jest i gdzie stoi.
