import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme, type ThemeMode } from "../context/ThemeContext";
import { hit, radius, spacing, type as typeScale } from "../theme";

const OPTIONS: readonly { readonly id: ThemeMode; readonly label: string }[] = [
  { id: "dark", label: "Scuro" },
  { id: "light", label: "Chiaro" },
  { id: "system", label: "Sistema" },
];

export function ThemeSwitcher() {
  const { mode, setMode, colors } = useTheme();
  return (
    <View accessibilityLabel="Tema" style={[styles.row, { borderColor: colors.sunk, backgroundColor: colors.sunk }]}>
      {OPTIONS.map((option) => {
        const selected = mode === option.id;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="button"
            accessibilityLabel={`Tema ${option.label}`}
            accessibilityState={{ selected }}
            onPress={() => setMode(option.id)}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: selected ? colors.card : "transparent",
                borderColor: selected ? colors.textPrimary : "transparent",
              },
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.label,
                { color: colors.textPrimary },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 4,
    padding: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chip: {
    borderWidth: 1.5,
    flex: 1,
    minHeight: hit - 6,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  label: {
    ...typeScale.label,
  },
  pressed: {
    opacity: 0.8,
  },
});
