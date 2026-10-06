import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

/**
 * Lets the user pick a photo and returns a URI that stays valid after the app restarts.
 * Returns undefined if they cancel.
 *
 * - Phone: the picked file lives in a temporary cache, so it's copied into the app's documents folder.
 * - Web: there's no file system, so the photo is kept as a data URI inside the recipe.
 */
export async function pickRecipePhoto(): Promise<string | undefined> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.6,
    base64: Platform.OS === 'web',
  });
  if (result.canceled || !result.assets[0]) return undefined;
  const asset = result.assets[0];

  if (Platform.OS === 'web') {
    if (asset.uri.startsWith('data:') || !asset.base64) return asset.uri;
    return `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`;
  }

  const dir = new Directory(Paths.document, 'photos');
  if (!dir.exists) dir.create({ intermediates: true });
  const ext = asset.uri.split('.').pop()?.split('?')[0] || 'jpg';
  const dest = new File(dir, `${Date.now()}.${ext}`);
  await new File(asset.uri).copy(dest);
  return dest.uri;
}

/** Removes a photo saved by pickRecipePhoto. Safe to call with any URI. */
export function deleteRecipePhoto(uri: string | undefined) {
  if (!uri || Platform.OS === 'web' || !uri.startsWith(Paths.document.uri)) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch (e) {
    console.warn('Could not delete photo', e);
  }
}
