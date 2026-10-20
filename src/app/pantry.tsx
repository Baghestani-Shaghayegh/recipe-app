import { router } from 'expo-router';

import { PantryList } from '@/components/pantry-list';

/** My pantry, opened from "Match my pantry" on the Recipes page. */
export default function PantryScreen() {
  return <PantryList onSeeRecipes={() => router.back()} />;
}
