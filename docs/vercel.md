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
  "installCommand": "npm ci --prefix web",
  "buildCommand": "npm run build --prefix web",
  "outputDirectory": "web/dist"
}
```

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
