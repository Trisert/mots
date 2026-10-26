import { memo, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import type { TranscriptEntry } from "@mots/client";
import { useTheme } from "../context/ThemeContext";
import { formatTime as formatTimestamp } from "../format";
import { fonts, radius, spacing, type as typeScale, type ThemeColors } from "../theme";
import { TOOL_LABELS, toolSummary } from "../tools";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CopyIcon,
  ForkIcon,
} from "./Icon";
import { MarkdownText } from "./MarkdownText";

function extractThinkingAndText(raw: string): { thinking?: string; text: string } {
  // Strip user submission ID prefixes if present
  let clean = raw.replace(/^\[[^\]\n]{1,40}\]\n/, "");

  // Match <think>...</think> or <reasoning>...</reasoning>
  const thinkMatch = /<(?:think|reasoning)>([\s\S]*?)<\/(?:think|reasoning)>/i.exec(clean);
  if (thinkMatch) {
    const thinking = thinkMatch[1].trim();
    clean = clean.replace(/<(?:think|reasoning)>[\s\S]*?<\/(?:think|reasoning)>/i, "").trim();
    return { thinking, text: clean };
  }

  return { text: clean };
}

/** Build Log markers: [+] adds, [~] reads or changes, [!] broke. Typed, never drawn. */
function toolMarker(name: string, isError: boolean): string {
  if (isError) return "[!]";
  return name === "remember" || name === "schedule" ? "[+]" : "[~]";
}

type Props = {
  readonly entry: TranscriptEntry;
  readonly onFork?: (entry: TranscriptEntry) => void;
};

