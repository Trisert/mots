import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
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
import { ROOT_CONVERSATION_ID, type ConversationSummary } from "@mots/protocol";
import { useTheme } from "../context/ThemeContext";
import { Composer } from "../components/Composer";
import {
  BookmarkIcon,
  ClockIcon,
  MenuIcon,
  PlusIcon,
  SparkleIcon,
} from "../components/Icon";
import { MarkdownText } from "../components/MarkdownText";
import { Mascot } from "../components/Mascot";
import { MessageBubble } from "../components/MessageBubble";
import { PROVIDER_MODELS, SessionSheet } from "../components/SessionSheet";
import { useMotsSession } from "../hooks/useMotsSession";
import { fonts, radius, spacing, type ThemeColors } from "../theme";
import { TOOL_LABELS } from "../tools";
import type { Identity } from "../storage";

const QUICK_SUGGESTIONS = [
  {
    icon: (color: string) => <ClockIcon size={17} color={color} strokeWidth={2} />,
    title: "Briefing mattutino",
    schedule: "08:00",
    prompt: "Pianifica la routine autonoma 'Briefing mattutino' ogni giorno alle 08:00 con riassunto dei task e priorità.",
  },
  {
    icon: (color: string) => <BookmarkIcon size={17} color={color} strokeWidth={2} />,
    title: "Appunto in memoria",
    schedule: "Immediato",
    prompt: "Ricorda che ",
  },
  {
    icon: (color: string) => <SparkleIcon size={17} color={color} strokeWidth={2} />,
    title: "Sintesi settimanale",
    schedule: "Lunedì 09:00",
    prompt: "Imposta la routine settimanale 'Sintesi del lunedì' alle 09:00 per fare il punto su progetti e scadenze.",
  },
];

type Props = {
  readonly identity: Identity;
  readonly onLeave: () => void;
};

