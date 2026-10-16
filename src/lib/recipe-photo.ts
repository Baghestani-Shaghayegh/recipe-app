import { requireOptionalNativeModule } from 'expo';
import { File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import type { ReadImages } from './file-import';
import { cleanOcrText } from './ocr';

type TextExtractor = {
  isSupported: boolean;
  extractTextFromImage: (path: string) => Promise<string[]>;
};

// Text recognition runs on the phone (Apple's Vision on iPhone, Google's ML Kit on Android).
// It's a native module, so it's missing in Expo Go and on the web: then this is null and the
// app says so instead of crashing. The installed app (development or store build) has it.
const extractor = requireOptionalNativeModule<TextExtractor>('ExpoTextExtractor');

export const canReadPhotos = Platform.OS !== 'web' && !!extractor?.isSupported;

export class PhotoProblem extends Error {}

/**
 * Takes or picks a photo of a recipe and returns its text, cleaned up. Undefined if cancelled.
 * `onReading` runs once a photo is chosen, while its text is being read.
 */
export async function readRecipePhoto(
  source: 'camera' | 'library',
  onReading?: () => void,
): Promise<string | undefined> {
  if (!extractor || !canReadPhotos) {
    throw new PhotoProblem('Reading recipe photos works in the installed app, not here.');
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new PhotoProblem('Allow camera access in Settings to take a photo.');
  }
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets[0]) return undefined;
  onReading?.();

  const blocks = await extractor.extractTextFromImage(result.assets[0].uri.replace('file://', ''));
  const text = cleanOcrText(blocks);
  if (!text) {
    throw new PhotoProblem(
      'Couldn’t find any text in that photo. Try again with the page flat and well lit.',
    );
  }
  return text;
}

/**
 * Reads the text in the page pictures of a scanned PDF, page by page, with the same text
 * recognition as photos. Undefined where that isn't available (Expo Go and the web).
 */
export const readImagesText: ReadImages | undefined =
  extractor && canReadPhotos
    ? async (images) => {
        const lines: string[] = [];
        for (const [i, image] of images.entries()) {
          const file = new File(
            Paths.cache,
            `scan-page-${Date.now()}-${i}.${image.type === 'jpeg' ? 'jpg' : 'png'}`,
          );
          try {
            file.write(image.data);
            lines.push(
              ...(await extractor.extractTextFromImage(file.uri.replace('file://', ''))),
              '',
            );
          } finally {
            if (file.exists) file.delete();
          }
        }
        return lines;
      }
    : undefined;
