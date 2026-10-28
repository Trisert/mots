/** The text the person typed, without the `[name]` line the server puts before an attributed prompt. */
export function messageBody(raw: string): string {
  return raw.replace(/^\[[^\]\n]{1,40}\]\n/, "");
}

/**
 * The entry a branch starts from when a sent message is edited: the entry just before it. Undefined
 * when the message is the first one, so the branch starts empty, or when the entry is not listed.
 */
export function branchEntryId(
  entries: readonly { readonly id: number }[],
  entryId: number,
): number | undefined {
  const index = entries.findIndex((entry) => entry.id === entryId);
  if (index <= 0) return undefined;
  return entries[index - 1]?.id;
}
