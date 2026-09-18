# Integracja po stronie CRM (Laravel na Forge)

Co trzeba dołożyć w `advfactory-crm`, żeby strona zaczęła działać naprawdę.
Kontrakt danych jest w `schema.ts`, przepływ w `integracja-crm.md`, hosting
w `architektura.md`. Tu jest tylko strona Laravela.

> **Pierwsza wersja tego dokumentu była pisana z dokumentacji, bez wglądu w kod CRM,
> i myliła się w kilku miejscach.** Repozytorium `advfactory-crm` jest już przeczytane.
> Trasa przyjmująca zgłoszenia — rozdział 1 — jest napisana i przetestowana. Rozdziały
> 2 i 3 dalej są planem, ale opartym już na tym, co w CRM faktycznie jest.

## Co się nie zgadzało

| Zakładałem | Jak jest w kodzie |
|---|---|
| endpoint `POST /api/leads` | CRM nie miał `routes/api.php` ani żadnego API — trasę trzeba było dopisać |
| Skrzynka Zapytań i lejek to dwa byty | jedna tabela `zapytania` z kolumną `etap`; „wątek w skrzynce ALBO karta w lejku" nie istnieje |
| trzeba dołożyć kanał `www` | `KanalZapytania::Formularz` już to znaczy — zmiana schematu niepotrzebna (ADV-81) |
| lead niesie sam identyfikator wyprawy | identyfikatory katalogu strony (`wyp-001`) nie wskazują na nic w CRM; jadą nazwy obok |
| `Wyprawa` w CRM ma pola z kontraktu | tabela `wyprawy` ma pięć kolumn: nazwa, kierunek, trudność, opis, wymagane dokumenty |
| dane płyną wyłącznie CRM → strona | jest komenda `adv:wyprawy-ze-strony`, która **scrapuje** advfactory.com do katalogu |

Ostatni wiersz jest bootstrapem, nie docelowym przepływem: dziś prawda o katalogu
siedzi na starym WordPressie, a CRM ją zaciąga. Po wejściu nowej strony ta komenda
przestanie działać i powinna zniknąć.

## Dwa strumienie, trzy trasy

```
strona → CRM     POST /zgloszenia/strona      zgłoszenie ze strony  ← ZROBIONE (ADV-81)
                 POST /api/zainteresowani     zapis na powiadomienie o terminie  ← plan

CRM → strona     „Publikuj" w panelu          zapis oferta.json do S3 + przebudowa  ← plan
```

---

## 1. `POST /zgloszenia/strona` — zrobione

Trasa stoi w module Lejek: `app/Modules/Lejek/routes/web.php`. Pełny opis decyzji jest
w `backend/README.md` w repozytorium CRM, sekcja „Zgłoszenia ze strony prosto do lejka".
Tu tylko to, co musi wiedzieć strona.

### Żądanie

```
POST /zgloszenia/strona
X-Advfactory-Podpis: <HMAC-SHA256 z treści żądania, kluczem STRONA_SEKRET>
Content-Type: application/json

{ …kształt LeadWWW z docs/schema.ts… }
```

### Odpowiedź

| Status | Kiedy | Treść |
|---|---|---|
| `201` | powstała nowa sprawa | `{"numer_sprawy": "ZP/00042", "nowa_sprawa": true}` |
| `200` | zgłoszenie dopięło się do otwartej sprawy | `{"numer_sprawy": "ZP/00042", "nowa_sprawa": false}` |
| `401` | brak albo zły podpis | `{"blad": "…"}` — nic nie zostało zapisane |
| `422` | kształt niezgodny z kontraktem | błędy walidacji Laravela |
| `429` | przekroczony limit na minutę z jednego adresu | — |
| `503` | `STRONA_SEKRET` nieustawiony w CRM | `{"blad": "…"}` |

Strona czyta `numer_sprawy` i przekazuje go do `/dziekujemy?nr=…`. Przy powtórce klient
dostaje **ten sam** numer — to celowe, nie błąd.

### Co CRM robi ze zgłoszeniem

Zakłada zapytanie w etapie `nowe` z kanałem `formularz`, dopina do istniejącego kontaktu
(dopasowanie po mailu i telefonie, `WykrywaczDuplikatow`) albo zakłada nowy. Produkt
rozpoznaje po źródle: `konfigurator` i `strona_kierunku` → transport, `karta_wyprawy` →
wyprawa, `formularz` → nierozpoznany, bo zgadywanie po słowach z treści myli się za często.

Wartość szacunkowa trafia na kartę **tylko z konfiguratora** i tylko jako dolna granica
widełek. Przy karcie wyprawy zostaje pusta — cena zależy od terminu i liczby osób.

Reszta — źródło, widziana wycena, preferowany kanał, droga po stronie, zgoda RODO —
trafia do pierwszego wpisu w historii zapytania. Wpis jest typu `notatka`, nie
`mail_przychodzacy`, żeby licznik doby bez odpowiedzi biegł dalej: biuro jeszcze się
nie odezwało.

### Deduplikacja

