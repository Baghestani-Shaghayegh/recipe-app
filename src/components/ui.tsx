import Ionicons from '@expo/vector-icons/Ionicons';
import { useContext, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { SheetKeyboard } from '@/components/bottom-sheet';
import { Spacing, useTheme } from '@/constants/theme';

export function Chip({
  label,
  selected,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const c = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: selected ? c.accent : c.chip, opacity: pressed ? 0.7 : 1 },
      ]}>
      <Text style={[styles.chipText, { color: selected ? c.accentText : c.text }]}>{label}</Text>
    </Pressable>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}) {
  const c = useTheme();
  const bg = variant === 'primary' ? c.accent : 'transparent';
  const fg = variant === 'primary' ? c.accentText : variant === 'danger' ? c.danger : c.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: bg,
          borderColor:
            variant === 'primary' ? c.accent : variant === 'danger' ? c.danger : c.border,
          opacity: disabled ? 0.5 : pressed ? 0.7 : 1,
        },
      ]}>
      <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Field({
  label,
  hint,
  style,
  ...props
}: TextInputProps & { label: string; hint?: string }) {
  const c = useTheme();
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);
  const [focused, setFocused] = useState(false);
  // Leaving the box hides the ✕ a moment later, so a tap on the ✕ itself (which can take the
  // focus first) still lands on it.
  const blurTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(blurTimer.current), []);
  // While typing in a one-line box with something in it: a ✕ that empties it.
  const clearable =
    focused &&
    !props.multiline &&
    props.editable !== false &&
    !!props.value &&
    !!props.onChangeText;
  // A number box in a sheet on iPhone gets a Done bar on the keyboard (see SheetKeyboard).
  const sheet = useContext(SheetKeyboard);
  const numeric = /number-pad|decimal-pad|numeric|phone-pad/.test(props.keyboardType ?? '');
  const wantDone = Platform.OS === 'ios' && numeric && focused;
  useEffect(() => {
    if (!sheet || !wantDone) return;
    sheet.wantDone(true);
    return () => sheet.wantDone(false);
  }, [sheet, wantDone]);
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: c.text }]}>{label}</Text>
      {hint ? <Text style={[styles.hint, { color: c.textSecondary }]}>{hint}</Text> : null}
      <View>
        <TextInput
          ref={input}
          placeholderTextColor={c.textSecondary}
          style={[
            styles.input,
            { color: c.text, backgroundColor: c.card, borderColor: c.border },
            props.multiline && styles.multiline,
            clearable && styles.inputWithClear,
            style,
          ]}
          {...props}
          onFocus={(e) => {
            clearTimeout(blurTimer.current);
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            blurTimer.current = setTimeout(() => setFocused(false), 250);
            props.onBlur?.(e);
          }}
        />
        {clearable ? (
          <Pressable
            // On touch down, before anything can take the focus (and the keyboard) away; the
            // cursor goes back into the box, so you can type the new value straight away.
            onPressIn={() => {
              props.onChangeText!('');
              input.current?.focus();
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Clear ${label}`}
            style={styles.clear}>
            <Ionicons name="close-circle" size={20} color={c.textSecondary} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/** Two or three side-by-side choices, like a switch between views. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const c = useTheme();
  return (
    <View style={[styles.segment, { backgroundColor: c.chip }]} accessibilityRole="tablist">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={[styles.segmentItem, selected && { backgroundColor: c.card }]}>
            <Text
              numberOfLines={1}
              style={[styles.segmentText, { color: selected ? c.text : c.textSecondary }]}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  const c = useTheme();
  return <Text style={[styles.sectionTitle, { color: c.text }]}>{children}</Text>;
}

/** Yes/no question. Alert with buttons doesn't work on web, so web uses window.confirm. */
export function confirm(title: string, message: string, confirmLabel: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ]),
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', borderRadius: 12, padding: 3 },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10 },
  segmentText: { fontSize: 15, fontWeight: '600' },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
  },
  chipText: { fontSize: 14, fontWeight: '500' },
  button: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  buttonText: { fontSize: 16, fontWeight: '600' },
  field: { gap: Spacing.one },
  label: { fontSize: 15, fontWeight: '600' },
  hint: { fontSize: 13 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    fontSize: 16,
  },
  multiline: { minHeight: 110, textAlignVertical: 'top' },
  inputWithClear: { paddingRight: 40 },
  clear: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { fontSize: 20, fontWeight: '700', marginBottom: Spacing.two },
});
