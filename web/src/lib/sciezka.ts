/**
 * Ścieżka klienta po stronie — ostatnie kilka widoków przed formularzem.
 * Trafia do leada jako `sciezka` i w CRM pokazuje, skąd ktoś przyszedł
 * („Start → Transport → Konfigurator → Formularz”).
 *
 * Trzymamy to w sessionStorage, nie w cookie: nie jest to dane śledzące
 * między sesjami, więc nie potrzebuje zgody marketingowej.
 */
const KLUCZ = 'adv-sciezka';
const LIMIT = 4;

export function zapiszWidok(): void {
  try {
    const teraz = location.pathname;
    const poprzednie = odczytajSciezke();
    if (poprzednie[poprzednie.length - 1] === teraz) return;
    const nowa = [...poprzednie, teraz].slice(-LIMIT);
    sessionStorage.setItem(KLUCZ, JSON.stringify(nowa));
  } catch {
    // Tryb prywatny albo zablokowane storage — ścieżka jest miłym dodatkiem, nie warunkiem.
  }
}

export function odczytajSciezke(): string[] {
  try {
    const surowe = sessionStorage.getItem(KLUCZ);
    return surowe ? (JSON.parse(surowe) as string[]) : [];
  } catch {
    return [];
  }
}
