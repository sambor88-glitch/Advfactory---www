/**
 * Test przeglądarkowy ścieżki sprzedażowej.
 *
 * Sprawdza to, czego nie złapie typowanie ani build: czy konfigurator liczy
 * właściwe kwoty, czy lead składa payload zgodny z `LeadWWW`, czy puste pola
 * oferty chowają całe sekcje i czy YouTube nie ładuje się przed zgodą na cookies.
 *
 * Uruchomienie:
 *   npm run build && npm run preview &
 *   npm run test:e2e
 *
 * Wymaga Chromium. W środowiskach z Playwrightem preinstalowanym przez obraz
 * wskaż binarkę zmienną CHROMIUM_PATH.
 */
import { chromium } from 'playwright';

const BAZA = process.env.BAZA_URL ?? 'http://localhost:4321';
const b = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
);
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
const p = await ctx.newPage();
const logi = [];
p.on('console', (m) => logi.push(`${m.type()}: ${m.text()}`));
p.on('pageerror', (e) => logi.push(`pageerror: ${e}`));
const zle = [];
const sprawdz = (co, war) => { console.log((war ? '  OK  ' : '  BŁĄD') + '  ' + co); if (!war) zle.push(co); };
// Etykieta, nie ukryty input — tak klika prawdziwy użytkownik.
const wybierz = (nazwa, wartosc) => p.locator(`label:has(input[name="${nazwa}"][value="${wartosc}"])`).click();
const zamknijCookies = async () => {
  await p.waitForTimeout(1200);
  const banner = p.locator('#zgoda-cookies');
  if (await banner.isVisible().catch(() => false)) await p.click('[data-zgoda="niezbedne"]');
  await p.waitForTimeout(300);
};

console.log('— KONFIGURATOR —');
await p.goto(`${BAZA}/transport`, { waitUntil: 'domcontentloaded' });
await zamknijCookies();

const widelek = async () => (await p.textContent('#widelek')).replace(/\s/g, ' ').trim();
console.log('        domyślnie:', await widelek());
sprawdz('domyślnie: motocykl, Kirgistan, w jedną stronę = 1250–1400', /1 250/.test(await widelek()) && /1 400/.test(await widelek()));

await wybierz('strony', 'obie');
await p.waitForTimeout(200);
console.log('        w obie strony:', await widelek());
sprawdz('obie strony = 1800–2016', /1 800/.test(await widelek()) && /2 016/.test(await widelek()));

await wybierz('pojazd', 'quad');
await p.waitForTimeout(200);
console.log('        quad:', await widelek());
sprawdz('quad = 1800×1,35 = 2430–2722', /2 430/.test(await widelek()));

const opcjaIslandia = await p.locator('#wybor-kierunku option', { hasText: 'Islandia' }).getAttribute('value');
await p.selectOption('#wybor-kierunku', opcjaIslandia);
await p.waitForTimeout(250);
sprawdz('Islandia blokuje „w jedną stronę"', await p.isDisabled('input[name="strony"][value="jedna"]'));
sprawdz('Islandia pokazuje notkę o wymuszeniu', await p.locator('#wymuszone').isVisible());
console.log('        notka:', (await p.textContent('#wymuszone')).trim());
console.log('        widełki:', await widelek());

const cfg = JSON.parse(await p.getAttribute('#zapytaj-konfigurator', 'data-konfiguracja'));
console.log('        payload:', JSON.stringify(cfg));
sprawdz('payload zgodny z KonfiguracjaTransportu',
  cfg.kierunek_id === 'kier-is' && cfg.pojazd === 'quad' && cfg.kierunek_podrozy === 'obie' && cfg.wycena_do_eur > cfg.wycena_od_eur);
// Nazwa obok identyfikatora — bez niej CRM zapisze zapytanie „o kier-is”, czego biuro nie przeczyta.
sprawdz('konfiguracja niesie nazwę kierunku', typeof cfg.kierunek_nazwa === 'string' && cfg.kierunek_nazwa.length > 0);

console.log('\n— SZUFLADA I LEAD —');
await p.click('#zapytaj-konfigurator');
await p.waitForTimeout(400);
sprawdz('szuflada się otwiera', await p.locator('#szuflada').isVisible());
sprawdz('kontekst pokazuje wybrany kierunek', (await p.textContent('#kontekst-zapytania')).includes('Islandia'));

