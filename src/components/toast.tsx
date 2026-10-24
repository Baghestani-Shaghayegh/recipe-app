import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing, useTheme } from '@/constants/theme';

const SHOW_MS = 2500;
const NATIVE = Platform.OS !== 'web';

/**
 * A short message that pops up at the bottom of the screen and goes away by itself, e.g.
 * "Planned for dinner Wednesday." `onHide` clears it; a new message starts the timer again.
 */
export function Toast({ message, onHide }: { message?: string; onHide: () => void }) {
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
    const timer = setTimeout(() => {
      Animated.timing(shown, { toValue: 0, duration: 220, useNativeDriver: NATIVE }).start(
        ({ finished }) => finished && hide.current(),
      );
    }, SHOW_MS);
    return () => {
      show.stop();
      clearTimeout(timer);
    };
  }, [message, shown]);

  if (!message) return null;
  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      style={[
        styles.toast,
        {
          backgroundColor: c.text,
          bottom: insets.bottom + Spacing.four,
          opacity: shown,
          transform: [
            { translateY: shown.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
          ],
        },
      ]}>
      <Text style={[styles.text, { color: c.background }]}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    pointerEvents: 'none',
    alignSelf: 'center',
    maxWidth: 480,
    marginHorizontal: Spacing.four,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: Spacing.four,
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
  },
  text: { fontSize: 15, fontWeight: '600', textAlign: 'center' },
});
