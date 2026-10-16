import { configFromEnv } from './supabase';

/**
 * The Supabase project the app was built with (from .env), or undefined when none is set.
 * Expo only fills in EXPO_PUBLIC_ variables written out in full like this.
 */
export const supabaseConfig = configFromEnv({
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_KEY: process.env.EXPO_PUBLIC_SUPABASE_KEY,
});