function MessageBubbleComponent({ entry, onFork }: Props) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [reasoningExpanded, setReasoningExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  if (entry.role === "system" || entry.role === "event") return null;

  if (entry.role === "compaction" || entry.role === "reset") {
    return (
      <View style={styles.systemRow}>
        <View style={styles.systemRule} />
        <View style={styles.systemBadge}>
          <Text style={styles.systemText}>
            {entry.role === "compaction" ? "Contesto compattato" : "Nuovo contesto"}
          </Text>
        </View>
        <View style={styles.systemRule} />
      </View>
    );
  }

  // Tool execution card
  if (entry.role === "tool") {
    const name = entry.toolResult?.name ?? "strumento";
    const summary = toolSummary(name, entry.toolResult?.details);
    const detail = entry.toolResult?.isError === true ? entry.text : summary;
    const isError = entry.toolResult?.isError === true;

    return (
      <View style={styles.toolRow}>
        <Text
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={[styles.toolMark, isError && styles.toolMarkError]}
        >
          {toolMarker(name, isError)}
        </Text>
        <View style={styles.toolTitleBlock}>
          <Text style={styles.toolName}>
            {TOOL_LABELS[name] ?? name}
            <Text style={styles.toolStatus}>{isError ? "  · errore" : "  · fatto"}</Text>
          </Text>
          {detail !== undefined && detail.length > 0 ? (
            <Text style={styles.toolSummary}>{detail}</Text>
          ) : null}
        </View>
      </View>
    );
  }

  const isUser = entry.role === "user";
  const isScheduled = entry.role === "scheduled";
  const time = formatTimestamp(entry.timestamp);
  const { thinking, text } = extractThinkingAndText(entry.text);

  const onlyToolCalls = text.length === 0 && (entry.toolCalls?.length ?? 0) > 0;
  if (onlyToolCalls) return null;

  const copyMessage = async () => {
    try {
      await Clipboard.setStringAsync(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}>
      <View
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleAssistant,
          isScheduled && styles.bubbleScheduled,
        ]}
      >
        {isScheduled ? (
          <View style={styles.scheduledHeader}>
            <Text style={styles.scheduledLabel}>Routine</Text>
          </View>
        ) : null}

        {/* Autonomous tool call chips on assistant message */}
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

        {/* Grok-style Thinking / Reasoning Accordion */}
        {thinking !== undefined && thinking.length > 0 ? (
          <View style={styles.reasoningCard}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dettagli ragionamento"
              onPress={() => setReasoningExpanded(!reasoningExpanded)}
              style={({ pressed }) => [
                styles.reasoningHeader,
                pressed && styles.reasoningHeaderPressed,
              ]}
            >
              <View style={styles.reasoningTitleRow}>
                <Text style={styles.reasoningTitle}>Ragionamento</Text>
              </View>
              {reasoningExpanded ? (
                <ChevronUpIcon size={14} color={colors.reasoningText} />
              ) : (
                <ChevronDownIcon size={14} color={colors.reasoningText} />
              )}
            </Pressable>

            {reasoningExpanded ? (
              <View style={styles.reasoningContent}>
                <Text style={styles.reasoningText} selectable>
                  {thinking}
                </Text>
              </View>
            ) : null}
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

        {/* Assistant Message Actions & Time Bar (Discreet, Grok/ChatGPT style) */}
        {!isUser ? (
          <View style={styles.assistantFooter}>
            <View style={styles.actionIconsRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Copia risposta"
                hitSlop={4}
                onPress={() => void copyMessage()}
                style={({ pressed }) => [
                  styles.iconActionButton,
                  pressed && styles.actionButtonPressed,
                ]}
              >
                {copied ? (
                  <CheckIcon size={14} color={colors.textPrimary} />
                ) : (
                  <CopyIcon size={14} color={colors.textSecondary} />
                )}
              </Pressable>

              {entry.canFork && onFork !== undefined ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Dirama da questo messaggio"
                  hitSlop={4}
                  onPress={() => onFork(entry)}
                  style={({ pressed }) => [
                    styles.iconActionButton,
                    pressed && styles.actionButtonPressed,
                  ]}
                >
                  <ForkIcon size={14} color={colors.textSecondary} />
                </Pressable>
              ) : null}
            </View>

            {time !== undefined ? <Text style={styles.time}>{time}</Text> : null}
          </View>
        ) : (
          time !== undefined ? <Text style={styles.timeUser}>{time}</Text> : null
        )}
      </View>
    </View>
  );
}

export const MessageBubble = memo(MessageBubbleComponent);

function createStyles(colors: ThemeColors, isDark: boolean) {
  return StyleSheet.create({
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
      maxWidth: "100%",
    },
    bubbleAssistant: {
      width: "100%",
      backgroundColor: "transparent",
      paddingHorizontal: 2,
      paddingVertical: 6,
    },
    bubbleUser: {
      alignSelf: "flex-end",
      maxWidth: "84%",
      backgroundColor: "transparent",
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: colors.rule,
      paddingHorizontal: 14,
      paddingTop: 10,
      paddingBottom: 8,
    },
    bubbleScheduled: {
      backgroundColor: "transparent",
      borderRadius: radius.card,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: colors.rule,
    },
    text: {
      fontFamily: fonts.regular,
      color: colors.textPrimary,
      fontSize: 16,
      lineHeight: 24,
    },
    textUser: {
      fontFamily: fonts.regular,
      color: colors.userBubbleText,
    },
    scheduledHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: spacing.xs,
    },
    scheduledLabel: {
      ...typeScale.kicker,
      color: colors.textSecondary,
    },
    time: {
      ...typeScale.mono,
      fontSize: 11,
      color: colors.textSecondary,
    },
    timeUser: {
      ...typeScale.mono,
      fontSize: 11,
      marginTop: 4,
      alignSelf: "flex-end",
      color: colors.textSecondary,
    },
    assistantFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 2,
    },
    actionIconsRow: {
      flexDirection: "row",
      alignItems: "center",
      marginLeft: -12,
    },
    iconActionButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "transparent",
    },
    actionButtonPressed: {
      backgroundColor: colors.surfaceSoft,
    },
    toolCalls: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.xs,
      marginBottom: spacing.sm,
    },
    toolChip: {
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.rule,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
    },
    toolChipText: {
      ...typeScale.mono,
      fontSize: 11,
      color: colors.textPrimary,
    },
    reasoningCard: {
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: colors.reasoningBorder,
      overflow: "hidden",
      marginBottom: spacing.sm,
    },
    reasoningHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      minHeight: 40,
      paddingHorizontal: spacing.md,
    },
    reasoningHeaderPressed: {
      backgroundColor: colors.surfaceSoft,
    },
    reasoningTitleRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    reasoningTitle: {
      ...typeScale.kicker,
      color: colors.textSecondary,
    },
    reasoningContent: {
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.reasoningBorder,
      paddingTop: spacing.sm,
    },
    reasoningText: {
      ...typeScale.mono,
      color: colors.reasoningText,
      lineHeight: 18,
    },
    toolRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.md,
      marginTop: spacing.md,
      paddingVertical: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderMedium,
    },
    toolMark: {
      fontFamily: fonts.monoMedium,
      fontSize: 13,
      lineHeight: 20,
      color: colors.textPrimary,
      paddingHorizontal: 2,
    },
    toolMarkError: {
      backgroundColor: colors.invertBg,
      color: colors.invertFg,
      borderRadius: radius.xs,
      overflow: "hidden",
    },
    toolTitleBlock: {
      flex: 1,
    },
    toolName: {
      fontFamily: fonts.medium,
      color: colors.textPrimary,
      fontSize: 14,
      lineHeight: 20,
    },
    toolStatus: {
      fontFamily: fonts.mono,
      fontSize: 12,
      color: colors.textSecondary,
    },
    toolSummary: {
      fontFamily: fonts.regular,
      marginTop: 2,
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 18,
    },
    diagnostics: {
      marginTop: spacing.sm,
      gap: spacing.xs,
    },
    diagnostic: {
      ...typeScale.mono,
      color: colors.textSecondary,
      lineHeight: 17,
    },
    systemRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginTop: spacing.lg,
      justifyContent: "center",
    },
    systemRule: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.borderMedium,
    },
    systemBadge: {
      paddingHorizontal: spacing.sm,
    },
    systemText: {
      ...typeScale.kicker,
      color: colors.textSecondary,
    },
  });
}
