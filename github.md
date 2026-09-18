# Źródło kodu

repo: sambor88-glitch/advfactory-crm
branch: main

## Last sync
date: 2026-09-18T01:54:03Z

### Updated in this project
- Handoff dla programisty: `docs/schema.ts` (kontrakt typów), `docs/oferta.json` (przykładowa oferta), `crm/Skrzynka — panel leada WWW.dc.html` (spec prawego panelu istniejącej Skrzynki z `prototyp/Skrzynka Zapytań.dc.html`), `Stany strony.dc.html` (7 stanów błędów).
- CRM: widok Ustawienia strony (kontakt, obietnica 24 h, hero, baner, wideo, SEO domyślne, analityka, historia publikacji); pola SEO w szufladach wypraw i kierunków; geokodowanie kierunków po nazwie miasta. Dokumentacja przepływu w `docs/integracja-crm.md`.
- Nowe widoki CRM w `crm/` (styl prototypu z repo, motyw ciemny): Katalog wypraw (szkic → publikuj), Terminarz transportów, Zainteresowani terminem, Treści strony. Strona ma tweak „Tryb edycji” z linkami do tych widoków — CRM jest jedynym źródłem oferty.
- Nowa strona advfactory.com jako Design Component (`Strona ADVfactory.dc.html`): strona główna, lista wypraw, karta wyprawy, transport, panel klienta, szuflada zapytania do CRM.
- Mapa kierunków transportu z prawdziwej geometrii (d3 + Natural Earth), trasy z magazynu w Ciechanowie.
- Skopiowane assety z repozytorium: `assets/logo-white.png`, `assets/lucide.min.js`.
- Tokeny wizualne (kolory, typografia, layout) przeniesione z `design-system/tokens/` — Anton / Archivo / IBM Plex Mono, enduro orange `#EA5A0B`.
- Warstwa prawna: polityka prywatności, polityka cookies, banner zgody z blokadą embedów (YouTube, Mapy Google), klauzula RODO przy formularzu, strona 404 i osobna strona „dziękujemy”.
- Dołożone: menu mobilne, FAQ, Kontakt (dwa magazyny: Łowicz i Ciechanów), archiwum 60 zakończonych wypraw, opinie (zaślepki), planer kontenerów, kalkulator pełnego kosztu, checklista gotowości, wątek wiadomości w panelu.

## Screen map
| Ekran w projekcie | Pliki źródłowe w repo |
|---|---|
| Strona ADVfactory — cała strona | `design-system/README-design-system.md`, `design-system/tokens/colors.css`, `design-system/tokens/typography.css`, `design-system/tokens/layout.css`, `README.md` |
| Szuflada zapytania (lejek do CRM) | `prototyp/Skrzynka Zapytań.dc.html`, `README.md` (sekcja Skrzynka Zapytań) |
| Panel klienta — os czasu transportu | `README.md` (E4 Transport, `propozycje_statusu`), `prototyp/admin-shell.js` |
| Mapa kierunków transportu | dane advfactory.com/transport (terminarz), geometria Natural Earth |
| `crm/*.dc.html` — widoki oferty i leadów | `prototyp/Klienci.dc.html` (lista), `prototyp/Skrzynka Zapytań.dc.html` (trzy panele), `prototyp/admin-shell.js`, `README.md` (model danych: `zapytania`, `kontakty`, `aktywnosci`) |
| Assety (logo, ikony) | `prototyp/logo-white.png`, `prototyp/lucide.min.js` |

## Uwagi
- Statusy transportu w panelu klienta odzwierciedlają zasadę z repo: system nie zmienia statusu sam, biuro zatwierdza propozycję z maila agencji celnej.
- Treść wypraw i terminarz transportu pobrane z advfactory.com (strony `/wyprawy/`, `/transport/`, karta wyprawy „Przez Tybet do Bangkoku”).
