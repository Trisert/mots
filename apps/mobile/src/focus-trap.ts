// Pure helpers for keeping keyboard focus inside a web drawer. No DOM access here.

export const FOCUSABLE_SELECTOR =
  'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])';

type AttributeReader = {
  hasAttribute(name: string): boolean;
  getAttribute(name: string): string | null;
};

export function isEnabledElement(element: AttributeReader): boolean {
  return !element.hasAttribute("disabled") && element.getAttribute("aria-disabled") !== "true";
}

// Returns the index of the focusable element that Tab should move to, or undefined when the
// browser's default Tab order is already correct. -1 means there is nothing to focus.
export function tabTrapIndex(options: {
  readonly count: number;
  readonly index: number;
  readonly shift: boolean;
  readonly inside: boolean;
}): number | undefined {
  const { count, index, shift, inside } = options;
  if (count === 0) return -1;
  if (!inside) return shift ? count - 1 : 0;
  if (shift && index <= 0) return count - 1;
  if (!shift && index === count - 1) return 0;
  return undefined;
}
