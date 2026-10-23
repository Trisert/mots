import { StyleSheet, View } from "react-native";
import { colors } from "../theme";

type Props = {
  readonly size?: number;
  readonly color?: string;
  readonly backgroundColor?: string;
};

/**
 * A 4-point sparkle/star drawn with pure Views.
 * Uses a rotated square with 4 circles at the corners masking into a diamond shape.
 */
export function SparkleView({
  size = 48,
  color = colors.starHighlight,
  backgroundColor = colors.accentCoral,
}: Props) {
  const circleSize = size * 0.55;
  const offset = -circleSize / 2;
  return (
    <View
      style={[
        styles.container,
        { width: size, height: size, backgroundColor: color, transform: [{ rotate: "45deg" }] },
      ]}
    >
      <View
        style={[
          styles.cornerCircle,
          {
            width: circleSize,
            height: circleSize,
            borderRadius: circleSize / 2,
            backgroundColor,
            top: offset,
            left: offset,
          },
        ]}
      />
      <View
        style={[
          styles.cornerCircle,
          {
            width: circleSize,
            height: circleSize,
            borderRadius: circleSize / 2,
            backgroundColor,
            top: offset,
            right: offset,
          },
        ]}
      />
      <View
        style={[
          styles.cornerCircle,
          {
            width: circleSize,
            height: circleSize,
            borderRadius: circleSize / 2,
            backgroundColor,
            bottom: offset,
            left: offset,
          },
        ]}
      />
      <View
        style={[
          styles.cornerCircle,
          {
            width: circleSize,
            height: circleSize,
            borderRadius: circleSize / 2,
            backgroundColor,
            bottom: offset,
            right: offset,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    overflow: "hidden",
  },
  cornerCircle: {
    position: "absolute",
  },
});