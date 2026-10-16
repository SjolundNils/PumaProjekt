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

import { Pressable, StyleSheet, View } from 'react-native';

import { StarRating } from '@/components/rating/star-rating';
import { ActionButton } from '@/components/ui/action-button';
import { openRatingSheet } from '@/lib/ratings';

type Props = {
  /** Id:t för raden i daily_songs. */
  dailySongId: number;
  /** Användarens eget betyg på låten, om hen har betygsatt den. */
  myRating?: number;
    /**
   * Om betyget går att ändra. Sätts till false för låtar som inte är
   * dagens, eftersom bara dagens låt kan betygsättas. Då visas stjärnorna
   * utan att gå att trycka på, eller ingenting om låten saknar betyg.
   */
  editable?: boolean;
};

export function RateButton({ dailySongId, myRating, editable = true }: Props) {
  if (!editable) {
    return myRating ? (
      <View style={styles.stars}>
        <StarRating value={myRating} size={16} />
      </View>
    ) : null;
  }

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
    <ActionButton
      label="Rate"
      icon="star-outline"
      size="small"
      color="orange"
      onPress={() => openRatingSheet(dailySongId)}
      accessibilityLabel="Rate this song"
      style={styles.pill}
    />
  );
}

const styles = StyleSheet.create({
  stars: { alignSelf: 'flex-start', marginTop: 4 },
  pill: { alignSelf: 'flex-start', marginTop: 4 },
});