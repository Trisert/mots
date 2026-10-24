import { useMemo } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { ArrowUpIcon } from "./Icon";
import { fonts, hit, inset, radius, spacing, type as typeScale, type ThemeColors } from "../theme";

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
    <View style={styles.wrap}>
      <View style={styles.pill}>
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
          hitSlop={4}
          style={({ pressed }) => [
            styles.send,
            {
              backgroundColor: canSend ? colors.accent : "transparent",
              borderColor: canSend ? colors.accent : colors.borderSubtle,
            },
            pressed && canSend && styles.pressed,
          ]}
        >
          {sending ? (
            <ActivityIndicator color={colors.accentInk} />
          ) : (
            <ArrowUpIcon size={18} color={canSend ? colors.accentInk : colors.textFaint} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      paddingHorizontal: inset,
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
      backgroundColor: colors.bgMain,
    },
    pill: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      minHeight: 56,
      borderRadius: radius.full,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSubtle,
      backgroundColor: colors.surfaceSoft,
      paddingLeft: spacing.lg,
      paddingRight: 6,
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
      width: hit,
      height: hit,
      borderRadius: radius.full,
      borderWidth: StyleSheet.hairlineWidth,
      alignItems: "center",
      justifyContent: "center",
    },
    pressed: {
      opacity: 0.8,
    },
  });
}
