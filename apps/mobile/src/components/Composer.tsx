import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useTheme } from "../context/ThemeContext";
import { ArrowUpIcon, BookmarkIcon, ClockIcon, PlusIcon, SearchIcon } from "./Icon";
import { fonts, hit, radius, spacing, type as typeScale, type ThemeColors } from "../theme";

type Props = {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onSend: () => void;
  readonly disabled: boolean;
  readonly sending: boolean;
  readonly hint?: string;
};

/** One line of text plus its vertical padding: the same height as the round buttons beside it. */
const INPUT_MIN_HEIGHT = hit;

const QUICK_ACTIONS = [
  {
    label: "Routine",
    prefix: "Imposta una routine per ",
    icon: (color: string) => <ClockIcon size={15} color={color} />,
  },
  {
    label: "Ricorda",
    prefix: "Ricorda che ",
    icon: (color: string) => <BookmarkIcon size={15} color={color} />,
  },
  {
    label: "Cerca",
    prefix: "Cosa abbiamo detto su ",
    icon: (color: string) => <SearchIcon size={15} color={color} />,
  },
];

export function Composer({ value, onChange, onSend, disabled, sending, hint }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [inputHeight, setInputHeight] = useState<number | undefined>(undefined);
  const canSend = value.trim().length > 0 && !disabled && !sending;

  useEffect(() => {
    if (value.trim().length === 0) setInputHeight(undefined);
  }, [value]);

  return (
    <View style={styles.wrapper}>
      {hint !== undefined ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
      {toolsOpen ? (
        <View style={styles.tools}>
          {QUICK_ACTIONS.map((action) => (
            <Pressable
              key={action.label}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              onPress={() => {
                onChange(action.prefix);
                setToolsOpen(false);
              }}
              style={({ pressed }) => [styles.tool, pressed && styles.pressed]}
            >
              {action.icon(colors.textPrimary)}
              <Text style={styles.toolLabel}>{action.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View
        style={[
          styles.field,
          { borderColor: focused ? colors.rule : colors.borderMedium },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Azioni rapide"
          accessibilityState={{ expanded: toolsOpen }}
          onPress={() => setToolsOpen((open) => !open)}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <PlusIcon size={18} color={toolsOpen ? colors.textPrimary : colors.textSecondary} />
        </Pressable>
        <TextInput
          accessibilityLabel="Messaggio"
          value={value}
          onChangeText={onChange}
          placeholder="Scrivi a Mots"
          placeholderTextColor={colors.textFaint}
          style={[styles.input, inputHeight !== undefined ? { height: inputHeight } : null]}
          multiline
          // React Native Web renders a two-row textarea by default; start at one line and grow.
          numberOfLines={1}
          maxLength={100_000}
          selectionColor={colors.textPrimary}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onContentSizeChange={(event) => {
            const next = Math.min(Math.max(INPUT_MIN_HEIGHT, Math.round(event.nativeEvent.contentSize.height)), 140);
            setInputHeight(next);
          }}
          onKeyPress={(event) => {
            if (Platform.OS !== "web") return;
            const native = event.nativeEvent;
            const shift = "shiftKey" in native && native.shiftKey === true;
            if (native.key !== "Enter" || shift) return;
            if ("preventDefault" in event && typeof event.preventDefault === "function") {
              event.preventDefault();
            }
            if (canSend) onSend();
          }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Invia messaggio"
          accessibilityState={{ disabled: !canSend, busy: sending }}
          onPress={onSend}
          disabled={!canSend}
          style={({ pressed }) => [
            styles.send,
            canSend
              ? { backgroundColor: colors.invertBg, borderColor: colors.invertBg }
              : { backgroundColor: "transparent", borderColor: colors.borderMedium },
            pressed && canSend && styles.pressed,
          ]}
        >
          {sending ? (
            <ActivityIndicator color={colors.textPrimary} />
          ) : (
            <ArrowUpIcon
              size={18}
              color={canSend ? colors.invertFg : colors.textFaint}
              strokeWidth={2}
            />
          )}
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrapper: {
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.sm,
      backgroundColor: colors.bgMain,
    },
    hint: {
      ...typeScale.small,
      color: colors.textSecondary,
      paddingHorizontal: spacing.xs,
    },
    tools: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    tool: {
      minHeight: 36,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.rule,
    },
    toolLabel: {
      ...typeScale.label,
      color: colors.textPrimary,
    },
    field: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: spacing.xs,
      borderRadius: radius.card,
      borderWidth: 1,
      backgroundColor: "transparent",
      padding: spacing.xs,
    },
    iconButton: {
      width: hit,
      height: hit,
      borderRadius: hit / 2,
      alignItems: "center",
      justifyContent: "center",
    },
    input: {
      flex: 1,
      minHeight: INPUT_MIN_HEIGHT,
      maxHeight: 140,
      paddingHorizontal: spacing.xs,
      paddingVertical: (INPUT_MIN_HEIGHT - 22) / 2,
      fontFamily: fonts.regular,
      fontSize: 16,
      lineHeight: 22,
      color: colors.textPrimary,
    },
    send: {
      width: hit,
      height: hit,
      borderRadius: hit / 2,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    pressed: {
      opacity: 0.75,
    },
  });
}
