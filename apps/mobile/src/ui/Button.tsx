import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { fonts, hit, radius, type ThemeColors } from "../theme";

type Variant = "primary" | "secondary" | "ghost" | "danger";

type Props = {
  readonly label: string;
  readonly onPress: () => void;
  readonly variant?: Variant;
  readonly disabled?: boolean;
  readonly loading?: boolean;
  readonly accessibilityLabel?: string;
};

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  accessibilityLabel,
}: Props) {
  const { colors } = useTheme();
  const palette = palettes(colors)[variant];
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: palette.background,
          borderColor: palette.border,
        },
        variant === "ghost" ? styles.ghost : null,
        inactive && styles.inactive,
        pressed && !inactive && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.label} />
      ) : (
        <Text
          style={[
            styles.label,
            { color: palette.label, fontWeight: variant === "ghost" ? "500" : "600" },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

function palettes(colors: ThemeColors): Record<
  Variant,
  { readonly background: string; readonly border: string; readonly label: string }
> {
  return {
    primary: {
      background: colors.textPrimary,
      border: colors.textPrimary,
      label: colors.bgMain,
    },
    secondary: {
      background: colors.cardSurfacePrimary,
      border: colors.borderSubtle,
      label: colors.textPrimary,
    },
    ghost: {
      background: "transparent",
      border: "transparent",
      label: colors.textSecondary,
    },
    danger: {
      background: colors.dangerSoft,
      border: "transparent",
      label: colors.danger,
    },
  };
}

const styles = StyleSheet.create({
  base: {
    minHeight: hit,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  ghost: {
    minHeight: hit,
  },
  label: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    lineHeight: 20,
  },
  inactive: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.82,
  },
});
