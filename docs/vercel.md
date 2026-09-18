# Vercel — dwa projekty, dwa podglądy

Z tego samego repozytorium budują się **dwa niezależne projekty**. Żaden nie
przykrywa drugiego, bo każdy ma własny Root Directory i własny `vercel.json`.

| Projekt | Root Directory | Serwuje | Adres |
|---|---|---|---|
| `advfactory-www` | `deploy` | klikalny prototyp do oceny | `…/podglad` |
| `advfactory-web` | `web` | właściwa strona w Astro | `advfactory-web.vercel.app` |

Oba mają `X-Robots-Tag: noindex`, żeby nie konkurowały w Google z advfactory.com.

**To nie jest docelowy hosting strony.** Produkcja i staging idą na AWS
(S3 + CloudFront, `docs/architektura.md`). Vercel służy do oglądania zmian
pod linkiem, zanim trafią na produkcję.

## Jak to działa na co dzień

Każdy push na gałąź buduje oba projekty i daje dwa adresy podglądu. Można je
otworzyć obok siebie i porównać: prototyp pokazuje, jak zaprojektowano,
`advfactory-web` — co faktycznie stoi.

Różnice są oczekiwane. Część to świadome decyzje (mapa renderowana w buildzie,
własne fonty, ceny z separatorem tysięcy, puste opisy chowające całe sekcje),
część to widoki, których jeszcze nie ma w `web/`: panel klienta, relacje,
archiwum, „o nas", polityki i wersja EN.

## Skąd podgląd bierze dane

Z **fixture w repozytorium** (`docs/oferta.json`), bo `OFERTA_URL` nie jest
ustawione. Ceny i terminy są prawdziwe, ale zamrożone; formularz nie wysyła
nigdzie leadów.

Gdy CRM zacznie publikować ofertę, wystarczy ustawić `OFERTA_URL` w zmiennych
środowiskowych projektu `advfactory-web` (scope: Preview) na CRM testowy. Wtedy
podgląd pokazuje realne dane — i przy okazji zaczyna wyłapywać rozjazd kontraktu,
bo build waliduje ofertę i pada, gdy się nie zgadza.

## Czego tu nie robić

**Nie dokładać `vercel.json` w korzeniu repozytorium.** Vercel czyta go
niezależnie od Root Directory, więc taki plik trafia do OBU projektów naraz.

Raz już tak zrobiłem: uznałem `deploy/` za pozostałość po paczce projektowej
i wstawiłem w korzeniu konfigurację kierującą build do `web/`. Przykryła
`deploy/vercel.json` i położyła podgląd prototypu — dwa deploye z rzędu
zakończone błędem, ostatni na `cd: web: No such file or directory`, bo polecenie
wykonywało się w `deploy/`. Plik usunięty, podgląd wrócił.

Wniosek: zanim podłoży się konfigurację globalną, sprawdzić, czy to, co wygląda
na porzucone, nie jest czyjąś działającą robotą.

**Nie czyścić Root Directory w `advfactory-www`.** Zdejmie to Vercela z `deploy/`
i `/podglad` przestanie się otwierać. Konfiguracja obu projektów jest już
poprawna i nic w panelu nie wymaga zmiany.

## Drobiazg techniczny

`npm ci --prefix web` nie działa: `--prefix` ustawia katalog docelowy instalacji,
ale `npm ci` szuka `package-lock.json` w katalogu bieżącym. npm 10 to wybacza,
npm 11 na Vercelu już nie. Nie jest to dziś potrzebne — `advfactory-web` ma
Root Directory ustawione na `web`, więc npm pracuje we właściwym miejscu — ale
warto wiedzieć, gdyby ktoś wracał do pomysłu budowania z korzenia.

Build z Root Directory = `web` **widzi pliki spoza tego katalogu**: Vercel klonuje
całe repozytorium. Sprawdzone — `astro check` odpalił się w `/vercel/path0/web`
i bez problemu zaciągnął `docs/schema.ts` oraz `docs/oferta.json`.

## Uwaga o kosztach

Darmowy plan Hobby jest przeznaczony do użytku niekomercyjnego. Dwa projekty
firmowe formalnie wymagają planu Pro — sprawdź aktualny cennik i regulamin,
zanim to zostanie na stałe.
