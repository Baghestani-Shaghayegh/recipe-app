import { useColorScheme } from 'react-native';

/**
 * "Warm Kitchen" palette. See UI_UX_PLAN.md.
 *
 * - `accent` is for red text, icons and tints; `primary` is the fill behind
 *   buttons and selected chips, with `onPrimary` on top. They differ in dark
 *   mode: the button keeps the same tomato red, while red text gets lighter
 *   so it stays readable on the dark background.
 * - `secondary` (olive) marks done/have states such as checkmarks.
 * - `highlight` (saffron) is for timers and small highlights only.
 */
export const Colors = {
  light: {
    text: '#241A17',
    textSecondary: '#776B65',
    background: '#FBFAF8',
    card: '#FFFFFF',
    border: '#ECE6E1',
    chip: '#F4EFEA',
    accent: '#C8412B',
    primary: '#C8412B',
    onPrimary: '#FFFFFF',
    secondary: '#66733A',
    highlight: '#E3A23C',
    danger: '#B42318',
  },
  dark: {
    text: '#F3ECE6',
    textSecondary: '#ADA29A',
    background: '#171311',
    card: '#221C19',
    border: '#342B27',
    chip: '#2B2420',
    accent: '#EE7A63',
    primary: '#C8412B',
    onPrimary: '#FFFFFF',
    secondary: '#A3B062',
    highlight: '#E3A23C',
    danger: '#F97066',
  },
} as const;

export type ThemeColors = (typeof Colors)['light' | 'dark'];

/**
 * Font family names, loaded in the root layout. Each weight is its own family,
 * so set `fontFamily` instead of `fontWeight`. The serif is for recipe titles only.
 */
export const Fonts = {
  serif: 'YoungSerif_400Regular',
  regular: 'HankenGrotesk_400Regular',
  medium: 'HankenGrotesk_500Medium',
  semibold: 'HankenGrotesk_600SemiBold',
  bold: 'HankenGrotesk_700Bold',
  extrabold: 'HankenGrotesk_800ExtraBold',
} as const;

/** Type scale for new and restyled text. */
export const TypeSize = {
  caption: 13,
  body: 15,
  lead: 17,
  title: 22,
  display: 28,
} as const;

export const Radius = {
  small: 8,
  medium: 12,
  large: 16,
} as const;

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