await p.click('#wyslij');
await p.waitForTimeout(300);
sprawdz('pusty formularz nie wysyła i pokazuje błąd', await p.locator('#blad-zapytania').isVisible());

const szuflada = p.locator('#szuflada');
await szuflada.locator('input[name="imie_nazwisko"]').fill('Jan Testowy');
await szuflada.locator('input[name="email"]').fill('sambor88@gmail.com');
await szuflada.locator('textarea[name="tresc"]').fill('Pytam o transport quada na Islandię.');
await p.locator('label.rodo').click();
await p.click('#wyslij');
await p.waitForURL(/dziekujemy/, { timeout: 6000 }).catch(() => {});
sprawdz('po wysyłce ląduje na /dziekujemy', p.url().includes('/dziekujemy'));
sprawdz('strona dziękujemy pokazuje numer sprawy', await p.locator('#numer-sprawy').isVisible());

const lead = logi.find((l) => l.includes('[lead] payload'));
sprawdz('payload leada trafił do wysyłki', Boolean(lead));
if (lead) console.log('        ' + lead.slice(0, 260));

console.log('\n— ŚCIEŻKA KLIENTA —');
const sciezka = await p.evaluate(() => sessionStorage.getItem('adv-sciezka'));
console.log('        sciezka:', sciezka);
sprawdz('ścieżka zapisuje odwiedzone widoki', sciezka && JSON.parse(sciezka).length >= 2);

console.log('\n— FILTRY WYPRAW —');
await p.goto(`${BAZA}/wyprawy`, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(400);
sprawdz('domyślnie 9 wypraw', (await p.textContent('#widoczne')) === '9');
await wybierz('trudnosc', 'mocne');
await p.waitForTimeout(200);
const mocne = await p.textContent('#widoczne');
console.log('        mocne 7–10:', mocne);
sprawdz('filtr trudności zawęża listę', Number(mocne) > 0 && Number(mocne) < 9);
await wybierz('rok', '2026');
await p.waitForTimeout(200);
const puste = await p.textContent('#widoczne');
console.log('        mocne + 2026:', puste);
sprawdz('przy zerowym wyniku pokazuje komunikat', puste !== '0' || await p.locator('#pusto').isVisible());

console.log('\n— KARTA WYPRAWY BEZ OPISU —');
await p.goto(`${BAZA}/wyprawy/2026-przez-tybet-do-bangkoku`, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(300);
sprawdz('pusty opis nie zostawia gołego nagłówka', (await p.textContent('.brak-tresci')).includes('dopiero powstaje'));
sprawdz('puste plan_dni nie renderuje sekcji', (await p.locator('.plan').count()) === 0);
sprawdz('puste zawiera/nie_zawiera nie renderuje sekcji', (await p.locator('.dwie-listy').count()) === 0);

console.log('\n— COOKIES I EMBEDY —');
const ctx2 = await b.newContext({ viewport: { width: 1440, height: 1000 } });
const p2 = await ctx2.newPage();
await p2.goto(`${BAZA}/`, { waitUntil: 'domcontentloaded' });
await p2.waitForTimeout(1500);
sprawdz('banner cookies się pokazuje', await p2.locator('#zgoda-cookies').isVisible());
sprawdz('YouTube NIE jest załadowany przed zgodą', (await p2.locator('iframe').count()) === 0);
await p2.click('[data-zgoda="wszystko"]');
await p2.waitForTimeout(600);
sprawdz('po zgodzie banner znika', await p2.locator('#zgoda-cookies').isHidden());
sprawdz('po zgodzie embed YouTube się pojawia', (await p2.locator('iframe').count()) > 0);

const bledy = logi.filter((l) => l.startsWith('error') || l.startsWith('pageerror'))
  .filter((l) => !/ERR_TUNNEL|ERR_CERT|Failed to load resource/.test(l));
console.log('\n— KONSOLA —');
console.log(bledy.length ? bledy.join('\n') : '  brak błędów JS (pominięto zasoby zablokowane przez sandbox)');

await b.close();
console.log(zle.length ? `\nNIEPOWODZENIA (${zle.length}):\n  - ` + zle.join('\n  - ') : '\nWSZYSTKO PRZESZŁO');
process.exit(zle.length ? 1 : 0);
