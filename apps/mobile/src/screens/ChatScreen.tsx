import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { TranscriptEntry } from "@mots/client";
import { Composer } from "../components/Composer";
import { MessageBubble } from "../components/MessageBubble";
import { SessionSheet } from "../components/SessionSheet";
import { useMotsSession } from "../hooks/useMotsSession";
import { colors, radius, spacing } from "../theme";
import type { Identity } from "../storage";

const TOOL_LABELS: Record<string, string> = {
  remember: "memoria",
  forget: "memoria",
  schedule: "promemoria",
  search_history: "ricerca",
};

const SUGGESTIONS = [
  "Ricordami di bere acqua tra 20 minuti",
  "Cosa abbiamo detto ieri?",
  "Ricorda che amo il caffè amaro",
];

type Props = {
  readonly identity: Identity;
  readonly onLeave: () => void;
};

export function ChatScreen({ identity, onLeave }: Props) {
  const insets = useSafeAreaInsets();
  const { client, state } = useMotsSession({
    baseUrl: identity.apiUrl,
    sessionId: identity.sessionId,
    username: identity.username,
  });
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const listRef = useRef<FlatList<TranscriptEntry>>(null);
  const stickToBottom = useRef(true);

  const activeConversationId = state.activeConversationId;
  const active =
    activeConversationId === undefined
      ? undefined
      : state.snapshots[activeConversationId];
  const entries = active?.entries ?? [];
  const conversations = state.conversations.filter(
    (conversation) => conversation.owner === undefined,
  );
  const liveText = active?.live?.text ?? "";
  const liveActive = active?.live?.active === true;
  const runningTools = (active?.tools ?? []).filter(
    (tool) => tool.status !== "done",
  );
  const typingOthers = (active?.typing ?? []).filter(
    (name) => name !== identity.username,
  );
  const connected = state.status === "connected";
  const canWrite = connected && activeConversationId !== undefined;

  const send = useCallback(async () => {
    if (activeConversationId === undefined) return;
    const text = input.trim();
    if (text.length === 0) return;
    setSending(true);
    try {
      const accepted = await client.submitPrompt(activeConversationId, text);
      if (accepted) {
        setInput("");
        client.setTyping(activeConversationId, false);
      }
    } catch (error) {
      Alert.alert(
        "Invio non riuscito",
        error instanceof Error ? error.message : "Riprova tra poco.",
      );
    } finally {
      setSending(false);
    }
  }, [activeConversationId, client, input]);

  useEffect(() => {
    if (activeConversationId === undefined) return;
    if (!connected) return;
    if (input.length === 0) {
      client.setTyping(activeConversationId, false);
      return;
    }
    client.setTyping(activeConversationId, true);
    const timer = setTimeout(() => {
      client.setTyping(activeConversationId, false);
    }, 2500);
    return () => clearTimeout(timer);
  }, [activeConversationId, client, connected, input]);

  useEffect(() => {
    stickToBottom.current = true;
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: false });
    });
  }, [activeConversationId]);

  useEffect(() => {
    if (!stickToBottom.current) return;
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, [entries.length, liveText, runningTools.length]);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distance =
      contentSize.height - (contentOffset.y + layoutMeasurement.height);
    stickToBottom.current = distance < 140;
  };

  const share = useCallback(() => {
    void Share.share({
      message: `Entra su Mots\nCodice: ${identity.sessionId}\nServer: ${identity.apiUrl}`,
    });
  }, [identity.apiUrl, identity.sessionId]);

  const leave = useCallback(() => {
    Alert.alert(
      "Uscire da Mots?",
      "La conversazione resta sul server. Potrai rientrare con lo stesso codice.",
      [
        { text: "Annulla", style: "cancel" },
        {
          text: "Esci",
          style: "destructive",
          onPress: () => {
            setSheetOpen(false);
            onLeave();
          },
        },
      ],
    );
  }, [onLeave]);

  const fork = useCallback(
    (entry: TranscriptEntry) => {
      Alert.alert(
        "Nuova diramazione",
        "Apro una nuova chat che parte da questo messaggio.",
        [
          { text: "Annulla", style: "cancel" },
          {
            text: "Dirama",
            onPress: () => {
              client.forkConversation(entry.conversationId, entry.id);
              setSheetOpen(false);
            },
          },
        ],
      );
    },
    [client],
  );

  const footer = (
    <View style={styles.footer}>
      {typingOthers.length > 0 ? (
        <Text style={styles.typing}>
          {typingOthers.join(", ")} sta scrivendo…
        </Text>
      ) : null}

      {runningTools.map((tool) => (
        <View key={tool.callId} style={styles.progress}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={styles.progressText}>
            {TOOL_LABELS[tool.name] ?? tool.name}…
          </Text>
        </View>
      ))}

      {liveActive ? (
        <View style={styles.liveRow}>
          <View style={styles.liveBubble}>
            {liveText.length > 0 ? (
              <Text style={styles.liveText}>{liveText}</Text>
            ) : (
              <View style={styles.thinking}>
                <ActivityIndicator size="small" color={colors.accent} />
                <Text style={styles.thinkingText}>Sto pensando…</Text>
              </View>
            )}
            {active?.live?.retry !== undefined ? (
              <Text style={styles.retryText}>
                Riprovo: {active.live.retry.error}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}

      {(active?.queued ?? []).map((queued) => (
        <View key={queued.submissionId} style={styles.queued}>
          <Text style={styles.queuedLabel}>
            {queued.mode === "steer" ? "IN ATTESA" : "IN CODA"}
          </Text>
          <Text style={styles.queuedText} numberOfLines={2}>
            {queued.text}
          </Text>
        </View>
      ))}

      {active?.failure !== undefined ? (
        <View style={styles.failure}>
          <Text style={styles.failureText}>{active.failure.message}</Text>
        </View>
      ) : null}

      {active?.runError !== undefined ? (
        <View style={styles.failure}>
          <Text style={styles.failureText}>{active.runError}</Text>
        </View>
      ) : null}
    </View>
  );

  const empty =
    activeConversationId === undefined ? (
      <View style={styles.connecting}>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.connectingText}>Connessione a Mots…</Text>
      </View>
    ) : (
      <View style={styles.empty}>
        <Text style={styles.emptyEyebrow}>IL TUO COMPAGNO</Text>
        <Text style={styles.emptyTitle}>Ciao, sono Mots.</Text>
        <Text style={styles.emptyBody}>
          Posso ricordare ciò che conta, cercare nelle nostre chat e farti
          tornare indietro quando serve.
        </Text>
        <View style={styles.suggestions}>
          {SUGGESTIONS.map((suggestion) => (
            <Pressable
              key={suggestion}
              onPress={() => setInput(suggestion)}
              style={({ pressed }) => [
                styles.suggestion,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.suggestionText}>{suggestion}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    );

  const statusColor =
    state.status === "connected"
      ? colors.success
      : state.status === "failed"
        ? colors.danger
        : colors.accent;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Apri le chat"
          onPress={() => setSheetOpen(true)}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <Text style={styles.iconText}>≡</Text>
        </Pressable>

        <View style={styles.brand}>
          <Text style={styles.wordmark}>mots</Text>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Nuova chat"
          disabled={!connected}
          onPress={() => client.createConversation()}
          style={({ pressed }) => [
            styles.iconButton,
            !connected && styles.iconButtonDisabled,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.iconText}>＋</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <FlatList
          ref={listRef}
          data={entries}
          keyExtractor={(entry) => String(entry.id)}
          renderItem={({ item }) => <MessageBubble entry={item} onFork={fork} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={empty}
          ListFooterComponent={footer}
          onScroll={onScroll}
          scrollEventThrottle={100}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        />

        <View style={[styles.bottom, { paddingBottom: insets.bottom + spacing.xs }]}>
          {state.status === "connecting" && activeConversationId !== undefined ? (
            <View style={styles.banner}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={styles.bannerText}>Riconnessione…</Text>
            </View>
          ) : null}

          {state.status === "failed" ? (
            <View style={[styles.banner, styles.bannerDanger]}>
              <Text style={[styles.bannerText, styles.bannerDangerText]}>
                Connessione interrotta. Riapri Mots o controlla il server.
              </Text>
            </View>
          ) : null}

          {state.error !== undefined ? (
            <Pressable
              onPress={() => client.clearError()}
              style={[styles.banner, styles.bannerDanger]}
            >
              <Text style={[styles.bannerText, styles.bannerDangerText]}>
                {state.error} · tocca per chiudere
              </Text>
            </Pressable>
          ) : null}

          <Composer
            value={input}
            onChange={setInput}
            onSend={() => void send()}
            disabled={!canWrite}
            sending={sending}
          />
        </View>
      </KeyboardAvoidingView>

      <SessionSheet
        visible={sheetOpen}
        conversations={conversations}
        activeConversationId={activeConversationId}
        sessionId={identity.sessionId}
        onClose={() => setSheetOpen(false)}
        onSelect={(conversationId: number) => {
          client.openConversation(conversationId);
          setSheetOpen(false);
        }}
        onCreate={() => {
          client.createConversation();
          setSheetOpen(false);
        }}
        onShare={share}
        onLeave={leave}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  iconButtonDisabled: {
    opacity: 0.35,
  },
  iconText: {
    color: colors.text,
    fontSize: 21,
    lineHeight: 24,
  },
  brand: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.xs,
  },
  wordmark: {
    color: colors.text,
    fontSize: 23,
    fontWeight: "700",
    letterSpacing: -1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: radius.pill,
    marginBottom: 6,
  },
  list: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  footer: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  empty: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xxl,
  },
  emptyEyebrow: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: -1,
  },
  emptyBody: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 24,
    marginTop: spacing.md,
    maxWidth: 320,
  },
  suggestions: {
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  suggestion: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  suggestionText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  connecting: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    paddingTop: spacing.xxl,
  },
  connectingText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  typing: {
    color: colors.textFaint,
    fontSize: 12,
    fontStyle: "italic",
  },
  progress: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  progressText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  liveRow: {
    alignItems: "flex-start",
  },
  liveBubble: {
    maxWidth: "88%",
    borderRadius: radius.lg,
    borderBottomLeftRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  liveText: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 23,
  },
  thinking: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  thinkingText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  retryText: {
    color: colors.danger,
    fontSize: 11,
    marginTop: spacing.xs,
  },
  queued: {
    alignSelf: "flex-end",
    maxWidth: "88%",
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  queuedLabel: {
    color: colors.accent,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  queuedText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  failure: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
    padding: spacing.md,
  },
  failureText: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 18,
  },
  bottom: {
    backgroundColor: colors.background,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  bannerDanger: {
    backgroundColor: colors.dangerSoft,
  },
  bannerText: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 12,
  },
  bannerDangerText: {
    color: colors.danger,
  },
  pressed: {
    opacity: 0.7,
  },
});
