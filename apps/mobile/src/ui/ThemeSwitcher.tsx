import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme, type ThemeMode } from "../context/ThemeContext";
import { useI18n, type MessageKey } from "../i18n";
import { hit, radius, spacing, type as typeScale } from "../theme";

const OPTIONS: readonly { readonly id: ThemeMode; readonly label: MessageKey }[] = [
  { id: "dark", label: "theme.dark" },
  { id: "light", label: "theme.light" },
  { id: "system", label: "theme.system" },
];

export function ThemeSwitcher() {
  const { mode, setMode, colors } = useTheme();
  const { t } = useI18n();
  return (
    <View accessibilityLabel={t("menu.theme")} style={[styles.row, { borderColor: colors.sunk, backgroundColor: colors.sunk }]}>
      {OPTIONS.map((option) => {
        const selected = mode === option.id;
        const label = t(option.label);
        return (
          <Pressable
            key={option.id}
            accessibilityRole="button"
            accessibilityLabel={t("menu.themeLabel", { name: label })}
            accessibilityState={{ selected }}
            onPress={() => setMode(option.id)}
            style={({ pressed }) => [
              styles.chip,
              { backgroundColor: selected ? colors.card : "transparent" },
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.label,
                { color: colors.textPrimary },
              ]}
            >
              {label}
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