export function ChatScreen({ identity, onLeave }: Props) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const isWide = windowWidth >= 768;

  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const keyboardVisible = useKeyboardState((keyboard) => keyboard.isVisible);
  const { client, state } = useMotsSession({
    baseUrl: identity.apiUrl,
    sessionId: identity.sessionId,
    username: identity.username,
  });
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeProviderId, setActiveProviderId] = useState("kilo");
  const [activeModelName, setActiveModelName] = useState("reflection/beam-free");

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

  const contentHeight = useRef(0);
  const viewportHeight = useRef(0);

  const scrollToBottom = useCallback((animated: boolean) => {
    const list = listRef.current;
    if (list === null) return;
    const target = Math.max(contentHeight.current - viewportHeight.current, 0);
    list.scrollToOffset({ offset: target, animated });
  }, []);

  const onContentSizeChange = useCallback(
    (_width: number, height: number) => {
      contentHeight.current = height;
      if (stickToBottom.current) {
        scrollToBottom(false);
      }
    },
    [scrollToBottom],
  );

  const onListLayout = useCallback(
    (event: LayoutChangeEvent) => {
      viewportHeight.current = event.nativeEvent.layout.height;
      if (stickToBottom.current) {
        scrollToBottom(false);
      }
    },
    [scrollToBottom],
  );

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const distanceFromBottom =
        contentSize.height - (contentOffset.y + layoutMeasurement.height);
      stickToBottom.current = distanceFromBottom < 80;
    },
    [],
  );

  useEffect(() => {
    if (entries.length === 0) return;
    if (stickToBottom.current) {
      scrollToBottom(true);
    }
  }, [entries.length, scrollToBottom]);

  useEffect(() => {
    if (liveText.length === 0) return;
    if (stickToBottom.current) {
      scrollToBottom(false);
    }
  }, [liveText, scrollToBottom]);

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

  const statusColor =
    state.status === "connected"
      ? colors.success
      : state.status === "failed"
        ? colors.danger
        : colors.accentCoral;

  const footer = (
    <View style={styles.footer}>
      {typingOthers.length > 0 ? (
        <Text style={styles.typing}>
          {typingOthers.join(", ")} sta scrivendo…
        </Text>
      ) : null}

      {runningTools.map((tool) => (
        <View key={tool.callId} style={styles.progress}>
          <ActivityIndicator size="small" color={colors.accentCoral} />
          <Text style={styles.progressText}>
            {TOOL_LABELS[tool.name] ?? tool.name} in corso…
          </Text>
        </View>
      ))}

      {liveActive ? (
        <View style={styles.liveRow}>
          <View style={styles.liveBubble}>
            {liveText.length > 0 ? (
              <MarkdownText text={liveText} />
            ) : (
              <View style={styles.thinking}>
                <Mascot size={26} state="thinking" interactive={false} />
                <ActivityIndicator size="small" color={colors.accentCoral} />
                <Text style={styles.thinkingText}>Mots sta pensando…</Text>
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
    !connected ? (
      <View style={styles.connecting}>
        <ActivityIndicator size="small" color={colors.accentCoral} />
        <Text style={styles.connectingText}>Connessione all'agente Mots…</Text>
      </View>
    ) : (
      <View style={styles.emptyContainer}>
        {/* Animated Mascot Companion Hero */}
        <View style={styles.emptyHero}>
          <Mascot
            size={72}
            state={liveActive ? "speaking" : runningTools.length > 0 ? "thinking" : "idle"}
            interactive={true}
          />
          <Text style={styles.greetingTitle}>
            Ciao{identity.username ? `, ${identity.username}` : ""} 👋
          </Text>
          <Text style={styles.greetingSubtitle}>
            Il tuo compagno personale per routine autonome e focus.
          </Text>
        </View>

        {/* Quick Suggestion Chips */}
        <View style={styles.quickChipsList}>
          {QUICK_SUGGESTIONS.map((item) => (
            <Pressable
              key={item.title}
              accessibilityRole="button"
              accessibilityLabel={`${item.title} (${item.schedule})`}
              onPress={() => setInput(item.prompt)}
              style={({ pressed }) => [
                styles.quickChip,
                pressed && styles.quickChipPressed,
              ]}
            >
              <View style={styles.quickChipIconWrap}>
                {item.icon(colors.accentCoral)}
              </View>
              <View style={styles.quickChipTextWrap}>
                <Text style={styles.quickChipTitle}>{item.title}</Text>
                <Text style={styles.quickChipSchedule}>{item.schedule}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>
    );

  const modelShortName = activeModelName.split("/")[1] ?? activeModelName;

  return (
    <View style={styles.outerContainer}>
      <View style={[styles.appFrame, isWide && styles.appFrameWide]}>
        {/* App Bar / Top Navigation */}
        <View style={[styles.header, { paddingTop: insets.top, minHeight: 56 + insets.top }]}>
          {/* Hamburger Menu Button */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Menu principale"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() => setSheetOpen(true)}
            style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
          >
            <MenuIcon size={19} color={colors.textPrimary} strokeWidth={2} />
          </Pressable>

          {/* Center Brand & Companion State */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Apri impostazioni modello"
            onPress={() => setSheetOpen(true)}
            style={styles.headerCenter}
          >
            <Mascot
              size={30}
              state={liveActive ? "speaking" : runningTools.length > 0 ? "thinking" : "idle"}
              interactive={false}
            />
            <View style={styles.headerTitleWrap}>
              <View style={styles.brandTitleRow}>
                <Text
                  accessibilityRole="header"
                  aria-level={1}
                  style={styles.headerTitle}
                >
                  Mots
                </Text>
                <View style={styles.modelPill}>
                  <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                  <Text style={styles.modelPillText} numberOfLines={1}>
                    {modelShortName}
                  </Text>
                </View>
              </View>
            </View>
          </Pressable>

          {/* Right Action: Nuova Chat */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Nuova chat"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            disabled={!connected}
            onPress={() => client.createConversation()}
            style={({ pressed }) => [
              styles.headerButton,
              !connected && styles.headerButtonDisabled,
              pressed && styles.pressed,
            ]}
          >
            <PlusIcon size={18} color={colors.textPrimary} strokeWidth={2.2} />
          </Pressable>
        </View>

        {/* Message Feed / Chat Stream */}
        <KeyboardAvoidingView style={styles.flex} behavior="padding">
          <FlatList
            ref={listRef}
            data={entries}
            keyExtractor={(entry) => String(entry.id)}
            renderItem={({ item }) => <MessageBubble entry={item} onFork={fork} />}
            contentContainerStyle={styles.list}
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

          {/* Bottom Native Composer */}
          <View
            style={[
              styles.bottomBar,
              {
                paddingBottom: keyboardVisible
                  ? spacing.xs
                  : Math.max(insets.bottom, spacing.sm),
              },
            ]}
          >
            <Composer
              value={input}
              onChange={setInput}
              onSend={() => void send()}
              disabled={!canWrite}
              sending={sending}
            />
          </View>
        </KeyboardAvoidingView>

        {/* Hamburger Drawer / Session Sheet */}
        <SessionSheet
          visible={sheetOpen}
          conversations={conversations}
          activeConversationId={activeConversationId}
          sessionId={identity.sessionId}
          username={identity.username}
          onClose={() => setSheetOpen(false)}
          onSelect={(id) => {
            client.openConversation(id);
            setSheetOpen(false);
          }}
          onCreate={() => {
            client.createConversation();
            setSheetOpen(false);
          }}
          onShare={share}
          onLeave={leave}
          onActionSelect={(actionPrompt) => setInput(actionPrompt)}
          onModelSelect={(providerId, modelId) => {
            setActiveProviderId(providerId);
            setActiveModelName(modelId);
            if (activeConversationId) {
              void client.setModel(activeConversationId, providerId, modelId);
            }
          }}
        />
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors, isDark: boolean) {
  return StyleSheet.create({
    outerContainer: {
      flex: 1,
      backgroundColor: isDark ? "#050608" : "#ECECE7",
      alignItems: "center",
    },
    appFrame: {
      flex: 1,
      width: "100%",
      backgroundColor: colors.bgMain,
    },
    appFrameWide: {
      maxWidth: 440,
      borderRadius: 28,
      marginVertical: 14,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.cardBorderSubtle,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: isDark ? 0.35 : 0.08,
      shadowRadius: 36,
      elevation: 8,
    },
    flex: {
      flex: 1,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      minHeight: 56,
      backgroundColor: colors.bgMain,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderSubtle,
    },
    headerButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.03)",
    },
    headerButtonDisabled: {
      opacity: 0.35,
    },
    headerCenter: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    headerTitleWrap: {
      alignItems: "flex-start",
    },
    brandTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    headerTitle: {
      fontFamily: fonts.bold,
      fontSize: 16.5,
      lineHeight: 20,
      color: colors.textPrimary,
      fontWeight: "700",
    },
    modelPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: isDark ? "rgba(74, 222, 128, 0.12)" : "#EEF8EE",
      paddingHorizontal: 8,
      paddingVertical: 2.5,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: isDark ? "rgba(74, 222, 128, 0.25)" : "rgba(120, 200, 100, 0.3)",
    },
    statusDot: {
      width: 5.5,
      height: 5.5,
      borderRadius: 3,
    },
    modelPillText: {
      fontFamily: fonts.semiBold,
      fontSize: 10.5,
      color: colors.accentGreen,
      maxWidth: 120,
      fontWeight: "600",
    },
    list: {
      paddingHorizontal: 14,
      paddingTop: 12,
      paddingBottom: 20,
    },
    emptyContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 32,
      paddingHorizontal: 16,
    },
    emptyHero: {
      alignItems: "center",
      marginBottom: 24,
    },
    greetingTitle: {
      fontFamily: fonts.bold,
      fontSize: 20,
      color: colors.textPrimary,
      fontWeight: "700",
      letterSpacing: -0.3,
      marginTop: 14,
      marginBottom: 4,
      textAlign: "center",
    },
    greetingSubtitle: {
      fontFamily: fonts.regular,
      fontSize: 13.5,
      lineHeight: 19,
      color: colors.textSecondary,
      textAlign: "center",
      maxWidth: 290,
    },
    quickChipsList: {
      width: "100%",
      maxWidth: 360,
      gap: 8,
    },
    quickChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: colors.cardSurfacePrimary,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 11,
      borderWidth: 1,
      borderColor: colors.cardBorderSubtle,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0.2 : 0.03,
      shadowRadius: 4,
      elevation: 1,
    },
    quickChipPressed: {
      opacity: 0.7,
    },
    quickChipIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: isDark ? "rgba(45, 212, 191, 0.14)" : "rgba(224, 90, 71, 0.08)",
      alignItems: "center",
      justifyContent: "center",
    },
    quickChipTextWrap: {
      flex: 1,
    },
    quickChipTitle: {
      fontFamily: fonts.semiBold,
      fontSize: 13,
      color: colors.textPrimary,
      fontWeight: "600",
    },
    quickChipSchedule: {
      fontFamily: fonts.regular,
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 1,
    },
    connecting: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: spacing.xxl,
      gap: spacing.sm,
    },
    connectingText: {
      fontFamily: fonts.regular,
      color: colors.textSecondary,
      fontSize: 13,
    },
    footer: {
      gap: spacing.xs,
      paddingTop: spacing.xs,
    },
    typing: {
      fontFamily: fonts.regular,
      color: colors.textSecondary,
      fontSize: 12,
      paddingHorizontal: spacing.xs,
    },
    progress: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.xs,
    },
    progressText: {
      fontFamily: fonts.regular,
      color: colors.textSecondary,
      fontSize: 12,
    },
    liveRow: {
      marginVertical: spacing.xs,
      alignItems: "flex-start",
    },
    liveBubble: {
      borderRadius: radius.lg,
      backgroundColor: colors.cardSurfacePrimary,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderWidth: 1,
      borderColor: colors.cardBorderSubtle,
      maxWidth: "88%",
    },
    thinking: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    thinkingText: {
      fontFamily: fonts.regular,
      color: colors.textSecondary,
      fontSize: 13,
    },
    retryText: {
      fontFamily: fonts.regular,
      color: colors.danger,
      fontSize: 11,
      marginTop: spacing.xs,
    },
    queued: {
      borderRadius: radius.sm,
      backgroundColor: colors.cardSurfacePrimary,
      padding: spacing.sm,
      borderWidth: 1,
      borderColor: colors.cardBorderSubtle,
    },
    queuedLabel: {
      fontFamily: fonts.bold,
      fontSize: 9,
      letterSpacing: 0.6,
      color: colors.textSecondary,
      marginBottom: 2,
      fontWeight: "700",
    },
    queuedText: {
      fontFamily: fonts.regular,
      fontSize: 12,
      color: colors.textPrimary,
    },
    failure: {
      borderRadius: radius.sm,
      backgroundColor: colors.cardSurfacePink,
      padding: spacing.sm,
    },
    failureText: {
      fontFamily: fonts.regular,
      color: colors.danger,
      fontSize: 12,
    },
    bottomBar: {
      backgroundColor: colors.bgMain,
    },
    pressed: {
      opacity: 0.7,
    },
  });
}
