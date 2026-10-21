import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ChatScreen } from "./src/screens/ChatScreen";
import { OnboardingScreen } from "./src/screens/OnboardingScreen";
import {
  clearIdentity,
  loadIdentity,
  saveIdentity,
  type Identity,
} from "./src/storage";
import { colors, radius, spacing } from "./src/theme";

function Splash() {
  return (
    <View style={styles.splash}>
      <View style={styles.brandRow}>
        <Text style={styles.wordmark}>mots</Text>
        <View style={styles.brandDot} />
      </View>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

export default function App() {
  const [identity, setIdentity] = useState<Identity | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    void loadIdentity().then((stored) => {
      if (!alive) return;
      setIdentity(stored);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  const handleReady = async (next: Identity) => {
    await saveIdentity(next);
    setIdentity(next);
  };

  const handleLeave = async () => {
    await clearIdentity();
    setIdentity(undefined);
  };

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {loading ? (
        <Splash />
      ) : identity !== undefined ? (
        <ChatScreen identity={identity} onLeave={handleLeave} />
      ) : (
        <OnboardingScreen onReady={handleReady} />
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xl,
    backgroundColor: colors.background,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.xs,
  },
  wordmark: {
    color: colors.text,
    fontSize: 44,
    fontWeight: "700",
    letterSpacing: -2,
  },
  brandDot: {
    width: 9,
    height: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    marginBottom: 8,
  },
});
