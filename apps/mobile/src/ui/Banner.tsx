import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { presentCalmError } from "../present";
import { hit, radius, spacing, type as typeScale } from "../theme";

type Props = {
  readonly message: string;
  readonly tone?: "danger" | "info";
  readonly actionLabel?: string;
  readonly onAction?: () => void;
  readonly onDismiss?: () => void;
};

export function Banner({ message, actionLabel = "Riprova", onAction, onDismiss }: Props) {
  const { colors } = useTheme();
  const calm = presentCalmError(message);
  const [open, setOpen] = useState(false);
  const action = onAction ?? onDismiss;
  const actionText = onAction !== undefined ? actionLabel : onDismiss !== undefined ? "Chiudi" : undefined;

  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.banner, { backgroundColor: colors.surfaceSoft }]}
    >
      <Text style={[styles.message, { color: colors.textPrimary }]}>{calm.line}</Text>
      <View style={styles.actions}>
        {action !== undefined && actionText !== undefined ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={actionText}
            onPress={action}
            style={styles.action}
          >
            <Text style={[styles.actionLabel, { color: colors.textPrimary }]}>{actionText}</Text>
          </Pressable>
        ) : null}
        {calm.detail !== undefined ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dettagli"
            onPress={() => setOpen((current) => !current)}
            style={styles.action}
          >
            <Text style={[styles.detailLink, { color: colors.textSecondary }]}>Dettagli</Text>
          </Pressable>
        ) : null}
      </View>
      {open && calm.detail !== undefined ? (
        <Text selectable style={[styles.detail, { color: colors.textSecondary }]}>
          {calm.detail}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    gap: spacing.xs,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  message: {
    ...typeScale.body,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
  },
  action: {
    minHeight: hit,
    justifyContent: "center",
  },
  actionLabel: {
    ...typeScale.body,
  },
  detailLink: {
    ...typeScale.small,
  },
  detail: {
    ...typeScale.small,
  },
});
