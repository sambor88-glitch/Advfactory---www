# Lead ze strony → istniejąca Skrzynka Zapytań w CRM

Strona **nie ma własnej skrzynki**. Każde zapytanie z www trafia do `zapytania` tak jak WhatsApp/mail/telefon, z kanałem `www`.

## Co strona wysyła (payload)

| pole | źródło na stronie | przykład |
|---|---|---|
| `kanal` | stałe | `www` |
| `zrodlo_www` | który formularz | `formularz` / `konfigurator` / `karta_wyprawy` |
| `jezyk` | wersja strony | `PL` / `EN` |
| `imie_nazwisko`, `email`, `telefon` | pola formularza | |
| `tresc` | pole „O co pytasz” | |
| `preferowany_kanal` | przełącznik w formularzu | `wa` / `mail` / `tel` |
| `wyprawa_id` | tylko z karty wyprawy | `tybet-2026` |
| `konfiguracja` | tylko z konfiguratora | `{ pojazd, kierunek, strony, wycena_od, wycena_do }` |
| `zgoda_rodo` | checkbox | `{ ts, wersja_polityki: "2026-09-09", ip }` |
| `sciezka` | ostatnie 4 widoki | `Start → Transport → Konfigurator → Formularz` |

## Co dostaje istniejąca skrzynka (bez nowego widoku)

- badge kanału **WWW** na wątku + podtyp (Formularz / Konfigurator / Karta wyprawy),
- w prawym panelu kontekstu (tam, gdzie dziś jest klient) blok **„Lead ze strony”**: ścieżka, język, preferowany kanał, konfiguracja z wyceną i przycisk *Utwórz zlecenie z tej konfiguracji*, wyprawa → link do karty w Katalogu, zgoda RODO z datą,
- deduplikacja po e-mailu / telefonie → dopięcie do istniejącego `kontaktu`,
- alert 24 h liczony tak samo jak dla innych kanałów.

## Lejek sprzedaży

Karta w lejku powstaje **automatycznie** dla leadów, które niosą kwotę i konkret:

| `zrodlo_www` | Karta w lejku | Wartość szacowana |
|---|---|---|
| `konfigurator` | tak, 1. etap | `wycena_od`–`wycena_do` |
| `karta_wyprawy` | tak, 1. etap | cena wyprawy (kierowca) |
| `formularz` | nie — zakłada operator ze Skrzynki | — |

Karta pokazuje źródło `WWW`, podtyp (Konfigurator / Karta wyprawy) i wartość szacowaną. Nic więcej.

Jeśli kontakt ma już otwartą kartę w lejku, lead dopina się do niej — nie powstaje druga.

Lead z `formularz` zostaje tylko w Skrzynce. Operator przenosi go do lejka przyciskiem, gdy okaże się sprzedażowy. Powód: ogólny formularz zbiera też pytania o faktury, reklamacje i spam.

## Nie-zapytania

Zapisy „daj znać o nowym terminie” **nie** trafiają do skrzynki ani lejka — osobna lista `crm/Zainteresowani Terminem.dc.html`.
