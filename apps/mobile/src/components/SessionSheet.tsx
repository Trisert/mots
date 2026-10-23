import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ROOT_CONVERSATION_ID, type ConversationSummary } from "@mots/protocol";
import { ChevronRightIcon, CloseIcon, PlusIcon } from "./Icon";
import { colors, radius, spacing } from "../theme";

type Props = {
  readonly visible: boolean;
  readonly conversations: readonly ConversationSummary[];
  readonly activeConversationId: number | undefined;
  readonly sessionId: string;
  readonly onClose: () => void;
  readonly onSelect: (conversationId: number) => void;
  readonly onCreate: () => void;
  readonly onShare: () => void;
  readonly onLeave: () => void;
};

function conversationName(conversation: ConversationSummary, index: number): string {
  if (conversation.id === ROOT_CONVERSATION_ID) return "Chat principale";
  return `Chat ${index + 1}`;
}

export function SessionSheet({
  visible,
  conversations,
  activeConversationId,
  sessionId,
  onClose,
  onSelect,
  onCreate,
  onShare,
  onLeave,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Le tue chat</Text>
            <Text style={styles.code}>Codice {sessionId.slice(0, 8)}…</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Chiudi"
            onPress={onClose}
            style={styles.close}
          >
            <CloseIcon size={14} color={colors.textMuted} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {conversations.map((conversation, index) => {
            const active = conversation.id === activeConversationId;
            return (
              <Pressable
                key={conversation.id}
                onPress={() => onSelect(conversation.id)}
                style={({ pressed }) => [
                  styles.item,
                  active && styles.itemActive,
                  pressed && styles.itemPressed,
                ]}
              >
                <View style={[styles.dot, active && styles.dotActive]} />
                <Text style={[styles.itemText, active && styles.itemTextActive]}>
                  {conversationName(conversation, index)}
                </Text>
                <ChevronRightIcon size={14} color={colors.textFaint} />
              </Pressable>
            );
          })}
        </ScrollView>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Nuova chat"
          onPress={onCreate}
          style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
        >
          <PlusIcon size={16} color={colors.accentInk} />
          <Text style={styles.primaryText}>Nuova chat</Text>
        </Pressable>

        <View style={styles.secondaryRow}>
          <Pressable
            onPress={onShare}
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryText}>Condividi</Text>
          </Pressable>
          <Pressable
            onPress={onLeave}
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
          >
            <Text style={[styles.secondaryText, styles.leaveText]}>Esci</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.overlay,
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "82%",
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.surfaceSoft,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  handle: {
    alignSelf: "center",
    width: 38,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.borderStrong,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 21,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  code: {
    color: colors.textFaint,
    fontSize: 12,
    marginTop: 2,
  },
  close: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceRaised,
  },
  list: {
    maxHeight: 320,
  },
  listContent: {
    gap: spacing.xs,
    paddingBottom: spacing.sm,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 44,
    borderRadius: radius.md,
  },
  itemActive: {
    backgroundColor: colors.surfaceRaised,
  },
  itemPressed: {
    opacity: 0.7,
  },
  itemText: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 16,
  },
  itemTextActive: {
    color: colors.text,
    fontWeight: "600",
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.borderStrong,
  },
  dotActive: {
    backgroundColor: colors.accent,
  },
  primary: {
    marginTop: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    minHeight: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
  },
  primaryText: {
    color: colors.accentInk,
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  secondary: {
    flex: 1,
    alignItems: "center",
    borderRadius: radius.lg,
    backgroundColor: colors.cardSurfacePrimary,
    paddingVertical: spacing.md,
  },
  secondaryText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "600",
  },
  leaveText: {
    color: colors.danger,
  },
  pressed: {
    opacity: 0.72,
  },
});
