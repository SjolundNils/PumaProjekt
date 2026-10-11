import { ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { StyleSheet, TextInput, type TextInputProps } from 'react-native';

export type ThemedTextInputProps = TextInputProps & {
  themeColor?: ThemeColor;
};

export function ThemedTextInput({ style, themeColor = 'text', ...rest }: ThemedTextInputProps) {
  const theme = useTheme();

  return (
    <TextInput
      style={[
        styles.input,
        { 
          color: theme[themeColor],
        },
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16
  },
});