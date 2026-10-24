import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing, useTheme } from '@/constants/theme';

const SHOW_MS = 2500;
// Longer when there's a button to reach for.
const SHOW_WITH_ACTION_MS = 4000;
const NATIVE = Platform.OS !== 'web';

export type ToastMessage =
  | string
  | {
      title: string;
      /** A second, smaller line, e.g. "Lunch · Today". */
      detail?: string;
      /** A green tick: something was done (planned, copied). */
      done?: boolean;
      action?: { label: string; onPress: () => void };
    };

/**
 * A short message that pops up at the bottom of the screen and goes away by itself, e.g.
 * "Added to your plan". `onHide` clears it; a new message starts the timer again.
 */
export function Toast({ message, onHide }: { message?: ToastMessage; onHide: () => void }) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const [shown] = useState(() => new Animated.Value(0));
  // Kept in a ref, so a new onHide on every render doesn't restart the timer.
  const hide = useRef(onHide);
  useEffect(() => {
    hide.current = onHide;
  });

  useEffect(() => {
    if (!message) return;
    shown.setValue(0);
    const show = Animated.timing(shown, { toValue: 1, duration: 180, useNativeDriver: NATIVE });
    show.start();
    const hasAction = typeof message !== 'string' && !!message.action;
    const timer = setTimeout(
      () => {
        Animated.timing(shown, { toValue: 0, duration: 220, useNativeDriver: NATIVE }).start(
          ({ finished }) => finished && hide.current(),
        );
      },
      hasAction ? SHOW_WITH_ACTION_MS : SHOW_MS,
    );
    return () => {
      show.stop();
      clearTimeout(timer);
    };
  }, [message, shown]);

  if (!message) return null;
  const m = typeof message === 'string' ? { title: message } : message;
  const action = 'action' in m ? m.action : undefined;
  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      style={[
        styles.toast,
        {
          backgroundColor: c.toast,
          bottom: insets.bottom + Spacing.four,
          opacity: shown,
          transform: [
            { translateY: shown.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
          ],
        },
      ]}>
      {'done' in m && m.done ? (
        <View style={[styles.tick, { backgroundColor: c.success }]}>
          <Ionicons name="checkmark" size={18} color="#fff" />
        </View>
      ) : null}
      <View style={styles.text}>
        <Text style={styles.title}>{m.title}</Text>
        {'detail' in m && m.detail ? <Text style={styles.detail}>{m.detail}</Text> : null}
      </View>
      {action ? (
        <Pressable
          onPress={() => {
            action.onPress();
            hide.current();
          }}
          hitSlop={10}
          accessibilityRole="button"
          style={({ pressed }) => [styles.action, { opacity: pressed ? 0.6 : 1 }]}>
          <Text style={styles.actionText}>{action.label}</Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: Spacing.four,
    right: Spacing.four,
    maxWidth: 480,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.28)',
  },
  tick: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0 },
  title: { color: '#fff', fontSize: 15, fontWeight: '700', lineHeight: 20 },
  detail: { color: '#CFC6BE', fontSize: 13, lineHeight: 18, marginTop: 1 },
  action: { paddingVertical: 4, paddingLeft: Spacing.two },
  actionText: { color: '#FDBA74', fontSize: 15, fontWeight: '700' },
});
