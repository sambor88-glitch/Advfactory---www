# Advfactory---www

Nowa strona advfactory połączona z crm.

## `deploy/` — klikalny prototyp (wrzesień 2026)

Statyczny prototyp strony PL/EN wraz z panelem CRM do zarządzania jej treścią.
Same pliki HTML — nic nie trzeba budować.

Strona startowa dla oceniającego: **`/podglad`**

| Adres | Zawartość |
|---|---|
| `/podglad` | spis treści prototypu, linki do wszystkiego |
| `/` · `/en` | strona główna PL · EN |
| `/mapa-transportow` | mapa kierunków transportu |
| `/stany` | stany błędów i ładowania |
| `/crm/wyprawy` | katalog wypraw |
| `/crm/transport` | terminarz transportów |
| `/crm/tresci` | treści strony (FAQ, relacje, opinie) |
| `/crm/zainteresowani` | zapisy na powiadomienia o terminach |
| `/crm/ustawienia` | ustawienia strony |
| `/crm/leady-www` | lead ze strony w skrzynce CRM |

`deploy/vercel.json` włącza `cleanUrls` (adresy bez `.html`) i nagłówek
`X-Robots-Tag: noindex`, żeby prototyp nie trafił do Google.

Szczegóły publikacji: [`deploy/README.md`](deploy/README.md).

### Zależności zewnętrzne

Prototyp nie jest samowystarczalny — do poprawnego wyświetlenia potrzebuje internetu:

- zdjęcia pobierane z `advfactory.com`,
- fonty z Google Fonts (Anton, Archivo, IBM Plex Mono),
- `mapa-transportow` ładuje d3 i topojson z unpkg.com oraz dane granic
  państw z cdn.jsdelivr.net; bez nich pokazuje pustą planszę.

### Ograniczenia prototypu

- Dane są przykładowe, nie ma połączenia z bazą.
- Formularze nie wysyłają nigdzie danych.
