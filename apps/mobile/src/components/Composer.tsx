import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from "react-native";
import { ArrowUpIcon } from "./Icon";
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
        {sending ? (
          <ActivityIndicator size="small" color={colors.textFaint} />
        ) : (
          <ArrowUpIcon size={15} color={canSend ? colors.accentInk : colors.textFaint} />
        )}
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
    paddingBottom: spacing.lg,
    backgroundColor: colors.bgMain,
  },
  inputWrap: {
    flex: 1,
    borderRadius: radius.pill,
    backgroundColor: colors.cardSurfacePrimary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    minHeight: 60,
    justifyContent: "center",
  },
  input: {
    color: colors.textPrimary,
    fontSize: 16,
    lineHeight: 22,
    maxHeight: 120,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  send: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentCoral,
  },
  sendDisabled: {
    backgroundColor: colors.surfaceRaised,
  },
  sendPressed: {
    opacity: 0.78,
  },
});
