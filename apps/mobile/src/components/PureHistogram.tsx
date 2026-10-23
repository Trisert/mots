import { StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "../theme";

type BarData = {
  readonly label: string;
  readonly value: number;
  readonly isPeak?: boolean;
};

type Props = {
  readonly bars: readonly BarData[];
  readonly maxValue?: number;
  readonly height?: number;
};

export function PureHistogram({ bars, maxValue, height = 120 }: Props) {
  const max = maxValue ?? Math.max(...bars.map((b) => b.value), 1);

  return (
    <View style={[styles.container, { height }]}>
      {bars.map((bar, index) => {
        const barHeight = max > 0 ? (bar.value / max) * (height - 20) : 0;
        return (
          <View key={index} style={styles.barColumn}>
            <View
              style={[
                styles.bar,
                {
                  height: Math.max(barHeight, 2),
                  backgroundColor: bar.isPeak
                    ? colors.accentCoral
                    : colors.textPrimary,
                },
              ]}
            />
            <Text style={styles.barLabel}>{bar.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 4,
  },
  barColumn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  bar: {
    width: "100%",
    borderRadius: 4,
    minHeight: 2,
  },
  barLabel: {
    fontSize: 9,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: "center",
  },
});