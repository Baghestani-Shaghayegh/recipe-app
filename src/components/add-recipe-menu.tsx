import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { File as FsFile } from 'expo-file-system';
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
import { FileProblem, MAX_FILE_BYTES, textFromFile } from '@/lib/file-import';
import { canReadPhotos, PhotoProblem, readRecipePhoto } from '@/lib/recipe-photo';
import { recipeDraftFromText } from '@/lib/recipe-text';
import { setRecipeDraft } from '@/store/draft';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

// iOS can't open the camera or photo library until the menu has fully closed.
const afterSheet = (run: () => void) => setTimeout(run, Platform.OS === 'ios' ? 350 : 0);

/** Shows a problem to the person. React Native's Alert does nothing on the web. */
function tell(title: string, message: string) {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}

function openDraft(text: string) {
  const draft = recipeDraftFromText(text, { sourceUrl: undefined });
  router.push({ pathname: '/recipe/edit', params: { draft: setRecipeDraft(draft) } });
}

/** The + button's menu: every way to add a recipe in one place. */
export function AddRecipeMenu({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const c = useTheme();
  const [busy, setBusy] = useState<string>();
  // The photo option opens up to offer the camera or the album.
  const [photoChoice, setPhotoChoice] = useState(false);

  const fromPhoto = async (source: 'camera' | 'library') => {
    try {
      // The overlay waits until a photo is chosen: iOS can't show it over the camera.
      const text = await readRecipePhoto(source, () => setBusy('Reading the photo…'));
      if (text) openDraft(text);
    } catch (e) {
      tell('Couldn’t read that photo', e instanceof PhotoProblem ? e.message : 'Please try again.');
    } finally {
      setBusy(undefined);
    }
  };

  const fromFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      const asset = result.assets?.[0];
      if (result.canceled || !asset) return;
      if (asset.size && asset.size > MAX_FILE_BYTES) {
        throw new FileProblem('That file is too big to import.');
      }
      setBusy('Reading the file…');
      const buffer = asset.file
        ? await asset.file.arrayBuffer() // web
        : await new FsFile(asset.uri).arrayBuffer();
      // Let the overlay show before the (synchronous) reading starts.
      await new Promise((r) => setTimeout(r, 30));
      openDraft(
        textFromFile({ name: asset.name, mimeType: asset.mimeType, bytes: new Uint8Array(buffer) }),
      );
    } catch (e) {
      tell(
        'Couldn’t import that file',
        e instanceof FileProblem ? e.message : 'Please try again with another file.',
      );
    } finally {
      setBusy(undefined);
    }
  };

  const close = () => {
    setPhotoChoice(false);
    onClose();
  };

  return (
    <>
      <BottomSheet visible={visible} title="Add a recipe" onClose={close}>
        {(slideClose) => (
          <View style={styles.options}>
            <Option
              icon="link-outline"
              title="Paste a link"
              subtitle="Instagram, TikTok, YouTube or a recipe website"
              onPress={() => slideClose(() => router.push('/recipe/import'))}
            />
            <Option
              icon="camera-outline"
              title="Photo of a recipe"
              subtitle={
                canReadPhotos
                  ? 'Take a photo or choose one from your album'
                  : 'Works in the installed app'
              }
              disabled={!canReadPhotos}
              expanded={photoChoice}
              onPress={() => setPhotoChoice((v) => !v)}
            />
            {photoChoice ? (
              <View style={styles.choices}>
                <Choice
                  icon="camera-outline"
                  label="Camera"
                  onPress={() => slideClose(() => afterSheet(() => fromPhoto('camera')))}
                />
                <Choice
                  icon="images-outline"
                  label="Album"
                  onPress={() => slideClose(() => afterSheet(() => fromPhoto('library')))}
                />
              </View>
            ) : null}
            <Option
              icon="document-text-outline"
              title="Import a file"
              subtitle="PDF, Word, or a page exported from Notion"
              onPress={() => slideClose(() => afterSheet(fromFile))}
            />
            <Option
              icon="create-outline"
              title="Write it yourself"
              subtitle="Type in your own recipe"
              onPress={() => slideClose(() => router.push('/recipe/edit'))}
            />
          </View>
        )}
      </BottomSheet>
      <Busy message={busy} color={c.accent} />
    </>
  );
}

function Choice({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.choice,
        { backgroundColor: c.chip, opacity: pressed ? 0.7 : 1 },
      ]}>
      <Ionicons name={icon} size={18} color={c.accent} />
      <Text style={[styles.choiceText, { color: c.text }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function Option({
  icon,
  title,
  subtitle,
  disabled,
  expanded,
  onPress,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  disabled?: boolean;
  /** Set for an option that opens up more choices under it. */
  expanded?: boolean;
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
      accessibilityState={{ disabled, expanded }}
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
      {expanded !== undefined ? (
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={c.textSecondary}
        />
      ) : null}
    </Pressable>
  );
}

/** Covers the screen while a photo or file is being read. */
function Busy({ message, color }: { message?: string; color: string }) {
  const c = useTheme();
  return (
    <Modal visible={!!message} transparent animationType="fade">
      <View style={styles.readingBackdrop}>
        <View style={[styles.readingBox, { backgroundColor: c.card }]}>
          <ActivityIndicator color={color} size="large" />
          <Text style={[styles.readingText, { color: c.text }]}>{message}</Text>
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
  choices: { flexDirection: 'row', gap: Spacing.two, paddingLeft: 44 + Spacing.three },
  choice: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: 12,
    paddingHorizontal: Spacing.two,
    borderRadius: 12,
  },
  choiceText: { fontSize: 15, fontWeight: '600', flexShrink: 1 },
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
