import { useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ROOT_CONVERSATION_ID, type ConversationSummary } from "@mots/protocol";
import { normalizeBaseUrl } from "../config";
import { useTheme } from "../context/ThemeContext";
import { presentModel, providerLabel, shortModelName, type PresentedModel } from "../present";
import { PROVIDER_MODELS, PROVIDERS } from "../models";
import { hit, inset, radius, spacing, type as typeScale, type ThemeColors } from "../theme";
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
  const [modelsOpen, setModelsOpen] = useState(false);
  const [serverOpen, setServerOpen] = useState(false);

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
    ? "Modello"
    : `${providerLabel(activeModel.provider)} · ${shortModelName(activeModel.modelId)}`;

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
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>
            {username !== undefined && username.length > 0 ? username : "Mots"}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Chiudi menu" onPress={onClose} style={styles.row}>
            <Text style={styles.rowLabel}>Chiudi</Text>
          </Pressable>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text selectable accessibilityLabel={`Codice sessione ${sessionId}`} style={styles.code}>
            {sessionId}
          </Text>
          <Pressable accessibilityRole="button" onPress={() => void copyCode()} style={styles.row}>
            <Text style={styles.rowLabel}>{copied ? "Copiato" : "Copia"}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onShare} style={styles.row}>
            <Text style={styles.rowLabel}>Condividi</Text>
          </Pressable>
          <View style={styles.rule} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Nuova chat"
            onPress={() => {
              onCreate();
              onClose();
            }}
            style={styles.row}
          >
            <Text style={styles.rowLabel}>Nuova chat</Text>
          </Pressable>
          {conversations.map((conversation, index) => {
            const active = conversation.id === activeConversationId;
            const name = conversationName(conversation, index);
            return (
              <Pressable
                key={conversation.id}
                accessibilityRole="button"
                accessibilityLabel={name}
                accessibilityState={{ selected: active }}
                onPress={() => onSelect(conversation.id)}
                style={[styles.row, active && styles.rowSelected]}
              >
                <Text style={[styles.rowLabel, active && styles.rowActive]}>{name}</Text>
              </Pressable>
            );
          })}
          <View style={styles.rule} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={inUse}
            accessibilityState={{ expanded: modelsOpen }}
            onPress={() => setModelsOpen((open) => !open)}
            style={styles.row}
          >
            <Text style={styles.rowLabel}>{inUse}</Text>
          </Pressable>
          {pending !== undefined ? <Text style={styles.note}>In attesa</Text> : null}
          {modelsOpen ? (
            <View>
              {PROVIDERS.map((provider) => {
                const selected = provider.id === selectedProviderId;
                return (
                  <Pressable
                    key={provider.id}
                    accessibilityRole="button"
                    accessibilityLabel={provider.name}
                    accessibilityState={{ selected }}
                    onPress={() => setSelectedProviderId(provider.id)}
                    style={[styles.row, selected && styles.rowSelected]}
                  >
                    <Text style={[styles.rowLabel, selected && styles.rowActive]}>{provider.name}</Text>
                  </Pressable>
                );
              })}
              {models.map((model) => {
                const live = activeModel?.provider === selectedProviderId && activeModel.modelId === model.id;
                return (
                  <Pressable
                    key={model.id}
                    accessibilityRole="button"
                    accessibilityLabel={model.name}
                    accessibilityState={{ selected: live }}
                    onPress={() => chooseModel(model.id)}
                    style={[styles.row, live && styles.rowSelected]}
                  >
                    <Text style={[styles.rowLabel, live && styles.rowActive]}>{model.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Server"
            accessibilityState={{ expanded: serverOpen }}
            onPress={() => setServerOpen((open) => !open)}
            style={styles.row}
          >
            <Text style={styles.rowLabel}>Server</Text>
          </Pressable>
          {serverOpen ? (
            <View style={styles.server}>
              <TextField
                label="Indirizzo"
                value={draftUrl}
                onChangeText={setDraftUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                error={urlError}
              />
              <Pressable accessibilityRole="button" accessibilityLabel="Salva server" onPress={saveUrl} style={styles.row}>
                <Text style={styles.rowLabel}>Salva</Text>
              </Pressable>
            </View>
          ) : null}
          <View style={styles.rule} />
          <ThemeSwitcher />
          <View style={styles.rule} />
          <Pressable accessibilityRole="button" accessibilityLabel="Esci dalla sessione" onPress={onLeave} style={styles.row}>
            <Text style={styles.rowLabel}>Esci</Text>
          </Pressable>
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
      justifyContent: "flex-end",
    },
    backdrop: {
      ...StyleSheet.absoluteFill,
      backgroundColor: colors.overlay,
    },
    sheet: {
      maxHeight: "88%",
      backgroundColor: colors.bgMain,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderSubtle,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      overflow: "hidden",
      paddingTop: spacing.lg,
      paddingHorizontal: inset,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    title: {
      ...typeScale.body,
      color: colors.textPrimary,
    },
    code: {
      ...typeScale.small,
      color: colors.textSecondary,
      paddingVertical: spacing.md,
    },
    row: {
      minHeight: hit,
      justifyContent: "center",
      borderRadius: radius.md,
      paddingHorizontal: spacing.sm,
      marginHorizontal: -spacing.sm,
    },
    rowLabel: {
      ...typeScale.body,
      color: colors.textPrimary,
    },
    rowActive: {
      color: colors.textPrimary,
    },
    rowSelected: {
      backgroundColor: colors.surfaceSoft,
    },
    note: {
      ...typeScale.small,
      color: colors.textSecondary,
      paddingBottom: spacing.sm,
    },
    rule: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.borderSubtle,
      marginVertical: spacing.sm,
    },
    server: {
      gap: spacing.sm,
    },
  });
}
