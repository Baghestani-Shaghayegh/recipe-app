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

import { Spacing, useTheme } from '@/constants/theme';

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  const c = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
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
          borderColor: variant === 'primary' ? c.accent : variant === 'danger' ? c.danger : c.border,
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
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: c.text }]}>{label}</Text>
      {hint ? <Text style={[styles.hint, { color: c.textSecondary }]}>{hint}</Text> : null}
      <TextInput
        placeholderTextColor={c.textSecondary}
        style={[
          styles.input,
          { color: c.text, backgroundColor: c.card, borderColor: c.border },
          props.multiline && styles.multiline,
          style,
        ]}
        {...props}
      />
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
  sectionTitle: { fontSize: 20, fontWeight: '700', marginBottom: Spacing.two },
});
