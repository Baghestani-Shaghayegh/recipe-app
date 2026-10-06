import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { parseIngredientList } from '@/lib/ingredients';
import type { Recipe } from '@/lib/recipe';

const STORAGE_KEY = 'recipes.v1';

export type RecipeInput = Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>;

type RecipesContextValue = {
  recipes: Recipe[];
  loaded: boolean;
  addRecipe: (input: RecipeInput) => Recipe;
  updateRecipe: (id: string, input: RecipeInput) => void;
  deleteRecipe: (id: string) => void;
};

const RecipesContext = createContext<RecipesContextValue | null>(null);

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// Shown the very first time the app opens so the list isn't empty.
function sampleRecipes(): Recipe[] {
  const now = Date.now();
  return [
    {
      id: newId(),
      title: 'Herb Omelette',
      category: 'Breakfast',
      tags: ['quick', 'vegetarian'],
      servings: 1,
      prepMinutes: 5,
      cookMinutes: 5,
      ingredients: parseIngredientList(
        '3 eggs\n1 tbsp butter\n2 tbsp chopped parsley and chives\nSalt and pepper',
      ),
      steps: [
        'Whisk the eggs with salt, pepper and most of the herbs.',
        'Melt the butter in a pan over medium heat.',
        'Pour in the eggs, stir gently until almost set, then fold in half.',
        'Top with the rest of the herbs.',
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: newId(),
      title: 'Lentil Soup',
      category: 'Dinner',
      tags: ['vegetarian', 'meal-prep'],
      servings: 4,
      prepMinutes: 10,
      cookMinutes: 35,
      ingredients: parseIngredientList(
        '1 cup red lentils\n1 onion\n2 cloves garlic\n1 tsp cumin\n1 l vegetable stock\n1 lemon',
      ),
      steps: [
        'Chop the onion and garlic and fry them in a little oil until soft.',
        'Add the cumin, lentils and stock. Simmer for 30 minutes.',
        'Blend until smooth and finish with lemon juice.',
      ],
      notes: 'Freezes well.',
      createdAt: now - 1,
      updatedAt: now - 1,
    },
  ];
}

export function RecipesProvider({ children }: { children: React.ReactNode }) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((json) => setRecipes(json === null ? sampleRecipes() : (JSON.parse(json) as Recipe[])))
      .catch((e) => console.warn('Could not load recipes', e))
      .finally(() => setLoaded(true));
  }, []);

  // Save after every change, but never before the first load (it would wipe saved data).
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(recipes)).catch((e) =>
      console.warn('Could not save recipes', e),
    );
  }, [recipes, loaded]);

  const addRecipe = useCallback((input: RecipeInput) => {
    const now = Date.now();
    const recipe: Recipe = { ...input, id: newId(), createdAt: now, updatedAt: now };
    setRecipes((prev) => [recipe, ...prev]);
    return recipe;
  }, []);

  const updateRecipe = useCallback((id: string, input: RecipeInput) => {
    setRecipes((prev) =>
      prev.map((r) => (r.id === id ? { ...input, id, createdAt: r.createdAt, updatedAt: Date.now() } : r)),
    );
  }, []);

  const deleteRecipe = useCallback((id: string) => {
    setRecipes((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const value = useMemo(
    () => ({ recipes, loaded, addRecipe, updateRecipe, deleteRecipe }),
    [recipes, loaded, addRecipe, updateRecipe, deleteRecipe],
  );

  return <RecipesContext.Provider value={value}>{children}</RecipesContext.Provider>;
}

export function useRecipes(): RecipesContextValue {
  const ctx = useContext(RecipesContext);
  if (!ctx) throw new Error('useRecipes must be used inside <RecipesProvider>');
  return ctx;
}
