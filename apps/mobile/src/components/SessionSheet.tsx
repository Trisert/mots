import { useEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import { BackHandler, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ROOT_CONVERSATION_ID, type ConversationSummary } from "@mots/protocol";
import { normalizeBaseUrl } from "../config";
import { STATUS_LABEL, type ConversationStatus } from "../conversation-status";
import { useTheme } from "../context/ThemeContext";
import { announceNow } from "../a11y";
import { presentModel, type PresentedModel } from "../present";
import { CheckIcon, ChevronDownIcon, ChevronRightIcon, ChevronUpIcon, CloseIcon, PlusIcon } from "./Icon";
import { FOCUSABLE_SELECTOR, isEnabledElement, tabTrapIndex } from "../focus-trap";
import { fonts, hit, radius, spacing, type as typeScale, type ThemeColors } from "../theme";
import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";
import { ThemeSwitcher } from "../ui/ThemeSwitcher";

type Props = {
  readonly visible: boolean;
  readonly conversations: readonly ConversationSummary[];
  readonly activeConversationId: number | undefined;
  /** What each chat is doing, shown as a dot beside its name. */
  readonly statusOf: (conversationId: number) => ConversationStatus;
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

type Section = "share" | "server" | "theme";

function conversationName(conversation: ConversationSummary, index: number): string {
  if (conversation.id === ROOT_CONVERSATION_ID) return "Chat principale";
  return `Diramazione ${index}`;
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
  statusOf,
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
      announceNow("Codice copiato");
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const saveUrl = () => {
    const next = normalizeBaseUrl(draftUrl);
    if (next.length === 0) {
      setUrlError("Inserisci l'indirizzo del server.");
      return;
    }
    setUrlError(undefined);
    if (next !== apiUrl) onApiUrlChange(next);
  };

  const toggle = (section: Section) =>
    setOpenSection((current) => (current === section ? undefined : section));

  const displayName = username !== undefined && username.length > 0 ? username : "Utente";

  const statusColor = (status: ConversationStatus): string => {
    if (status === "working") return colors.focus;
    if (status === "retrying") return colors.danger;
    return colors.textSecondary;
  };

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
        aria-label="Menu"
        style={[styles.sheet, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.sm }]}
      >
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>
            Mots
          </Text>
          <Pressable
            ref={closeRef}
            accessibilityRole="button"
            accessibilityLabel="Chiudi menu"
            onPress={onClose}
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}
          >
            <CloseIcon size={16} color={colors.textPrimary} />
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Nuova chat"
          onPress={() => {
            onCreate();
            onClose();
          }}
          style={({ pressed }) => [styles.newChat, pressed && styles.rowPressed]}
        >
          <View style={styles.newChatIcon}>
            <PlusIcon size={14} color={colors.invertFg} />
          </View>
          <Text style={styles.newChatLabel}>Nuova chat</Text>
        </Pressable>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.block}>
            <Text accessibilityRole="header" style={styles.section}>Chat</Text>
            {conversations.length === 0 ? (
              <Text style={styles.empty}>Nessuna chat ancora.</Text>
            ) : (
              conversations.map((conversation, index) => {
                const active = conversation.id === activeConversationId;
                const name = conversationName(conversation, index);
                const status = statusOf(conversation.id);
                return (
                  <Pressable
                    key={conversation.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${name}, ${STATUS_LABEL[status]}`}
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
                    <Text numberOfLines={1} style={[styles.itemTitle, active && styles.itemTitleActive]}>
                      {name}
                    </Text>
                    <View
                      importantForAccessibility="no"
                      style={[styles.statusDot, { backgroundColor: statusColor(status) }]}
                    />
                  </Pressable>
                );
              })
            )}
          </View>

          <View style={styles.block}>
            <Text accessibilityRole="header" style={styles.section}>Impostazioni</Text>

            <SettingRow
              label="Modello"
              value={activeModel?.shortName ?? "—"}
              onPress={onOpenModels}
              styles={styles}
              color={colors.textSecondary}
            />
            <SettingRow
              label="Condivisione"
              value="Codice"
              open={openSection === "share"}
              onPress={() => toggle("share")}
              styles={styles}
              color={colors.textSecondary}
            />
            {openSection === "share" ? (
              <View style={styles.settingBody}>
                <Text selectable accessibilityLabel={`Codice sessione ${sessionId}`} style={styles.code}>
                  {sessionId}
                </Text>
                <Text style={styles.body}>
                  Condividi il codice per intero. La parte dopo il trattino basso è la firma.
                </Text>
                <View style={styles.row}>
                  <View style={styles.rowItem}>
                    <Button
                      label={copied ? "Copiato" : "Copia codice"}
                      variant="secondary"
                      onPress={() => void copyCode()}
                    />
                  </View>
                  <View style={styles.rowItem}>
                    <Button label="Condividi" variant="secondary" onPress={onShare} />
                  </View>
                </View>
              </View>
            ) : null}

            <SettingRow
              label="Server"
              value={apiUrl.replace(/^https?:\/\//, "")}
              open={openSection === "server"}
              onPress={() => toggle("server")}
              styles={styles}
              color={colors.textSecondary}
            />
            {openSection === "server" ? (
              <View style={styles.settingBody}>
                <TextField
                  label="Indirizzo"
                  value={draftUrl}
                  onChangeText={setDraftUrl}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  error={urlError}
                  hint="Salvare riconnette questa sessione al nuovo indirizzo."
                />
                <Button label="Salva server" variant="secondary" onPress={saveUrl} />
              </View>
            ) : null}

            <SettingRow
              label="Tema"
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
            accessibilityLabel="Esci dalla sessione"
            onPress={onLeave}
            style={({ pressed }) => [styles.leave, pressed && styles.pressed]}
          >
            <Text style={styles.leaveLabel}>Esci</Text>
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
    // Sits at the row's far end, so the labels keep their alignment with the section headings.
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginLeft: "auto",
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
