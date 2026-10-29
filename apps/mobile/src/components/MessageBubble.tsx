import { memo, useMemo, useState } from "react";
import { Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import type { TranscriptEntry } from "@mots/client";
import { useTheme } from "../context/ThemeContext";
import { announceNow } from "../a11y";
import { messageBody } from "../edit-message";
import { useI18n } from "../i18n";
import { fonts, radius, shadows, spacing, type as typeScale, type ThemeColors } from "../theme";
import { toolLabel, toolSummary } from "../tools";
import {
  AlertIcon,
  BookmarkIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClockIcon,
  CopyIcon,
  ForkIcon,
  SearchIcon,
  ToolIcon,
  TrashIcon,
} from "./Icon";
import { MarkdownText } from "./MarkdownText";
import { MascotAvatar } from "./Mascot";
import { ToolMarker, ToolRun } from "./ToolRun";

function extractThinkingAndText(raw: string): { thinking?: string; text: string } {
  let clean = messageBody(raw);

  // Match <think>...</think> or <reasoning>...</reasoning>
  const thinkMatch = /<(?:think|reasoning)>([\s\S]*?)<\/(?:think|reasoning)>/i.exec(clean);
  if (thinkMatch) {
    const thinking = thinkMatch[1].trim();
    clean = clean.replace(/<(?:think|reasoning)>[\s\S]*?<\/(?:think|reasoning)>/i, "").trim();
    return { thinking, text: clean };
  }

  return { text: clean };
}

type Props = {
  readonly entry: TranscriptEntry;
  readonly onFork?: (entry: TranscriptEntry) => void;
  /** Offered for sent messages while the chat can take input. */
  readonly onEdit?: (entry: TranscriptEntry) => void;
};

function MessageBubbleComponent({ entry, onFork, onEdit }: Props) {
  const { colors, isDark } = useTheme();
  const { t, locale } = useI18n();
  const localeTag = locale === "it" ? "it-IT" : "en-GB";
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

  // Tool results are lines in the chat, grouped by ChatScreen. A lone result is one line.
  // Tool results are lines in the chat, grouped by ChatScreen. A lone result is one line.
  if (entry.role === "tool") {
    return <ToolRun tools={[entry]} />;
  }

  const isUser = entry.role === "user";
  const isScheduled = entry.role === "scheduled";
  const { thinking, text } = extractThinkingAndText(entry.text);

  const onlyToolCalls = text.length === 0 && (entry.toolCalls?.length ?? 0) > 0;
  if (onlyToolCalls) return null;

  const copyMessage = async () => {
    try {
      await Clipboard.setStringAsync(text);
      setCopied(true);
      announceNow(t("common.copied"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const openMessageActions = () => {
    Alert.alert(t("bubble.messageActions"), undefined, [
      { text: t("bubble.copyMessage"), onPress: () => void copyMessage() },
      ...(onEdit !== undefined ? [{ text: t("bubble.editMessage"), onPress: () => onEdit(entry) }] : []),
      { text: t("common.cancel"), style: "cancel" },
    ]);
  };

  const message = (
    <View accessibilityRole="listitem" style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}>
      {!isUser ? (
        <View style={styles.avatar}>
          <MascotAvatar size={28} />
        </View>
      ) : null}
      <View
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleAssistant,
          isScheduled && styles.bubbleScheduled,
        ]}
      >
        {isScheduled ? (
          <View style={styles.scheduledHeader}>
            <Text style={styles.scheduledLabel}>{t("bubble.routine")}</Text>
          </View>
        ) : null}

        {entry.toolCalls !== undefined && entry.toolCalls.length > 0 ? (
          <View style={styles.toolCalls}>
            {entry.toolCalls.map((call) => (
              <View key={call.callId} style={styles.toolCall}>
                <ToolMarker name={call.name} isError={false} color={colors.textSecondary} />
                <Text style={styles.toolCallText}>{toolLabel(call.name, t)}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Grok-style Thinking / Reasoning Accordion */}
        {thinking !== undefined && thinking.length > 0 ? (
          <View style={styles.reasoningCard}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("bubble.reasoningDetails")}
              accessibilityState={{ expanded: reasoningExpanded }}
              onPress={() => setReasoningExpanded(!reasoningExpanded)}
              style={({ pressed }) => [
                styles.reasoningHeader,
                pressed && styles.reasoningHeaderPressed,
              ]}
            >
              <View style={styles.reasoningTitleRow}>
                <Text style={styles.reasoningTitle}>{t("bubble.reasoning")}</Text>
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

        {entry.images !== undefined && entry.images.length > 0 ? (
          <View style={styles.images}>
            {entry.images.map((image, index) => (
              <Image
                // Pictures of one message have no id; their order is stable.
                key={index}
                accessibilityRole="image"
                accessibilityLabel={t("chat.imageAlt")}
                source={{ uri: `data:${image.mimeType};base64,${image.data}` }}
                style={styles.image}
                resizeMode="cover"
              />
            ))}
          </View>
        ) : null}

        {text.length > 0 ? (
          <MarkdownText
            text={text}
            style={[styles.text, isUser && styles.textUser]}
            // A long press opens the message actions, so a sent message is not selectable text.
            selectable={!isUser}
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
                accessibilityLabel={t("bubble.copyReply")}
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
                  accessibilityLabel={t("bubble.branchFromHere")}
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

          </View>
        ) : null}
      </View>
    </View>
  );

  if (!isUser) return message;
  return (
    <Pressable
      delayLongPress={350}
      onLongPress={openMessageActions}
      accessibilityActions={[
        { name: "copy", label: t("bubble.copyMessage") },
        ...(onEdit !== undefined ? [{ name: "edit", label: t("bubble.editMessage") }] : []),
      ]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "copy") void copyMessage();
        if (event.nativeEvent.actionName === "edit") onEdit?.(entry);
      }}
    >
      {message}
    </Pressable>
  );
}

export const MessageBubble = memo(MessageBubbleComponent);

function createStyles(colors: ThemeColors, isDark: boolean) {
  return StyleSheet.create({
    row: {
      width: "100%",
      marginTop: spacing.lg,
      flexDirection: "row",
    },
    rowUser: {
      justifyContent: "flex-end",
    },
    rowAssistant: {
      justifyContent: "flex-start",
      gap: spacing.sm,
    },
    avatar: {
      paddingTop: 4,
    },
    bubble: {
      maxWidth: "100%",
    },
    bubbleAssistant: {
      flex: 1,
      minWidth: 0,
      backgroundColor: "transparent",
      paddingHorizontal: 2,
      paddingVertical: 6,
    },
    // White bubble with a tail corner toward the sender.
    bubbleUser: {
      alignSelf: "flex-end",
      maxWidth: "84%",
      backgroundColor: colors.userBubble,
      borderRadius: radius.bubble,
      borderBottomRightRadius: radius.xs,
      paddingHorizontal: 16,
      paddingVertical: 10,
      ...(isDark ? null : shadows.card),
    },
    bubbleScheduled: {
      paddingHorizontal: 2,
    },
    images: {
      gap: spacing.sm,
      marginBottom: spacing.xs,
    },
    image: {
      width: 220,
      maxWidth: "100%",
      aspectRatio: 1,
      borderRadius: radius.bubble / 2,
      backgroundColor: colors.sunk,
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
    assistantFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 2,
    },
    actionIconsRow: {
      flexDirection: "row",
      alignItems: "center",
      marginLeft: -14,
      opacity: 0.8,
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
      marginBottom: spacing.sm,
      gap: 2,
    },
    toolCall: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      minHeight: 22,
    },
    toolCallText: {
      ...typeScale.caption,
      color: colors.textSecondary,
    },
    reasoningCard: {
      borderRadius: radius.card,
      backgroundColor: colors.reasoningSurface,
      overflow: "hidden",
      marginBottom: spacing.sm,
    },
    reasoningHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      minHeight: 44,
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
      paddingTop: 0,
    },
    reasoningText: {
      ...typeScale.mono,
      color: colors.reasoningText,
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
