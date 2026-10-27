import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Keyboard,
  LayoutAnimation,
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
  overlay,
  children,
}: {
  visible: boolean;
  title?: string;
  closeLabel?: string;
  onClose: () => void;
  /** Laid over the whole sheet, e.g. a small pop-up card. */
  overlay?: React.ReactNode;
  children: (close: CloseSheet) => React.ReactNode;
}) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  // 0 = off screen, 1 = open. `drag` follows a finger pulling the sheet down.
  const [progress] = useState(() => new Animated.Value(0));
  const [drag] = useState(() => new Animated.Value(0));
  // How far the keyboard covers the sheet: it moves up by that much, so the box you type in
  // and the buttons under it stay in sight. Measured, so it's 0 where the system already
  // makes room.
  const wrap = useRef<React.ComponentRef<typeof View>>(null);
  const [lift, setLift] = useState(0);

  useEffect(() => {
    if (!visible) return;
    const ios = Platform.OS === 'ios';
    const glide = (duration?: number) => {
      if (ios)
        LayoutAnimation.configureNext({ duration: duration || 250, update: { type: 'keyboard' } });
    };
    const shown = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
      wrap.current?.measureInWindow((_x, y, _w, h) => {
        glide(e.duration);
        setLift(Math.max(0, y + h - e.endCoordinates.screenY));
      });
    });
    const hidden = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', (e) => {
      glide(e.duration);
      setLift(0);
    });
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, [visible]);

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
      <View ref={wrap} style={[styles.backdropWrap, { paddingBottom: lift }]}>
        <Animated.View style={[styles.backdrop, { opacity: progress }]}>
          <Pressable style={styles.fill} onPress={() => slideOut()} accessibilityLabel="Dismiss" />
        </Animated.View>
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: c.card,
              // Above the keyboard there's no home indicator to keep clear of.
              paddingBottom: Spacing.four + (lift ? 0 : insets.bottom),
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
          {overlay}
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
