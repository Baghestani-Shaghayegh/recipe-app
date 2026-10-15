import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { getThumbnailAsync } from 'expo-video-thumbnails';
import { Platform } from 'react-native';

import { fileExtension, MAX_VIDEO_BYTES, MAX_VIDEO_SECONDS, videoMimeType } from './feed';

export type PickedVideo = {
  uri: string;
  ext: string;
  mimeType: string;
  /** Seconds, when the picker reports it. */
  durationSec?: number;
  sizeBytes?: number;
  /** A still from the video to show before it plays (phone only). */
  posterUri?: string;
};

export class VideoProblem extends Error {}

/** Records a new video with the camera, or picks one from the library. Undefined if cancelled. */
export async function chooseVideo(source: 'camera' | 'library'): Promise<PickedVideo | undefined> {
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['videos'],
    videoMaxDuration: MAX_VIDEO_SECONDS,
    // Lets people trim on iPhone; keeps files a sensible size.
    allowsEditing: true,
    videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
  };
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new VideoProblem('Allow camera access in Settings to record a video.');
  }
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets[0]) return undefined;

  const asset = result.assets[0];
  const durationSec = asset.duration ? asset.duration / 1000 : undefined;
  // A little slack: phones round trimmed clips up.
  if (durationSec !== undefined && durationSec > MAX_VIDEO_SECONDS + 1) {
    throw new VideoProblem(
      `Videos can be up to ${MAX_VIDEO_SECONDS} seconds. Trim it and try again.`,
    );
  }
  if (asset.fileSize && asset.fileSize > MAX_VIDEO_BYTES) {
    throw new VideoProblem('That video file is too big (over 60 MB). Try a shorter clip.');
  }

  const ext = fileExtension(asset.uri, asset.mimeType);
  let posterUri: string | undefined;
  if (Platform.OS !== 'web') {
    try {
      posterUri = (await getThumbnailAsync(asset.uri, { time: 500, quality: 0.7 })).uri;
    } catch {
      // No cover is fine: the feed shows the first frame once the video loads.
    }
  }
  return {
    uri: asset.uri,
    ext,
    mimeType: asset.mimeType?.startsWith('video/') ? asset.mimeType : videoMimeType(ext),
    durationSec,
    sizeBytes: asset.fileSize,
    posterUri,
  };
}

/** The file's contents, ready to upload. */
export async function readFileBytes(uri: string): Promise<Blob | ArrayBuffer> {
  if (Platform.OS === 'web') return (await fetch(uri)).blob();
  return new File(uri).arrayBuffer();
}
