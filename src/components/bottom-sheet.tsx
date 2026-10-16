import { useCallback, useMemo, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing, useTheme } from '@/constants/theme';

/** Slides the sheet down, then runs `after` (e.g. opening another screen). */
export type CloseSheet = (after?: () => void) => void;

// The web has no native animation driver.
const NATIVE = Platform.OS !== 'web';

/**
 * A panel that slides up from the bottom. It slides back down when the dark area or the bar
 * at the top is tapped, when that bar is dragged down, or when the content calls `close`.
 */
export function BottomSheet({
  visible,
  title,
  closeLabel = 'Close',
  onClose,
  children,
}: {
  visible: boolean;
  title?: string;
  closeLabel?: string;
  onClose: () => void;
  children: (close: CloseSheet) => React.ReactNode;
}) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  // 0 = off screen, 1 = open. `drag` follows a finger pulling the sheet down.
  const [progress] = useState(() => new Animated.Value(0));
  const [drag] = useState(() => new Animated.Value(0));

  const slideOut = useCallback<CloseSheet>(
    (after) =>
      Animated.timing(progress, {
        toValue: 0,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: NATIVE,
      }).start(() => {
        drag.setValue(0);
        onClose();
        after?.();
      }),
    [progress, drag, onClose],
  );

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4,
        onPanResponderMove: (_, g) => drag.setValue(Math.max(0, g.dy)),
        onPanResponderRelease: (_, g) => {
          // A tap, a long enough pull or a quick flick down closes it; anything else springs back.
          if (Math.abs(g.dy) < 4 || g.dy > 80 || g.vy > 0.5) slideOut();
          else Animated.spring(drag, { toValue: 0, useNativeDriver: NATIVE }).start();
        },
        onPanResponderTerminate: () =>
          Animated.spring(drag, { toValue: 0, useNativeDriver: NATIVE }).start(),
      }),
    [drag, slideOut],
  );

  const slideIn = () =>
    Animated.timing(progress, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: NATIVE,
    }).start();

  const translateY = Animated.add(
    progress.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }),
    drag,
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onShow={slideIn}
      onRequestClose={() => slideOut()}>
      <View style={styles.backdropWrap}>
        <Animated.View style={[styles.backdrop, { opacity: progress }]}>
          <Pressable style={styles.fill} onPress={() => slideOut()} accessibilityLabel="Dismiss" />
        </Animated.View>
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: c.card,
              paddingBottom: Spacing.four + insets.bottom,
              transform: [{ translateY }],
            },
          ]}>
          <View
            {...pan.panHandlers}
            accessible
            accessibilityRole="button"
            accessibilityLabel={closeLabel}
            accessibilityActions={[{ name: 'activate' }]}
            onAccessibilityAction={() => slideOut()}
            style={styles.grabArea}>
            <View style={[styles.grab, { backgroundColor: c.border }]} />
          </View>
          {title ? <Text style={[styles.title, { color: c.text }]}>{title}</Text> : null}
          {children(slideOut)}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdropWrap: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.4)' },
  fill: { flex: 1 },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: Spacing.five,
    width: '100%',
    maxWidth: 560,
    maxHeight: '85%',
    alignSelf: 'center',
  },
  // Tall enough to grab easily with a thumb.
  grabArea: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
    marginTop: -Spacing.one,
  },
  grab: { width: 40, height: 5, borderRadius: 3 },
  title: { fontSize: 19, fontWeight: '700', marginBottom: Spacing.one },
});
