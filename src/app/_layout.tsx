import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';
import { RecipesProvider } from '@/store/recipes';

export default function RootLayout() {
  const dark = useColorScheme() === 'dark';
  const c = dark ? Colors.dark : Colors.light;
  const base = dark ? DarkTheme : DefaultTheme;

  return (
    <ThemeProvider
      value={{
        ...base,
        colors: { ...base.colors, primary: c.accent, background: c.background, card: c.background, text: c.text, border: c.border },
      }}>
      <RecipesProvider>
        <Stack screenOptions={{ headerShadowVisible: false, headerTintColor: c.accent, headerTitleStyle: { color: c.text } }}>
          <Stack.Screen name="index" options={{ title: 'My Recipes' }} />
          <Stack.Screen name="recipe/[id]" options={{ title: '' }} />
          <Stack.Screen name="recipe/edit" options={{ title: 'New recipe', presentation: 'modal' }} />
        </Stack>
      </RecipesProvider>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
