import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { LOCALES, useI18n, type Locale, type MessageKey } from "../i18n";
import { hit, radius, spacing, type as typeScale } from "../theme";

const NAME_KEYS: Readonly<Record<Locale, MessageKey>> = {
  en: "language.en",
  it: "language.it",
};

/** Picks the app language. The choice is stored on this device and overrides the device language. */
export function LanguageSwitcher() {
  const { colors } = useTheme();
  const { locale, setLocale, t } = useI18n();
  return (
    <View accessibilityLabel={t("menu.language")} style={[styles.row, { borderColor: colors.sunk, backgroundColor: colors.sunk }]}>
      {LOCALES.map((option) => {
        const selected = locale === option;
        const name = t(NAME_KEYS[option]);
        return (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityLabel={t("menu.languageOption", { name })}
            accessibilityState={{ selected }}
            onPress={() => setLocale(option)}
            style={({ pressed }) => [
              styles.chip,
              { backgroundColor: selected ? colors.card : "transparent" },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.label, { color: colors.textPrimary }]}>{name}</Text>
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
