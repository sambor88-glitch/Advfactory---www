# Podgląd PR-a na Vercelu

Produkcja i staging idą na AWS (S3 + CloudFront, `docs/architektura.md`).
Vercel zostaje wyłącznie jako **podgląd każdego pull requesta** — żeby dało się
pokazać zmianę klientowi pod linkiem, zanim trafi na produkcję. Nic nie kosztuje
pracy wdrożeniowej i nie wymaga Terraforma.

## Co trzeba zmienić w panelu Vercela — jedno ustawienie

Projekt `advfactory-www` ma dziś **Root Directory = `deploy`**, czyli serwuje stary,
samowystarczalny eksport prototypu z paczki projektowej (1,4 MB jednego pliku HTML).
Podglądy PR-ów pokazywały przez to prototyp, a nie stronę z `web/`.

**Settings → General → Root Directory → wyczyść pole (korzeń repozytorium) → Save.**

Reszta jest już w repozytorium, w `vercel.json`:

```json
{
  "installCommand": "cd web && npm ci",
  "buildCommand": "cd web && npm run build",
  "outputDirectory": "web/dist"
}
```

**Dlaczego `cd web &&`, a nie `--prefix web`.** Pierwsze podejście używało
`npm ci --prefix web`. Lokalnie działa (npm 10), na Vercelu pada (npm 11):
`--prefix` ustawia katalog *docelowy* instalacji, ale `npm ci` szuka
`package-lock.json` w katalogu bieżącym, a nowszy npm nie przymyka już na to oka.
Forma z `cd` działa niezależnie od wersji npm.

**Dlaczego korzeń, a nie `web`.** Wydawałoby się naturalne wskazać `web`, ale build
strony importuje `docs/schema.ts` i `docs/oferta.json` — a więc pliki spoza tego
katalogu. Przy Root Directory = `web` Vercel domyślnie nie wgrywa plików leżących
wyżej i build by się wywrócił. Z korzenia widać wszystko, a `vercel.json` i tak
kieruje budowanie do `web/`.

## Czego podgląd NIE pokazuje

Podgląd budowany jest z **fixture w repozytorium**, bo `OFERTA_URL` nie jest tam
ustawione. Pokazuje więc stronę na przykładowej ofercie, nie na tym, co jest
aktualnie w CRM.

Gdy CRM będzie publikował ofertę, można to zmienić: `OFERTA_URL` w zmiennych
środowiskowych Vercela (scope: Preview) wskazujące na CRM testowy. Wtedy podgląd
pokazuje realne dane — i przy okazji wychodzi rozjazd kontraktu, bo build waliduje
ofertę i pada, gdy się nie zgadza.

## Uwaga o kosztach

Darmowy plan Hobby jest przeznaczony do użytku niekomercyjnego. Podglądy projektu
firmowego formalnie wymagają planu Pro — sprawdź aktualny cennik i regulamin,
zanim to zostanie na stałe.
