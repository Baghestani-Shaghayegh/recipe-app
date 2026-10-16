import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';
import { AccountProvider } from '@/store/account';
import { FeedProvider } from '@/store/feed';
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
      <AccountProvider>
        <RecipesProvider>
          <KitchenProvider>
            <PlanProvider>
              <ShoppingProvider>
                <FeedProvider>
                  <Stack
                    screenOptions={{
                      headerShadowVisible: false,
                      headerTintColor: c.accent,
                      headerTitleStyle: { color: c.text },
                    }}>
                    <Stack.Screen
                      name="(tabs)"
                      options={{ headerShown: false, title: 'Recipes' }}
                    />
                    <Stack.Screen name="recipe/[id]" options={{ title: '' }} />
                    <Stack.Screen
                      name="recipe/edit"
                      options={{ title: 'New recipe', presentation: 'modal' }}
                    />
                    <Stack.Screen
                      name="account"
                      options={{ title: 'Account & sync', presentation: 'modal' }}
                    />
                    <Stack.Screen
                      name="backup"
                      options={{ title: 'Backup', presentation: 'modal' }}
                    />
                    <Stack.Screen name="post/[id]" options={{ headerShown: false, title: '' }} />
                    <Stack.Screen
                      name="post/new"
                      options={{ title: 'Post a recipe video', presentation: 'modal' }}
                    />
                    <Stack.Screen
                      name="recipe/import"
                      options={{ title: 'Paste a link', presentation: 'modal' }}
                    />
                  </Stack>
                </FeedProvider>
              </ShoppingProvider>
            </PlanProvider>
          </KitchenProvider>
        </RecipesProvider>
      </AccountProvider>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
