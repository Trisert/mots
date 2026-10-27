import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
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
import {
  lastAssistantId,
  markTranscript,
  replyAnnouncement,
  thinkingAnnouncement,
  type TranscriptMark,
} from "../announce";
import { useTheme } from "../context/ThemeContext";
import { useI18n, type Translate } from "../i18n";
import { Composer } from "../components/Composer";
import { ChevronDownIcon, MenuIcon, PlusIcon } from "../components/Icon";
import { MarkdownText } from "../components/MarkdownText";
import { MessageBubble } from "../components/MessageBubble";
import { ModelPicker } from "../components/ModelPicker";
import { SessionSheet } from "../components/SessionSheet";
import { probeSession, type SessionAccess } from "../api";
import { useMotsSession } from "../hooks/useMotsSession";
import { presentConnection, presentError, presentModel, presentRunError, providerLabel } from "../present";
import { fonts, radius, shadows, spacing, type as typeScale, type ThemeColors } from "../theme";
import { toolLabel } from "../tools";
import type { Identity } from "../storage";
import { Banner } from "../ui/Banner";
import { Button } from "../ui/Button";
import { Mascot } from "../components/Mascot";
import { IconButton } from "../ui/IconButton";

/** Starter prompts. The text goes to the model, so it follows the app language. */
function suggestions(t: Translate) {
  return [
    {
      title: t("chat.sugMorningTitle"),
      hint: t("chat.sugMorningHint"),
      prompt: t("chat.sugMorningPrompt"),
    },
    {
      title: t("chat.sugNoteTitle"),
      hint: t("chat.sugNoteHint"),
      prompt: t("chat.sugNotePrompt"),
    },
    {
      title: t("chat.sugMondayTitle"),
      hint: t("chat.sugMondayHint"),
      prompt: t("chat.sugMondayPrompt"),
    },
  ];
}

type AccessView = SessionAccess | "checking";

