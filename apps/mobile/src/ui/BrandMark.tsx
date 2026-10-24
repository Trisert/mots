import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { fonts, radius } from "../theme";

type Props = {
  readonly size?: number;
};

/** Typographic mark. A drawn logo is an owner decision; this stands in for one. */
export function BrandMark({ size = 40 }: Props) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.mark,
        {
          width: size,
          height: size,
          borderRadius: radius.lg,
          backgroundColor: colors.cardSurfacePrimary,
          borderColor: colors.borderSubtle,
        },
      ]}
    >
      <Text
        style={{
          fontFamily: fonts.bold,
          fontWeight: "700",
          fontSize: Math.round(size * 0.42),
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
    borderWidth: 1,
  },
});
