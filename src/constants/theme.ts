import { useColorScheme } from 'react-native';

export const Colors = {
  light: {
    text: '#1F1A17',
    textSecondary: '#6B625C',
    background: '#FBF8F5',
    card: '#FFFFFF',
    border: '#E7E0D9',
    accent: '#C2410C',
    accentText: '#FFFFFF',
    chip: '#F1EBE5',
    danger: '#B91C1C',
  },
  dark: {
    text: '#F5F0EB',
    textSecondary: '#ABA29B',
    background: '#151210',
    card: '#211D1A',
    border: '#3A332E',
    accent: '#FB923C',
    accentText: '#1F1A17',
    chip: '#2C2622',
    danger: '#F87171',
  },
} as const;

export type ThemeColors = (typeof Colors)['light' | 'dark'];

export const Spacing = {
  one: 4,
  two: 8,
  three: 12,
  four: 16,
  five: 24,
  six: 32,
} as const;

export const MaxContentWidth = 720;

export function useTheme(): ThemeColors {
  return useColorScheme() === 'dark' ? Colors.dark : Colors.light;
}
