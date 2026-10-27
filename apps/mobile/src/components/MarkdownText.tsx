import { useMemo, useState } from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useTheme } from "../context/ThemeContext";
import { announceNow } from "../a11y";
import { CheckIcon, CopyIcon } from "./Icon";
import { parseMarkdownBlocks, type InlineRun } from "../markdown";
import { fonts, radius, spacing, type ThemeColors } from "../theme";

type Props = {
  readonly text: string;
  readonly style?: StyleProp<TextStyle>;
  readonly selectable?: boolean;
};

function InlineText({
  runs,
  style,
  selectable,
  styles,
}: {
  readonly runs: readonly InlineRun[];
  readonly style?: StyleProp<TextStyle>;
  readonly selectable?: boolean;
  readonly styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Text style={[styles.inlineBase, style]} selectable={selectable}>
      {runs.map((run, index) =>
        run.href !== undefined ? (
          <Text
            key={index}
            accessibilityRole="link"
            accessibilityLabel={run.text}
            accessibilityHint="Apre il link nel browser"
            style={[styles.link, run.bold && styles.bold, run.italic && styles.italic]}
            onPress={() => openLink(run.href ?? "")}
          >
            {run.text}
          </Text>
        ) : (
          <Text
            key={index}
            style={[
              run.bold && styles.bold,
              run.italic && styles.italic,
              run.code && styles.inlineCode,
            ]}
          >
            {run.text}
          </Text>
        ),
      )}
    </Text>
  );
}

function openLink(href: string): void {
  if (!/^https?:\/\//i.test(href)) return;
  void Linking.openURL(href).catch(() => undefined);
}

function CodeBlockView({
  code,
  language,
  styles,
  colors,
}: {
  readonly code: string;
  readonly language: string;
  readonly styles: ReturnType<typeof createStyles>;
  readonly colors: ThemeColors;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await Clipboard.setStringAsync(code);
      setCopied(true);
      announceNow("Codice copiato");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const label = language.length > 0 ? language.toUpperCase() : "CODE";

  return (
    <View style={styles.codeBlock}>
      <View style={styles.codeHeader}>
        <Text style={styles.codeLanguage}>{label}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copied ? "Codice copiato" : "Copia codice"}
          hitSlop={8}
          onPress={() => void copy()}
          style={({ pressed }) => [
            styles.copyButton,
            pressed && styles.copyButtonPressed,
          ]}
        >
          {copied ? (
            <>
              <CheckIcon size={12} color={colors.onInverse} />
              <Text style={[styles.copyButtonText, styles.copiedText]}>Copiato!</Text>
            </>
          ) : (
            <>
              <CopyIcon size={12} color={colors.codeMuted} />
              <Text style={styles.copyButtonText}>Copia</Text>
            </>
          )}
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.codeScroll}
      >
        <Text style={styles.codeText} selectable>
          {code}
        </Text>
      </ScrollView>
    </View>
  );
}

