import { useEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import { BackHandler, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ROOT_CONVERSATION_ID, type ConversationSummary } from "@mots/protocol";
import { normalizeBaseUrl } from "../config";
import { useTheme } from "../context/ThemeContext";
import { useI18n, type Translate } from "../i18n";
import { presentModel, type PresentedModel } from "../present";
import { CheckIcon, ChevronDownIcon, ChevronRightIcon, ChevronUpIcon, CloseIcon, PlusIcon } from "./Icon";
import { FOCUSABLE_SELECTOR, isEnabledElement, tabTrapIndex } from "../focus-trap";
import { fonts, hit, radius, spacing, type as typeScale, type ThemeColors } from "../theme";
import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";
import { LanguageSwitcher } from "../ui/LanguageSwitcher";
import { ThemeSwitcher } from "../ui/ThemeSwitcher";

type Props = {
  readonly visible: boolean;
  readonly conversations: readonly ConversationSummary[];
  readonly activeConversationId: number | undefined;
  readonly sessionId: string;
  readonly username?: string;
  readonly apiUrl: string;
  readonly agent: Parameters<typeof presentModel>[0];
  readonly onClose: () => void;
  readonly onSelect: (conversationId: number) => void;
  readonly onCreate: () => void;
  readonly onShare: () => void;
  readonly onLeave: () => void;
  readonly onApiUrlChange: (apiUrl: string) => void;
  /** Opens the model picker. */
  readonly onOpenModels: () => void;
};

type Section = "share" | "server" | "theme" | "language";

function conversationName(conversation: ConversationSummary, index: number, t: Translate): string {
  if (conversation.id === ROOT_CONVERSATION_ID) return t("menu.mainChat");
  return t("menu.branch", { index });
}

type SettingRowProps = {
  readonly label: string;
  readonly value?: string;
  readonly open?: boolean;
  readonly onPress: () => void;
  readonly styles: ReturnType<typeof createStyles>;
  readonly color: string;
};

/** One collapsed setting: its name, its current value, and a chevron. Tapping expands it in place. */
function SettingRow({ label, value, open, onPress, styles, color }: SettingRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={value === undefined ? label : `${label}: ${value}`}
      accessibilityState={open === undefined ? undefined : { expanded: open }}
      onPress={onPress}
      style={({ pressed }) => [styles.item, pressed && styles.rowPressed]}
    >
      <Text style={styles.itemTitle}>{label}</Text>
      {value !== undefined ? (
        <Text numberOfLines={1} style={styles.settingValue}>
          {value}
        </Text>
      ) : (
        <View style={styles.itemCopy} />
      )}
      {open === undefined ? (
        <ChevronRightIcon size={14} color={color} />
      ) : open ? (
        <ChevronUpIcon size={14} color={color} />
      ) : (
        <ChevronDownIcon size={14} color={color} />
      )}
    </Pressable>
  );
}

