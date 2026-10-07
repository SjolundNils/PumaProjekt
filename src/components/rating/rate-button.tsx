/**
 * rate-button.tsx
 *
 * Knapp för att betygsätta en låt. Visar antingen:
 *   - användarens egna stjärnor, om hen redan har betygsatt låten, eller
 *   - en pillformad Rate-knapp, om hen inte har det.
 *
 * Båda öppnar betygsrutan. Kan användas på alla skärmar som visar
 * dagens låtar, till exempel flödet och grupper.
 *
 * Exempel:
 *   <RateButton dailySongId={song.id} myRating={myRatings[song.id]} />
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet } from 'react-native';

import { StarRating } from '@/components/rating/star-rating';
import { ThemedText } from '@/components/themed-text';
import { openRatingSheet } from '@/lib/ratings';

type Props = {
  /** Id:t för raden i daily_songs. */
  dailySongId: number;
  /** Användarens eget betyg på låten, om hen har betygsatt den. */
  myRating?: number;
};

export function RateButton({ dailySongId, myRating }: Props) {
  if (myRating) {
    return (
      <Pressable
        style={styles.stars}
        onPress={() => openRatingSheet(dailySongId)}
        hitSlop={6}
        accessibilityLabel={`Your rating: ${myRating} stars. Tap to change.`}
      >
        <StarRating value={myRating} size={16} />
      </Pressable>
    );
  }

  return (
    <Pressable
      style={styles.pill}
      onPress={() => openRatingSheet(dailySongId)}
      hitSlop={6}
      accessibilityLabel="Rate this song"
    >
      <Ionicons name="star-outline" size={14} color="#FFC107" />
      <ThemedText style={styles.pillText}>Rate</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stars: { alignSelf: 'flex-start', marginTop: 4 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start', // Pillen blir bara så bred som innehållet
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginTop: 4,
    borderRadius: 999, // Fullt rundade kortsidor ger pillformen
    borderWidth: 1,
    borderColor: '#FFC107',
  },
  pillText: { fontSize: 13, fontWeight: '600', color: '#FFC107' },
});