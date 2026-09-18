# ADVfactory — nowa strona www + integracja z CRM

Repozytorium nowej strony advfactory.com, spiętej z CRM (`sambor88-glitch/advfactory-crm`).

**Stan:** paczka projektowa (prototypy + kontrakt danych) z 18.09.2026. Kodu produkcyjnego jeszcze nie ma.

---

## Co jest w środku

**Strona (prototypy klikalne)**
- `Strona ADVfactory.dc.html` — wersja PL: start, wyprawy, karta wyprawy, transport z konfiguratorem, 7 stron kierunków, relacje, FAQ, kontakt, archiwum, panel klienta (logowanie, reset hasła, oś czasu transportu, płatności, dokumenty, checklista, wątek, powiadomienia), polityki, cookies, 404, dziękujemy.
- `ADVfactory Website EN.dc.html` — wersja EN.
- `Stany strony.dc.html` — 7 stanów błędów i ładowania z zasadami działania.
- `mapa-transportow.html` — mapa kierunków (D3, prawdziwa geometria), wstawiana przez iframe.
- `deploy/index.html`, `deploy/en.html` — samowystarczalne wersje do wrzucenia na hosting.

**CRM — nowe widoki (`crm/`)**
- `Katalog Wypraw` — oferta wypraw, szkic → publikuj, SEO.
- `Terminarz Transportów` — kierunki, terminy, ceny, geokodowanie po nazwie miasta, SEO.
- `Treści Strony` — FAQ, relacje, opinie, dane firmy, magazyny.
- `Zainteresowani Terminem` — zapisy na powiadomienia (osobna lista, nie lejek).
- `Ustawienia Strony` — kontakt, obietnica 24 h, hero, baner, wideo, SEO domyślne, analityka, historia publikacji.
- `Skrzynka - panel leada WWW` — specyfikacja prawego panelu ISTNIEJĄCEJ Skrzynki Zapytań dla leadów ze strony (nie nowy widok).
- `LEAD-WWW-spec.md` — payload leada i jego obsługa w CRM.

**Dokumentacja (`docs/`) — kontrakt wdrożeniowy**
- `integracja-crm.md` — przepływ danych: oferta CRM → strona, leady strona → CRM, publikacja, panel, powiadomienia, stany błędów.
- `architektura.md` — hosting, publikacja, ścieżka leada, Terraform, szacunkowy koszt AWS.
- `crm-integracja-laravel.md` — co dołożyć w CRM (Laravel na Forge): trasy leadów, walidacja, routing do lejka, publikacja oferty.
- `praca-rownolegla.md` — jak budować stronę i CRM jednocześnie, nie rozjeżdżając się: kontrakt jako granica, trzy tryby danych, bramki w CI, kolejność prac.
- `oferta.schema.json` — kontrakt w formie JSON Schema (generowany ze `schema.ts`), do walidacji po stronie CRM.
- `schema.ts` — kontrakt typów dla obu strumieni i panelu.
- `oferta.json` — przykładowa opublikowana oferta (9 wypraw, 7 kierunków, 6 regionów, 10 FAQ, ustawienia).

**Materiały pomocnicze**
- `github.md` — log synchronizacji z repo CRM i mapa ekranów → pliki źródłowe.
- `uploads/` — zrzuty referencyjne z prototypu.
- `assets/`, `prototyp/`, `support.js` — runtime prototypów (lucide, image-slot, logo).

## Jak otwierać prototypy

Pliki `.dc.html` otwierają się w przeglądarce bezpośrednio z dysku (potrzebują `support.js` obok — jest w paczce, w `crm/` również). Zdjęcia ładują się z advfactory.com, więc wymagają internetu.

> Uwaga: `.dc.html` to **prototypy**, nie kod produkcyjny. Źródłem prawdy dla wdrożenia są `docs/schema.ts` i `docs/integracja-crm.md`.

## Zasady, które trzeba zachować

1. CRM jest jedynym źródłem oferty. Strona czyta `oferta.json`; nie ma edycji na stronie.
2. Publikacja świadoma: szkic → „Publikuj”. Zmiana w CRM bez publikacji nie jest widoczna.
3. Leady trafiają do istniejącej Skrzynki jako źródło „www”. Lead z konfiguratora i z karty wyprawy zakłada dodatkowo kartę w lejku; lead z ogólnego formularza — nie. Zapisy na powiadomienia — na osobną listę.
4. Obietnica odpowiedzi (24 h) jest jedną liczbą w Ustawieniach; steruje stroną i alertem w Skrzynce.
5. YouTube i Mapy Google ładują się dopiero po zgodzie na cookies marketingowe.
6. Podana cena jest ostateczna — strona nigdy nie pokazuje dopłat po fakcie; konfigurator pokazuje widelec z adnotacją.

## Ustalenia wdrożeniowe (18.09.2026)

1. **Leady → lejek:** automatycznie tylko z konfiguratora i karty wyprawy. Ogólny formularz zostaje w Skrzynce.
2. **Zakres oferty z CRM:** wyprawy i transport. Bez trzeciej encji.
3. **Strony kierunków i regionów:** treść przenosi się z kodu do CRM — rozbudowa widoku Terminarz + nowy widok „Strony regionów”.
4. **Architektura:** CRM publikuje `oferta.json` na S3, strona budowana statycznie (SSG) na AWS eu-central-1. Szczegóły i koszty w `docs/architektura.md`.
5. **CRM stoi na Laravel Forge** (środowisko testowe i produkcyjne). Leady idą wprost do Laravela — bez bufora Lambda + SQS, który planowałem, zanim to było wiadome. Uzasadnienie i kompromis w `docs/architektura.md`.

## Kod strony (`web/`)

Front w Astro (SSG), budowany z `docs/oferta.json`. Zbudowany zakres: strona główna,
lista i karty wypraw, transport z konfiguratorem i terminarzem, 7 stron kierunków,
6 stron regionów, FAQ, szuflada zapytania, „dziękujemy", 404, sitemap i robots.

```bash
cd web && npm install && npm run dev
```

Instrukcja wdrożenia, zmienne środowiskowe i opis struktury: `web/README.md`.

## Tokeny wizualne

Anton (nagłówki), Archivo (tekst), IBM Plex Mono (liczby, daty). Akcent `#EA5A0B` / `#F26A1B`, tło strony `#F2EFE7`, ciemne `#1C1B17` / `#161512`, CRM `#0F0E0C`. Promienie 4–8 px. Ikony: lucide.
