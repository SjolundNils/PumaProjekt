/**
 * dates.ts
 *
 * Hjälpfunktioner för datum.
 */

/**
 * Returnerar dagens datum i svensk tid som 'ÅÅÅÅ-MM-DD'.
 *
 * Måste stämma med databasens app_today(), som också använder svensk tid.
 * new Date().toISOString() ska inte användas för detta, eftersom den ger
 * datumet i UTC, som skiljer sig från svensk tid kort efter midnatt.
 */
export function todayInSweden(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm' }).format(new Date());
}