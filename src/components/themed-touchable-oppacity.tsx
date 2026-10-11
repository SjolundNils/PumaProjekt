import { ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { TouchableOpacity, type TouchableOpacityProps } from 'react-native';

export type ThemedTouchableOpacityProps = TouchableOpacityProps & {
  themeColor?: ThemeColor;
};

export function ThemedTouchableOpacity({ style, themeColor = 'background', ...rest }: ThemedTouchableOpacityProps) {
  const theme = useTheme();

  return (
    <TouchableOpacity
      style={[
        { 
          backgroundColor: theme[themeColor],
        },
        style,
      ]}
      {...rest}
    />
  );
}