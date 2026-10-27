import { useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextInputProps,
} from "react-native";
import { AlertIcon } from "../components/Icon";
import { useTheme } from "../context/ThemeContext";
import { fonts, radius, spacing, type as typeScale } from "../theme";

type Props = {
  readonly label: string;
  readonly value: string;
  readonly onChangeText: (value: string) => void;
  readonly placeholder?: string;
  readonly hint?: string;
  readonly error?: string;
  readonly autoCapitalize?: "none" | "sentences" | "words" | "characters";
  readonly autoCorrect?: boolean;
  readonly autoFocus?: boolean;
  readonly maxLength?: number;
  readonly keyboardType?: KeyboardTypeOptions;
  /** Identifies what the field holds, so the OS can fill it (WCAG 1.3.5). */
  readonly autoComplete?: TextInputProps["autoComplete"];
  readonly textContentType?: TextInputProps["textContentType"];
};

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  hint,
  error,
  autoCapitalize = "none",
  autoCorrect = false,
  autoFocus = false,
  maxLength,
  keyboardType,
  autoComplete,
  textContentType,
}: Props) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.group}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        autoFocus={autoFocus}
        maxLength={maxLength}
        keyboardType={keyboardType}
        autoComplete={autoComplete}
        textContentType={textContentType}
        accessibilityHint={error ?? hint}
        aria-invalid={error !== undefined}
        selectionColor={colors.textPrimary}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          styles.input,
          {
            color: colors.textPrimary,
            backgroundColor: colors.field,
            borderColor: error !== undefined ? colors.danger : focused ? colors.focus : colors.fieldBorder,
            borderWidth: error !== undefined || focused ? 2 : 1,
          },
        ]}
      />
      {error !== undefined ? (
        <View style={styles.errorRow}>
          <View
            aria-hidden
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={styles.mark}
          >
            <AlertIcon size={14} color={colors.danger} />
          </View>
          <Text
            accessibilityRole="alert"
            accessibilityLabel={`Errore: ${error}`}
            style={[styles.hint, styles.errorText, { color: colors.textPrimary }]}
          >
            {error}
          </Text>
        </View>
      ) : hint !== undefined ? (
        <Text style={[styles.hint, { color: colors.textSecondary }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: spacing.sm,
  },
  label: {
    ...typeScale.label,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.xs + 2,
  },
  mark: {
    height: typeScale.small.lineHeight,
    justifyContent: "center",
  },
  errorText: {
    flex: 1,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 22,
  },
  hint: {
    ...typeScale.small,
  },
});
