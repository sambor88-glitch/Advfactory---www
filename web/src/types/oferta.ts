/**
 * Kontrakt danych jest jeden dla CRM i dla strony — mieszka w `docs/schema.ts`
 * i tylko stamtąd go bierzemy. Kopiowanie typów tutaj skończyłoby się rozjazdem,
 * dokładnie takim jak brakujące `Wyprawa.region` w pierwszej wersji oferty.
 */
export type * from '../../../docs/schema';
