import { Pressable, StyleSheet, Text, View } from "react-native";
import type { TranscriptEntry } from "@mots/client";
import { colors, radius, spacing } from "../theme";

const TOOL_LABELS: Record<string, string> = {
  remember: "memoria",
  forget: "memoria",
  schedule: "promemoria",
  search_history: "ricerca",
};

function displayText(entry: TranscriptEntry): string {
  if (entry.role === "user" || entry.role === "scheduled") {
    return entry.text.replace(/^\[[^\]\n]{1,40}\]\n/, "");
  }
  return entry.text;
}

function formatTime(timestamp: number | undefined): string | undefined {
  if (timestamp === undefined) return undefined;
  try {
    return new Date(timestamp).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return undefined;
  }
}

type Props = {
  readonly entry: TranscriptEntry;
  readonly onFork?: (entry: TranscriptEntry) => void;
};

export function MessageBubble({ entry, onFork }: Props) {
  if (entry.role === "system" || entry.role === "event") return null;

  if (entry.role === "compaction" || entry.role === "reset") {
    return (
      <View style={styles.systemRow}>
        <View style={styles.systemRule} />
        <Text style={styles.systemText}>
          {entry.role === "compaction" ? "Contesto compattato" : "Nuovo contesto"}
        </Text>
        <View style={styles.systemRule} />
      </View>
    );
  }

  if (entry.role === "tool") {
    const name = entry.toolResult?.name ?? "strumento";
    return (
      <View style={styles.toolRow}>
        <View style={[styles.toolCard, entry.toolResult?.isError && styles.toolCardError]}>
          <Text style={styles.toolName}>{TOOL_LABELS[name] ?? name}</Text>
          {entry.text.length > 0 ? (
            <Text style={styles.toolText} numberOfLines={4}>
              {entry.text}
            </Text>
          ) : null}
        </View>
      </View>
    );
  }

  const isUser = entry.role === "user";
  const isScheduled = entry.role === "scheduled";
  const time = formatTime(entry.timestamp);
  const text = displayText(entry);

  return (
    <Pressable
      onLongPress={
        entry.canFork && onFork !== undefined ? () => onFork(entry) : undefined
      }
      delayLongPress={350}
      style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}
    >
      <View
        style={[
          styles.bubble,
          isUser && styles.bubbleUser,
          isScheduled && styles.bubbleScheduled,
        ]}
      >
        {isScheduled ? <Text style={styles.scheduledLabel}>PROMEMORIA</Text> : null}

        {entry.toolCalls !== undefined && entry.toolCalls.length > 0 ? (
          <View style={styles.toolCalls}>
            {entry.toolCalls.map((call) => (
              <View key={call.callId} style={styles.toolChip}>
                <Text style={styles.toolChipText}>
                  {TOOL_LABELS[call.name] ?? call.name}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {text.length > 0 ? (
          <Text style={[styles.text, isUser && styles.textUser]} selectable>
            {text}
          </Text>
        ) : null}

        {entry.diagnostics !== undefined && entry.diagnostics.length > 0 ? (
          <View style={styles.diagnostics}>
            {entry.diagnostics.map((diagnostic, index) => (
              <Text key={`${diagnostic.code ?? "diag"}-${index}`} style={styles.diagnostic}>
                {diagnostic.message}
              </Text>
            ))}
          </View>
        ) : null}

        {time !== undefined ? (
          <Text style={[styles.time, isUser && styles.timeUser]}>{time}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    width: "100%",
    marginTop: spacing.md,
    flexDirection: "row",
  },
  rowUser: {
    justifyContent: "flex-end",
  },
  rowAssistant: {
    justifyContent: "flex-start",
  },
  bubble: {
    maxWidth: "88%",
    borderRadius: radius.lg,
    borderBottomLeftRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  bubbleUser: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.sm,
  },
  bubbleScheduled: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.accent,
    borderBottomLeftRadius: radius.sm,
  },
  text: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 23,
  },
  textUser: {
    color: colors.accentInk,
  },
  time: {
    marginTop: spacing.sm,
    color: colors.textFaint,
    fontSize: 11,
  },
  timeUser: {
    color: "rgba(27, 19, 5, 0.58)",
  },
  scheduledLabel: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginBottom: spacing.xs,
  },
  toolCalls: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  toolChip: {
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  toolChipText: {
    color: colors.textMuted,
    fontSize: 11,
  },
  diagnostics: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  diagnostic: {
    color: colors.danger,
    fontSize: 12,
    lineHeight: 17,
  },
  systemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  systemRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  systemText: {
    color: colors.textFaint,
    fontSize: 11,
    letterSpacing: 0.4,
  },
  toolRow: {
    alignItems: "flex-start",
    marginTop: spacing.sm,
    paddingLeft: spacing.xs,
  },
  toolCard: {
    maxWidth: "88%",
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  toolCardError: {
    borderColor: colors.danger,
  },
  toolName: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  toolText: {
    marginTop: 2,
    color: colors.textFaint,
    fontSize: 12,
    lineHeight: 17,
  },
});
