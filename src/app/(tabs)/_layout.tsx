import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';
import { Platform, type ColorValue } from 'react-native';

import { Features } from '@/constants/features';
import { useTheme } from '@/constants/theme';
import { useKitchen } from '@/store/kitchen';
import { useRecipes } from '@/store/recipes';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

// tabBarIcon takes a render function, not a component, so this returns a plain function.
function icon(name: IconName) {
  return function renderIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} color={color} size={size} />;
  };
}

export default function TabLayout() {
  const c = useTheme();
  const { makeNext } = useKitchen();
  const { recipes } = useRecipes();
  const nextCount = makeNext.filter((m) => recipes.some((r) => r.id === m.recipeId)).length;

  return (
    <Tabs
      screenOptions={{
        headerShadowVisible: false,
        headerTintColor: c.accent,
        headerTitleStyle: { color: c.text },
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.textSecondary,
        tabBarStyle: {
          backgroundColor: c.background,
          borderTopColor: c.border,
          // Web has no safe-area padding, so the labels would touch the bottom edge.
          ...(Platform.OS === 'web' && { height: 60, paddingBottom: 8 }),
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'My Recipes', tabBarLabel: 'Recipes', tabBarIcon: icon('book-outline') }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: 'Discover',
          headerShown: false,
          href: Features.discover ? undefined : null,
          tabBarIcon: icon('play-circle-outline'),
        }}
      />
      <Tabs.Screen
        name="cook"
        options={{
          title: 'What can I make?',
          tabBarLabel: 'Cook',
          tabBarIcon: icon('flame-outline'),
        }}
      />
      <Tabs.Screen
        name="next"
        options={{
          title: 'Make next',
          tabBarLabel: 'Next',
          href: Features.makeNextTab ? undefined : null,
          tabBarIcon: icon('list-outline'),
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          title: 'Meal plan',
          tabBarLabel: 'Plan',
          tabBarIcon: icon('calendar-outline'),
          href: Features.mealPlan ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="pantry"
        options={{
          title: 'My Pantry',
          tabBarLabel: 'Pantry',
          tabBarIcon: icon('basket-outline'),
          // In version 1 the pantry is part of the Cook tab.
          href: null,
        }}
      />
      <Tabs.Screen
        name="shopping"
        options={{
          title: 'Shopping list',
          tabBarLabel: 'Shopping',
          tabBarIcon: icon('cart-outline'),
          // Without the Make next tab, its count shows here: recipes you're shopping for.
          tabBarBadge: (!Features.makeNextTab && nextCount) || undefined,
          tabBarBadgeStyle: { backgroundColor: c.accent, color: c.accentText },
        }}
      />
    </Tabs>
  );
}
