import { StyleSheet, View } from "react-native";
import { colors } from "../theme";

/**
 * Icons drawn with plain views.
 *
 * The UI used to render its icons as text glyphs (`≡`, `＋`, `×`, `↑`). That ties the icons to
 * whatever glyphs the device font happens to ship: the fullwidth plus `＋` (U+FF0B) is missing
 * from most system fonts and rendered as an empty box. Drawing them keeps the same shape on every
 * platform, gives a consistent stroke weight, and lets the colour follow the state of the control
 * the way `currentColor` does on the web.
 */
type IconProps = {
  readonly size?: number;
  readonly color?: string;
  readonly strokeWidth?: number;
};

/** Three stacked bars: opens the chat list. */
export function MenuIcon({ size = 18, color = colors.text, strokeWidth = 2 }: IconProps) {
  const bar = size;
  const gap = (size - strokeWidth) / 2.6;
  return (
    <View style={{ width: bar, height: size, justifyContent: "space-between" }}>
      {[0, 1, 2].map((index) => (
        <View
          key={index}
          style={{
            width: bar,
            height: strokeWidth,
            borderRadius: strokeWidth,
            backgroundColor: color,
          }}
        />
      ))}
      <View style={{ height: 0, marginTop: -gap + gap }} />
    </View>
  );
}

/** A plus sign: starts a new chat. */
export function PlusIcon({ size = 18, color = colors.text, strokeWidth = 2 }: IconProps) {
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <View
        style={{
          position: "absolute",
          width: size,
          height: strokeWidth,
          borderRadius: strokeWidth,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: "absolute",
          width: strokeWidth,
          height: size,
          borderRadius: strokeWidth,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

/** A cross: closes the sheet. */
export function CloseIcon({ size = 16, color = colors.text, strokeWidth = 2 }: IconProps) {
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <View
        style={{
          position: "absolute",
          width: size,
          height: strokeWidth,
          borderRadius: strokeWidth,
          backgroundColor: color,
          transform: [{ rotate: "45deg" }],
        }}
      />
      <View
        style={{
          position: "absolute",
          width: size,
          height: strokeWidth,
          borderRadius: strokeWidth,
          backgroundColor: color,
          transform: [{ rotate: "-45deg" }],
        }}
      />
    </View>
  );
}

/** A solid triangle pointing up: sends the message. */
export function ArrowUpIcon({ size = 16, color = colors.accentInk }: IconProps) {
  // A CSS-style triangle: a box with two transparent borders and a coloured one.
  const half = size / 2;
  return (
    <View
      style={{
        width: 0,
        height: 0,
        borderLeftWidth: half,
        borderRightWidth: half,
        borderBottomWidth: half,
        borderLeftColor: "transparent",
        borderRightColor: "transparent",
        borderBottomColor: color,
      }}
    />
  );
}

/** A chevron pointing right: opens a chat in the list. */
export function ChevronRightIcon({ size = 14, color = colors.textFaint, strokeWidth = 2 }: IconProps) {
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <View
        style={{
          position: "absolute",
          width: size * 0.62,
          height: size * 0.62,
          borderRightWidth: strokeWidth,
          borderTopWidth: strokeWidth,
          borderColor: color,
          transform: [{ rotate: "45deg" }],
        }}
      />
    </View>
  );
}

export const iconStyles = StyleSheet.create({
  centered: {
    alignItems: "center",
    justifyContent: "center",
  },
});
