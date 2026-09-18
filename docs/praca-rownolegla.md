# Jak budować stronę i CRM równolegle

Strona powstaje tutaj, CRM w `advfactory-crm`, obie rzeczy w tym samym czasie
i przez różne osoby. To jest ustalenie, jak się nie rozjechać.

## Zasada: kontrakt jest jedyną granicą

Oba systemy stykają się w **jednym** miejscu — kształcie `oferta.json`, opisanym
w `docs/schema.ts`. Poza tym kształtem nie wiedzą o sobie nic.

- Strona **importuje typy wprost** z `docs/schema.ts`. Nie ma kopii, więc nie ma
  czego rozjechać po stronie frontu.
- CRM dostaje ten sam kontrakt jako **`docs/oferta.schema.json`** — JSON Schema
  generowana z tego samego pliku TypeScript. PHP nie czyta TypeScriptu, ale
  JSON Schema czyta (`opis/json-schema`).

Plik `oferta.schema.json` jest commitowany i CI pilnuje, żeby był aktualny wobec
`schema.ts`. Gdyby ktoś zmienił kontrakt i zapomniał go przegenerować, CRM
walidowałby przeciw nieaktualnej wersji — a to jest dokładnie ten cichy rozjazd,
którego unikamy.

## Trzy tryby danych

Strona buduje się z jednego z trzech źródeł. Decyduje o tym jedna zmienna
środowiskowa, kod jest ten sam.

| Gdzie | `OFERTA_URL` | Skąd dane | Po co |
|---|---|---|---|
| lokalnie, CI | nie ustawione | `docs/oferta.json` z repo | szybko, offline, deterministycznie |
| staging | URL z CRM testowego | publikacja z CRM testowego | pierwszy realny kontakt obu systemów |
| produkcja | URL z CRM produkcyjnego | publikacja z CRM produkcyjnego | |

**Fixture w repo jest atrapą CRM-a.** Dziś wygenerowałem go ręcznie z prototypu.
Gdy tylko CRM będzie umiał opublikować ofertę, fixture przestaje być moim wytworem
i staje się **zrzutem z CRM testowego**, commitowanym do repo. Od tego momentu
każda zmiana kształtu po stronie CRM jest widoczna w diffie pull requesta.

To jest moment, w którym równoległa praca przestaje być ryzykiem.

## Trzy bramki

Rozjazd ma wychodzić w CI, nie u klienta.

**1. `npm run test:kontrakt`** — sprawdza plik oferty przeciw `schema.ts`:
kształt (JSON Schema) plus powiązania, których JSON Schema nie złapie:
`region_strony` wskazujące na nieistniejący region, kierunek `na_mapie` bez
współrzędnych, zdublowane slugi w obrębie jednej przestrzeni adresów.

Działa też na żywym CRM:

```bash
npm run test:kontrakt -- https://crm-test.advfactory.com/public/oferta.json
```

To jest polecenie, którym osoba pracująca nad CRM sprawdza swoją publikację,
zanim ktokolwiek wdroży stronę.

**2. Walidacja w buildzie.** Gdy `OFERTA_URL` jest ustawione, strona sprawdza
pobraną ofertę **zanim** wygeneruje z niej podstrony. Oferta niezgodna
z kontraktem przerywa przebudowę kodem wyjścia 1 i nie produkuje żadnego HTML-a.

Dzięki temu CloudFront serwuje dalej **poprzednią** wersję strony. Awaria po
stronie CRM nie zamienia się w publiczną stronę bez cen i terminów.

**3. GitHub Actions** (`.github/workflows/strona.yml`) — na każdy push i na
`repository_dispatch` z CRM po „Publikuj": aktualność schematu, kontrakt, typy,
build, martwe odnośniki, ścieżka sprzedażowa w przeglądarce.

## Kolejność, która nikogo nie blokuje

Żaden krok nie czeka na drugi zespół dłużej niż jeden krok.

| # | Kto | Co | Co się przez to odblokowuje |
|---|---|---|---|
| 1 | strona | buduje się z fixture | **zrobione** — 28 stron działa dziś, bez CRM |
| 2 | CRM | `zbuduj()` + publikacja na S3 | fixture zastąpiony zrzutem z CRM testowego |
| 3 | strona | staging czyta z CRM testowego | pierwszy realny przepływ oferty |
| 4 | CRM | `POST /api/leads` | strona na stagingu wysyła prawdziwe leady |
| 5 | oba | produkcja | |

Strona jest dziś na kroku 1 i może stać na stagingu bez żadnej gotowości CRM —
czyta wtedy fixture. **Pokazanie strony klientowi nie wymaga działającego CRM.**

## Gdy kontrakt trzeba zmienić

Będzie trzeba — przy stronach regionów już raz było. Procedura:

1. Zmiana idzie do `docs/schema.ts` **najpierw**, w osobnym pull requeście.
2. `npm run schemat` i commit wygenerowanego `oferta.schema.json`.
3. `npm run test:kontrakt` na fixture — pokaże, co trzeba uzupełnić w danych.
4. Dopiero potem obie strony implementują.

**Pole dodawane jako opcjonalne (`| null`) nie psuje niczego** i może wejść w dowolnej
kolejności. Pole wymagane albo usunięte łamie drugą stronę, więc wchodzi razem
z odpowiadającą zmianą w CRM.

Przy dużej zmianie prostsze niż wersjonowanie schematu jest publikowanie nowej
oferty pod nowym adresem (`oferta-v2.json`) i przełączenie `OFERTA_URL` dopiero,
gdy strona jest gotowa. Stary adres działa, dopóki nie zniknie potrzeba.

## Co jest dziś atrapą

Żeby nie było złudzeń, czego jeszcze nie ma:

- **Leady lecą do makiety.** Bez `PUBLIC_LEADS_URL` payload ląduje w konsoli
  przeglądarki, a strona zachowuje się jak przy sukcesie. Kształt payloadu jest
  już zgodny z `LeadWWW`, więc podpięcie to jedna zmienna.
- **`oferta.json` jest wytworem ręcznym**, nie zrzutem z CRM. Do kroku 2.
- **Terminarz jest nieświeży** — na 7 kierunków tylko Chile i Kapsztad mają datę
  pakowania w przyszłości. To dane, nie kod.
- **Relacje, opinie i archiwum są puste** w ofercie, więc strony na nich oparte
  nie powstały. Zbudowanie ich dziś dałoby zaślepki.
