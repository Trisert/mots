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
    <View accessibilityLabel="Tema" style={styles.row}>
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
                backgroundColor: selected ? colors.textPrimary : colors.cardSurfacePrimary,
                borderColor: selected ? colors.textPrimary : colors.borderSubtle,
              },
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.label,
                { color: selected ? colors.bgMain : colors.textSecondary },
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
    gap: spacing.sm,
  },
  chip: {
    flex: 1,
    minHeight: hit,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  label: {
    ...typeScale.label,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.8,
  },
});
