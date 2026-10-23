/**
 * group-fields.tsx
 *
 * Fälten för gruppens namn och beskrivning, med en tunn linje under varje.
 * Används av create-group och group/[id]/edit, så att formuläret ser
 * likadant ut på båda ställena.
 *
 * Gränserna för längden exporteras härifrån. De motsvarar check-reglerna i
 * databasen, så ändra dem på båda ställena.
 */

import { StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

/** Max antal tecken i gruppnamnet. */
export const MAX_NAME_LENGTH = 40;

/** Max antal tecken i gruppbeskrivningen. */
export const MAX_DESCRIPTION_LENGTH = 200;

type Props = {
  name: string;
  onChangeName: (text: string) => void;
  description: string;
  onChangeDescription: (text: string) => void;
};

export function GroupFields({ name, onChangeName, description, onChangeDescription }: Props) {
  const theme = useTheme();
  const common = [styles.input, { color: theme.text, borderBottomColor: theme.backgroundSelected }];

  return (
    <View>
      <TextInput
        style={common}
        value={name}
        onChangeText={onChangeName}
        placeholder="Name"
        placeholderTextColor={theme.textSecondary}
        maxLength={MAX_NAME_LENGTH}
        returnKeyType="next"
        accessibilityLabel="Group name"
      />
      <TextInput
        style={[...common, styles.multiline]}
        value={description}
        onChangeText={onChangeDescription}
        placeholder="Description (optional)"
        placeholderTextColor={theme.textSecondary}
        maxLength={MAX_DESCRIPTION_LENGTH}
        multiline
        accessibilityLabel="Group description"
      />
      <ThemedText style={[styles.counter, { color: theme.textSecondary }]}>
        {description.length}/{MAX_DESCRIPTION_LENGTH}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  input: { fontSize: 17, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  counter: { fontSize: 12, alignSelf: 'flex-end', marginTop: 4 },
});