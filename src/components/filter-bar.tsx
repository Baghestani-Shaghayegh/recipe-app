import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { Chip } from '@/components/ui';
import { Spacing, useTheme } from '@/constants/theme';

export type FilterOption = { value: string; label: string };

/** A filter with choices, e.g. Category. `multi` lets more than one be picked. */
export type FilterGroup = {
  key: string;
  title: string;
  options: FilterOption[];
  selected: string[];
  multi?: boolean;
  onChange: (selected: string[]) => void;
};

/** An on/off filter, e.g. "Pantry match". `section` is its heading on the all-filters sheet. */
export type FilterToggle = {
  key: string;
  label: string;
  section: string;
  on: boolean;
  onChange: (on: boolean) => void;
};

/**
 * One sideways-scrolling row: the filter icon (opens every filter on one sheet), then a pill
 * per filter (opens a sheet with just its choices). Choices apply as soon as they're tapped.
 */
export function FilterBar({
  groups,
  toggles = [],
  resultCount,
}: {
  groups: FilterGroup[];
  toggles?: FilterToggle[];
  /** How many recipes match, for the sheet's "Show N recipes" button. */
  resultCount: number;
}) {
  const c = useTheme();
  // 'all' for the filter icon's sheet, or the key of one group.
  const [open, setOpen] = useState<string>();
  const active =
    groups.filter((g) => g.selected.length).length + toggles.filter((t) => t.on).length;
  const openGroup = groups.find((g) => g.key === open);
  // Stable, so the sheet's drag handling isn't rebuilt on every render.
  const close = useCallback(() => setOpen(undefined), []);

  return (
    <>
      {/* The icon stays put; only the filters next to it scroll sideways. */}
      <View style={styles.bar}>
        {/* Padding above and to the right of the icon so the count badge is never cut off. */}
        <Pressable
          onPress={() => setOpen('all')}
          accessibilityRole="button"
          accessibilityLabel={active ? `All filters, ${active} on` : 'All filters'}
          style={({ pressed }) => [styles.iconWrap, { opacity: pressed ? 0.7 : 1 }]}>
          <View style={[styles.iconButton, { backgroundColor: active ? c.text : c.chip }]}>
            <Ionicons name="options-outline" size={20} color={active ? c.background : c.text} />
          </View>
          {active ? (
            <View style={[styles.badge, { backgroundColor: c.accent, borderColor: c.background }]}>
              <Text style={[styles.badgeText, { color: c.accentText }]}>{active}</Text>
            </View>
          ) : null}
        </Pressable>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.scroller}
          contentContainerStyle={styles.row}>
          {groups.map((g) => (
            <GroupPill key={g.key} group={g} onOpen={() => setOpen(g.key)} />
          ))}
          {toggles.map((t) => (
            <Pill
              key={t.key}
              label={t.label}
              selected={t.on}
              onPress={() => t.onChange(!t.on)}
              onClear={t.on ? () => t.onChange(false) : undefined}
            />
          ))}
        </ScrollView>
      </View>

      <Sheet
        visible={!!open}
        title={openGroup ? openGroup.title : 'Filters'}
        resultCount={resultCount}
        clearLabel={openGroup ? 'Clear' : 'Clear all'}
        onClear={() => {
          for (const g of openGroup ? [openGroup] : groups) g.onChange([]);
          if (!openGroup) for (const t of toggles) t.onChange(false);
        }}
        onClose={close}>
        {openGroup ? (
          <OptionList group={openGroup} />
        ) : (
          <>
            {groups.map((g) => (
              <View key={g.key} style={styles.section}>
                <Text style={[styles.sectionTitle, { color: c.textSecondary }]}>{g.title}</Text>
                <View style={styles.wrap}>
                  {g.options.map((o) => (
                    <Chip
                      key={o.value}
                      label={o.label}
                      selected={g.selected.includes(o.value)}
                      onPress={() => g.onChange(pick(g, o.value))}
                    />
                  ))}
                </View>
              </View>
            ))}
            {toggles.map((t) => (
              <View key={t.key} style={styles.section}>
                <Text style={[styles.sectionTitle, { color: c.textSecondary }]}>{t.section}</Text>
                <View style={styles.wrap}>
                  <Chip label={t.label} selected={t.on} onPress={() => t.onChange(!t.on)} />
                </View>
              </View>
            ))}
          </>
        )}
      </Sheet>
    </>
  );
}

/** The new selection after tapping `value`: tapping a picked choice un-picks it. */
function pick(group: FilterGroup, value: string): string[] {
  if (group.selected.includes(value)) return group.selected.filter((v) => v !== value);
  return group.multi ? [...group.selected, value] : [value];
}

function GroupPill({ group, onOpen }: { group: FilterGroup; onOpen: () => void }) {
  const n = group.selected.length;
  const label =
    n === 0
      ? group.title
      : n === 1
        ? (group.options.find((o) => o.value === group.selected[0])?.label ?? group.title)
        : `${group.title} · ${n}`;
  return (
    <Pill
      label={label}
      selected={n > 0}
      caret={n === 0}
      onPress={onOpen}
      onClear={n ? () => group.onChange([]) : undefined}
      accessibilityLabel={n ? `${group.title}: ${label}` : group.title}
    />
  );
}

