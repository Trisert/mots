import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { KeyboardAvoidingView, KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createSession, parseJoinTarget } from "../api";
import { DEFAULT_API_URL, normalizeBaseUrl } from "../config";
import { ChevronDownIcon, ChevronUpIcon, CloseIcon } from "../components/Icon";
import { useTheme } from "../context/ThemeContext";
import type { Identity } from "../storage";
import { hit, radius, spacing, type as typeScale, type ThemeColors } from "../theme";
import { Banner } from "../ui/Banner";
import { Mascot } from "../components/Mascot";
import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";
import { ThemeSwitcher } from "../ui/ThemeSwitcher";

type Props = {
  readonly onReady: (identity: Identity) => void | Promise<void>;
  readonly initialJoin?: boolean;
};

type Busy = "create" | "join" | undefined;

export function OnboardingScreen({ onReady, initialJoin = false }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [username, setUsername] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
  const [busy, setBusy] = useState<Busy>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [modalOpen, setModalOpen] = useState(initialJoin);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    if (initialJoin) setModalOpen(true);
  }, [initialJoin]);

  const name = username.trim().length > 0 ? username.trim() : "Utente";

  const create = async () => {
    const baseUrl = normalizeBaseUrl(apiUrl);
    if (baseUrl.length === 0) {
      setAdvancedOpen(true);
      setError("Inserisci l'indirizzo del server.");
      return;
    }
    setBusy("create");
    setError(undefined);
    try {
      const sessionId = await createSession(baseUrl);
      await onReady({ sessionId, username: name, apiUrl: baseUrl });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Non riesco a creare lo spazio. Controlla che il server sia attivo.",
      );
    } finally {
      setBusy(undefined);
    }
  };

  const join = async () => {
    const target = parseJoinTarget(joinCode);
    if (target === undefined) {
      setError("Codice non valido. Incolla il codice o il link della sessione.");
      return;
    }
    const baseUrl = normalizeBaseUrl(target.baseUrl ?? apiUrl);
    if (baseUrl.length === 0) {
      setError("Inserisci l'indirizzo del server.");
      return;
    }
    setBusy("join");
    setError(undefined);
    try {
      setModalOpen(false);
      await onReady({ sessionId: target.sessionId, username: name, apiUrl: baseUrl });
    } catch {
      setError("Non riesco a salvare la sessione su questo dispositivo.");
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <KeyboardAwareScrollView
      testID="onboarding-screen"
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xxl },
      ]}
      keyboardShouldPersistTaps="handled"
      bottomOffset={spacing.lg}
    >
      <View role="main" style={styles.column}>
        <View style={styles.intro}>
          <View style={styles.mascotPanel}>
            <Mascot mood="felice" size={176} shadow />
          </View>
          <Text role="heading" aria-level={1} style={styles.title}>
            Ciao, sono Mots
          </Text>
          <Text style={styles.lead}>
            Ricordo quello che mi dici, ti avviso quando serve e ti tengo compagnia.
          </Text>
        </View>

        <View style={styles.form}>
          <TextField
            label="Il tuo nome"
            value={username}
            onChangeText={setUsername}
            placeholder="Come ti chiamo"
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            maxLength={40}
            hint="Se lo lasci vuoto, userò Utente."
          />
          {error !== undefined && !modalOpen ? <Banner message={error} /> : null}
          <Button
            label="Crea uno spazio"
            accessibilityLabel="Crea uno spazio"
            loading={busy === "create"}
            disabled={busy !== undefined}
            onPress={() => void create()}
          />
          <Button
            label="Ho un codice"
            variant="ghost"
            accessibilityLabel="Ho un codice: entra in una sessione esistente"
            disabled={busy !== undefined}
            onPress={() => {
              setError(undefined);
              setModalOpen(true);
            }}
          />
        </View>

        <View style={styles.advanced}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Avanzate"
            accessibilityState={{ expanded: advancedOpen }}
            onPress={() => setAdvancedOpen((open) => !open)}
            style={({ pressed }) => [styles.advancedToggle, pressed && styles.pressed]}
          >
            <Text style={styles.advancedLabel}>Avanzate</Text>
            {advancedOpen ? (
              <ChevronUpIcon size={14} color={colors.textSecondary} />
            ) : (
              <ChevronDownIcon size={14} color={colors.textSecondary} />
            )}
          </Pressable>
          {advancedOpen ? (
            <View style={styles.advancedBody}>
              <TextField
                label="Server"
                value={apiUrl}
                onChangeText={setApiUrl}
                placeholder="http://localhost:8787"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                hint="Sul telefono usa l'indirizzo del computer, non localhost."
              />
              <View style={styles.themeBlock}>
                <Text style={styles.themeLabel}>Tema</Text>
                <ThemeSwitcher />
              </View>
            </View>
          ) : null}
        </View>
      </View>

      {modalOpen ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setModalOpen(false)}>
          <KeyboardAvoidingView style={styles.modalBackdrop} behavior="padding">
            <Pressable
              style={styles.modalOverlay}
              onPress={() => setModalOpen(false)}
              focusable={false}
              accessible={false}
              importantForAccessibility="no-hide-descendants"
              aria-hidden={true}
            />
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <Text accessibilityRole="header" style={styles.modalTitle}>
                  Entra
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Chiudi"
                  onPress={() => setModalOpen(false)}
                  style={styles.modalClose}
                >
                  <CloseIcon size={16} color={colors.textPrimary} />
                </Pressable>
              </View>
              <Text style={styles.modalBody}>
                Incolla il codice o il link. Un codice nuovo apre uno spazio vuoto.
              </Text>
              <TextField
                label="Codice o link"
                value={joinCode}
                onChangeText={setJoinCode}
                placeholder="100d5bc8-fbcd-…"
                autoFocus
                maxLength={512}
                autoCapitalize="none"
              />
              {error !== undefined ? <Banner message={error} /> : null}
              <Button
                label="Entra"
                accessibilityLabel="Entra nella sessione"
                loading={busy === "join"}
                disabled={busy === "join"}
                onPress={() => void join()}
              />
            </View>
          </KeyboardAvoidingView>
        </Modal>
      ) : null}
    </KeyboardAwareScrollView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.bgMain,
    },
    content: {
      flexGrow: 1,
      justifyContent: "center",
      paddingHorizontal: spacing.xl,
    },
    column: {
      width: "100%",
      maxWidth: 400,
      alignSelf: "center",
      gap: spacing.xxl,
    },
    intro: {
      alignItems: "center",
      gap: spacing.md,
    },
    mascotPanel: {
      alignSelf: "stretch",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: spacing.xxl,
      marginBottom: spacing.sm,
      borderRadius: radius.xl,
      backgroundColor: colors.blushSoft,
    },
    title: {
      ...typeScale.title,
      textAlign: "center",
      color: colors.textPrimary,
    },
    lead: {
      ...typeScale.body,
      textAlign: "center",
      color: colors.textSecondary,
      maxWidth: 320,
    },
    form: {
      gap: spacing.lg,
    },
    advanced: {
      alignItems: "stretch",
      gap: spacing.lg,
    },
    advancedToggle: {
      minHeight: hit,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    advancedLabel: {
      ...typeScale.label,
      color: colors.textSecondary,
    },
    advancedBody: {
      gap: spacing.lg,
    },
    pressed: {
      opacity: 0.7,
    },
    themeBlock: {
      gap: spacing.sm,
    },
    themeLabel: {
      ...typeScale.kicker,
      color: colors.textSecondary,
    },
    modalBackdrop: {
      flex: 1,
      justifyContent: "center",
      padding: spacing.lg,
      backgroundColor: colors.overlay,
    },
    modalOverlay: {
      ...StyleSheet.absoluteFill,
    },
    modalSheet: {
      gap: spacing.lg,
      borderRadius: radius.composer,
      backgroundColor: colors.bgMain,
      padding: spacing.xl,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    modalTitle: {
      ...typeScale.heading,
      color: colors.textPrimary,
    },
    modalClose: {
      width: hit,
      height: hit,
      alignItems: "center",
      justifyContent: "center",
    },
    modalBody: {
      ...typeScale.small,
      color: colors.textSecondary,
    },
  });
}
