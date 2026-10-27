import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useEffect, useRef, useState } from "react";
import { colors, radius, spacing } from "../theme";

type CardData = {
  readonly id: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly badge?: string;
  readonly color?: string;
};

type Props = {
  readonly cards: readonly CardData[];
  readonly onCardPress?: (card: CardData) => void;
};

const CARD_COLORS = [
  colors.cardSurfacePrimary,
  colors.cardSurfaceMint,
  colors.cardSurfacePink,
  colors.cardSurfaceAmber,
];

export function StackedCardList({ cards, onCardPress }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const animations = useRef(cards.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const anims = cards.map((_, index) =>
      Animated.spring(animations[index], {
        toValue: 1,
        damping: 18,
        stiffness: 120,
        delay: index * 80,
        useNativeDriver: false,
      }),
    );
    Animated.stagger(80, anims).start();
  }, [cards, animations]);

  return (
    <View style={styles.container}>
      {cards.map((card, index) => {
        const isExpanded = expandedId === card.id;
        const bgColor = card.color ?? CARD_COLORS[index % CARD_COLORS.length];
        const anim = animations[index] ?? new Animated.Value(1);
        return (
          <Animated.View
            key={card.id}
            style={{
              opacity: anim,
              transform: [
                {
                  translateY: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [60, 0],
                  }),
                },
              ],
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={card.title}
            onPress={() => {
              setExpandedId(isExpanded ? null : card.id);
              onCardPress?.(card);
            }}
            style={[
              styles.card,
              {
                backgroundColor: bgColor,
                marginTop: index === 0 ? 0 : -24,
                zIndex: index + 1,
                borderTopLeftRadius: radius.card,
                borderTopRightRadius: radius.card,
              },
              isExpanded && styles.cardExpanded,
            ]}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{card.title}</Text>
              {card.badge ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{card.badge}</Text>
                </View>
              ) : null}
            </View>
            {card.subtitle ? (
              <Text style={styles.cardSubtitle}>{card.subtitle}</Text>
            ) : null}
            {isExpanded ? (
              <View style={styles.expandedContent}>
                <View style={styles.pillRow}>
                  <View style={styles.pill}>
                    <Text style={styles.pillText}>Active</Text>
                  </View>
                  <View style={styles.pill}>
                    <Text style={styles.pillText}>Durable Object</Text>
                  </View>
                </View>
              </View>
            ) : null}
          </Pressable>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
  },
  card: {
    borderRadius: radius.card,
    padding: spacing.xl,
    minHeight: 80,
  },
  cardExpanded: {
    minHeight: 160,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
    flex: 1,
  },
  cardSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  badge: {
    backgroundColor: colors.accentCoral,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.accentInk,
    textTransform: "uppercase",
  },
  expandedContent: {
    marginTop: spacing.md,
  },
  pillRow: {
    flexDirection: "row",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  pill: {
    backgroundColor: colors.cardSurfacePrimary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  pillText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textPrimary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
});