type Announcement = { readonly text: string; readonly key: number };

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
  const { t } = useI18n();
  const tRef = useRef(t);
  tRef.current = t;
  const suggestionItems = useMemo(() => suggestions(t), [t]);
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const closePicker = useCallback(() => setPickerOpen(false), []);

  useEffect(() => {
    let alive = true;
    setAccess("checking");
    setAccessMessage(undefined);
    void probeSession(identity.apiUrl, identity.sessionId, tRef.current).then((result) => {
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
    void probeSession(identity.apiUrl, identity.sessionId, tRef.current).then((result) => {
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
  const connection = presentConnection(state.status, t, state.error);
  const model = presentModel(active?.agent);
  const showErrorBanner = state.error !== undefined && (connected || entries.length > 0);
  const conversationTitle = activeConversationId === 1 ? t("menu.mainChat") : t("chat.branchTitle");

  // Screen reader status: a polite live region plus AccessibilityInfo on native.
  const [announcement, setAnnouncement] = useState<Announcement | undefined>(undefined);
  const announcementSeq = useRef(0);
  const announce = useCallback((text: string) => {
    announcementSeq.current += 1;
    setAnnouncement({ text, key: announcementSeq.current });
    if (Platform.OS !== "web") AccessibilityInfo.announceForAccessibility(text);
  }, []);

  const transcriptMark = useRef<TranscriptMark | undefined>(undefined);
  const entryCount = entries.length;
  const latestAssistantId = lastAssistantId(entries);
  useEffect(() => {
    const next = markTranscript(activeConversationId, entries);
    const text = replyAnnouncement(transcriptMark.current, next, t);
    transcriptMark.current = next;
    if (text !== undefined) announce(text);
    // Depends on the count and the last assistant id only; `entries` changes identity on every render.
  }, [activeConversationId, entryCount, latestAssistantId, announce, t]);

  const wasLive = useRef<boolean | undefined>(undefined);
  useEffect(() => {
    const text = thinkingAnnouncement(wasLive.current, liveActive, t);
    wasLive.current = liveActive;
    if (text !== undefined) announce(text);
  }, [liveActive, announce, t]);

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
        t("chat.sendFailed"),
        error instanceof Error ? presentError(error.message, t) : t("chat.tryShortly"),
      );
    } finally {
      setSending(false);
    }
  }, [activeConversationId, client, input, t]);

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
      message: t("chat.shareMessage", { code: identity.sessionId, server: identity.apiUrl }),
    });
  }, [identity.apiUrl, identity.sessionId, t]);

  const leave = useCallback(() => {
    Alert.alert(t("chat.leaveTitle"), t("chat.leaveBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("menu.leave"),
        style: "destructive",
        onPress: () => {
          setSheetOpen(false);
          onLeave();
        },
      },
    ]);
  }, [onLeave, t]);

  const fork = useCallback(
    (entry: TranscriptEntry) => {
      Alert.alert(t("chat.forkTitle"), t("chat.forkBody"), [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("chat.forkAction"),
          onPress: () => {
            client.forkConversation(entry.conversationId, entry.id);
            setSheetOpen(false);
          },
        },
      ]);
    },
    [client, t],
  );

  // Online, the title is just the model, as in the Claude app. Any other state names itself.
  const titleLabel = connection.tone === "ok" && model !== undefined ? model.shortName : connection.label;
  const pillDescription = model === undefined
    ? t("chat.pillNoModel", { status: connection.label })
    : t("chat.pillModel", { status: connection.label, provider: providerLabel(model.provider), model: model.modelId });

  const footer = (
    <View style={styles.footer}>
      {typingOthers.length > 0 ? (
        <Text style={styles.meta}>{t("chat.typing", { names: typingOthers.join(", ") })}</Text>
      ) : null}
      {runningTools.map((tool) => (
        <View key={tool.callId} style={styles.progress}>
          <ActivityIndicator size="small" color={colors.textSecondary} />
          <Text style={styles.meta}>{t("chat.toolRunning", { tool: toolLabel(tool.name, t) })}</Text>
        </View>
      ))}
      {liveActive ? (
        <View style={styles.live}>
          {liveText.length > 0 ? <MarkdownText text={liveText} /> : <Thinking />}
          {active?.live?.retry !== undefined ? (
            <Text style={styles.danger}>{presentError(active.live.retry.error, t)}</Text>
          ) : null}
        </View>
      ) : null}
      {(active?.queued ?? []).map((queued) => (
        <View key={queued.submissionId} style={styles.queued}>
          <Text style={styles.queuedLabel}>{queued.mode === "steer" ? t("chat.waiting") : t("chat.queued")}</Text>
          <Text numberOfLines={2} style={styles.queuedText}>
            {queued.text}
          </Text>
        </View>
      ))}
      {active?.failure !== undefined ? <Banner message={active.failure.message} /> : null}
      {active?.runError !== undefined ? (
        <Banner message={presentRunError(active.runError, t)} />
      ) : null}
    </View>
  );

  const blocked = access === "unauthorized" || access === "unavailable";

  const empty = blocked ? (
    <View testID="session-gate" style={styles.connection}>
      <Text accessibilityRole="header" style={styles.connectionTitle}>
        {access === "unauthorized" ? t("chat.invalidCode") : t("chat.serverNotReady")}
      </Text>
      <Text style={styles.connectionBody}>
        {accessMessage ?? t("chat.codeNotOpen")}
      </Text>
      <Button label={t("chat.newSpace")} onPress={() => onRestart("create")} />
      <Button
        label={t("chat.joinWithCode")}
        variant="secondary"
        onPress={() => onRestart("join")}
      />
      {access === "unavailable" ? (
        <Button label={t("common.retry")} variant="ghost" onPress={() => setProbeEpoch((current) => current + 1)} />
      ) : null}
    </View>
  ) : access === "checking" ? (
    <View testID="connection-state" style={styles.connection}>
      <ActivityIndicator color={colors.textSecondary} />
      <Text accessibilityRole="header" style={styles.connectionTitle}>
        {t("chat.checkingCode")}
      </Text>
    </View>
  ) : !connected ? (
    <View testID="connection-state" style={styles.connection}>
      {connection.busy ? <ActivityIndicator color={colors.textSecondary} /> : null}
      <Text accessibilityRole="header" style={styles.connectionTitle}>
        {connection.title}
      </Text>
      <Text style={styles.connectionBody}>{connection.body}</Text>
      {connection.canRetry ? (
        <Button label={t("common.retry")} variant="secondary" onPress={retry} />
      ) : null}
    </View>
  ) : (
    <View style={styles.empty}>
      <View style={styles.emptyMascot}>
        <Mascot mood="felice" size={120} shadow />
      </View>
      <Text accessibilityRole="header" maxFontSizeMultiplier={1.6} style={styles.greeting}>
        {t("chat.greeting", { name: identity.username.length > 0 ? `, ${identity.username}` : "" })}
      </Text>
      <Text style={styles.lead}>{t("chat.lead")}</Text>
      <View style={styles.suggestions}>
        {suggestionItems.map((item) => (
          <Pressable
            key={item.title}
            accessibilityRole="button"
            accessibilityLabel={`${item.title}. ${item.hint}`}
            onPress={() => setInput(item.prompt)}
            style={({ pressed }) => [styles.suggestion, pressed && styles.suggestionPressed]}
          >
            <Text style={styles.suggestionTitle}>{item.title}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  const composerHint = blocked
    ? accessMessage
    : !connected
      ? t("chat.sendPaused")
      : activeConversationId === undefined
        ? t("chat.waitingChat")
        : undefined;

  return (
    <View testID="chat-screen" style={[styles.outer, isWide && styles.outerWide]}>
      <View style={[styles.frame, isWide && styles.frameWide]}>
        <Text key={announcement?.key ?? 0} aria-live="polite" style={visuallyHidden.hidden}>
          {announcement?.text ?? ""}
        </Text>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <IconButton label={t("menu.label")} onPress={() => setSheetOpen(true)}>
            <MenuIcon size={20} color={colors.textPrimary} />
          </IconButton>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${pillDescription} ${t("chat.changeModel")}`}
            onPress={() => setPickerOpen(true)}
            style={({ pressed }) => [styles.headerCenter, pressed && styles.pressed]}
          >
            {connection.tone === "ok" ? null : (
              <View
                style={[
                  styles.statusDot,
                  connection.tone === "danger"
                    ? { backgroundColor: colors.textPrimary }
                    : { borderColor: colors.textSecondary, borderWidth: 1 },
                ]}
              />
            )}
            <Text numberOfLines={1} style={styles.headerTitle}>
              {titleLabel}
            </Text>
            <ChevronDownIcon size={14} color={colors.textSecondary} />
          </Pressable>
          <IconButton
            label={t("menu.newChat")}
            disabled={!connected}
            onPress={() => client.createConversation()}
          >
            <PlusIcon size={20} color={colors.textPrimary} />
          </IconButton>
        </View>

        <KeyboardAvoidingView style={styles.flex} behavior="padding">
          {!connected && entries.length > 0 ? (
            <View style={styles.strip}>
              <Text style={styles.stripText}>{connection.title}</Text>
              {connection.canRetry ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("chat.retryConnection")}
                  onPress={retry}
                  style={styles.stripAction}
                >
                  <Text style={styles.stripActionLabel}>{t("common.retry")}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          <View role="main" style={styles.flex}>
            <Text role="heading" aria-level={1} style={visuallyHidden.hidden}>
              {conversationTitle}
            </Text>
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
          </View>
          <View
            role="form"
            aria-label={t("composer.formLabel")}
            style={{ paddingBottom: keyboardVisible ? spacing.xs : Math.max(insets.bottom, spacing.sm) }}
          >
            {showErrorBanner && state.error !== undefined ? (
              <View style={styles.bannerWrap}>
                <Banner message={presentError(state.error, t)} onDismiss={() => client.clearError()} />
              </View>
            ) : null}
            <Composer
              value={input}
              onChange={setInput}
              onSend={() => void send()}
              disabled={!canWrite}
              sending={sending}
              hint={composerHint}
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
          onOpenModels={() => {
            setSheetOpen(false);
            setPickerOpen(true);
          }}
        />

        <ModelPicker
          visible={pickerOpen}
          apiUrl={identity.apiUrl}
          sessionId={identity.sessionId}
          agent={active?.agent}
          onClose={closePicker}
          onSelect={(providerId, modelId) => {
            if (activeConversationId === undefined) return false;
            return client.setModel(activeConversationId, providerId, modelId);
          }}
        />
      </View>
    </View>
  );
}

/** Mots thinking: the sky mascot with its rising dots. Still under reduced motion. */
function Thinking() {
  const { colors } = useTheme();
  const { t } = useI18n();
  return (
    <View style={stylesThinking.row}>
      <Mascot mood="pensa" size={44} />
      <Text style={[stylesThinking.text, { color: colors.textSecondary }]}>{t("chat.thinking")}</Text>
    </View>
  );
}

const stylesThinking = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  text: {
    ...typeScale.small,
  },
});

// Visually hidden but kept in the accessibility tree (clip pattern).
const visuallyHidden = StyleSheet.create({
  hidden: {
    position: "absolute",
    width: 1,
    height: 1,
    overflow: "hidden",
    margin: -1,
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
      maxWidth: 440,
      marginVertical: spacing.lg,
      borderRadius: radius.card,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.borderSubtle,
    },
    flex: {
      flex: 1,
    },
    header: {
      minHeight: 56,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.sm,
      paddingHorizontal: spacing.xs,
      backgroundColor: colors.bgMain,
    },
    // The model as a white pill in the middle of the header; it opens the picker.
    headerCenter: {
      flexShrink: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      minHeight: 44,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.pill,
      backgroundColor: colors.card,
    },
    headerTitle: {
      ...typeScale.bodyMedium,
      fontSize: 15,
      color: colors.textPrimary,
      flexShrink: 1,
    },
    statusDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
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
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.md,
      paddingVertical: spacing.xxl,
    },
    emptyMascot: {
      marginBottom: spacing.sm,
    },
    greeting: {
      ...typeScale.display,
      textAlign: "center",
      color: colors.textPrimary,
    },
    lead: {
      ...typeScale.body,
      textAlign: "center",
      color: colors.textSecondary,
    },
    suggestions: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: spacing.sm,
      marginTop: spacing.lg,
    },
    suggestion: {
      minHeight: 44,
      justifyContent: "center",
      paddingHorizontal: spacing.lg,
      borderRadius: radius.pill,
      backgroundColor: colors.card,
      ...shadows.card,
    },
    suggestionPressed: {
      backgroundColor: colors.sky,
    },
    suggestionTitle: {
      ...typeScale.label,
      color: colors.textPrimary,
    },
    connection: {
      flex: 1,
      justifyContent: "center",
      gap: spacing.md,
      paddingVertical: spacing.xxl,
    },
    connectionTitle: {
      ...typeScale.heading,
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
      ...typeScale.mono,
      color: colors.textSecondary,
    },
    queued: {
      borderRadius: radius.bubble,
      backgroundColor: colors.field,
    },
    queuedLabel: {
      ...typeScale.kicker,
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
      paddingHorizontal: spacing.lg,
      backgroundColor: colors.invertBg,
    },
    stripText: {
      ...typeScale.label,
      color: colors.invertFg,
      flex: 1,
    },
    stripAction: {
      minHeight: 44,
      justifyContent: "center",
      paddingHorizontal: spacing.sm,
    },
    stripActionLabel: {
      ...typeScale.label,
      textDecorationLine: "underline",
      color: colors.invertFg,
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
