import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { Spacing, useTheme } from '@/constants/theme';
import { canReadPhotos, PhotoProblem, readRecipePhoto } from '@/lib/recipe-photo';
import { recipeDraftFromText } from '@/lib/recipe-text';
import { setRecipeDraft } from '@/store/draft';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

// iOS can't open the camera or photo library until the menu has fully closed.
const afterSheet = (run: () => void) => setTimeout(run, Platform.OS === 'ios' ? 350 : 0);

/** The + button's menu: every way to add a recipe in one place. */
export function AddRecipeMenu({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [reading, setReading] = useState(false);

  const fromPhoto = async (source: 'camera' | 'library') => {
    try {
      // The overlay waits until a photo is chosen: iOS can't show it over the camera.
      const text = await readRecipePhoto(source, () => setReading(true));
      if (text) {
        const draft = recipeDraftFromText(text, { sourceUrl: undefined });
        router.push({ pathname: '/recipe/edit', params: { draft: setRecipeDraft(draft) } });
      }
    } catch (e) {
      Alert.alert(
        'Couldn’t read that photo',
        e instanceof PhotoProblem ? e.message : 'Please try again.',
      );
    } finally {
      setReading(false);
    }
  };

  const photoNote = canReadPhotos ? undefined : 'Works in the installed app';

  return (
    <>
      <BottomSheet visible={visible} title="Add a recipe" onClose={onClose}>
        {(close) => (
          <View style={styles.options}>
            <Option
              icon="link-outline"
              title="Paste a link"
              subtitle="Instagram, TikTok, YouTube or a recipe website"
              onPress={() => close(() => router.push('/recipe/import'))}
            />
            <Option
              icon="camera-outline"
              title="Take a photo"
              subtitle={photoNote ?? 'Of a cookbook page or a handwritten card'}
              disabled={!canReadPhotos}
              onPress={() => close(() => afterSheet(() => fromPhoto('camera')))}
            />
            <Option
              icon="images-outline"
              title="Choose from album"
              subtitle={photoNote ?? 'A photo or screenshot of a recipe'}
              disabled={!canReadPhotos}
              onPress={() => close(() => afterSheet(() => fromPhoto('library')))}
            />
            <Option
              icon="create-outline"
              title="Write it myself"
              subtitle="Type in your own recipe"
              onPress={() => close(() => router.push('/recipe/edit'))}
            />
          </View>
        )}
      </BottomSheet>
      <ReadingPhoto visible={reading} />
    </>
  );
}

function Option({
  icon,
  title,
  subtitle,
  disabled,
  onPress,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const c = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={subtitle}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.option,
        { opacity: disabled ? 0.45 : 1, backgroundColor: pressed ? c.chip : 'transparent' },
      ]}>
      <View style={[styles.optionIcon, { backgroundColor: c.chip }]}>
        <Ionicons name={icon} size={22} color={c.accent} />
      </View>
      <View style={styles.optionText}>
        <Text style={[styles.optionTitle, { color: c.text }]}>{title}</Text>
        <Text style={[styles.optionSubtitle, { color: c.textSecondary }]} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

/** Covers the screen while the photo's text is being read. */
function ReadingPhoto({ visible }: { visible: boolean }) {
  const c = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.readingBackdrop}>
        <View style={[styles.readingBox, { backgroundColor: c.card }]}>
          <ActivityIndicator color={c.accent} size="large" />
          <Text style={[styles.readingText, { color: c.text }]}>Reading the photo…</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  options: { gap: Spacing.one, paddingTop: Spacing.two },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    marginHorizontal: -Spacing.two,
    borderRadius: 12,
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: { flex: 1, gap: 2 },
  optionTitle: { fontSize: 16, fontWeight: '600' },
  optionSubtitle: { fontSize: 14 },
  readingBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  readingBox: {
    padding: Spacing.five,
    borderRadius: 16,
    alignItems: 'center',
    gap: Spacing.three,
  },
  readingText: { fontSize: 16, fontWeight: '600' },
});
