# Integracja po stronie CRM (Laravel na Forge)

Co trzeba dołożyć w `advfactory-crm`, żeby strona zaczęła działać naprawdę.
Kontrakt danych jest w `schema.ts`, przepływ w `integracja-crm.md`, hosting
w `architektura.md`. Tu jest tylko strona Laravela.

> Pisane z dokumentacji, nie z kodu CRM — nazwy modeli (`zapytania`, `kontakty`,
> `aktywnosci`) biorę z `github.md`. Przy wdrożeniu dopasuj je do tego, co jest
> w repozytorium.

## Dwa strumienie, trzy trasy

```
strona → CRM     POST /api/leads              lead ze strony
                 POST /api/zainteresowani     zapis na powiadomienie o terminie

CRM → strona     „Publikuj" w panelu          zapis oferta.json do S3 + przebudowa
```

---

## 1. `POST /api/leads`

### Trasa

```php
// routes/api.php
Route::post('/leads', [LeadWwwController::class, 'store'])
    ->middleware(['throttle:leady']);          // limit niżej
```

```php
// app/Providers/AppServiceProvider.php — boot()
RateLimiter::for('leady', fn (Request $r) => [
    Limit::perMinute(3)->by($r->ip()),
    Limit::perDay(20)->by($r->ip()),
]);
```

Dwa progi, bo pojedynczy limit minutowy nie zatrzymuje bota rozłożonego w czasie,
a sam dzienny blokuje uczciwego klienta, który poprawia literówkę w mailu.

### Walidacja

```php
// app/Http/Requests/ZapiszLeadRequest.php
public function rules(): array
{
    return [
        'imie_nazwisko'    => ['required', 'string', 'max:120'],
        'email'            => ['required', 'email:rfc,dns', 'max:180'],
        'telefon'          => ['nullable', 'string', 'max:40'],
        'tresc'            => ['required', 'string', 'min:10', 'max:4000'],
        'zrodlo'           => ['required', Rule::in(['formularz', 'konfigurator', 'karta_wyprawy', 'strona_kierunku'])],
        'jezyk'            => ['required', Rule::in(['pl', 'en'])],
        'preferowany_kanal'=> ['required', Rule::in(['whatsapp', 'email', 'telefon'])],
        'wyprawa_id'       => ['nullable', 'string', 'exists:wyprawy,id'],
        'kierunek_id'      => ['nullable', 'string', 'exists:kierunki,id'],

        'konfiguracja'                    => ['nullable', 'array'],
        'konfiguracja.kierunek_id'        => ['required_with:konfiguracja', 'string', 'exists:kierunki,id'],
        'konfiguracja.kierunek_podrozy'   => ['required_with:konfiguracja', Rule::in(['jedna', 'obie'])],
        'konfiguracja.pojazd'             => ['required_with:konfiguracja', Rule::in(['motocykl', 'quad', 'samochod'])],
        'konfiguracja.wycena_od_eur'      => ['required_with:konfiguracja', 'integer', 'min:0'],
        'konfiguracja.wycena_do_eur'      => ['nullable', 'integer', 'gte:konfiguracja.wycena_od_eur'],

        'zgoda_rodo'                 => ['required', 'array'],
        'zgoda_rodo.timestamp'       => ['required', 'date'],
        'zgoda_rodo.wersja_polityki' => ['required', 'string', 'max:20'],

        'sciezka'         => ['array', 'max:10'],
        'sciezka.*'       => ['string', 'max:200'],
        'antyspam_token'  => ['required', 'string'],
    ];
}
```

**`ip` w `zgoda_rodo` dopisuje serwer**, nie przeglądarka — strona własnego adresu
nie zna i nie powinna go zgadywać. Za Forge/CloudFrontem pamiętaj o `TrustProxies`,
inaczej zapiszesz adres proxy zamiast klienta.

**Widełki z konfiguratora przyjmujemy jak są i nie przeliczamy ich.** To zapis tego,
co klient WIDZIAŁ na stronie. Jeśli cennik zmienił się między wyświetleniem a wysyłką,
to jest informacja dla handlowca, nie błąd do naprawienia po cichu.

### Turnstile

