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
import { fonts, radius, type ThemeColors } from "../theme";

type Props = {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onSend: () => void;
  readonly disabled: boolean;
  readonly sending: boolean;
};

const QUICK_ACTIONS = [
  {
    label: "Routine",
    prefix: "Imposta una routine autonoma per ",
    icon: (color: string) => <ClockIcon size={13} color={color} />,
  },
  {
    label: "Ricorda",
    prefix: "Ricorda che ",
    icon: (color: string) => <BookmarkIcon size={13} color={color} />,
  },
  {
    label: "Cerca memoria",
    prefix: "Cosa abbiamo memorizzato su ",
    icon: (color: string) => <SearchIcon size={13} color={color} />,
  },
];

export function Composer({ value, onChange, onSend, disabled, sending }: Props) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [toolsOpen, setToolsOpen] = useState(false);
  const [inputHeight, setInputHeight] = useState<number | undefined>(undefined);
  const canSend = value.trim().length > 0 && !disabled && !sending;

  useEffect(() => {
    if (!value || value.trim().length === 0) {
      setInputHeight(undefined);
    }
  }, [value]);

  const handleToolSelect = (prefix: string) => {
    onChange(prefix);
    setToolsOpen(false);
  };

  return (
    <View style={styles.wrapper}>
      {toolsOpen ? (
        <View style={styles.quickToolsContainer}>
          <Text style={styles.quickToolsTitle}>AZIONI RAPIDE</Text>
          <View style={styles.quickToolsRow}>
            {QUICK_ACTIONS.map((action) => (
              <Pressable
                key={action.label}
                accessibilityRole="button"
                accessibilityLabel={action.label}
                onPress={() => handleToolSelect(action.prefix)}
                style={({ pressed }) => [
                  styles.quickToolChip,
                  pressed && styles.quickToolChipPressed,
                ]}
              >
                {action.icon(colors.textPrimary)}
                <Text style={styles.quickToolText}>{action.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.container}>
        <View style={styles.inputWrap}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Azioni rapide agente"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() => setToolsOpen(!toolsOpen)}
            style={({ pressed }) => [
              styles.plusButton,
              toolsOpen && styles.plusButtonActive,
              pressed && styles.plusButtonPressed,
              inputHeight && inputHeight > 36 ? { alignSelf: "flex-end", marginBottom: 3 } : null,
            ]}
          >
            <PlusIcon
              size={15}
              color={toolsOpen ? colors.accentCoral : colors.textSecondary}
              strokeWidth={2}
            />
          </Pressable>

          <TextInput
            value={value}
            onChangeText={onChange}
            placeholder="Scrivi un messaggio a Mots…"
            placeholderTextColor={colors.textSecondary}
            style={[
              styles.input,
              inputHeight ? { height: inputHeight } : null,
            ]}
            multiline
            numberOfLines={1}
            maxLength={100_000}
            selectionColor={colors.accentCoral}
            onContentSizeChange={(e) => {
              const h = Math.min(Math.max(24, Math.round(e.nativeEvent.contentSize.height)), 120);
              setInputHeight(h);
            }}
            onKeyPress={(e) => {
              const native = e.nativeEvent as unknown as { key?: string; shiftKey?: boolean };
              if (
                Platform.OS === "web" &&
                native.key === "Enter" &&
                !native.shiftKey
              ) {
                (e as any).preventDefault?.();
                if (canSend) {
                  onSend();
                }
              }
            }}
          />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Invia messaggio"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={onSend}
            disabled={!canSend}
            style={({ pressed }) => [
              styles.send,
              canSend ? styles.sendActive : styles.sendDisabled,
              pressed && canSend && styles.sendPressed,
              inputHeight && inputHeight > 36 ? { alignSelf: "flex-end", marginBottom: 3 } : null,
            ]}
          >
            {sending ? (
              <ActivityIndicator size="small" color={isDark ? "#0D0E12" : "#FFFFFF"} />
            ) : (
              <ArrowUpIcon
                size={18}
                color={
                  canSend
                    ? isDark
                      ? "#0D0E12"
                      : "#FFFFFF"
                    : isDark
                      ? "#52525B"
                      : "#9E9E98"
                }
                strokeWidth={2.4}
              />
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors, isDark: boolean) {
  return StyleSheet.create({
    wrapper: {
      backgroundColor: colors.bgMain,
    },
    quickToolsContainer: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 4,
    },
    quickToolsTitle: {
      fontFamily: fonts.semiBold,
      color: colors.textSecondary,
      fontSize: 10,
      fontWeight: "600",
      letterSpacing: 0.8,
      marginBottom: 6,
    },
    quickToolsRow: {
      flexDirection: "row",
      gap: 8,
      flexWrap: "wrap",
    },
    quickToolChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderRadius: radius.pill,
      backgroundColor: isDark ? "#1A1B22" : "#FFFFFF",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0.3 : 0.03,
      shadowRadius: 3,
      elevation: 1,
    },
    quickToolChipPressed: {
      opacity: 0.7,
    },
    quickToolText: {
      fontFamily: fonts.medium,
      color: colors.textPrimary,
      fontSize: 12.5,
    },
    container: {
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    inputWrap: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 26,
      backgroundColor: isDark ? "#1A1B22" : "#FFFFFF",
      paddingLeft: 6,
      paddingRight: 6,
      paddingVertical: 4,
      minHeight: 48,
      borderWidth: 1,
      borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.35 : 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    plusButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.04)",
    },
    plusButtonActive: {
      backgroundColor: isDark ? "rgba(45, 212, 191, 0.2)" : colors.cardSurfaceMint,
    },
    plusButtonPressed: {
      opacity: 0.7,
    },
    input: {
      fontFamily: fonts.regular,
      flex: 1,
      color: colors.textPrimary,
      fontSize: 15,
      lineHeight: 20,
      maxHeight: 120,
      paddingHorizontal: 10,
      paddingVertical: 6,
      ...Platform.select({
        web: {
          outlineStyle: "none",
          outlineWidth: 0,
          minHeight: 22,
          resize: "none",
        } as any,
        android: {
          textAlignVertical: "center",
        },
        default: {},
      }),
    },
    send: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
    },
    sendActive: {
      backgroundColor: isDark ? "#F5F5F7" : "#1C1B1A",
    },
    sendDisabled: {
      backgroundColor: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.06)",
    },
    sendPressed: {
      opacity: 0.85,
    },
  });
}
