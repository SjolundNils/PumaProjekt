/**
 * daily-song-context.tsx
 *
 * Håller reda på om den inloggade användaren har valt dagens låt.
 *
 * Används av flikraden för att dölja knappen för dagens låt när en låt
 * redan är vald, och av sidan för dagens låt för att uppdatera läget
 * direkt efter att en låt har valts.
 *
 * Läget hämtas på nytt:
 *   - när appen startar
 *   - när användaren loggar in eller ut
 *   - när appen kommer tillbaka från bakgrunden, så att knappen dyker upp
 *     igen efter midnatt
 *   - när en skärm anropar refresh()
 */

import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { todayInSweden } from '@/lib/dates';
import { supabase } from '@/lib/supabase';

type DailySongContextValue = {
  /** true om dagens låt är vald, false om inte, null medan det hämtas. */
  hasChosenToday: boolean | null;
  /** Hämtar läget på nytt. Anropas efter att en låt har valts. */
  refresh: () => Promise<void>;
};

const DailySongContext = createContext<DailySongContextValue | null>(null);

export function DailySongProvider({ children }: { children: ReactNode }) {
  const [hasChosenToday, setHasChosenToday] = useState<boolean | null>(null);

  const refresh = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) {
      setHasChosenToday(null);
      return;
    }

    // head: true hämtar bara antalet rader, inte själva datan.
    const { count, error } = await supabase
      .from('daily_songs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('song_date', todayInSweden());

    if (error) {
      console.log('Kunde inte hämta dagens låt:', error);
      return;
    }
    setHasChosenToday((count ?? 0) > 0);
  }, []);

  useEffect(() => {
    refresh();

    // Hämtar på nytt vid inloggning och utloggning. refresh anropas med
    // setTimeout så att inga Supabase-anrop görs inuti själva callbacken,
    // vilket kan låsa sessionen.
    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      setTimeout(refresh, 0);
    });

    // Hämtar på nytt när appen öppnas igen från bakgrunden.
    const appStateListener = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });

    return () => {
      authListener.subscription.unsubscribe();
      appStateListener.remove();
    };
  }, [refresh]);

  return (
    <DailySongContext.Provider value={{ hasChosenToday, refresh }}>
      {children}
    </DailySongContext.Provider>
  );
}

/** Ger tillgång till läget för dagens låt från valfri komponent. */
export function useDailySong(): DailySongContextValue {
  const context = useContext(DailySongContext);
  if (!context) {
    throw new Error('useDailySong måste användas inuti DailySongProvider');
  }
  return context;
}