import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme, type ThemeMode } from "../context/ThemeContext";
import { hit, spacing, type as typeScale } from "../theme";

const OPTIONS: readonly { readonly id: ThemeMode; readonly label: string }[] = [
  { id: "dark", label: "Scuro" },
  { id: "light", label: "Chiaro" },
  { id: "system", label: "Sistema" },
];

export function ThemeSwitcher() {
  const { mode, setMode, colors } = useTheme();
  return (
    <View accessibilityLabel="Tema">
      {OPTIONS.map((option) => {
        const selected = mode === option.id;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="button"
            accessibilityLabel={`Tema ${option.label}`}
            accessibilityState={{ selected }}
            onPress={() => setMode(option.id)}
            style={styles.row}
          >
            <Text
              style={[
                styles.label,
                { color: selected ? colors.textPrimary : colors.textSecondary },
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
    minHeight: hit,
    justifyContent: "center",
    paddingVertical: spacing.sm,
  },
  label: {
    ...typeScale.body,
  },
});
