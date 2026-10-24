import { useMemo } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { fonts, hit, inset, spacing, type as typeScale, type ThemeColors } from "../theme";

type Props = {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onSend: () => void;
  readonly disabled: boolean;
  readonly sending: boolean;
};

export function Composer({ value, onChange, onSend, disabled, sending }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const canSend = value.trim().length > 0 && !disabled && !sending;

  return (
    <View style={styles.row}>
      <TextInput
        accessibilityLabel="Messaggio"
        value={value}
        onChangeText={onChange}
        placeholder="Messaggio"
        placeholderTextColor={colors.textFaint}
        style={styles.input}
        maxLength={100_000}
        selectionColor={colors.textPrimary}
        onKeyPress={(event) => {
          if (Platform.OS !== "web") return;
          const native = event.nativeEvent;
          const shift = "shiftKey" in native && native.shiftKey === true;
          if (native.key !== "Enter" || shift) return;
          if ("preventDefault" in event && typeof event.preventDefault === "function") {
            event.preventDefault();
          }
          if (canSend) onSend();
        }}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Invia messaggio"
        accessibilityState={{ disabled: !canSend, busy: sending }}
        onPress={onSend}
        disabled={!canSend}
        style={({ pressed }) => [
          styles.send,
          { backgroundColor: canSend ? colors.accent : "transparent" },
          pressed && canSend && styles.pressed,
        ]}
      >
        {sending ? (
          <ActivityIndicator color={colors.accentInk} />
        ) : (
          <Text style={[styles.sendLabel, { color: canSend ? colors.accentInk : colors.textFaint }]}>
            Invia
          </Text>
        )}
      </Pressable>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingHorizontal: inset,
      paddingVertical: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderSubtle,
      backgroundColor: colors.bgMain,
    },
    input: {
      flex: 1,
      minHeight: hit,
      paddingVertical: spacing.sm,
      fontFamily: fonts.regular,
      fontSize: typeScale.body.fontSize,
      lineHeight: typeScale.body.lineHeight,
      color: colors.textPrimary,
    },
    send: {
      minHeight: hit,
      minWidth: 72,
      paddingHorizontal: spacing.md,
      alignItems: "center",
      justifyContent: "center",
    },
    sendLabel: {
      ...typeScale.body,
    },
    pressed: {
      opacity: 0.8,
    },
  });
}
