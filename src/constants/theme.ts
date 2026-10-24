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
    dangerSoft: '#FDECEC',
    // Meal prep batches.
    prep: '#0F766E',
    prepSoft: '#E6F4F1',
    prepLine: '#9CC9C1',
    // A day's calories, protein and fat on the Plan.
    kcal: '#E8590C',
    kcalTrack: '#FCE7DA',
    protein: '#5E8C31',
    proteinTrack: '#E6F0DA',
    fat: '#D99A1E',
    fatTrack: '#FAEFD6',
    // The pop-up message at the bottom of the screen.
    toast: '#2A2420',
    success: '#3FA36B',
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
    dangerSoft: '#3A1F1D',
    prep: '#2DD4BF',
    prepSoft: '#123B37',
    prepLine: '#2F6B63',
    kcal: '#FB923C',
    kcalTrack: '#3A2A1F',
    protein: '#A3C46A',
    proteinTrack: '#2A3320',
    fat: '#F2B84B',
    fatTrack: '#3A3020',
    toast: '#3A332E',
    success: '#3FA36B',
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
