import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useTheme } from "../context/ThemeContext";
import { useI18n, type Translate } from "../i18n";
import { MAX_PROMPT_IMAGES } from "@mots/protocol";
import type { AttachedImage } from "../attachments";
import {
  ArrowUpIcon,
  BookmarkIcon,
  ClockIcon,
  CloseIcon,
  ImageIcon,
  PlusIcon,
  SearchIcon,
} from "./Icon";
import { fonts, hit, radius, shadows, spacing, type as typeScale, type ThemeColors } from "../theme";

type Props = {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onSend: () => void;
  readonly disabled: boolean;
  readonly sending: boolean;
  readonly hint?: string;
  readonly attachments: readonly AttachedImage[];
  readonly onAttach: () => void;
  readonly onRemoveAttachment: (index: number) => void;
  /** False while the composer edits a message, which cannot carry new pictures. */
  readonly canAttach: boolean;
};

const ACTION_SIZE = 40;
/** One line of text, as tall as the buttons beside it. */
const INPUT_MIN_HEIGHT = ACTION_SIZE;
const TARGET_INSET = (hit - ACTION_SIZE) / 2;
const FIELD_PADDING = 6;
/**
 * Corner radius of the field. A capsule (`radius.composer`) curves in at the bottom ends once the
 * field grows, and the buttons, which sit at the bottom, poke out of it. This radius keeps the
 * one-line look and holds the buttons inside the corner when the field grows.
 */
const FIELD_RADIUS = (ACTION_SIZE + FIELD_PADDING * 2) / 2;

/** The quick actions insert a prefix the person completes; the prefix is in the app language. */
function quickActions(t: Translate) {
  return [
    {
      label: t("composer.routine"),
      prefix: t("composer.routinePrefix"),
      icon: (color: string) => <ClockIcon size={15} color={color} />,
    },
    {
      label: t("composer.remember"),
      prefix: t("composer.rememberPrefix"),
      icon: (color: string) => <BookmarkIcon size={15} color={color} />,
    },
    {
      label: t("composer.search"),
      prefix: t("composer.searchPrefix"),
      icon: (color: string) => <SearchIcon size={15} color={color} />,
    },
  ];
}

export function Composer({
  value,
  onChange,
  onSend,
  disabled,
  sending,
  hint,
  attachments,
  onAttach,
  onRemoveAttachment,
  canAttach,
}: Props) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const actions = useMemo(() => quickActions(t), [t]);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [inputHeight, setInputHeight] = useState<number | undefined>(undefined);
  const canSend = (value.trim().length > 0 || attachments.length > 0) && !disabled && !sending;
  const attachDisabled = disabled || !canAttach || attachments.length >= MAX_PROMPT_IMAGES;

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
          {actions.map((action) => (
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

      {attachments.length > 0 ? (
        <View style={styles.thumbs}>
          {attachments.map((image, index) => (
            <View key={`${index}-${image.uri}`} style={styles.thumb}>
              <Image source={{ uri: image.uri }} style={styles.thumbImage} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("composer.removeImage")}
                onPress={() => onRemoveAttachment(index)}
                style={({ pressed }) => [styles.thumbRemove, pressed && styles.pressed]}
              >
                <CloseIcon size={12} color={colors.textPrimary} strokeWidth={2.4} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      <View style={[styles.field, focused && styles.fieldFocused]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("composer.quickActions")}
          accessibilityState={{ expanded: toolsOpen }}
          onPress={() => setToolsOpen((open) => !open)}
          style={({ pressed }) => [styles.target, pressed && styles.pressed]}
        >
          <View style={[styles.circle, styles.circleBorder, toolsOpen && styles.circleOpen]}>
            <PlusIcon size={18} color={toolsOpen ? colors.inkOnPastel : colors.textPrimary} />
          </View>
        </Pressable>
        <TextInput
          accessibilityLabel={t("composer.message")}
          value={value}
          onChangeText={onChange}
          placeholder={t("composer.placeholder")}
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("composer.attach")}
          accessibilityState={{ disabled: attachDisabled }}
          onPress={onAttach}
          disabled={attachDisabled}
          style={({ pressed }) => [styles.target, pressed && !attachDisabled && styles.pressed]}
        >
          <View style={[styles.circle, styles.circleBorder]}>
            <ImageIcon size={18} color={attachDisabled ? colors.textSecondary : colors.textPrimary} />
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("composer.send")}
          accessibilityState={{ disabled: !canSend, busy: sending }}
          onPress={onSend}
          disabled={!canSend}
          style={({ pressed }) => [styles.target, pressed && canSend && styles.pressed]}
        >
          <View
            style={[
              styles.circle,
              { backgroundColor: canSend ? colors.action : colors.sunk },
            ]}
          >
            {sending ? (
              <ActivityIndicator color={colors.invertFg} />
            ) : (
              <ArrowUpIcon
                size={17}
                color={canSend ? colors.onAction : colors.textSecondary}
                strokeWidth={2.2}
              />
            )}
          </View>
        </Pressable>
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
    thumbs: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      paddingHorizontal: spacing.xs,
    },
    thumb: {
      width: 64,
      height: 64,
    },
    thumbImage: {
      width: 64,
      height: 64,
      borderRadius: radius.sm,
      backgroundColor: colors.sunk,
    },
    thumbRemove: {
      position: "absolute",
      top: -6,
      right: -6,
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.sunk,
      ...shadows.card,
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
      paddingHorizontal: spacing.lg,
      borderRadius: radius.pill,
      backgroundColor: colors.card,
      ...shadows.card,
    },
    toolLabel: {
      ...typeScale.label,
      color: colors.textPrimary,
    },
    // One row: actions on the sides, text in between. The buttons stay at the bottom while the
    // text grows to more lines.
    field: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: spacing.sm,
      borderRadius: FIELD_RADIUS,
      borderWidth: 1,
      borderColor: colors.fieldBorder,
      backgroundColor: colors.card,
      padding: FIELD_PADDING,
      ...shadows.card,
    },
    fieldFocused: {
      borderColor: colors.focus,
    },
    input: {
      flex: 1,
      minHeight: INPUT_MIN_HEIGHT,
      maxHeight: 160,
      paddingHorizontal: spacing.sm,
      paddingVertical: (INPUT_MIN_HEIGHT - 22) / 2,
      fontFamily: fonts.regular,
      fontSize: 16,
      lineHeight: 22,
      color: colors.textPrimary,
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
      backgroundColor: colors.sunk,
    },
    circleOpen: {
      backgroundColor: colors.sky,
    },
    pressed: {
      opacity: 0.7,
    },
  });
}
