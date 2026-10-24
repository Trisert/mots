import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createSession, parseJoinTarget } from "../api";
import { DEFAULT_API_URL, normalizeBaseUrl } from "../config";
import { useTheme } from "../context/ThemeContext";
import type { Identity } from "../storage";
import { hit, spacing, type as typeScale, type ThemeColors } from "../theme";
import { Banner } from "../ui/Banner";
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
  const [advanced, setAdvanced] = useState(initialJoin);

  useEffect(() => {
    if (initialJoin) setAdvanced(true);
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
        cause instanceof Error ? cause.message : "Non riesco a creare lo spazio.",
      );
    } finally {
      setBusy(undefined);
    }
  };

  const join = async () => {
    const target = parseJoinTarget(joinCode);
    if (target === undefined) {
      setError("Codice non valido.");
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
        { paddingTop: insets.top + spacing.xxxl, paddingBottom: insets.bottom + spacing.xxl },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.column}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={1.4} style={styles.title}>
          Mots
        </Text>
        <Text style={styles.line}>Uno spazio per pensare.</Text>
        {error !== undefined ? <Banner message={error} /> : null}
        <Button
          label="Inizia"
          accessibilityLabel="Inizia"
          loading={busy === "create"}
          disabled={busy !== undefined}
          onPress={() => void create()}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Avanzate"
          accessibilityState={{ expanded: advanced }}
          onPress={() => setAdvanced((open) => !open)}
          style={styles.advancedLink}
        >
          <Text style={styles.advancedLabel}>Avanzate</Text>
        </Pressable>
        {advanced ? (
          <View style={styles.advanced}>
            <TextField
              label="Nome"
              value={username}
              onChangeText={setUsername}
              placeholder="Utente"
              autoCapitalize="words"
              maxLength={40}
            />
            <TextField
              label="Server"
              value={apiUrl}
              onChangeText={setApiUrl}
              placeholder="http://localhost:8787"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <ThemeSwitcher />
            <TextField
              label="Codice"
              value={joinCode}
              onChangeText={setJoinCode}
              placeholder="Codice o link"
              autoFocus={initialJoin}
              maxLength={512}
              autoCapitalize="none"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Entra nella sessione"
              disabled={busy !== undefined}
              onPress={() => void join()}
              style={styles.advancedLink}
            >
              <Text style={styles.enter}>{busy === "join" ? "Entro" : "Entra"}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
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
      maxWidth: 420,
      alignSelf: "center",
      gap: spacing.xl,
    },
    title: {
      ...typeScale.title,
      color: colors.textPrimary,
    },
    line: {
      ...typeScale.body,
      color: colors.textSecondary,
    },
    advancedLink: {
      minHeight: hit,
      justifyContent: "center",
      alignSelf: "flex-start",
    },
    advancedLabel: {
      ...typeScale.small,
      color: colors.textSecondary,
    },
    advanced: {
      gap: spacing.lg,
    },
    enter: {
      ...typeScale.body,
      color: colors.textPrimary,
    },
  });
}
