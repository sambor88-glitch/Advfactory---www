# Vercel — podgląd prototypu

**Projekt `advfactory-www` na Vercelu serwuje katalog `deploy/`, czyli klikalny
prototyp. Tak ma zostać.** Root Directory = `deploy`, konfiguracja w
`deploy/vercel.json` (`cleanUrls` i `X-Robots-Tag: noindex`), strona startowa
dla oceniającego: `/podglad`.

## Czego tu nie ma

Podgląd **nie pokazuje** strony z `web/`. To dwie różne rzeczy:

- `deploy/` — statyczny prototyp do oceny wyglądu i przepływów, bez buildu,
- `web/` — właściwa strona w Astro, budowana z `docs/oferta.json`, docelowo
  na AWS (S3 + CloudFront, `docs/architektura.md`).

## Błąd, który tu popełniłem

Zobaczyłem, że Vercel serwuje `deploy/`, uznałem to za pozostałość po paczce
projektowej i dołożyłem `vercel.json` w korzeniu repozytorium, kierujący build
do `web/`. Vercel czyta konfigurację z korzenia **przed** tą z Root Directory,
więc mój plik przykrył `deploy/vercel.json` i położył podgląd prototypu — dwa
deploye z rzędu zakończone błędem.

`deploy/` nie jest pozostałością. To osobno utrzymywany prototyp z własnym
`/podglad`, makietami widoków CRM i świadomym `noindex`. Plik z korzenia został
usunięty i podgląd wrócił do działania.

**Wniosek na przyszłość:** zanim podłoży się konfigurację globalną, sprawdzić,
czy to, co wygląda na porzucone, nie jest czyjąś działającą robotą.

## Gdyby kiedyś potrzebny był podgląd strony z `web/`

Nie przez ten projekt — przykryłby prototyp. Dwie czyste drogi:

1. **Drugi projekt na Vercelu** z tego samego repozytorium, z Root Directory
   w korzeniu i budowaniem `cd web && npm ci` / `cd web && npm run build`,
   katalog wyjściowy `web/dist`. Musi być korzeń, nie `web` — build importuje
   `docs/schema.ts` i `docs/oferta.json`, czyli pliki spoza tego katalogu.
2. **Podgląd na AWS z GitHub Actions** — deploy do prefiksu z numerem PR-a
   w tym samym buckecie. Zostaje wtedy jeden dostawca i jeden rachunek.

Uwaga przy okazji: `npm ci --prefix web` nie zadziała. `--prefix` ustawia katalog
docelowy instalacji, ale `npm ci` szuka `package-lock.json` w katalogu bieżącym —
npm 10 to wybacza, npm 11 na Vercelu już nie. Forma z `cd` działa wszędzie.
