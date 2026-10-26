import { useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ROOT_CONVERSATION_ID, type ConversationSummary } from "@mots/protocol";
import { normalizeBaseUrl } from "../config";
import { useTheme } from "../context/ThemeContext";
import { presentModel, providerLabel, type PresentedModel } from "../present";
import { PROVIDER_MODELS, PROVIDERS } from "../models";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon, CloseIcon, PlusIcon } from "./Icon";
import { fonts, hit, radius, spacing, type as typeScale, type ThemeColors } from "../theme";
import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";
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
  readonly onModelSelect?: (provider: string, modelId: string) => Promise<boolean> | boolean;
};

type Section = "model" | "share" | "server" | "theme";

function conversationName(conversation: ConversationSummary, index: number): string {
  if (conversation.id === ROOT_CONVERSATION_ID) return "Chat principale";
  return `Diramazione ${index}`;
}

type SettingRowProps = {
  readonly label: string;
  readonly value?: string;
  readonly open: boolean;
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
      accessibilityState={{ expanded: open }}
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
      {open ? <ChevronUpIcon size={14} color={color} /> : <ChevronDownIcon size={14} color={color} />}
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
  onModelSelect,
}: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const activeModel: PresentedModel | undefined = presentModel(agent);

  const [selectedProviderId, setSelectedProviderId] = useState(activeModel?.provider ?? "kilo");
  const [pending, setPending] = useState<{ provider: string; modelId: string } | undefined>();
  const [copied, setCopied] = useState(false);
  const [draftUrl, setDraftUrl] = useState(apiUrl);
  const [urlError, setUrlError] = useState<string | undefined>();
  const [openSection, setOpenSection] = useState<Section | undefined>(undefined);

  const liveProvider = activeModel?.provider;
  const wasVisible = useRef(false);
  useEffect(() => {
    if (!visible) {
      wasVisible.current = false;
      return;
    }
    if (!wasVisible.current) {
      setDraftUrl(apiUrl);
      setUrlError(undefined);
      if (liveProvider !== undefined) setSelectedProviderId(liveProvider);
    }
    wasVisible.current = true;
  }, [apiUrl, liveProvider, visible]);

  const liveModelId = activeModel?.modelId;
  useEffect(() => {
    if (pending !== undefined && liveProvider === pending.provider && liveModelId === pending.modelId) {
      setPending(undefined);
    }
  }, [liveModelId, liveProvider, pending]);

  useEffect(() => {
    // Calling BackHandler on web throws and takes down the sheet.
    if (!visible || Platform.OS === "web") return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [visible, onClose]);

  if (!visible) return null;

  const models = PROVIDER_MODELS[selectedProviderId] ?? [];
  const inUse = activeModel === undefined
    ? "Il server non ha ancora indicato il modello."
    : `In uso: ${providerLabel(activeModel.provider)} · ${activeModel.modelId}`;

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
      setUrlError("Inserisci l'indirizzo del server.");
      return;
    }
    setUrlError(undefined);
    if (next !== apiUrl) onApiUrlChange(next);
  };

  const toggle = (section: Section) =>
    setOpenSection((current) => (current === section ? undefined : section));

  const chooseModel = (modelId: string) => {
    const request = { provider: selectedProviderId, modelId };
    setPending(request);
    void Promise.resolve(onModelSelect?.(request.provider, request.modelId)).then((ok) => {
      if (ok === false) setPending(undefined);
    });
  };

  const displayName = username !== undefined && username.length > 0 ? username : "Utente";
  const selectedProvider = PROVIDERS.find((provider) => provider.id === selectedProviderId) ?? PROVIDERS[0];

  return (
    <View style={styles.container} accessibilityViewIsModal>
      <Pressable accessibilityLabel="Chiudi menu" style={styles.backdrop} onPress={onClose} />
      <View
        testID="session-sheet"
        style={[styles.sheet, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.sm }]}
      >
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>
            Mots
          </Text>
          <Pressable
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
            <Text style={styles.section}>Chat</Text>
            {conversations.length === 0 ? (
              <Text style={styles.empty}>Nessuna chat ancora.</Text>
            ) : (
              conversations.map((conversation, index) => {
                const active = conversation.id === activeConversationId;
                const name = conversationName(conversation, index);
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
                    <Text numberOfLines={1} style={[styles.itemTitle, active && styles.itemTitleActive]}>
                      {name}
                    </Text>
                  </Pressable>
                );
              })
            )}
          </View>

          <View style={styles.block}>
            <Text style={styles.section}>Impostazioni</Text>

            <SettingRow
              label="Modello"
              value={activeModel?.modelId ?? "—"}
              open={openSection === "model"}
              onPress={() => toggle("model")}
              styles={styles}
              color={colors.textSecondary}
            />
            {openSection === "model" ? (
              <View style={styles.settingBody}>
                <Text style={styles.body}>{inUse}</Text>
                {pending !== undefined ? (
                  <Text style={styles.body}>Richiesto {pending.modelId}. Aspetto conferma dal server.</Text>
                ) : null}
                <View style={styles.providers}>
                  {PROVIDERS.map((provider) => {
                    const selected = provider.id === selectedProviderId;
                    return (
                      <Pressable
                        key={provider.id}
                        accessibilityRole="button"
                        accessibilityLabel={provider.name}
                        accessibilityState={{ selected }}
                        onPress={() => setSelectedProviderId(provider.id)}
                        style={[
                          styles.provider,
                          selected
                            ? { backgroundColor: colors.invertBg, borderColor: colors.invertBg }
                            : { borderColor: colors.fieldBorder },
                        ]}
                      >
                        <Text
                          style={[styles.providerLabel, { color: selected ? colors.invertFg : colors.textPrimary }]}
                        >
                          {provider.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={styles.meta}>
                  {selectedProvider?.details}
                  {" · "}
                  {selectedProvider?.endpoint}
                </Text>
                {models.map((model) => {
                  const live = activeModel?.provider === selectedProviderId && activeModel.modelId === model.id;
                  return (
                    <Pressable
                      key={model.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${model.name}. ${model.id}`}
                      accessibilityState={{ selected: live }}
                      onPress={() => chooseModel(model.id)}
                      style={({ pressed }) => [styles.item, live && styles.itemActive, pressed && styles.rowPressed]}
                    >
                      <View style={styles.itemCopy}>
                        <Text style={[styles.itemTitle, live && styles.itemTitleActive]}>{model.name}</Text>
                        <Text style={styles.itemMeta}>{model.tag}</Text>
                      </View>
                      {live ? <CheckIcon size={16} color={colors.textPrimary} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

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
      backgroundColor: colors.bgMain,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderRightColor: colors.fieldBorder,
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
      fontFamily: fonts.serif,
      fontSize: 28,
      lineHeight: 32,
      letterSpacing: -0.5,
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
      borderRadius: radius.sm,
    },
    itemActive: {
      backgroundColor: colors.surfaceSoft,
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
      borderTopColor: colors.fieldBorder,
    },
    avatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.invertBg,
    },
    avatarLetter: {
      fontFamily: fonts.serif,
      fontSize: 18,
      lineHeight: 22,
      color: colors.invertFg,
    },
    footerName: {
      ...typeScale.bodyMedium,
      fontSize: 15,
      color: colors.textPrimary,
      flex: 1,
    },
    leave: {
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
