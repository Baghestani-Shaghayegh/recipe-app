import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';
import { KitchenProvider } from '@/store/kitchen';
import { PlanProvider } from '@/store/plan';
import { RecipesProvider } from '@/store/recipes';
import { ShoppingProvider } from '@/store/shopping';

export default function RootLayout() {
  const dark = useColorScheme() === 'dark';
  const c = dark ? Colors.dark : Colors.light;
  const base = dark ? DarkTheme : DefaultTheme;

  return (
    <ThemeProvider
      value={{
        ...base,
        colors: {
          ...base.colors,
          primary: c.accent,
          background: c.background,
          card: c.background,
          text: c.text,
          border: c.border,
        },
      }}>
      <RecipesProvider>
        <KitchenProvider>
          <PlanProvider>
            <ShoppingProvider>
              <Stack
                screenOptions={{
                  headerShadowVisible: false,
                  headerTintColor: c.accent,
                  headerTitleStyle: { color: c.text },
                }}>
                <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Recipes' }} />
                <Stack.Screen name="recipe/[id]" options={{ title: '' }} />
                <Stack.Screen
                  name="recipe/edit"
                  options={{ title: 'New recipe', presentation: 'modal' }}
                />
                <Stack.Screen name="backup" options={{ title: 'Backup', presentation: 'modal' }} />
                <Stack.Screen
                  name="recipe/import"
                  options={{ title: 'Import a recipe', presentation: 'modal' }}
                />
              </Stack>
            </ShoppingProvider>
          </PlanProvider>
        </KitchenProvider>
      </RecipesProvider>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
