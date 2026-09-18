# Architektura wdrożenia

Decyzje z 18.09.2026. Region: **eu-central-1 (Frankfurt)**. Infrastruktura jako kod: **Terraform**. Środowiska: **dev / staging / prod**.

## Wybór w jednym zdaniu

Strona jest statyczna i budowana z `oferta.json`, który CRM wypycha na S3 przy „Publikuj”. Strona nie odpytuje CRM przy wejściu użytkownika — dzięki temu działa, nawet gdy CRM leży.

## Co już stoi: CRM

CRM (`advfactory-crm`) to aplikacja **Laravel na Laravel Forge**, w dwóch środowiskach:
testowym i produkcyjnym. Forge zarządza serwerem — nginx, PHP-FPM, baza, kolejki,
certyfikaty, deploy z gita.

To przesądza o dwóch rzeczach w tej architekturze:

- **Publikacja oferty** to zwykły zapis do S3 z Laravela (`Storage::disk('s3')`),
  a nie osobna usługa.
- **Leady idą wprost do Laravela**, nie przez Lambdę. Powód niżej.

## Schemat

```
                      ┌─────────── CRM (advfactory-crm) ───────────┐
                      │  Katalog wypraw · Terminarz · Treści       │
                      │  Ustawienia · Skrzynka Zapytań · Lejek     │
                      └────┬──────────────────────────────▲────────┘
            „Publikuj”     │                              │  konsument kolejki
                           ▼                              │
                  S3: oferta.json ──► EventBridge ──► CodeBuild (build SSG)
                           │                              │
                           │                        S3: strona (HTML)
                           ▼                              ▼
                      ┌──────────────── CloudFront (OAC) ───────────────┐
                      │  advfactory.com  ·  /data/oferta.json           │
                      └────┬───────────────────────────────────┬───────┘
                           │  odczyt                           │  POST /leads
                           ▼                                   ▼
                     przeglądarka                    API Gateway → Lambda → SQS
```

## Podgląd pull requestów

Produkcja i staging stoją na AWS, jak niżej. Niezależnie od tego repozytorium ma
podpięty **Vercel**, który buduje podgląd każdego pull requesta — do pokazania
zmiany klientowi, zanim trafi na produkcję. Nie jest częścią ścieżki produkcyjnej
i nie ma go w Terraformie. Konfiguracja i jedno ustawienie do zmiany w panelu:
`docs/vercel.md`.

## Frontend — Astro (SSG)

**Dlaczego Astro, nie Next.js:** strona to w 90% treść SEO (9 wypraw, 7 kierunków, 6 regionów, relacje, FAQ, archiwum). Astro renderuje to do czystego HTML i domyślnie nie wysyła ani bajta JS. Interaktywne są tylko cztery wyspy: konfigurator transportu, formularz zapytania, mapa kierunków (D3) i banner cookies. Mniej JS = lepszy Core Web Vitals = lepszy SEO, a to jest główny cel tej strony.

**Panel klienta** to wyjątek — dynamiczny, za logowaniem, bez SEO. Buduje się jako osobna wyspa (Preact/React) pod `/panel`, gadająca z API CRM. Nie przechodzi przez SSG.

**Wersja EN** — drugi build z tych samych danych (`en.tytul` / `en.lead`, fallback do PL z adnotacją), pod `/en`.

## Dane oferty

- `oferta.json` leży w S3 i jest serwowany przez ten sam CloudFront pod `/data/oferta.json`.
- Nagłówek: `Cache-Control: max-age=300, stale-while-revalidate=86400`. Strona ma świeże ceny w 5 minut, a przy awarii pokazuje ostatnią wersję z cache (stan 02 w `Stany strony.dc.html`).
- Build SSG czyta ten sam plik — jedno źródło, zero rozjazdu między HTML a tym, co widzi konfigurator.

## Publikacja i przebudowa

1. „Publikuj” w CRM → Laravel składa `oferta.json` i zapisuje go przez
   `Storage::disk('s3')->put(...)`, po czym unieważnia `/data/oferta.json` w CloudFroncie.
2. Ten sam kontroler woła `repository_dispatch` w GitHubie, co odpala przebudowę strony
   w GitHub Actions: `npm ci && npm run build`, sync do bucketu, invalidacja `/*`.
3. Build trwa ~1–2 min. Do jego końca CloudFront serwuje **poprzedni** build — nie ma
   okna z pustą stroną.
4. Rollback = przywrócenie wcześniejszej wersji `oferta.json` (S3 versioning) — to samo,
   co „historia publikacji" w widoku Ustawienia strony.

**Dlaczego GitHub Actions, a nie CodeBuild + EventBridge** (jak było w pierwszej wersji):
kod strony i tak leży na GitHubie, więc build jest tam, gdzie repozytorium i gdzie i tak
patrzy się na czerwone CI. To o dwa zasoby AWS mniej w Terraformie i o jedną rolę IAM
mniej do ustawienia. Koszt porównywalny.

## Leady — strona → CRM

`POST /leads` idzie **wprost do Laravela**: strona → `https://crm.advfactory.com/api/leads`.
Kontroler weryfikuje token Turnstile, trzyma limit częstości per IP, waliduje payload,
robi deduplikację po e-mailu i telefonie, zakłada wątek w Skrzynce i — dla źródeł
`konfigurator` i `karta_wyprawy` — kartę w lejku. Zwraca `numer_sprawy`.

**Zmiana wobec pierwszej wersji tego dokumentu.** Planowałem tu API Gateway → Lambda →
SQS jako bufor na wypadek, gdyby CRM leżał. Przy Laravelu na Forge to się nie opłaca:

- Walidacja, deduplikacja i reguła lejka i tak muszą być w CRM, bo tam są dane.
  Lambda dublowałaby połowę z tego w innym języku.
