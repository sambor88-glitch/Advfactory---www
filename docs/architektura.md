# Architektura wdrożenia

Decyzje z 18.09.2026. Region: **eu-central-1 (Frankfurt)**. Infrastruktura jako kod: **Terraform**. Środowiska: **dev / staging / prod**.

## Wybór w jednym zdaniu

Strona jest statyczna i budowana z `oferta.json`, który CRM wypycha na S3 przy „Publikuj”. Strona nie odpytuje CRM przy wejściu użytkownika — dzięki temu działa, nawet gdy CRM leży.

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

## Frontend — Astro (SSG)

**Dlaczego Astro, nie Next.js:** strona to w 90% treść SEO (9 wypraw, 7 kierunków, 6 regionów, relacje, FAQ, archiwum). Astro renderuje to do czystego HTML i domyślnie nie wysyła ani bajta JS. Interaktywne są tylko cztery wyspy: konfigurator transportu, formularz zapytania, mapa kierunków (D3) i banner cookies. Mniej JS = lepszy Core Web Vitals = lepszy SEO, a to jest główny cel tej strony.

**Panel klienta** to wyjątek — dynamiczny, za logowaniem, bez SEO. Buduje się jako osobna wyspa (Preact/React) pod `/panel`, gadająca z API CRM. Nie przechodzi przez SSG.

**Wersja EN** — drugi build z tych samych danych (`en.tytul` / `en.lead`, fallback do PL z adnotacją), pod `/en`.

## Dane oferty

- `oferta.json` leży w S3 i jest serwowany przez ten sam CloudFront pod `/data/oferta.json`.
- Nagłówek: `Cache-Control: max-age=300, stale-while-revalidate=86400`. Strona ma świeże ceny w 5 minut, a przy awarii pokazuje ostatnią wersję z cache (stan 02 w `Stany strony.dc.html`).
- Build SSG czyta ten sam plik — jedno źródło, zero rozjazdu między HTML a tym, co widzi konfigurator.

## Publikacja i przebudowa

1. „Publikuj” w CRM → `PUT s3://advfactory-oferta-{env}/oferta.json` + invalidacja `/data/oferta.json`.
2. Zdarzenie S3 → EventBridge → CodeBuild: `npm ci && npm run build`, sync do bucketu strony, invalidacja `/*`.
3. Build trwa ~1–2 min. Do jego końca CloudFront serwuje **poprzedni** build — nie ma okna z pustą stroną.
4. Rollback = przywrócenie wcześniejszej wersji `oferta.json` (S3 versioning) — to samo, co „historia publikacji" w widoku Ustawienia strony.

## Leady — strona → CRM

`POST /leads` idzie przez **API Gateway (HTTP API) → Lambda → SQS → CRM**, nie prosto do CRM.

Lambda robi trzy rzeczy: weryfikuje token Turnstile, trzyma limit częstości per IP, waliduje payload wg `schema.ts`. Potem wrzuca lead do SQS i od razu zwraca `numer_sprawy`. CRM konsumuje kolejkę.

**Dlaczego kolejka:** lead to pieniądze. Jeśli CRM jest w trakcie deployu albo leży, lead czeka w SQS zamiast zniknąć. Dead-letter queue po 3 próbach + alarm na Slacka/mail.

Antyspam: **Cloudflare Turnstile** (darmowy) zamiast AWS WAF ($5/mies + $1 za regułę). Przy tej skali WAF się nie zwraca.

`POST /zainteresowani` — ta sama ścieżka, inna kolejka, trafia na listę „Zainteresowani terminem”.

## Panel klienta

Przeglądarka → CloudFront (`/api/*`) → API Gateway → CRM. Sesja na httpOnly cookie, reset hasła linkiem ważnym 30 min. Panel zapisuje tylko trzy rzeczy: ustawienia powiadomień, wiadomości w wątku, odhaczenia checklisty.

## Terraform

```
infra/
  modules/
    static-site/      # S3 + CloudFront + OAC + ACM + Route 53
    lead-api/         # API Gateway + Lambda + SQS + DLQ + IAM
    build-pipeline/   # EventBridge + CodeBuild + IAM
  envs/
    dev/  staging/  prod/     # osobny state per środowisko
```

Certyfikat ACM dla CloudFront musi stać w **us-east-1** — to jedyny zasób poza Frankfurtem.

## Szacunkowy koszt AWS (prod, miesięcznie)

Założenie: 30–50 tys. odsłon/mies., ~10 GB transferu, ~60 publikacji, ~500 leadów.

| Pozycja | Koszt |
|---|---|
| S3 (strona + oferta.json, 5 GB) | ~1,00 USD |
| CloudFront (10 GB + 300 tys. żądań) | 0–1,30 USD |
| Route 53 (strefa + zapytania) | ~0,60 USD |
| CodeBuild (60 buildów × 2 min) | ~0,60 USD |
| Lambda + API Gateway + SQS | ~0,10 USD |
| CloudWatch Logs (~1 GB) | ~0,60 USD |
| Secrets Manager (1 sekret) | ~0,40 USD |
| ACM | 0,00 USD |
| **Razem prod** | **~3,30–4,60 USD** |

Dev i staging bez własnej strefy Route 53 (subdomeny w tej samej): **~1,50 USD każde**.

**Trzy środowiska razem: ~6–8 USD/mies.**

Zastrzeżenia:
- CloudFront ma darmowy próg 1 TB transferu/mies. na starszych kontach; na nowych rozliczenie jest kredytowe. Stąd widełki 0–1,30 USD.
- Jeśli przeniesiemy zdjęcia wypraw z WordPressa do S3 (~50 GB), dojdzie ~1,20 USD storage plus transfer. Warto to zrobić — dziś wszystkie zdjęcia w `oferta.json` wskazują na `advfactory.com/wp-content/`, czyli nowa strona zależy od starego WordPressa.
- Koszt CRM jest poza tym rachunkiem.

## Ryzyka do domknięcia przed startem

1. **Przekierowania 301 ze starych URL-i.** advfactory.com ma wypozycjonowane adresy (`/wyprawy/`, `/transport/`, karty wypraw). Bez mapy przekierowań redesign kosztuje pozycje w Google. Potrzebna lista stary URL → nowy URL przed przełączeniem DNS.
2. **Zdjęcia na WordPressie.** Patrz wyżej — dopóki nie przeniesiemy mediów, wyłączenie starego serwera zabija zdjęcia na nowej stronie.
3. **Slug z ogonkami.** Generator slugów w CRM musi normalizować NFD i ścinać znaki diakrytyczne, nie tylko polskie: `Reykjavík` → `reykjavik`, `Valparaíso` → `valparaiso`. W wyjściowej wersji `oferta.json` wychodziło `reykjav-k` i `valpara-so`.
4. **Puste treści wypraw.** 9 z 9 wypraw nie ma opisu, planu dni ani list „zawiera/nie zawiera”. Widoki muszą chować puste sekcje, a nie renderować nagłówki nad niczym.
