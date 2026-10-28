import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { MAX_PROMPT_IMAGES, type PromptImage } from "@mots/protocol";
import { fitsImageLimit, IMAGE_ENCODINGS, resizeTarget } from "./image-limits";

/** A picture chosen for the composer: the local file to preview, and the JPEG the server receives. */
export type AttachedImage = PromptImage & { readonly uri: string };

export type PickedImages = {
  readonly images: readonly AttachedImage[];
  /** Pictures that stayed over the limit even at the smallest size. */
  readonly tooLarge: number;
};

/** Opens the system photo picker for at most `limit` pictures. Resolves to nothing when cancelled. */
export async function pickImages(limit: number): Promise<ImagePicker.ImagePickerAsset[] | undefined> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: true,
    selectionLimit: Math.max(1, Math.min(limit, MAX_PROMPT_IMAGES)),
    // The shrinking below does the compression, so the picker hands over the original.
    quality: 1,
  });
  return result.canceled ? undefined : result.assets;
}

/** Shrinks one picture to JPEG and returns it as base64, or `undefined` when it stays too large. */
export async function prepareImage(
  asset: ImagePicker.ImagePickerAsset,
): Promise<AttachedImage | undefined> {
  for (const encoding of IMAGE_ENCODINGS) {
    const target = resizeTarget(asset.width, asset.height, encoding.edge);
    const actions = target === undefined ? [] : [{ resize: target }];
    const result = await ImageManipulator.manipulateAsync(asset.uri, actions, {
      compress: encoding.compress,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    });
    if (result.base64 !== undefined && fitsImageLimit(result.base64)) {
      return { mimeType: "image/jpeg", data: result.base64, uri: result.uri };
    }
  }
  return undefined;
}

/** Picks and prepares up to `limit` pictures, keeping the ones that fit. */
export async function attachImages(limit: number): Promise<PickedImages | undefined> {
  const assets = await pickImages(limit);
  if (assets === undefined) return undefined;
  const prepared = await Promise.all(assets.map(prepareImage));
  const images = prepared.filter((image): image is AttachedImage => image !== undefined);
  return { images, tooLarge: prepared.length - images.length };
}
