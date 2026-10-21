import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, radius, spacing } from "../theme";

type Props = {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onSend: () => void;
  readonly disabled: boolean;
  readonly sending: boolean;
};

export function Composer({ value, onChange, onSend, disabled, sending }: Props) {
  const canSend = value.trim().length > 0 && !disabled && !sending;

  return (
    <View style={styles.container}>
      <View style={styles.inputWrap}>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder="Scrivi a Mots…"
          placeholderTextColor={colors.textFaint}
          style={styles.input}
          multiline
          maxLength={100_000}
          keyboardAppearance="dark"
          selectionColor={colors.accent}
        />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Invia"
        onPress={onSend}
        disabled={!canSend}
        style={({ pressed }) => [
          styles.send,
          !canSend && styles.sendDisabled,
          pressed && canSend && styles.sendPressed,
        ]}
      >
        <Text style={[styles.sendText, !canSend && styles.sendTextDisabled]}>
          {sending ? "…" : "↑"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  inputWrap: {
    flex: 1,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  input: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
    maxHeight: 120,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
  },
  sendDisabled: {
    backgroundColor: colors.surfaceRaised,
  },
  sendPressed: {
    opacity: 0.78,
  },
  sendText: {
    color: colors.accentInk,
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 25,
  },
  sendTextDisabled: {
    color: colors.textFaint,
  },
});
