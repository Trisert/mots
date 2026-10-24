import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Pressable,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAvoidingView, useKeyboardState } from "react-native-keyboard-controller";
import type { TranscriptEntry } from "@mots/client";
import { useTheme } from "../context/ThemeContext";
import { Composer } from "../components/Composer";
import { MenuIcon } from "../components/Icon";
import { MarkdownText } from "../components/MarkdownText";
import { MessageBubble } from "../components/MessageBubble";
import { SessionSheet } from "../components/SessionSheet";
import { probeSession, type SessionAccess } from "../api";
import { useMotsSession } from "../hooks/useMotsSession";
import { presentConnection, presentError } from "../present";
import { motion, radius, spacing, type as typeScale, type ThemeColors } from "../theme";
import { TOOL_LABELS } from "../tools";
import type { Identity } from "../storage";
import { Banner } from "../ui/Banner";
import { IconButton } from "../ui/IconButton";

type AccessView = SessionAccess | "checking";

type Props = {
  readonly identity: Identity;
  readonly onLeave: () => void;
  readonly onIdentityChange: (identity: Identity) => void | Promise<void>;
  readonly onRestart: (mode: "create" | "join") => void;
};

export function ChatScreen({ identity, onLeave, onIdentityChange, onRestart }: Props) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const isWide = windowWidth >= 768;
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const keyboardVisible = useKeyboardState((keyboard) => keyboard.isVisible);
  const [access, setAccess] = useState<AccessView>("checking");
  const [accessMessage, setAccessMessage] = useState<string | undefined>(undefined);
  const [probeEpoch, setProbeEpoch] = useState(0);
  const sessionOpen = access === "open" || access === "unknown";

  const { client, state, retry } = useMotsSession({
    baseUrl: identity.apiUrl,
    sessionId: identity.sessionId,
    username: identity.username,
    enabled: sessionOpen,
  });
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    setAccess("checking");
    setAccessMessage(undefined);
    void probeSession(identity.apiUrl, identity.sessionId).then((result) => {
      if (!alive) return;
      setAccess(result.access);
      setAccessMessage(result.message);
    });
    return () => {
      alive = false;
    };
  }, [identity.apiUrl, identity.sessionId, probeEpoch]);

  useEffect(() => {
    if (state.status !== "failed") return;
    let alive = true;
    void probeSession(identity.apiUrl, identity.sessionId).then((result) => {
      if (!alive) return;
      if (result.access === "unauthorized" || result.access === "unavailable") {
        setAccess(result.access);
        setAccessMessage(result.message);
      }
    });
    return () => {
      alive = false;
    };
  }, [identity.apiUrl, identity.sessionId, state.status]);

  const listRef = useRef<FlatList<TranscriptEntry>>(null);
  const stickToBottom = useRef(true);
  const contentHeight = useRef(0);
  const viewportHeight = useRef(0);

  const activeConversationId = state.activeConversationId;
  const active =
    activeConversationId === undefined ? undefined : state.snapshots[activeConversationId];
  const entries = active?.entries ?? [];
  const conversations = state.conversations.filter((conversation) => conversation.owner === undefined);
  const liveText = active?.live?.text ?? "";
  const liveActive = active?.live?.active === true;
  const runningTools = (active?.tools ?? []).filter((tool) => tool.status !== "done");
  const typingOthers = (active?.typing ?? []).filter((name) => name !== identity.username);
  const connected = state.status === "connected";
  const canWrite = connected && activeConversationId !== undefined;
  const connection = presentConnection(state.status, state.error);
  const showErrorBanner = state.error !== undefined && (connected || entries.length > 0);

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
        error instanceof Error ? presentError(error.message) : "Riprova tra poco.",
      );
    } finally {
      setSending(false);
    }
  }, [activeConversationId, client, input]);

  useEffect(() => {
    if (activeConversationId === undefined || !connected) return;
    if (input.length === 0) {
      client.setTyping(activeConversationId, false);
      return;
    }
    client.setTyping(activeConversationId, true);
    const timer = setTimeout(() => client.setTyping(activeConversationId, false), 2500);
    return () => clearTimeout(timer);
  }, [activeConversationId, client, connected, input]);

  const scrollToBottom = useCallback((animated: boolean) => {
    const list = listRef.current;
    if (list === null) return;
    const target = Math.max(contentHeight.current - viewportHeight.current, 0);
    list.scrollToOffset({ offset: target, animated });
  }, []);

  const onContentSizeChange = useCallback(
    (_width: number, height: number) => {
      contentHeight.current = height;
      if (stickToBottom.current) scrollToBottom(false);
    },
    [scrollToBottom],
  );

  const onListLayout = useCallback(
    (event: LayoutChangeEvent) => {
      viewportHeight.current = event.nativeEvent.layout.height;
      if (stickToBottom.current) scrollToBottom(false);
    },
    [scrollToBottom],
  );

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    stickToBottom.current = distanceFromBottom < 80;
  }, []);

  useEffect(() => {
    if (entries.length === 0 || !stickToBottom.current) return;
    scrollToBottom(true);
  }, [entries.length, scrollToBottom]);

  useEffect(() => {
    if (liveText.length === 0 || !stickToBottom.current) return;
    scrollToBottom(false);
  }, [liveText, scrollToBottom]);

  const share = useCallback(() => {
    void Share.share({
      message: `Entra su Mots\nCodice: ${identity.sessionId}\nServer: ${identity.apiUrl}`,
    });
  }, [identity.apiUrl, identity.sessionId]);

  const leave = useCallback(() => {
    Alert.alert("Uscire da Mots?", "La conversazione resta sul server. Puoi rientrare con lo stesso codice.", [
      { text: "Annulla", style: "cancel" },
      {
        text: "Esci",
        style: "destructive",
        onPress: () => {
          setSheetOpen(false);
          onLeave();
        },
      },
    ]);
  }, [onLeave]);

  const fork = useCallback(
    (entry: TranscriptEntry) => {
      Alert.alert("Nuova diramazione", "Apro una chat che parte da questo messaggio. L'originale resta dov'è.", [
        { text: "Annulla", style: "cancel" },
        {
          text: "Dirama",
          onPress: () => {
            client.forkConversation(entry.conversationId, entry.id);
            setSheetOpen(false);
          },
        },
      ]);
    },
    [client],
  );

  const footer = (
    <View style={styles.footer}>
      {typingOthers.length > 0 ? (
        <Text style={styles.meta}>{typingOthers.join(", ")} sta scrivendo</Text>
      ) : null}
      {runningTools.map((tool) => (
        <View key={tool.callId} style={styles.progress}>
          <ActivityIndicator size="small" color={colors.textSecondary} />
          <Text style={styles.meta}>{TOOL_LABELS[tool.name] ?? tool.name} in corso</Text>
        </View>
      ))}
      {liveActive ? (
        <View style={styles.live}>
          {liveText.length > 0 ? <MarkdownText text={liveText} /> : <Thinking />}
          {active?.live?.retry !== undefined ? (
            <Text style={styles.danger}>{presentError(active.live.retry.error)}</Text>
          ) : null}
        </View>
      ) : null}
      {(active?.queued ?? []).map((queued) => (
        <View key={queued.submissionId} style={styles.queued}>
          <Text style={styles.queuedLabel}>{queued.mode === "steer" ? "In attesa" : "In coda"}</Text>
          <Text numberOfLines={2} style={styles.queuedText}>
            {queued.text}
          </Text>
        </View>
      ))}
      {active?.failure !== undefined ? <Banner message={active.failure.message} /> : null}
      {active?.runError !== undefined ? <Banner message={active.runError} /> : null}
    </View>
  );

  const blocked = access === "unauthorized" || access === "unavailable";
  const gateLine = access === "unauthorized" ? "Questo codice non funziona." : "Il server non è pronto.";
  const gateDetail =
    accessMessage ?? "Questo codice non apre la sessione. Creane una nuova, oppure entra con il codice intero.";

  const empty = blocked ? (
    <View testID="session-gate" style={styles.connection}>
      <Text style={styles.connectionTitle}>{gateLine}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Riprova"
        onPress={() => {
          if (access === "unauthorized") onRestart("join");
          else setProbeEpoch((current) => current + 1);
        }}
        style={styles.textAction}
      >
        <Text style={styles.textActionLabel}>Riprova</Text>
      </Pressable>
      <QuietDetail detail={gateDetail} />
    </View>
  ) : access === "checking" ? (
    <View testID="connection-state" style={styles.connection}>
      <Text style={styles.connectionTitle}>Mi collego</Text>
    </View>
  ) : !connected ? (
    <View testID="connection-state" style={styles.connection}>
      <Text style={styles.connectionTitle}>{connection.title}</Text>
      {connection.canRetry && !connection.busy ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Riprova"
          onPress={retry}
          style={styles.textAction}
        >
          <Text style={styles.textActionLabel}>Riprova</Text>
        </Pressable>
      ) : null}
      {connection.body.length > 0 ? <QuietDetail detail={connection.body} /> : null}
    </View>
  ) : (
    <View style={styles.empty} />
  );

  return (
    <View testID="chat-screen" style={styles.outer}>
      <View style={[styles.frame, isWide && styles.frameWide]}>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <Text accessibilityRole="header" style={styles.brand}>
            Mots
          </Text>
          <IconButton label="Menu" onPress={() => setSheetOpen(true)}>
            <MenuIcon size={20} color={colors.textPrimary} />
          </IconButton>
        </View>

        <KeyboardAvoidingView style={styles.flex} behavior="padding">
          {!connected && entries.length > 0 ? (
            <View style={styles.strip}>
              <Text style={styles.stripText}>{connection.title}</Text>
              {connection.canRetry ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Riprova la connessione"
                  onPress={retry}
                  style={styles.stripAction}
                >
                  <Text style={styles.stripActionLabel}>Riprova</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          <FlatList
            ref={listRef}
            data={entries}
            keyExtractor={(entry) => String(entry.id)}
            renderItem={({ item }) => <MessageBubble entry={item} onFork={fork} />}
            contentContainerStyle={[styles.list, entries.length === 0 && styles.listEmpty]}
            ListEmptyComponent={empty}
            ListFooterComponent={footer}
            onScroll={onScroll}
            onContentSizeChange={onContentSizeChange}
            onLayout={onListLayout}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={100}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          />
          <View style={{ paddingBottom: keyboardVisible ? spacing.xs : Math.max(insets.bottom, spacing.sm) }}>
            {showErrorBanner && state.error !== undefined ? (
              <View style={styles.bannerWrap}>
                <Banner message={presentError(state.error)} onDismiss={() => client.clearError()} />
              </View>
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
          username={identity.username}
          apiUrl={identity.apiUrl}
          agent={active?.agent}
          onClose={() => setSheetOpen(false)}
          onSelect={(id) => {
            client.openConversation(id);
            setSheetOpen(false);
          }}
          onCreate={() => client.createConversation()}
          onShare={share}
          onLeave={leave}
          onApiUrlChange={(apiUrl) => {
            void onIdentityChange({ ...identity, apiUrl });
          }}
          onModelSelect={(providerId, modelId) => {
            if (activeConversationId === undefined) return false;
            return client.setModel(activeConversationId, providerId, modelId);
          }}
        />
      </View>
    </View>
  );
}

function QuietDetail({ detail }: { readonly detail: string }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  if (detail.length === 0) return null;
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dettagli"
        onPress={() => setOpen((current) => !current)}
        style={stylesQuiet.action}
      >
        <Text style={[stylesQuiet.link, { color: colors.textSecondary }]}>Dettagli</Text>
      </Pressable>
      {open ? (
        <Text selectable style={[stylesQuiet.detail, { color: colors.textSecondary }]}>
          {detail}
        </Text>
      ) : null}
    </View>
  );
}

const stylesQuiet = StyleSheet.create({
  action: {
    minHeight: 44,
    justifyContent: "center",
  },
  link: {
    ...typeScale.small,
  },
  detail: {
    ...typeScale.small,
  },
});

function Thinking() {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: motion.slow,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: motion.slow,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <Animated.Text style={[stylesThinking.text, { color: colors.textSecondary, opacity }]}>
      Sta scrivendo
    </Animated.Text>
  );
}

const stylesThinking = StyleSheet.create({
  text: {
    ...typeScale.body,
  },
});

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    outer: {
      flex: 1,
      backgroundColor: colors.bgMain,
    },
    outerWide: {
      backgroundColor: colors.frame,
      alignItems: "center",
    },
    frame: {
      flex: 1,
      width: "100%",
      backgroundColor: colors.bgMain,
    },
    frameWide: {
      maxWidth: 560,
    },
    flex: {
      flex: 1,
    },
    header: {
      minHeight: 64,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingLeft: spacing.xl,
      paddingRight: spacing.sm,
      backgroundColor: colors.bgMain,
    },
    brand: {
      ...typeScale.body,
      color: colors.textPrimary,
    },
    list: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.xl,
    },
    listEmpty: {
      flexGrow: 1,
    },
    empty: {
      flex: 1,
      justifyContent: "center",
      gap: spacing.lg,
      paddingVertical: spacing.xxl,
    },
    greeting: {
      ...typeScale.title,
      color: colors.textPrimary,
    },
    lead: {
      ...typeScale.body,
      color: colors.textSecondary,
    },
    suggestions: {
      gap: spacing.sm,
    },
    suggestion: {
      minHeight: 64,
      justifyContent: "center",
      gap: 2,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderRadius: radius.lg,
      backgroundColor: colors.cardSurfacePrimary,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
    },
    suggestionTitle: {
      ...typeScale.bodyMedium,
      color: colors.textPrimary,
    },
    suggestionHint: {
      ...typeScale.small,
      color: colors.textSecondary,
    },
    connection: {
      flex: 1,
      justifyContent: "center",
      gap: spacing.md,
      paddingVertical: spacing.xxl,
    },
    connectionTitle: {
      ...typeScale.body,
      color: colors.textPrimary,
    },
    textAction: {
      minHeight: 44,
      justifyContent: "center",
      alignSelf: "flex-start",
    },
    textActionLabel: {
      ...typeScale.body,
      color: colors.textPrimary,
    },
    connectionBody: {
      ...typeScale.body,
      color: colors.textSecondary,
    },
    footer: {
      gap: spacing.sm,
      paddingTop: spacing.sm,
    },
    meta: {
      ...typeScale.small,
      color: colors.textSecondary,
    },
    progress: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    live: {
      gap: spacing.xs,
      paddingVertical: spacing.sm,
    },
    danger: {
      ...typeScale.small,
      color: colors.danger,
    },
    queued: {
      borderRadius: radius.md,
      backgroundColor: colors.cardSurfacePrimary,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      padding: spacing.md,
      gap: 2,
    },
    queuedLabel: {
      ...typeScale.caption,
      color: colors.textSecondary,
    },
    queuedText: {
      ...typeScale.small,
      color: colors.textPrimary,
    },
    strip: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.xl,
    },
    stripText: {
      ...typeScale.body,
      color: colors.textPrimary,
      flex: 1,
    },
    stripAction: {
      minHeight: 44,
      justifyContent: "center",
      paddingHorizontal: spacing.sm,
    },
    stripActionLabel: {
      ...typeScale.body,
      color: colors.textPrimary,
    },
    bannerWrap: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
    },
    pressed: {
      opacity: 0.75,
    },
  });
}
