import { StyleSheet, Text, View, type StyleProp, type TextStyle } from "react-native";
import { colors } from "../theme";
import { parseInline } from "../markdown";

type Props = {
  readonly text: string;
  readonly style?: StyleProp<TextStyle>;
  readonly selectable?: boolean;
};

/** Renders the assistant's text, with markdown runs styled and paragraphs kept apart. */
export function MarkdownText({ text, style, selectable }: Props) {
  const paragraphs = text.split(/\n{2,}/);
  return (
    <>
      {paragraphs.map((paragraph, index) => (
        <Text
          key={index}
          style={[styles.paragraph, index > 0 && styles.paragraphGap, style]}
          selectable={selectable}
        >
          {parseInline(paragraph).map((run, runIndex) => (
            <Text
              key={runIndex}
              style={[
                run.bold && styles.bold,
                run.italic && styles.italic,
                // The code run keeps the colour of the bubble it sits in. Giving it the accent
                // colour made it invisible in the amber user bubble (accent on accent, 1:1).
                run.code && styles.code,
              ]}
            >
              {run.text}
            </Text>
          ))}
        </Text>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  paragraph: {
    lineHeight: 23,
  },
  paragraphGap: {
    marginTop: 8,
  },
  bold: {
    fontWeight: "700",
  },
  italic: {
    fontStyle: "italic",
  },
  code: {
    fontFamily: "monospace",
    backgroundColor: colors.cardSurfaceAmber,
    borderRadius: 16,
    paddingHorizontal: 6,
    paddingVertical: 2,
    color: colors.textPrimary,
    fontSize: 13,
  },
});
