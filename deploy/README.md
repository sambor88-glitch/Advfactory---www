# ADVfactory — publikacja na Vercel

Ten folder jest gotowy do wrzucenia w całości. Nic nie trzeba budować — same pliki HTML.

## Najszybciej (bez terminala)
1. Wejdź na vercel.com → **Add New… → Project**.
2. Przeciągnij cały folder `deploy` na stronę (opcja „Deploy a static site” / drag & drop).
3. Po chwili dostaniesz adres `https://cos.vercel.app` — wyślij ojcu link do `/podglad`.

## Z terminala
```
npm i -g vercel
cd deploy
vercel --prod
```

## Adresy po publikacji (cleanUrls: bez `.html`)
- `/podglad` — strona startowa dla oceniającego, linki do wszystkiego
- `/` — strona PL · `/en` — strona EN
- `/mapa-transportow` — mapa kierunków (też wstawiona w stronę)
- `/stany` — stany błędów i ładowania
- `/crm/wyprawy` · `/crm/transport` · `/crm/tresci` · `/crm/zainteresowani` · `/crm/ustawienia` · `/crm/leady-www`

## Uwagi
- Zdjęcia ładują się z advfactory.com — potrzebny internet.
- Fonty z Google Fonts.
- `vercel.json` ustawia `noindex` — Google nie zaindeksuje prototypu.
- Formularze nie wysyłają nic nigdzie — to prototyp.
