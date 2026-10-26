import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme";

type Props = {
  readonly size?: number;
};

/**
 * Circled serif M: a hairline ring around an Instrument Serif capital. Typographic stand-in
 * until the owner draws a logo. Never set it below 32px.
 */
export function BrandMark({ size = 40 }: Props) {
  const { colors } = useTheme();
  const side = Math.max(32, size);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.mark,
        {
          width: side,
          height: side,
          borderRadius: side / 2,
          borderColor: colors.rule,
          borderWidth: side >= 48 ? 2 : 1.5,
        },
      ]}
    >
      <Text
        style={{
          fontFamily: fonts.serif,
          fontSize: Math.round(side * 0.62),
          lineHeight: Math.round(side * 0.7),
          marginTop: Math.round(side * 0.06),
          color: colors.textPrimary,
          letterSpacing: -0.5,
        }}
      >
        M
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    alignItems: "center",
    justifyContent: "center",
  },
});
