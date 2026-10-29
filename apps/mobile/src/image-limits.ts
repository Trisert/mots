import { MAX_IMAGE_BASE64_CHARACTERS } from "@mots/protocol";

/**
 * How a picture is shrunk before it is sent: the longest edge in pixels and the JPEG quality. The
 * phone tries the first step and falls back to the next one only when the result is still over the
 * server's limit. Pure, so it can be tested without the native image modules.
 */
export const IMAGE_ENCODINGS = [
  { edge: 1024, compress: 0.7 },
  { edge: 768, compress: 0.55 },
] as const;

/** Resize to fit the longest edge in `edge` pixels, keeping the aspect ratio. Never enlarges. */
export function resizeTarget(
  width: number,
  height: number,
  edge: number,
): { readonly width: number } | { readonly height: number } | undefined {
  if (!(width > 0) || !(height > 0)) return undefined;
  if (Math.max(width, height) <= edge) return undefined;
  return width >= height ? { width: edge } : { height: edge };
}

/** Whether a base64 picture fits what the server accepts in one image. */
export function fitsImageLimit(base64: string): boolean {
  return base64.length > 0 && base64.length <= MAX_IMAGE_BASE64_CHARACTERS;
}
