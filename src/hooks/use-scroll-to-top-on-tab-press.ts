/**
 * use-scroll-to-top-on-tab-press.ts
 *
 * Scrollar en lista till toppen när användaren trycker på flikens knapp i
 * flikraden, medan fliken redan visas. Samma beteende som i Apples egna
 * appar.
 *
 * Fungerar med ScrollView, FlatList och SectionList, utan att sidans
 * struktur behöver ändras.
 *
 * Exempel:
 *   const listRef = useRef<SectionList<FeedEvent>>(null);
 *   useScrollToTopOnTabPress(listRef);
 *   <SectionList ref={listRef} ... />
 */

import { useNavigation } from 'expo-router';
import { RefObject, useEffect } from 'react';

/**
 * Det enda listan behöver kunna: scrolla, direkt eller via sin scrollyta.
 *
 * Metoderna skrivs med metodsyntax (namn(): typ) istället för som
 * egenskaper, eftersom TypeScript då jämför dem mindre strikt. Det gör att
 * ScrollView, FlatList och SectionList alla passar, trots att deras egna
 * typer skiljer sig något åt.
 */
type ScrollOptions = { y: number; animated: boolean };

type Scrollable = {
  getScrollResponder?(): { scrollTo?(options: ScrollOptions): void } | null | undefined;
  scrollTo?(options: ScrollOptions): void;
};

export function useScrollToTopOnTabPress(ref: RefObject<Scrollable | null>) {
  const navigation = useNavigation();

  useEffect(() => {
    // @ts-expect-error native tabs saknar typen för tabPress
    const unsubscribe = navigation.addListener('tabPress', () => {
      // Scrollar bara om fliken redan visas. Annars byter tryckningen bara flik.
      if (!navigation.isFocused()) return;

      const list = ref.current;
      if (!list) return;

      // ScrollView har scrollTo direkt. FlatList och SectionList har den
      // på sin scrollyta, som nås via getScrollResponder.
      if (list.scrollTo) {
        list.scrollTo({ y: 0, animated: true });
      } else {
        list.getScrollResponder?.()?.scrollTo?.({ y: 0, animated: true });
      }
    });

    return unsubscribe;
  }, [navigation, ref]);
}