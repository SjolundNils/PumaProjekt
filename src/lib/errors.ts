/**
 * errors.ts
 *
 * Hjälpfunktioner för felhantering.
 */

/**
 * Returnerar ett läsbart felmeddelande från ett okänt fel.
 *
 * Supabase returnerar sina fel som vanliga objekt med ett message-fält,
 * inte som instanser av Error. Funktionen hanterar båda fallen.
 *
 * @param error Felet som fångades, av okänd typ.
 * @returns     Felmeddelandet, eller en standardtext om inget finns.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return 'Okänt fel';
}