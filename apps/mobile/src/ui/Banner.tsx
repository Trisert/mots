import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { CloseIcon } from "../components/Icon";
import { hit, radius, spacing, type as typeScale } from "../theme";

type Props = {
  readonly message: string;
  readonly tone?: "danger" | "info";
  readonly actionLabel?: string;
  readonly onAction?: () => void;
  readonly onDismiss?: () => void;
};

export function Banner({ message, tone = "danger", actionLabel, onAction, onDismiss }: Props) {
  const { colors } = useTheme();
  const background = tone === "danger" ? colors.dangerSoft : colors.cardSurfacePrimary;
  const foreground = tone === "danger" ? colors.danger : colors.textPrimary;

  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[
        styles.banner,
        { backgroundColor: background, borderColor: colors.borderSubtle },
      ]}
    >
      <Text style={[styles.message, { color: foreground }]}>{message}</Text>
      <View style={styles.actions}>
        {actionLabel !== undefined && onAction !== undefined ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            onPress={onAction}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          >
            <Text style={[styles.actionLabel, { color: foreground }]}>{actionLabel}</Text>
          </Pressable>
        ) : null}
        {onDismiss !== undefined ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Chiudi avviso"
            onPress={onDismiss}
            hitSlop={8}
            style={({ pressed }) => [styles.dismiss, pressed && styles.pressed]}
          >
            <CloseIcon size={14} color={foreground} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  message: {
    ...typeScale.small,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  action: {
    minHeight: hit,
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  actionLabel: {
    ...typeScale.label,
    fontWeight: "600",
  },
  dismiss: {
    width: hit,
    height: hit,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.7,
  },
});