export function MarkdownText({ text, style, selectable = true }: Props) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const blocks = parseMarkdownBlocks(text);

  return (
    <View style={styles.container}>
      {blocks.map((block, index) => {
        if (block.type === "code") {
          return (
            <CodeBlockView
              key={index}
              code={block.code}
              language={block.language}
              styles={styles}
              colors={colors}
            />
          );
        }

        if (block.type === "heading") {
          const headingStyle =
            block.level === 1
              ? styles.h1
              : block.level === 2
                ? styles.h2
                : styles.h3;
          return (
            <Text
              key={index}
              style={[headingStyle, style]}
              selectable={selectable}
            >
              {block.text}
            </Text>
          );
        }

        if (block.type === "quote") {
          return (
            <View key={index} style={styles.quoteCard}>
              <View style={styles.quoteBar} />
              <View style={styles.quoteBody}>
                <InlineText
                  runs={block.runs}
                  style={[styles.quoteText, style]}
                  selectable={selectable}
                  styles={styles}
                />
              </View>
            </View>
          );
        }

        if (block.type === "list") {
          return (
            <View key={index} style={styles.list}>
              {block.items.map((item, itemIndex) => {
                const bullet =
                  item.number !== undefined
                    ? `${item.number}.`
                    : "•";
                return (
                  <View key={itemIndex} style={styles.listItem}>
                    <Text style={styles.listBullet}>{bullet}</Text>
                    <View style={styles.listItemContent}>
                      <InlineText
                        runs={item.runs}
                        style={[styles.paragraph, style]}
                        selectable={selectable}
                        styles={styles}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          );
        }

        return (
          <Text
            key={index}
            style={[styles.paragraph, index > 0 && styles.paragraphGap, style]}
            selectable={selectable}
          >
            <InlineText
              runs={block.runs}
              style={style}
              selectable={selectable}
              styles={styles}
            />
          </Text>
        );
      })}
    </View>
  );
}

function createStyles(colors: ThemeColors, isDark: boolean) {
  return StyleSheet.create({
    container: {
      gap: 2,
    },
    inlineBase: {
      fontFamily: fonts.medium,
      color: colors.textPrimary,
      fontSize: 15,
      lineHeight: 22,
    },
    paragraph: {
      fontFamily: fonts.medium,
      color: colors.textPrimary,
      fontSize: 15,
      lineHeight: 22,
    },
    paragraphGap: {
      marginTop: spacing.xs,
    },
    bold: {
      fontFamily: fonts.bold,
      fontWeight: "700",
    },
    italic: {
      fontStyle: "italic",
    },
    link: {
      color: colors.link,
      textDecorationLine: "underline",
    },
    inlineCode: {
      fontFamily: "monospace",
      backgroundColor: colors.surfaceSoft,
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 1,
      color: colors.textPrimary,
      fontSize: 13,
    },
    h1: {
      fontFamily: fonts.extraBold,
      color: colors.textPrimary,
      fontSize: 22,
      fontWeight: "800",
      letterSpacing: -0.6,
      marginTop: spacing.sm,
      marginBottom: spacing.xs,
    },
    h2: {
      fontFamily: fonts.bold,
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: "700",
      letterSpacing: -0.4,
      marginTop: spacing.xs,
      marginBottom: spacing.xs,
    },
    h3: {
      fontFamily: fonts.semiBold,
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: "600",
      marginTop: spacing.xs,
      marginBottom: 2,
    },
    quoteCard: {
      flexDirection: "row",
      backgroundColor: colors.surfaceSoft,
      borderRadius: radius.md,
      overflow: "hidden",
      marginVertical: spacing.xs,
    },
    quoteBar: {
      width: 4,
      backgroundColor: colors.accent,
    },
    quoteBody: {
      flex: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    quoteText: {
      fontFamily: fonts.medium,
      fontStyle: "italic",
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 21,
    },
    list: {
      marginVertical: spacing.xs,
      gap: spacing.xs,
    },
    listItem: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.sm,
    },
    listBullet: {
      fontFamily: fonts.bold,
      color: colors.accent,
      fontSize: 15,
      fontWeight: "700",
      lineHeight: 22,
      width: 16,
    },
    listItemContent: {
      flex: 1,
    },
    codeBlock: {
      backgroundColor: colors.codeSurface,
      borderRadius: radius.md,
      overflow: "hidden",
      marginVertical: spacing.sm,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
    },
    codeHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.codeSurfaceHeader,
      paddingHorizontal: spacing.md,
      paddingVertical: 7,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSubtle,
    },
    codeLanguage: {
      fontFamily: fonts.bold,
      color: colors.codeMuted,
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.6,
    },
    copyButton: {
      minWidth: 44,
      minHeight: 32,
      justifyContent: "center",
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: radius.xs,
      backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(255, 255, 255, 0.06)",
    },
    copyButtonPressed: {
      opacity: 0.7,
    },
    copyButtonText: {
      fontFamily: fonts.semiBold,
      color: colors.codeMuted,
      fontSize: 11,
      fontWeight: "600",
    },
    copiedText: {
      color: colors.onInverse,
    },
    codeScroll: {
      padding: spacing.md,
    },
    codeText: {
      fontFamily: "monospace",
      color: colors.codeText,
      fontSize: 13,
      lineHeight: 20,
    },
  });
}
