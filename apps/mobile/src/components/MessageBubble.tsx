import { Pressable, StyleSheet, Text, View } from "react-native";
import type { TranscriptEntry } from "@mots/client";
import { formatTime as formatTimestamp } from "../format";
import { colors, radius, spacing } from "../theme";
import { TOOL_LABELS, toolSummary } from "../tools";
import { MarkdownText } from "./MarkdownText";

function displayText(entry: TranscriptEntry): string {
  if (entry.role === "user" || entry.role === "scheduled") {
    return entry.text.replace(/^\[[^\]\n]{1,40}\]\n/, "");
  }
  return entry.text;
}

function formatTime(timestamp: number | undefined): string | undefined {
  return formatTimestamp(timestamp);
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
    // The raw tool output is written for the model; the person sees a short Italian summary
    // instead, and the raw text only when the tool failed.
    const summary = toolSummary(name, entry.toolResult?.details);
    const detail = entry.toolResult?.isError === true ? entry.text : summary;
    return (
      <View style={styles.toolRow}>
        <View style={[styles.toolCard, entry.toolResult?.isError && styles.toolCardError]}>
          <Text style={styles.toolName}>{TOOL_LABELS[name] ?? name}</Text>
          {detail !== undefined && detail.length > 0 ? (
            <Text style={styles.toolText} numberOfLines={4}>
              {detail}
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
  // A turn that only issued tool calls has nothing of its own to say: the tool card already shows
  // it, so an extra bubble with the same chip would repeat the same action twice.
  const onlyToolCalls = text.length === 0 && (entry.toolCalls?.length ?? 0) > 0;
  if (onlyToolCalls) return null;

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
          <MarkdownText
            text={text}
            style={[styles.text, isUser && styles.textUser]}
            selectable
          />
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
    borderRadius: 24,
    borderBottomLeftRadius: 6,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.cardSurfacePrimary,
  },
  bubbleUser: {
    backgroundColor: colors.accentCoral,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 6,
  },
  bubbleScheduled: {
    backgroundColor: colors.cardSurfaceAmber,
    borderBottomLeftRadius: 6,
  },
  text: {
    color: colors.textPrimary,
    fontSize: 16,
    lineHeight: 24,
  },
  textUser: {
    color: "#FFFFFF",
  },
  time: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    fontSize: 11,
  },
  timeUser: {
    color: "rgba(255,255,255,0.7)",
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
    backgroundColor: colors.cardSurfacePrimary,
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
    justifyContent: "center",
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
    borderRadius: 24,
    backgroundColor: colors.cardSurfaceAmber,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  toolCardError: {
    backgroundColor: colors.cardSurfacePink,
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
