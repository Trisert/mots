import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createSession, parseJoinTarget } from "../api";
import { DEFAULT_API_URL, normalizeBaseUrl } from "../config";
import { CloseIcon } from "../components/Icon";
import { useTheme } from "../context/ThemeContext";
import type { Identity } from "../storage";
import { hit, radius, spacing, type as typeScale, type ThemeColors } from "../theme";
import { Banner } from "../ui/Banner";
import { BrandMark } from "../ui/BrandMark";
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

  useEffect(() => {
    if (initialJoin) setModalOpen(true);
  }, [initialJoin]);

  const name = username.trim().length > 0 ? username.trim() : "Utente";

  const create = async () => {
    const baseUrl = normalizeBaseUrl(apiUrl);
    if (baseUrl.length === 0) {
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
    <ScrollView
      testID="onboarding-screen"
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xxl },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.column}>
        <View style={styles.intro}>
          <BrandMark size={52} />
          <Text accessibilityRole="header" maxFontSizeMultiplier={1.6} style={styles.title}>
            Mots
          </Text>
          <Text style={styles.lead}>
            Uno spazio calmo per pensare, ricordare e tornare sulle cose dopo.
          </Text>
        </View>

        <View style={styles.card}>
          <TextField
            label="Il tuo nome"
            value={username}
            onChangeText={setUsername}
            placeholder="Come ti chiamo"
            autoCapitalize="words"
            maxLength={40}
            hint="Se lo lasci vuoto, userò Utente."
          />
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
            accessibilityLabel="Entra in una sessione esistente"
            disabled={busy !== undefined}
            onPress={() => {
              setError(undefined);
              setModalOpen(true);
            }}
          />
        </View>

        <View style={styles.themeBlock}>
          <Text style={styles.themeLabel}>Tema</Text>
          <ThemeSwitcher />
        </View>
      </View>

      {modalOpen ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setModalOpen(false)}>
          <KeyboardAvoidingView style={styles.modalBackdrop} behavior="padding">
            <Pressable
              accessibilityLabel="Chiudi"
              style={styles.modalOverlay}
              onPress={() => setModalOpen(false)}
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
    </ScrollView>
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
      maxWidth: 440,
      alignSelf: "center",
      gap: spacing.xl,
    },
    intro: {
      gap: spacing.md,
    },
    title: {
      ...typeScale.display,
      color: colors.textPrimary,
    },
    lead: {
      ...typeScale.body,
      color: colors.textSecondary,
      maxWidth: 360,
    },
    card: {
      gap: spacing.lg,
      backgroundColor: colors.cardSurfacePrimary,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      padding: spacing.xl,
    },
    themeBlock: {
      gap: spacing.sm,
    },
    themeLabel: {
      ...typeScale.caption,
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
      borderRadius: radius.xl,
      backgroundColor: colors.bgMain,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
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
