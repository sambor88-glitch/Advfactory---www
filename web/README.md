# Strona advfactory.com — front

Statyczna strona (Astro SSG) budowana z `oferta.json`, którą publikuje CRM.
Zakres kroku 1: rdzeń sprzedażowy — start, wyprawy, karta wyprawy, transport
z konfiguratorem, szuflada zapytania, dziękujemy, 404.

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

Build jest świadomie twardy: gdy `OFERTA_URL` jest ustawione i nie odpowiada,
przebudowa pada. Wolimy, żeby CloudFront serwował poprzedni build, niż żeby
poszła strona bez cen i terminów.

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
  pages/                index, wyprawy/, transport/, dziekujemy, 404,
                        mapa-kierunkow.svg.ts
testy/e2e.mjs           test przeglądarkowy ścieżki sprzedażowej
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

Krok 1 to ścieżka sprzedażowa. Poza nią zostają: strony kierunków i regionów,
relacje, FAQ jako osobna strona, o nas, archiwum, polityki, panel klienta
i wersja EN. Pozycje menu są w `src/lib/nawigacja.ts` z flagą `gotowe: false` —
po zbudowaniu widoku wystarczy przestawić flagę.

Leady lecą dziś do makiety: bez `PUBLIC_LEADS_URL` payload ląduje w konsoli,
a strona zachowuje się jak przy sukcesie. Podpięcie do CRM czeka na decyzję,
w czym CRM jest i gdzie stoi.
