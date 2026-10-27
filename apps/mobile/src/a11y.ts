import { AccessibilityInfo, Platform } from "react-native";

/**
 * Speaks a short status to screen reader users on native. On web the caller changes a visible
 * label instead, which the browser exposes to assistive tech.
 */
export function announceNow(text: string): void {
  if (Platform.OS !== "web") AccessibilityInfo.announceForAccessibility(text);
}