export function SessionSheet({
  visible,
  conversations,
  activeConversationId,
  sessionId,
  username,
  apiUrl,
  agent,
  onClose,
  onSelect,
  onCreate,
  onShare,
  onLeave,
  onApiUrlChange,
  onOpenModels,
}: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t, locale } = useI18n();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const activeModel: PresentedModel | undefined = presentModel(agent);

  const [copied, setCopied] = useState(false);
  const [draftUrl, setDraftUrl] = useState(apiUrl);
  const [urlError, setUrlError] = useState<string | undefined>();
  const [openSection, setOpenSection] = useState<Section | undefined>(undefined);

  const wasVisible = useRef(false);
  useEffect(() => {
    if (!visible) {
      wasVisible.current = false;
      return;
    }
    if (!wasVisible.current) {
      setDraftUrl(apiUrl);
      setUrlError(undefined);
    }
    wasVisible.current = true;
  }, [apiUrl, visible]);

  useEffect(() => {
    // Calling BackHandler on web throws and takes down the sheet.
    if (!visible || Platform.OS === "web") return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [visible, onClose]);

  const panelRef = useRef<ComponentRef<typeof View>>(null);
  const closeRef = useRef<ComponentRef<typeof View>>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Web only: focus moves into the drawer, Escape closes it, Tab stays inside, and focus returns on close.
  useEffect(() => {
    if (!visible || Platform.OS !== "web") return;
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current as unknown as HTMLElement | null;
    const close = closeRef.current as unknown as HTMLElement | null;
    (close ?? panel)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || panel === null) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        isEnabledElement,
      );
      const active = document.activeElement;
      const target = tabTrapIndex({
        count: focusable.length,
        index: focusable.findIndex((element) => element === active),
        shift: event.shiftKey,
        inside: active !== null && panel.contains(active),
      });
      if (target === undefined) return;
      event.preventDefault();
      focusable[target]?.focus();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (previous !== null && document.body.contains(previous)) previous.focus();
    };
  }, [visible]);

  if (!visible) return null;

  const copyCode = async () => {
    try {
      await Clipboard.setStringAsync(sessionId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const saveUrl = () => {
    const next = normalizeBaseUrl(draftUrl);
    if (next.length === 0) {
      setUrlError(t("menu.serverRequired"));
      return;
    }
    setUrlError(undefined);
    if (next !== apiUrl) onApiUrlChange(next);
  };

  const toggle = (section: Section) =>
    setOpenSection((current) => (current === section ? undefined : section));

  const displayName = username !== undefined && username.length > 0 ? username : t("common.user");

  return (
    <View style={styles.container} accessibilityViewIsModal>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        focusable={false}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        aria-hidden={true}
      />
      <View
        ref={panelRef}
        testID="session-sheet"
        role="dialog"
        aria-modal={true}
        aria-label={t("menu.label")}
        style={[styles.sheet, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.sm }]}
      >
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>
            Mots
          </Text>
          <Pressable
            ref={closeRef}
            accessibilityRole="button"
            accessibilityLabel={t("menu.close")}
            onPress={onClose}
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}
          >
            <CloseIcon size={16} color={colors.textPrimary} />
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("menu.newChat")}
          onPress={() => {
            onCreate();
            onClose();
          }}
          style={({ pressed }) => [styles.newChat, pressed && styles.rowPressed]}
        >
          <View style={styles.newChatIcon}>
            <PlusIcon size={14} color={colors.invertFg} />
          </View>
          <Text style={styles.newChatLabel}>{t("menu.newChat")}</Text>
        </Pressable>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.block}>
            <Text style={styles.section}>{t("menu.chats")}</Text>
            {conversations.length === 0 ? (
              <Text style={styles.empty}>{t("menu.noChats")}</Text>
            ) : (
              conversations.map((conversation, index) => {
                const active = conversation.id === activeConversationId;
                const name = conversationName(conversation, index, t);
                return (
                  <Pressable
                    key={conversation.id}
                    accessibilityRole="button"
                    accessibilityLabel={name}
                    accessibilityState={{ selected: active }}
                    onPress={() => {
                      onSelect(conversation.id);
                      onClose();
                    }}
                    style={({ pressed }) => [
                      styles.item,
                      active && styles.itemActive,
                      pressed && styles.rowPressed,
                    ]}
                  >
                    {active ? <View style={styles.activeBar} /> : null}
                    <Text numberOfLines={1} style={[styles.itemTitle, active && styles.itemTitleActive]}>
                      {name}
                    </Text>
                  </Pressable>
                );
              })
            )}
          </View>

          <View style={styles.block}>
            <Text style={styles.section}>{t("menu.settings")}</Text>

            <SettingRow
              label={t("menu.model")}
              value={activeModel?.shortName ?? "—"}
              onPress={onOpenModels}
              styles={styles}
              color={colors.textSecondary}
            />
            <SettingRow
              label={t("menu.sharing")}
              value={t("menu.code")}
              open={openSection === "share"}
              onPress={() => toggle("share")}
              styles={styles}
              color={colors.textSecondary}
            />
            {openSection === "share" ? (
              <View style={styles.settingBody}>
                <Text selectable accessibilityLabel={t("menu.codeLabel", { code: sessionId })} style={styles.code}>
                  {sessionId}
                </Text>
                <Text style={styles.body}>
                  {t("menu.shareHint")}
                </Text>
                <View style={styles.row}>
                  <View style={styles.rowItem}>
                    <Button
                      label={copied ? t("common.copied") : t("menu.copyCode")}
                      variant="secondary"
                      onPress={() => void copyCode()}
                    />
                  </View>
                  <View style={styles.rowItem}>
                    <Button label={t("menu.share")} variant="secondary" onPress={onShare} />
                  </View>
                </View>
              </View>
            ) : null}

            <SettingRow
              label={t("menu.server")}
              value={apiUrl.replace(/^https?:\/\//, "")}
              open={openSection === "server"}
              onPress={() => toggle("server")}
              styles={styles}
              color={colors.textSecondary}
            />
            {openSection === "server" ? (
              <View style={styles.settingBody}>
                <TextField
                  label={t("menu.address")}
                  value={draftUrl}
                  onChangeText={setDraftUrl}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  error={urlError}
                  hint={t("menu.serverHint")}
                />
                <Button label={t("menu.saveServer")} variant="secondary" onPress={saveUrl} />
              </View>
            ) : null}

            <SettingRow
              label={t("menu.theme")}
              open={openSection === "theme"}
              onPress={() => toggle("theme")}
              styles={styles}
              color={colors.textSecondary}
            />
            {openSection === "theme" ? (
              <View style={styles.settingBody}>
                <ThemeSwitcher />
              </View>
            ) : null}

            <SettingRow
              label={t("menu.language")}
              value={t(locale === "it" ? "language.it" : "language.en")}
              open={openSection === "language"}
              onPress={() => toggle("language")}
              styles={styles}
              color={colors.textSecondary}
            />
            {openSection === "language" ? (
              <View style={styles.settingBody}>
                <LanguageSwitcher />
              </View>
            ) : null}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarLetter}>{displayName.slice(0, 1).toUpperCase()}</Text>
          </View>
          <Text numberOfLines={1} style={styles.footerName}>
            {displayName}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("menu.leaveLabel")}
            onPress={onLeave}
            style={({ pressed }) => [styles.leave, pressed && styles.pressed]}
          >
            <Text style={styles.leaveLabel}>{t("menu.leave")}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      ...StyleSheet.absoluteFill,
      zIndex: 20,
    },
    backdrop: {
      ...StyleSheet.absoluteFill,
      backgroundColor: colors.overlay,
    },
    sheet: {
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      width: "86%",
      maxWidth: 360,
      backgroundColor: colors.card,
      borderTopRightRadius: radius.xl,
      borderBottomRightRadius: radius.xl,
      paddingHorizontal: spacing.md,
    },
    header: {
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingLeft: spacing.sm,
    },
    title: {
      ...typeScale.title,
      color: colors.textPrimary,
    },
    close: {
      width: hit,
      height: hit,
      alignItems: "center",
      justifyContent: "center",
    },
    newChat: {
      minHeight: hit,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingHorizontal: spacing.sm,
      marginTop: spacing.sm,
      borderRadius: radius.sm,
    },
    newChatIcon: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.invertBg,
    },
    newChatLabel: {
      ...typeScale.bodyMedium,
      color: colors.textPrimary,
    },
    scroll: {
      flex: 1,
      marginTop: spacing.sm,
    },
    scrollContent: {
      gap: spacing.xl,
      paddingBottom: spacing.xl,
    },
    block: {
      gap: spacing.xs,
    },
    settingBody: {
      gap: spacing.sm,
      paddingTop: spacing.xs,
      paddingBottom: spacing.md,
    },
    settingValue: {
      ...typeScale.small,
      color: colors.textSecondary,
      flex: 1,
      textAlign: "right",
    },
    section: {
      ...typeScale.kicker,
      color: colors.textSecondary,
      paddingHorizontal: spacing.sm,
      marginBottom: spacing.xs,
    },
    code: {
      ...typeScale.mono,
      color: colors.textPrimary,
      backgroundColor: colors.field,
      borderRadius: radius.sm,
      padding: spacing.md,
    },
    row: {
      flexDirection: "row",
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    rowItem: {
      flex: 1,
    },
    body: {
      ...typeScale.small,
      color: colors.textSecondary,
      paddingHorizontal: spacing.sm,
    },
    meta: {
      ...typeScale.mono,
      fontSize: 11,
      color: colors.textSecondary,
      paddingHorizontal: spacing.sm,
    },
    empty: {
      ...typeScale.small,
      color: colors.textSecondary,
      paddingHorizontal: spacing.sm,
    },
    providers: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.xs,
      paddingVertical: spacing.xs,
    },
    provider: {
      minHeight: 32,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: spacing.md,
      alignItems: "center",
      justifyContent: "center",
    },
    providerLabel: {
      ...typeScale.caption,
    },
    item: {
      minHeight: hit,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.md,
    },
    itemActive: {
      backgroundColor: colors.skySoft,
    },
    activeBar: {
      position: "absolute",
      left: 0,
      top: "20%",
      height: "60%",
      width: 3,
      borderRadius: 2,
      backgroundColor: colors.textPrimary,
    },
    rowPressed: {
      backgroundColor: colors.surfaceSoft,
    },
    itemCopy: {
      flex: 1,
    },
    itemTitle: {
      ...typeScale.body,
      fontSize: 15,
      color: colors.textPrimary,
      flexShrink: 1,
    },
    itemTitleActive: {
      fontFamily: fonts.medium,
    },
    itemMeta: {
      ...typeScale.caption,
      fontFamily: fonts.regular,
      color: colors.textSecondary,
    },
    footer: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingTop: spacing.sm,
      paddingHorizontal: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.line,
    },
    avatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.blush,
    },
    avatarLetter: {
      fontFamily: fonts.semiBold,
      fontSize: 16,
      lineHeight: 20,
      color: colors.inkOnPastel,
    },
    footerName: {
      ...typeScale.bodyMedium,
      fontSize: 15,
      color: colors.textPrimary,
      flex: 1,
    },
    leave: {
      minWidth: hit,
      minHeight: hit,
      justifyContent: "center",
      paddingHorizontal: spacing.sm,
    },
    leaveLabel: {
      ...typeScale.label,
      color: colors.textSecondary,
    },
    pressed: {
      opacity: 0.7,
    },
  });
}