- To osobny cel wdrożenia, osobny kawałek Terraforma i osobne miejsce do debugowania
  — w zespole, który pracuje w PHP.
- Strona ma już własne zabezpieczenie: przy błędzie wysyłki treść formularza zostaje,
  pojawia się przycisk „Wyślij na WhatsApp” z wypełnioną wiadomością i kod zgłoszenia.

**Czego to nie rozwiązuje.** Forge domyślnie **nie deployuje bez przerwy** — w trakcie
`composer install` i migracji aplikacja potrafi na kilkanaście sekund oddać 5xx.
W tym oknie lead poleci w fallback na WhatsApp, a nie do CRM. Trzy wyjścia, w kolejności
od najsensowniejszego:

1. **Envoyer** (produkt Laravela do deployu bez przerwy). Rozwiązuje problem dla całego
   CRM, nie tylko dla leadów. Płatny — sprawdź aktualny cennik.
2. Deploy w oknie o niskim ruchu, skoro leady idą głównie w dzień roboczy.
3. Dopiero gdyby to realnie bolało: bufor przed CRM (Lambda + SQS albo Cloudflare Worker
   + kolejka). Warto dołożyć na podstawie danych, nie na zapas.

Antyspam: **Cloudflare Turnstile** (darmowy). W Laravelu jedna reguła walidacji
plus `throttle` na trasie.

`POST /zainteresowani` — ta sama ścieżka, ta sama walidacja, inna tabela: lista
„Zainteresowani terminem”, nie Skrzynka i nie lejek.

Szczegóły po stronie Laravela — trasy, walidacja, routing do lejka, publikacja oferty —
w `docs/crm-integracja-laravel.md`.

## Panel klienta

Przeglądarka → CloudFront (`/api/*`) → API Gateway → CRM. Sesja na httpOnly cookie, reset hasła linkiem ważnym 30 min. Panel zapisuje tylko trzy rzeczy: ustawienia powiadomień, wiadomości w wątku, odhaczenia checklisty.

## Terraform

```
infra/
  modules/
    static-site/      # S3 + CloudFront + OAC + ACM + Route 53
    publikacja/       # bucket na oferta.json + użytkownik IAM dla Laravela
                      # + rola OIDC dla GitHub Actions (deploy bez kluczy w sekretach)
  envs/
    dev/  staging/  prod/     # osobny state per środowisko
```

Laravel potrzebuje z AWS dokładnie dwóch uprawnień: zapis `oferta.json` do bucketu
i `CreateInvalidation` na dystrybucji. Nic więcej — CRM nie dotyka ani strony, ani buildu.

Certyfikat ACM dla CloudFront musi stać w **us-east-1** — to jedyny zasób poza Frankfurtem.

## Szacunkowy koszt AWS (prod, miesięcznie)

Założenie: 30–50 tys. odsłon/mies., ~10 GB transferu, ~60 publikacji, ~500 leadów.

| Pozycja | Koszt |
|---|---|
| S3 (strona + oferta.json, 5 GB) | ~1,00 USD |
| CloudFront (10 GB + 300 tys. żądań) | 0–1,30 USD |
| Route 53 (strefa + zapytania) | ~0,60 USD |
| CloudWatch Logs (~1 GB) | ~0,60 USD |
| ACM | 0,00 USD |
| **Razem prod** | **~2,20–3,50 USD** |

Poza rachunkiem AWS: GitHub Actions (60 buildów × ~2 min — w darmowym limicie
repozytorium prywatnego), serwer CRM w Forge i sam Forge.

Dev i staging bez własnej strefy Route 53 (subdomeny w tej samej): **~1,50 USD każde**.

**Trzy środowiska razem: ~6–8 USD/mies.**

Zastrzeżenia:
- CloudFront ma darmowy próg 1 TB transferu/mies. na starszych kontach; na nowych rozliczenie jest kredytowe. Stąd widełki 0–1,30 USD.
- Jeśli przeniesiemy zdjęcia wypraw z WordPressa do S3 (~50 GB), dojdzie ~1,20 USD storage plus transfer. Warto to zrobić — dziś wszystkie zdjęcia w `oferta.json` wskazują na `advfactory.com/wp-content/`, czyli nowa strona zależy od starego WordPressa.
- Koszt CRM jest poza tym rachunkiem: serwer w Forge, licencja Forge i ewentualnie Envoyer.
- **Nie wiem, u jakiego dostawcy stoi serwer Forge.** Jeśli to nie AWS, transfer
  Laravel → S3 idzie przez publiczny internet: przy jednym pliku `oferta.json` na
  publikację to nieistotne, ale warto to wiedzieć przed decyzją o mediach.

## Ryzyka do domknięcia przed startem

1. **Przekierowania 301 ze starych URL-i.** advfactory.com ma wypozycjonowane adresy (`/wyprawy/`, `/transport/`, karty wypraw). Bez mapy przekierowań redesign kosztuje pozycje w Google. Potrzebna lista stary URL → nowy URL przed przełączeniem DNS.
2. **Zdjęcia na WordPressie.** Patrz wyżej — dopóki nie przeniesiemy mediów, wyłączenie starego serwera zabija zdjęcia na nowej stronie.
3. **Slug z ogonkami.** Generator slugów w CRM musi normalizować NFD i ścinać znaki diakrytyczne, nie tylko polskie: `Reykjavík` → `reykjavik`, `Valparaíso` → `valparaiso`. W wyjściowej wersji `oferta.json` wychodziło `reykjav-k` i `valpara-so`.
4. **Puste treści wypraw.** 9 z 9 wypraw nie ma opisu, planu dni ani list „zawiera/nie zawiera”. Widoki muszą chować puste sekcje, a nie renderować nagłówki nad niczym.
