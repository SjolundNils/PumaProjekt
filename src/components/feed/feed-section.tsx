import { ThemedText } from '@/components/themed-text';
import { Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { StyleSheet, View } from 'react-native';

type Props = {
  title: string;
};

export function FeedSection({ title }: Props) {
  const theme = useTheme();
  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      <View style={styles.line} />
      <ThemedText themeColor="textSecondary" style={styles.label}>
        {title}
      </ThemedText>
      <View style={styles.line} />
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.two,
      marginTop: Spacing.one,
      marginBottom: Spacing.one,
    },
    line: {
      flex: 1,
      height: 1,
      backgroundColor: theme.backgroundSelected,
    },
    label: Typography.caption,
  });
}
