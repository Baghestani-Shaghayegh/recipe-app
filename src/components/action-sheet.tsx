import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Spacing, useTheme } from '@/constants/theme';

export type SheetAction = { label: string; danger?: boolean; onPress: () => void };

/** A menu that slides over the screen (the ⋯ menu). Works the same on phones and the web. */
export function ActionSheet({
  visible,
  title,
  actions,
  onClose,
}: {
  visible: boolean;
  title?: string;
  actions: SheetAction[];
  onClose: () => void;
}) {
  const c = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close menu">
        <View style={[styles.menu, { backgroundColor: c.card }]}>
          {title ? <Text style={[styles.title, { color: c.textSecondary }]}>{title}</Text> : null}
          {actions.map((a) => (
            <Pressable
              key={a.label}
              onPress={a.onPress}
              accessibilityRole="button"
              style={[styles.item, { borderTopColor: c.border }]}>
              <Text style={[styles.text, { color: a.danger ? c.danger : c.text }]}>{a.label}</Text>
            </Pressable>
          ))}
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            style={[styles.item, { borderTopColor: c.border }]}>
            <Text style={[styles.text, styles.bold, { color: c.text }]}>Cancel</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  menu: {
    marginBottom: Spacing.four,
    borderRadius: 14,
    overflow: 'hidden',
    width: '92%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  title: { fontSize: 14, textAlign: 'center', paddingVertical: Spacing.three },
  item: { paddingVertical: 14, alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth },
  text: { fontSize: 17 },
  bold: { fontWeight: '700' },
});
