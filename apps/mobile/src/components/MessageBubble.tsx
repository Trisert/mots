import { memo, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import type { TranscriptEntry } from "@mots/client";
import { useTheme } from "../context/ThemeContext";
import { formatTime as formatTimestamp } from "../format";
import { fonts, radius, spacing, type ThemeColors } from "../theme";
import { TOOL_LABELS, toolSummary } from "../tools";
import {
  BookmarkIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClockIcon,
  CopyIcon,
  ForkIcon,
  SearchIcon,
  SparkleIcon,
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

function ToolIcon({ name, isError }: { readonly name: string; readonly isError?: boolean }) {
  const { colors } = useTheme();
  const color = isError ? colors.danger : colors.textPrimary;
  switch (name) {
    case "schedule":
      return <ClockIcon size={16} color={color} />;
    case "remember":
    case "forget":
      return <BookmarkIcon size={16} color={color} />;
    case "search_history":
      return <SearchIcon size={16} color={color} />;
    default:
      return <SparkleIcon size={16} color={color} />;
  }
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
          <SparkleIcon size={12} color={colors.starHighlight} />
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
        <View style={[styles.toolCard, isError && styles.toolCardError]}>
          <View style={styles.toolHeader}>
            <View style={styles.toolIconWrap}>
              <ToolIcon name={name} isError={isError} />
            </View>
            <View style={styles.toolTitleBlock}>
              <Text style={styles.toolName}>{TOOL_LABELS[name] ?? name}</Text>
              {detail !== undefined && detail.length > 0 ? (
                <Text style={styles.toolSummary}>{detail}</Text>
              ) : null}
            </View>
            <View
              style={[
                styles.toolStatusBadge,
                isError ? styles.toolBadgeError : styles.toolBadgeSuccess,
              ]}
            >
              <Text
                style={[
                  styles.toolStatusText,
                  isError ? styles.toolStatusTextError : styles.toolStatusTextSuccess,
                ]}
              >
                {isError ? "Errore" : "Eseguito"}
              </Text>
            </View>
          </View>
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
            <ClockIcon size={14} color={colors.accentCoral} />
            <Text style={styles.scheduledLabel}>ROUTINE PROGRAMMATA</Text>
          </View>
        ) : null}

        {/* Autonomous tool call chips on assistant message */}
        {entry.toolCalls !== undefined && entry.toolCalls.length > 0 ? (
          <View style={styles.toolCalls}>
            {entry.toolCalls.map((call) => (
              <View key={call.callId} style={styles.toolChip}>
                <ToolIcon name={call.name} />
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
                <SparkleIcon size={14} color={colors.starHighlight} />
                <Text style={styles.reasoningTitle}>Ragionamento</Text>
                <View style={styles.reasoningPill}>
                  <Text style={styles.reasoningPillText}>✦ autonomo</Text>
                </View>
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
                hitSlop={{ top: 11, bottom: 11, left: 11, right: 11 }}
                onPress={() => void copyMessage()}
                style={({ pressed }) => [
                  styles.iconActionButton,
                  pressed && styles.actionButtonPressed,
                ]}
              >
                {copied ? (
                  <CheckIcon size={14} color={colors.accentGreen} />
                ) : (
                  <CopyIcon size={14} color={colors.textSecondary} />
                )}
              </Pressable>

              {entry.canFork && onFork !== undefined ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Dirama da questo messaggio"
                  hitSlop={{ top: 11, bottom: 11, left: 11, right: 11 }}
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
      backgroundColor: colors.userBubble,
      borderRadius: 20,
      borderTopLeftRadius: 20,
      borderBottomLeftRadius: 20,
      borderBottomRightRadius: 6,
      paddingHorizontal: 16,
      paddingVertical: 11,
      elevation: 1,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0.25 : 0.05,
      shadowRadius: 3,
      borderWidth: isDark ? 1 : 0,
      borderColor: isDark ? "rgba(255, 255, 255, 0.06)" : "transparent",
    },
    bubbleScheduled: {
      backgroundColor: colors.cardSurfaceAmber,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: colors.reasoningBorder,
    },
    text: {
      fontFamily: fonts.medium,
      color: colors.textPrimary,
      fontSize: 15.5,
      lineHeight: 23,
    },
    textUser: {
      fontFamily: fonts.medium,
      color: colors.userBubbleText,
    },
    scheduledHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: spacing.xs,
    },
    scheduledLabel: {
      fontFamily: fonts.bold,
      color: colors.accentCoral,
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 1.2,
    },
    time: {
      fontFamily: fonts.medium,
      color: colors.textSecondary,
      fontSize: 11,
      opacity: 0.8,
    },
    timeUser: {
      fontFamily: fonts.medium,
      marginTop: 4,
      alignSelf: "flex-end",
      color: isDark ? "rgba(245, 245, 247, 0.55)" : "rgba(255, 255, 255, 0.55)",
      fontSize: 10.5,
    },
    assistantFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 6,
      paddingTop: 2,
    },
    actionIconsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    iconActionButton: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "transparent",
    },
    actionButtonPressed: {
      opacity: 0.5,
      backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
    },
    toolCalls: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.xs,
      marginBottom: spacing.sm,
    },
    toolChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      borderRadius: radius.pill,
      backgroundColor: colors.cardSurfaceAmber,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
    },
    toolChipText: {
      fontFamily: fonts.semiBold,
      color: colors.textPrimary,
      fontSize: 11,
      fontWeight: "600",
    },
    reasoningCard: {
      backgroundColor: colors.reasoningSurface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.reasoningBorder,
      overflow: "hidden",
      marginBottom: spacing.sm,
    },
    reasoningHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.md,
      paddingVertical: 8,
    },
    reasoningHeaderPressed: {
      opacity: 0.7,
    },
    reasoningTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    reasoningTitle: {
      fontFamily: fonts.bold,
      color: colors.reasoningText,
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0.2,
    },
    reasoningPill: {
      backgroundColor: colors.badgeAmberBg,
      borderRadius: radius.pill,
      paddingHorizontal: 6,
      paddingVertical: 1,
    },
    reasoningPillText: {
      fontFamily: fonts.semiBold,
      color: colors.badgeAmberText,
      fontSize: 10,
      fontWeight: "600",
    },
    reasoningContent: {
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.reasoningBorder,
      paddingTop: spacing.sm,
    },
    reasoningText: {
      fontFamily: "monospace",
      color: colors.reasoningText,
      fontSize: 12,
      lineHeight: 18,
    },
    toolRow: {
      alignItems: "flex-start",
      marginTop: spacing.sm,
      paddingLeft: spacing.xs,
    },
    toolCard: {
      maxWidth: "92%",
      borderRadius: radius.card,
      backgroundColor: colors.cardSurfacePrimary,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderWidth: 1,
      borderColor: colors.cardBorderSubtle,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0.2 : 0.03,
      shadowRadius: 4,
      elevation: 1,
    },
    toolCardError: {
      backgroundColor: colors.badgePinkBg,
      borderColor: colors.cardSurfacePink,
    },
    toolHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    toolIconWrap: {
      width: 32,
      height: 32,
      borderRadius: radius.pill,
      backgroundColor: colors.cardSurfaceAmber,
      alignItems: "center",
      justifyContent: "center",
    },
    toolTitleBlock: {
      flex: 1,
    },
    toolName: {
      fontFamily: fonts.bold,
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: "700",
      letterSpacing: 0.2,
    },
    toolSummary: {
      fontFamily: fonts.regular,
      marginTop: 2,
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 16,
    },
    toolStatusBadge: {
      borderRadius: radius.pill,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    toolBadgeSuccess: {
      backgroundColor: colors.badgeMintBg,
    },
    toolBadgeError: {
      backgroundColor: colors.badgePinkBg,
    },
    toolStatusText: {
      fontFamily: fonts.semiBold,
      fontSize: 11,
      fontWeight: "600",
    },
    toolStatusTextSuccess: {
      color: colors.badgeMintText,
    },
    toolStatusTextError: {
      color: colors.badgePinkText,
    },
    diagnostics: {
      marginTop: spacing.sm,
      gap: spacing.xs,
    },
    diagnostic: {
      fontFamily: fonts.regular,
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
      backgroundColor: colors.borderMedium,
    },
    systemBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: spacing.md,
      paddingVertical: 3,
      borderRadius: radius.pill,
      backgroundColor: colors.cardSurfacePrimary,
    },
    systemText: {
      fontFamily: fonts.semiBold,
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: "600",
      letterSpacing: 0.3,
    },
  });
}
