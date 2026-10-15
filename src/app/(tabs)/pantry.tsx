import { router } from 'expo-router';

import { PantryList } from '@/components/pantry-list';

export default function PantryScreen() {
  return <PantryList onSeeRecipes={() => router.navigate('/cook')} />;
}