Drugie zgłoszenie **tego samego kontaktu, o ten sam produkt i ten sam przedmiot**, przy
sprawie w etapie innym niż `wygrane`/`przegrane`, nie zakłada drugiej karty w lejku — treść
idzie do historii tej otwartej. Pytanie o Pamir i pytanie o transport auta do Chile to dwie
różne sprawy, nawet tego samego dnia od tej samej osoby.

### Nazwy obok identyfikatorów

Zgłoszenie niesie `wyprawa_nazwa` i `kierunek_nazwa`, a konfiguracja `kierunek_nazwa`.
Bez nich biuro zobaczyłoby zapytanie „o `kier-is`". Zapytanie w CRM jest zapisem
historycznym: ma mówić „Pamir 2027" także wtedy, gdy wyprawa zeszła ze strony.

### `zgoda_rodo.ip` dopisuje CRM

Przeglądarka swojego publicznego adresu nie zna, a gdyby go podawała, byłaby to wartość
podana przez zgłaszającego — dowód niewart trzymania. Strona wysyła sam `timestamp`
i `wersja_polityki`.

### Zmienne w Forge

```
STRONA_SEKRET=              # openssl rand -hex 32; ta sama wartość po stronie nadawcy
STRONA_LIMIT_NA_MINUTE=20
STRONA_ADRES=https://advfactory.com
```

Pusty `STRONA_SEKRET` zamyka trasę (503). Świadomie: endpoint zakłada zapytania bez udziału
biura, więc otwarty zapełniłby skrzynkę w jeden dzień.

### Czego brakuje do końca tej drogi

**Strona statyczna nie policzy podpisu.** Sekret w kodzie wysyłanym do przeglądarki
przestaje być sekretem w dniu wdrożenia. ADV-81 opisywał formularz WordPressa, czyli
nadawcę serwerowego — dla Astro na S3 trzeba wybrać jedno z dwóch:

| Droga | Co trzeba | Koszt AWS | Uwagi |
|---|---|---|---|
| **Pośrednik podpisujący** — Lambda + Function URL przed CRM-em | Terraform: funkcja, rola IAM, sekret w SSM | ~0 USD/mies. przy tym ruchu (1 mln żądań w darmowym progu) | sekret nie opuszcza AWS; jedna rzecz więcej do utrzymania |
| **Turnstile sprawdzany w CRM** — strona wysyła `antyspam_token`, Laravel go weryfikuje | konto Cloudflare, wywołanie HTTP z Laravela, poluzowanie wymogu podpisu dla tej trasy | 0 USD | mniej infrastruktury; wprowadza zależność od Cloudflare i drugą ścieżkę uwierzytelnienia w tej samej trasie |

Trasa działa już dziś dla każdego nadawcy serwerowego — w tym dla starego formularza
na WordPressie, który mógłby zacząć zasilać lejek przed wejściem nowej strony.

### CORS

Potrzebny wyłącznie przy drugiej drodze (wysyłka wprost z przeglądarki). Przy pośredniku
żądanie do CRM-u idzie serwer–serwer i CORS nie występuje.

---

## 2. `POST /api/zainteresowani` — plan

> **W CRM nie ma dziś niczego, na czym to mogłoby stanąć.** Ani tabeli, ani modelu:
> `rezerwacje` i `uczestnicy` dotyczą ludzi, którzy już jadą. Lista zainteresowanych
> terminem to nowa encja i osobne zgłoszenie w Jirze, nie wariant rozdziału 1.

Ta sama walidacja, inny cel: lista „Zainteresowani terminem”.
**Nie tworzy wątku w Skrzynce i nie tworzy szansy w lejku** — do lejka przechodzi
dopiero po powiadomieniu o nowym terminie i odpowiedzi klienta, albo ręcznie.

```php
'email'      => ['required', 'email:rfc,dns'],
'kierunki'   => ['required', 'array', 'min:1'],
'kierunki.*' => ['string', 'max:60'],
'jezyk'      => ['required', Rule::in(['pl', 'en'])],
```

Ponowny zapis tego samego maila scala kierunki zamiast zakładać drugi wiersz.

---

## 3. Publikacja oferty — plan, z jedną dużą przeszkodą

> **CRM nie ma dziś z czego zbudować `oferta.json`.** Tabela `wyprawy` to pięć kolumn
> (nazwa, kierunek, trudność, opis, wymagane dokumenty), ceny i daty siedzą osobno
> w `terminy_wypraw`, a kierunków transportu jako katalogu nie ma wcale — `kontenery`
> opisują operację (statek, porty, ETD/ETA), nie ofertę. Do kontraktu ze `schema.ts`
> brakuje m.in. sluga, zdjęcia, regionu, chipów, programu dnia po dniu i widełek cenowych.
>
> Zanim ten rozdział da się wykonać, katalog w CRM musi urosnąć — to osobny, większy
> kawałek pracy niż cała trasa z rozdziału 1.

