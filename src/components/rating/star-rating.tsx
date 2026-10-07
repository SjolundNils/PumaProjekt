/**
 * star-rating.tsx
 *
 * Fem stjärnor för att välja eller visa ett betyg från 1 till 5 i halva
 * steg (1, 1.5, 2 ... 5).
 *
 * Varje stjärna är delad i en vänster och en höger halva. Ett tryck på
 * vänster halva ger ett halvt steg (till exempel 3.5), ett tryck på höger
 * halva ger ett helt (till exempel 4).
 *
 * Komponenten är kontrollerad: den visar värdet den får via value och
 * rapporterar nya val via onChange. Utan onChange visas betyget bara,
 * utan att gå att ändra.
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

type Props = {
  /** Aktuellt betyg, 0 betyder inget betyg. */
  value: number;
  /** Anropas med det nya betyget när användaren trycker. Utelämnas för att bara visa. */
  onChange?: (value: number) => void;
  /** Storlek på stjärnorna i punkter. */
  size?: number;
  /** Färg på ifyllda stjärnor. */
  color?: string;
};

const STARS = [1, 2, 3, 4, 5];

export function StarRating({ value, onChange, size = 40, color = '#FFC107' }: Props) {
  return (
    <View style={styles.row}>
      {STARS.map((star) => (
        <View key={star} style={{ width: size, height: size }}>
          <Ionicons name={iconFor(star, value)} size={size} color={color} />

          {/* Osynliga tryckytor ovanpå stjärnan, en per halva. */}
          {onChange && (
            <View style={StyleSheet.absoluteFill}>
              <View style={styles.halves}>
                <Pressable
                  style={styles.half}
                  onPress={() => onChange(star - 0.5)}
                  hitSlop={{ top: 8, bottom: 8 }}
                />
                <Pressable
                  style={styles.half}
                  onPress={() => onChange(star)}
                  hitSlop={{ top: 8, bottom: 8 }}
                />
              </View>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

/**
 * Väljer ikon för en stjärna utifrån betyget:
 * hel om betyget når upp till stjärnan, halv om det når halvvägs,
 * annars tom.
 */
function iconFor(star: number, value: number): 'star' | 'star-half' | 'star-outline' {
  if (value >= star) return 'star';
  if (value >= star - 0.5) return 'star-half';
  return 'star-outline';
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6 },
  halves: { flex: 1, flexDirection: 'row' },
  half: { flex: 1 },
});