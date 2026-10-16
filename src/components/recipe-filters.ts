import type { FilterGroup } from '@/components/filter-bar';
import { DIETS, type DietId } from '@/lib/diet';
import { CATEGORIES, TIME_FILTERS, type Category } from '@/lib/recipe';

// The filters the Recipes and Cook tabs share, as FilterBar groups.

export function categoryGroup(
  category: Category | undefined,
  set: (c: Category | undefined) => void,
): FilterGroup {
  return {
    key: 'category',
    title: 'Category',
    options: CATEGORIES.map((c) => ({ value: c, label: c })),
    selected: category ? [category] : [],
    onChange: (sel) => set(sel[0] as Category | undefined),
  };
}

export function timeGroup(
  maxMinutes: number | undefined,
  set: (m: number | undefined) => void,
): FilterGroup {
  return {
    key: 'time',
    title: 'Cooking time',
    options: TIME_FILTERS.map((t) => ({ value: String(t.maxMinutes), label: t.label })),
    selected: maxMinutes === undefined ? [] : [String(maxMinutes)],
    onChange: (sel) => set(sel[0] === undefined ? undefined : Number(sel[0])),
  };
}

export function dietGroup(diets: DietId[], set: (d: DietId[]) => void): FilterGroup {
  return {
    key: 'diet',
    title: 'Diet',
    multi: true,
    options: DIETS.map((d) => ({ value: d.id, label: d.label })),
    selected: diets,
    onChange: (sel) => set(sel as DietId[]),
  };
}