```php
// app/Actions/OpublikujOferte.php
public function handle(User $kto): void
{
    $oferta = $this->zbuduj();                    // pełny kształt wg docs/schema.ts

    Storage::disk('s3')->put('oferta.json', json_encode($oferta,
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT));

    $this->cloudfront->createInvalidation([...'/data/oferta.json']);

    // Przebudowa statycznej strony w GitHub Actions.
    Http::withToken(config('services.github.token'))
        ->post('https://api.github.com/repos/sambor88-glitch/Advfactory---www/dispatches', [
            'event_type' => 'publikacja-oferty',
            'client_payload' => ['wersja' => $oferta['_meta']['wersja']],
        ]);

    HistoriaPublikacji::create(['przez' => $kto->name, 'wersja' => $oferta['_meta']['wersja']]);
}
```

**`zbuduj()` musi zwrócić dokładnie kształt z `schema.ts`.** Nie sprawdzaj tego okiem —
w repozytorium strony leży `docs/oferta.schema.json`, czyli ten sam kontrakt w formie,
którą PHP umie zwalidować:

```php
// przed zapisem do S3 — publikacja niezgodna z kontraktem nie ma prawa wyjść
$walidator = new \Opis\JsonSchema\Validator();
$wynik = $walidator->validate(
    json_decode(json_encode($oferta)),
    file_get_contents(base_path('kontrakt/oferta.schema.json'))
);

if (! $wynik->isValid()) {
    throw new OfertaNiezgodnaZKontraktem($wynik->error());
}
```

Plik bierze się z repozytorium strony (`docs/oferta.schema.json`) — kopiowany przy
deployu albo pobierany z opublikowanej strony. Jest generowany z `schema.ts`, a CI
strony pilnuje, żeby nie był nieaktualny.

Po stronie strony ta sama oferta jest sprawdzana jeszcze raz przy przebudowie
i **niezgodna przerywa build**, więc CloudFront zostaje przy poprzedniej wersji.
Dwie bramki na tej samej regule — patrz `docs/praca-rownolegla.md`.

Zanim wypchniesz publikację, możesz ją sprawdzić tym, czym sprawdza ją CI strony:

```bash
npm run test:kontrakt -- https://crm-test.advfactory.com/public/oferta.json
```

Trzy pułapki, na które już się nadzialiśmy przy generowaniu przykładowej oferty:

1. **Slugi.** Normalizuj NFD i ścinaj znaki diakrytyczne, nie tylko polskie.
   Pierwsza wersja dawała `reykjav-k` i `valpara-so`.
2. **`Wyprawa.region` jest wymagane** przez kontrakt. W danych wyjściowych go nie było.
3. **Geokodowanie robi CRM przy zapisie**, nie strona. Bez `geo.lat`/`geo.lon`
   kierunek nie pojawi się na mapie.

### Zmienne w Forge

```
AWS_ACCESS_KEY_ID           # użytkownik IAM tylko do zapisu oferta.json
AWS_SECRET_ACCESS_KEY
AWS_DEFAULT_REGION=eu-central-1
AWS_BUCKET=advfactory-oferta-prod
CLOUDFRONT_DISTRIBUTION_ID
GITHUB_DISPATCH_TOKEN       # token z prawem repository_dispatch, nic więcej
TURNSTILE_SECRET
APP_FRONT_URL=https://advfactory.com
```

Uprawnienia użytkownika IAM: `s3:PutObject` na jednym kluczu i
`cloudfront:CreateInvalidation` na jednej dystrybucji. Nic poza tym — CRM nie ma
powodu dotykać samej strony ani buildu.

---

## Czego brakuje po stronie CRM

Poza trasami — widoki z paczki projektowej, których jeszcze nie ma w aplikacji:

- rozszerzenie **Terminarza transportów** o pełną stronę kierunku (zdjęcie, chipy,
  akapity, FAQ, wybór regionów) — dziś widok ma tylko lead i SEO,
- nowy widok **„Strony regionów”** pod gałąź `regiony[]` w ofercie,
- blok **„Lead ze strony”** w prawym panelu istniejącej Skrzynki — makieta jest
  w `crm/Skrzynka - panel leada WWW.dc.html`. Dziś zgłoszenie ze strony wygląda
  w skrzynce jak każde inne: kanał „Formularz" i notatka w historii. Blok z makiety
  wyciągnąłby wycenę i drogę po stronie na wierzch.

Znacznika źródła `WWW` w lejku **nie robimy** — ADV-81 rozstrzygnął, że `formularz`
wystarcza, a nowa wartość w słowniku to migracja bez zysku.

## Kolejność wdrożenia

1. ~~Trasa przyjmująca zgłoszenia~~ — zrobione, ADV-81.
2. **Wybór drogi z przeglądarki do CRM-u** (pośrednik albo Turnstile) — bez tego strona
   dalej jest makietą, mimo że CRM jest gotowy ją przyjąć.
3. Rozbudowa katalogu wypraw i dodanie katalogu kierunków transportu w CRM — warunek
   konieczny publikacji `oferta.json`.
4. Publikacja `oferta.json` do S3 — od tego oferta przestaje być plikiem w repo.
5. Blok „Lead ze strony” w Skrzynce.
6. Edytory stron kierunków i regionów.
7. Panel klienta.