function Pill({
  label,
  selected,
  caret,
  onPress,
  onClear,
  accessibilityLabel,
}: {
  label: string;
  selected: boolean;
  caret?: boolean;
  onPress: () => void;
  onClear?: () => void;
  accessibilityLabel?: string;
}) {
  const c = useTheme();
  const color = selected ? c.accentText : c.text;
  return (
    <View style={[styles.pill, { backgroundColor: selected ? c.accent : c.chip }]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ selected }}
        style={({ pressed }) => [
          styles.pillMain,
          onClear ? styles.pillMainWithClear : null,
          { opacity: pressed ? 0.7 : 1 },
        ]}>
        <Text style={[styles.pillText, { color }]} numberOfLines={1}>
          {label}
        </Text>
        {caret ? <Ionicons name="chevron-down" size={14} color={color} /> : null}
      </Pressable>
      {onClear ? (
        <Pressable
          onPress={onClear}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${label}`}
          style={({ pressed }) => [styles.pillClear, { opacity: pressed ? 0.6 : 1 }]}>
          <Ionicons name="close" size={15} color={color} />
        </Pressable>
      ) : null}
    </View>
  );
}

function OptionList({ group }: { group: FilterGroup }) {
  const c = useTheme();
  return (
    <View>
      {group.options.map((o) => {
        const on = group.selected.includes(o.value);
        return (
          <Pressable
            key={o.value}
            onPress={() => group.onChange(pick(group, o.value))}
            accessibilityRole={group.multi ? 'checkbox' : 'radio'}
            accessibilityState={{ checked: on }}
            style={({ pressed }) => [
              styles.option,
              { borderBottomColor: c.border, opacity: pressed ? 0.6 : 1 },
            ]}>
            <Text style={[styles.optionText, { color: c.text }, on && styles.optionOn]}>
              {o.label}
            </Text>
            <View
              style={[
                styles.check,
                on
                  ? { backgroundColor: c.accent, borderColor: c.accent }
                  : { borderColor: c.border },
              ]}>
              {on ? <Ionicons name="checkmark" size={14} color={c.accentText} /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function Sheet({
  visible,
  title,
  resultCount,
  clearLabel,
  onClear,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  resultCount: number;
  clearLabel: string;
  onClear: () => void;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const c = useTheme();
  return (
    <BottomSheet visible={visible} title={title} closeLabel="Close filters" onClose={onClose}>
      {(close) => (
        <>
          <ScrollView style={styles.sheetBody} contentContainerStyle={styles.sheetContent}>
            {children}
          </ScrollView>
          <View style={styles.buttons}>
            <Pressable
              onPress={onClear}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: c.chip, opacity: pressed ? 0.7 : 1 },
              ]}>
              <Text style={[styles.buttonText, { color: c.text }]}>{clearLabel}</Text>
            </Pressable>
            <Pressable
              onPress={() => close()}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: c.accent, opacity: pressed ? 0.8 : 1 },
              ]}>
              <Text style={[styles.buttonText, { color: c.accentText }]} numberOfLines={1}>
                {resultCount === 0
                  ? 'No matches'
                  : `Show ${resultCount} recipe${resultCount === 1 ? '' : 's'}`}
              </Text>
            </Pressable>
          </View>
        </>
      )}
    </BottomSheet>
  );
}

const PILL_HEIGHT = 38;
// How far the count badge sticks out past the icon.
const BADGE_ROOM = 6;

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two },
  iconWrap: { paddingTop: BADGE_ROOM, paddingRight: BADGE_ROOM, marginRight: -BADGE_ROOM },
  // The filters run to the right edge of the screen so they scroll under it.
  scroller: { flex: 1, marginRight: -Spacing.four },
  row: { gap: Spacing.two, paddingRight: Spacing.four, alignItems: 'center' },
  iconButton: {
    width: PILL_HEIGHT,
    height: PILL_HEIGHT,
    borderRadius: PILL_HEIGHT / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
  pill: {
    height: PILL_HEIGHT,
    borderRadius: PILL_HEIGHT / 2,
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: 220,
  },
  pillMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: '100%',
    paddingHorizontal: 14,
    flexShrink: 1,
  },
  pillMainWithClear: { paddingRight: 4 },
  pillClear: { height: '100%', justifyContent: 'center', paddingLeft: 2, paddingRight: 12 },
  pillText: { fontSize: 15, fontWeight: '500', flexShrink: 1 },
  sheetBody: { flexGrow: 0 },
  sheetContent: { gap: Spacing.four, paddingVertical: Spacing.two },
  section: { gap: Spacing.two },
  sectionTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionText: { fontSize: 16 },
  optionOn: { fontWeight: '600' },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttons: { flexDirection: 'row', gap: Spacing.three, marginTop: Spacing.four },
  button: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 12 },
  buttonText: { fontSize: 16, fontWeight: '600' },
});