```php
// app/Rules/TokenTurnstile.php — validate()
$odp = Http::asForm()->timeout(5)->post('https://challenges.cloudflare.com/turnstile/v0/siteverify', [
    'secret'   => config('services.turnstile.secret'),
    'response' => $value,
    'remoteip' => request()->ip(),
]);

// Cloudflare niedostępne to nie powód, żeby stracić leada — przepuszczamy
// i oznaczamy zapytanie do ręcznego sprawdzenia.
if ($odp->failed()) {
    Log::warning('Turnstile nieosiągalny — lead przepuszczony bez weryfikacji');
    return;
}
if (! $odp->json('success')) {
    $fail('Weryfikacja antyspamowa nie przeszła.');
}
```

### Deduplikacja i routing do lejka

Reguła jest w `integracja-crm.md`; tu jej wykonanie.

```php
DB::transaction(function () use ($dane) {
    // 1. Kontakt — po e-mailu, potem po znormalizowanym telefonie.
    $kontakt = Kontakt::where('email', $dane['email'])->first()
        ?? Kontakt::where('telefon_e164', Telefon::normalizuj($dane['telefon'] ?? ''))->first()
        ?? Kontakt::create([...]);

    // 2. Wątek w Skrzynce — zawsze, dla każdego źródła.
    $zapytanie = Zapytanie::create([
        'kontakt_id'   => $kontakt->id,
        'kanal'        => 'www',
        'zrodlo_www'   => $dane['zrodlo'],
        'tresc'        => $dane['tresc'],
        'jezyk'        => strtoupper($dane['jezyk']),
        'konfiguracja' => $dane['konfiguracja'] ?? null,
        'sciezka'      => $dane['sciezka'] ?? [],
        'zgoda_rodo'   => [...$dane['zgoda_rodo'], 'ip' => request()->ip()],
    ]);

    // 3. Lejek — tylko dla źródeł, które niosą kwotę i konkret.
    if (in_array($dane['zrodlo'], ['konfigurator', 'karta_wyprawy'], true)) {
        $otwarta = $kontakt->szanse()->whereNotIn('etap', Etap::zamkniete())->first();

        if ($otwarta) {
            // Jeden klient, trzy zapytania to nadal jedna szansa sprzedaży.
            $otwarta->zapytania()->attach($zapytanie->id);
        } else {
            Szansa::create([
                'kontakt_id'        => $kontakt->id,
                'etap'              => Etap::NOWA,
                'zrodlo'            => 'WWW',
                'podtyp'            => $dane['zrodlo'],
                'wartosc_szacowana' => $this->wartoscSzacowana($dane),
            ]);
        }
    }
});
```

`wartoscSzacowana()`: dla `konfigurator` — `wycena_od_eur` (dolna granica widełek,
bo prognoza ma nie być życzeniowa); dla `karta_wyprawy` — `cena.kierowca_eur` wyprawy.

### Odpowiedź

```json
{ "ok": true, "numer_sprawy": "ZP-2026-0418", "odpowiedz_w_godzinach": 24 }
```

`numer_sprawy` ląduje w adresie strony „dziękujemy” i to jego klient poda przy telefonie.

### CORS

Strona stoi na `advfactory.com`, CRM na własnej domenie — to żądanie cross-origin.

```php
// config/cors.php
'paths' => ['api/leads', 'api/zainteresowani'],
'allowed_methods' => ['POST'],
'allowed_origins' => [env('APP_FRONT_URL', 'https://advfactory.com')],
'allowed_headers' => ['Content-Type'],
'supports_credentials' => false,
```

Środowisko testowe wskazuje na swój odpowiednik strony. Bez `*` — endpoint zapisuje dane.

---

## 2. `POST /api/zainteresowani`

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

## 3. Publikacja oferty

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
  w `crm/Skrzynka - panel leada WWW.dc.html`,
- w lejku: znacznik źródła `WWW` z podtypem i wartością szacowaną.

## Kolejność wdrożenia

1. `POST /api/leads` — od tego strona przestaje być makietą.
2. Publikacja `oferta.json` do S3 — od tego oferta przestaje być plikiem w repo.
3. Blok „Lead ze strony” w Skrzynce i znacznik w lejku.
4. Edytory stron kierunków i regionów.
5. Panel klienta.
