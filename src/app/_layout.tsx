import {
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
  HankenGrotesk_800ExtraBold,
} from '@expo-google-fonts/hanken-grotesk';
import { YoungSerif_400Regular } from '@expo-google-fonts/young-serif';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { Colors, Fonts } from '@/constants/theme';
import { AccountProvider } from '@/store/account';
import { FeedProvider } from '@/store/feed';
import { KitchenProvider } from '@/store/kitchen';
import { PlanProvider } from '@/store/plan';
import { RecipesProvider } from '@/store/recipes';
import { ShoppingProvider } from '@/store/shopping';

// Keep the splash screen up until the fonts are ready, so text never flashes in the system font.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    YoungSerif_400Regular,
    HankenGrotesk_400Regular,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
    HankenGrotesk_700Bold,
    HankenGrotesk_800ExtraBold,
  });
  const fontsReady = fontsLoaded || !!fontError;
  useEffect(() => {
    if (fontsReady) SplashScreen.hide();
  }, [fontsReady]);

  const dark = useColorScheme() === 'dark';
  const c = dark ? Colors.dark : Colors.light;
  const base = dark ? DarkTheme : DefaultTheme;

  // If a font fails to load, carry on with the system font rather than blocking the app.
  if (!fontsReady) return null;

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
        fonts: {
          regular: { fontFamily: Fonts.regular, fontWeight: 'normal' },
          medium: { fontFamily: Fonts.medium, fontWeight: 'normal' },
          bold: { fontFamily: Fonts.semibold, fontWeight: 'normal' },
          heavy: { fontFamily: Fonts.bold, fontWeight: 'normal' },
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
                      headerTitleStyle: { color: c.text, fontFamily: Fonts.semibold },
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
                      options={{ title: 'Import a recipe', presentation: 'modal' }}
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
