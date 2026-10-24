import { useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ROOT_CONVERSATION_ID, type ConversationSummary } from "@mots/protocol";
import { normalizeBaseUrl } from "../config";
import { useTheme } from "../context/ThemeContext";
import { presentModel, providerLabel, type PresentedModel } from "../present";
import { PROVIDER_MODELS, PROVIDERS } from "../models";
import { CheckIcon, ChevronRightIcon, CloseIcon } from "./Icon";
import { hit, radius, spacing, type as typeScale, type ThemeColors } from "../theme";
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

function conversationName(conversation: ConversationSummary, index: number): string {
  if (conversation.id === ROOT_CONVERSATION_ID) return "Chat principale";
  return `Diramazione ${index}`;
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

  const chooseModel = (modelId: string) => {
    const request = { provider: selectedProviderId, modelId };
    setPending(request);
    void Promise.resolve(onModelSelect?.(request.provider, request.modelId)).then((ok) => {
      if (ok === false) setPending(undefined);
    });
  };

  return (
    <View style={styles.container} accessibilityViewIsModal>
      <Pressable accessibilityLabel="Chiudi menu" style={styles.backdrop} onPress={onClose} />
      <View
        testID="session-sheet"
        style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}
      >
        <View style={styles.handle} />
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text accessibilityRole="header" style={styles.title}>
              {username !== undefined && username.length > 0 ? username : "Mots"}
            </Text>
            <Text style={styles.subtitle}>Conversazioni e sessione</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Chiudi menu"
            onPress={onClose}
            style={styles.close}
          >
            <CloseIcon size={16} color={colors.textPrimary} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.block}>
            <Text style={styles.section}>Condivisione</Text>
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

          <View style={styles.block}>
            <Text style={styles.section}>Conversazioni</Text>
            <Button
              label="Nuova chat"
              onPress={() => {
                onCreate();
                onClose();
              }}
            />
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
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={styles.itemCopy}>
                      <Text style={[styles.itemTitle, active && styles.itemTitleActive]}>{name}</Text>
                      <Text style={styles.itemMeta}>{active ? "Aperta" : "Apri"}</Text>
                    </View>
                    {active ? (
                      <CheckIcon size={16} color={colors.textPrimary} />
                    ) : (
                      <ChevronRightIcon size={16} color={colors.textSecondary} />
                    )}
                  </Pressable>
                );
              })
            )}
          </View>

          <View style={styles.block}>
            <Text style={styles.section}>Modello</Text>
            <Text style={styles.body}>{inUse}</Text>
            {pending !== undefined ? (
              <Text style={styles.body}>Richiesto {pending.modelId}. Aspetto conferma dal server.</Text>
            ) : null}
            <View style={styles.providers}>
              {PROVIDERS.map((provider) => {
                const selected = provider.id === selectedProviderId;
                const live = activeModel?.provider === provider.id;
                return (
                  <Pressable
                    key={provider.id}
                    accessibilityRole="button"
                    accessibilityLabel={provider.name}
                    accessibilityState={{ selected }}
                    onPress={() => setSelectedProviderId(provider.id)}
                    style={[
                      styles.provider,
                      {
                        backgroundColor: selected ? colors.textPrimary : colors.bgMain,
                        borderColor: selected ? colors.textPrimary : colors.borderSubtle,
                      },
                    ]}
                  >
                    <Text style={[styles.providerLabel, { color: selected ? colors.bgMain : colors.textPrimary }]}>
                      {provider.name}
                      {live ? " · in uso" : ""}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.meta}>
              {(PROVIDERS.find((provider) => provider.id === selectedProviderId) ?? PROVIDERS[0])?.details}
              {" · "}
              {(PROVIDERS.find((provider) => provider.id === selectedProviderId) ?? PROVIDERS[0])?.endpoint}
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
                  style={({ pressed }) => [styles.item, live && styles.itemActive, pressed && styles.pressed]}
                >
                  <View style={styles.itemCopy}>
                    <Text style={styles.itemTitle}>{model.name}</Text>
                    <Text style={styles.itemMeta}>
                      {model.tag}
                      {live ? " · in uso" : ""}
                    </Text>
                  </View>
                  {live ? <CheckIcon size={16} color={colors.textPrimary} /> : null}
                </Pressable>
              );
            })}
          </View>

          <View style={styles.block}>
            <Text style={styles.section}>Server</Text>
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

          <View style={styles.block}>
            <Text style={styles.section}>Tema</Text>
            <ThemeSwitcher />
          </View>

          <Button label="Esci" variant="danger" accessibilityLabel="Esci dalla sessione" onPress={onLeave} />
        </ScrollView>
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
      right: 0,
      bottom: 0,
      maxHeight: "92%",
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      backgroundColor: colors.bgMain,
      paddingTop: spacing.sm,
      paddingHorizontal: spacing.lg,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
    },
    handle: {
      alignSelf: "center",
      width: 40,
      height: 4,
      borderRadius: radius.pill,
      backgroundColor: colors.borderMedium,
      marginBottom: spacing.md,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.md,
    },
    headerCopy: {
      flex: 1,
      gap: 2,
    },
    title: {
      ...typeScale.heading,
      color: colors.textPrimary,
    },
    subtitle: {
      ...typeScale.small,
      color: colors.textSecondary,
    },
    close: {
      width: hit,
      height: hit,
      borderRadius: hit / 2,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.cardSurfacePrimary,
    },
    scroll: {
      flexShrink: 1,
    },
    scrollContent: {
      gap: spacing.xl,
      paddingBottom: spacing.lg,
    },
    block: {
      gap: spacing.sm,
    },
    section: {
      ...typeScale.caption,
      color: colors.textSecondary,
      letterSpacing: 0.4,
    },
    code: {
      ...typeScale.small,
      color: colors.textPrimary,
      backgroundColor: colors.cardSurfacePrimary,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      padding: spacing.md,
    },
    row: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    rowItem: {
      flex: 1,
    },
    body: {
      ...typeScale.small,
      color: colors.textSecondary,
    },
    meta: {
      ...typeScale.caption,
      color: colors.textFaint,
    },
    empty: {
      ...typeScale.small,
      color: colors.textSecondary,
    },
    providers: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    provider: {
      minHeight: hit,
      borderRadius: radius.pill,
      borderWidth: 1,
      paddingHorizontal: spacing.md,
      alignItems: "center",
      justifyContent: "center",
    },
    providerLabel: {
      ...typeScale.label,
    },
    item: {
      minHeight: hit,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: colors.cardSurfacePrimary,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
    },
    itemActive: {
      borderColor: colors.textPrimary,
    },
    itemCopy: {
      flex: 1,
      gap: 2,
    },
    itemTitle: {
      ...typeScale.bodyMedium,
      color: colors.textPrimary,
    },
    itemTitleActive: {
      fontWeight: "600",
    },
    itemMeta: {
      ...typeScale.caption,
      color: colors.textSecondary,
    },
    pressed: {
      opacity: 0.75,
    },
  });
}
