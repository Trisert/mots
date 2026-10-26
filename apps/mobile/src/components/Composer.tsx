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

/** One line of text plus its vertical padding. */
const INPUT_MIN_HEIGHT = 40;
const ACTION_SIZE = 34;
const TARGET_INSET = (hit - ACTION_SIZE) / 2;

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

      <View style={[styles.field, focused && styles.fieldFocused]}>
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
            const next = Math.min(Math.max(INPUT_MIN_HEIGHT, Math.round(event.nativeEvent.contentSize.height)), 160);
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
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Azioni rapide"
            accessibilityState={{ expanded: toolsOpen }}
            onPress={() => setToolsOpen((open) => !open)}
            style={({ pressed }) => [styles.target, pressed && styles.pressed]}
          >
            <View style={[styles.circle, styles.circleBorder, toolsOpen && styles.circleOpen]}>
              <PlusIcon size={18} color={colors.textPrimary} />
            </View>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Invia messaggio"
            accessibilityState={{ disabled: !canSend, busy: sending }}
            onPress={onSend}
            disabled={!canSend}
            style={({ pressed }) => [styles.target, pressed && canSend && styles.pressed]}
          >
            <View
              style={[
                styles.circle,
                { backgroundColor: canSend ? colors.invertBg : colors.surfaceSoft },
              ]}
            >
              {sending ? (
                <ActivityIndicator color={colors.invertFg} />
              ) : (
                <ArrowUpIcon
                  size={17}
                  color={canSend ? colors.invertFg : colors.textFaint}
                  strokeWidth={2.2}
                />
              )}
            </View>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrapper: {
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.xs,
      paddingBottom: spacing.xs,
      backgroundColor: colors.bgMain,
    },
    hint: {
      ...typeScale.small,
      color: colors.textSecondary,
      paddingHorizontal: spacing.sm,
    },
    tools: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      paddingHorizontal: spacing.xs,
    },
    tool: {
      minHeight: hit,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.pill,
      backgroundColor: colors.field,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.fieldBorder,
    },
    toolLabel: {
      ...typeScale.label,
      color: colors.textPrimary,
    },
    field: {
      borderRadius: radius.composer,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.fieldBorder,
      backgroundColor: colors.field,
      paddingTop: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingBottom: spacing.sm,
    },
    fieldFocused: {
      borderColor: colors.borderMedium,
    },
    input: {
      minHeight: INPUT_MIN_HEIGHT,
      maxHeight: 160,
      paddingHorizontal: spacing.sm,
      paddingVertical: (INPUT_MIN_HEIGHT - 22) / 2,
      fontFamily: fonts.regular,
      fontSize: 16,
      lineHeight: 22,
      color: colors.textPrimary,
    },
    actions: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    // 44px touch target on every platform (hitSlop is ignored on web). The
    // negative margin pulls it back so the visible 34px circle stays where it was.
    target: {
      width: hit,
      height: hit,
      margin: -TARGET_INSET,
      alignItems: "center",
      justifyContent: "center",
    },
    circle: {
      width: ACTION_SIZE,
      height: ACTION_SIZE,
      borderRadius: ACTION_SIZE / 2,
      alignItems: "center",
      justifyContent: "center",
    },
    circleBorder: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.fieldBorder,
    },
    circleOpen: {
      backgroundColor: colors.surfaceSoft,
    },
    pressed: {
      opacity: 0.7,
    },
  });
}
