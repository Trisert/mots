import type { ReactNode } from "react";
import { Pressable, StyleSheet } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { hit } from "../theme";

type Props = {
  readonly label: string;
  readonly onPress: () => void;
  readonly disabled?: boolean;
  readonly children: ReactNode;
};

export function IconButton({ label, onPress, disabled = false, children }: Props) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: pressed ? colors.cardSurfacePrimary : "transparent" },
        disabled && styles.disabled,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: hit,
    height: hit,
    borderRadius: hit / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: {
    opacity: 0.35,
  },
});
