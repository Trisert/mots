import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import type { TranscriptEntry } from "@mots/client";
import { useTheme } from "../context/ThemeContext";
import { useReduceMotion } from "../hooks/useReduceMotion";
import { collapsedRunTitle, INLINE_TOOL_LIMIT, toolLine } from "../tool-runs";
import { fonts, spacing, type as typeScale, type ThemeColors } from "../theme";
import { AlertIcon, BookmarkIcon, ChevronDownIcon, ChevronUpIcon, ClockIcon, SearchIcon, ToolIcon, TrashIcon } from "./Icon";

/** The icon of a tool line: what the tool did, or an alert when it failed. */
export function ToolMarker({ name, isError, color }: { name: string; isError: boolean; color: string }) {
  const props = { size: 14, color };
  if (isError) return <AlertIcon {...props} strokeWidth={1.8} />;
  switch (name) {
    case "remember":
      return <BookmarkIcon {...props} />;
    case "forget":
      return <TrashIcon {...props} />;
    case "schedule":
      return <ClockIcon {...props} />;
    case "search_history":
      return <SearchIcon {...props} strokeWidth={1.8} />;
    default:
      return <ToolIcon {...props} />;
  }
}

type Props = {
  readonly tools: readonly TranscriptEntry[];
  /** True while the agent is still working on this run: the collapsed title then shimmers. */
  readonly live?: boolean;
};

/**
 * Tool activity inside the chat, with no pill around it. Up to INLINE_TOOL_LIMIT results are one
 * line each. A longer run is one line that shimmers while the agent works and opens to the detail.
 */
export function ToolRun({ tools, live = false }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const reduceMotion = useReduceMotion();
  const [expanded, setExpanded] = useState(false);
  const pulse = useRef(new Animated.Value(1)).current;
  const shimmer = live && !reduceMotion;

  useEffect(() => {
    pulse.setValue(1);
    if (!shimmer) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.45, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, shimmer]);

  const long = tools.length > INLINE_TOOL_LIMIT;
  const lines = tools.map((entry) => ({ id: entry.id, ...toolLine(entry) }));
  const title = collapsedRunTitle(tools);

  if (long && !expanded) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}. Mostra i dettagli`}
        accessibilityState={{ expanded: false }}
        hitSlop={6}
        onPress={() => setExpanded(true)}
        style={({ pressed }) => [styles.collapsed, pressed && styles.pressed]}
      >
        <Animated.Text style={[styles.collapsedText, { opacity: pulse }]} numberOfLines={1}>
          {title}
        </Animated.Text>
        <ChevronDownIcon size={12} color={colors.textSecondary} />
      </Pressable>
    );
  }

  return (
    <View style={styles.run}>
      {lines.map((line) => (
        <View key={line.id} style={styles.line}>
          <View aria-hidden importantForAccessibility="no-hide-descendants" style={styles.mark}>
            <ToolMarker
              name={line.name}
              isError={line.isError}
              color={line.isError ? colors.danger : colors.textSecondary}
            />
          </View>
          <Text style={[styles.lineText, line.isError && styles.lineTextError]} numberOfLines={2}>
            {line.label}
            {line.detail === undefined ? null : <Text>{` · ${line.detail}`}</Text>}
          </Text>
        </View>
      ))}
      {long ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Nascondi i dettagli"
          accessibilityState={{ expanded: true }}
          hitSlop={6}
          onPress={() => setExpanded(false)}
          style={({ pressed }) => [styles.collapsed, pressed && styles.pressed]}
        >
          <Text style={styles.collapsedText}>{title}</Text>
          <ChevronUpIcon size={12} color={colors.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  // Aligned with the assistant's text, past the avatar.
  const indent = 28 + spacing.sm;
  return StyleSheet.create({
    run: {
      marginLeft: indent,
      marginTop: spacing.xs,
      marginBottom: spacing.xs,
      gap: 2,
    },
    line: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.sm,
      minHeight: 22,
    },
    mark: {
      height: 18,
      justifyContent: "center",
    },
    lineText: {
      ...typeScale.caption,
      flexShrink: 1,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    lineTextError: {
      color: colors.danger,
    },
    collapsed: {
      alignSelf: "flex-start",
      marginLeft: indent,
      marginTop: spacing.xs,
      marginBottom: spacing.xs,
      minHeight: 28,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      borderRadius: 8,
    },
    collapsedText: {
      fontFamily: fonts.medium,
      fontSize: 13,
      lineHeight: 18,
      color: colors.textSecondary,
    },
    pressed: {
      backgroundColor: colors.surfaceSoft,
    },
  });
}
