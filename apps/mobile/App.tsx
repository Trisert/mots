import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFonts } from "expo-font";
import {
  InstrumentSerif_400Regular,
  InstrumentSerif_400Regular_Italic,
} from "@expo-google-fonts/instrument-serif";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from "@expo-google-fonts/inter";
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
} from "@expo-google-fonts/jetbrains-mono";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider, useTheme } from "./src/context/ThemeContext";
import { ChatScreen } from "./src/screens/ChatScreen";
import { OnboardingScreen } from "./src/screens/OnboardingScreen";
import {
  clearIdentity,
  loadIdentity,
  saveIdentity,
  type Identity,
} from "./src/storage";
import { spacing, type as typeScale } from "./src/theme";
import { BrandMark } from "./src/ui/BrandMark";

function Splash() {
  const { colors } = useTheme();
  return (
    <View style={[styles.splash, { backgroundColor: colors.bgMain }]}>
      <BrandMark size={56} />
      <Text accessibilityRole="header" style={[styles.wordmark, { color: colors.textPrimary }]}>
        Mots
      </Text>
      <ActivityIndicator color={colors.textSecondary} />
    </View>
  );
}

function MainApp() {
  const { colors, isDark } = useTheme();
  const [fontsLoaded, fontError] = useFonts({
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
  });

  const [identity, setIdentity] = useState<Identity | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [openJoin, setOpenJoin] = useState(false);

  useEffect(() => {
    let alive = true;
    if (Platform.OS === "web" && typeof document !== "undefined") {
      // The UI copy is Italian; the served shell declares lang="en" (WCAG 3.1.1).
      document.documentElement.lang = "it";

      const fontLinkId = "mots-google-fonts";
      if (!document.getElementById(fontLinkId)) {
        const link = document.createElement("link");
        link.id = fontLinkId;
        link.rel = "stylesheet";
        link.href =
          "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap";
        document.head.appendChild(link);
      }

      const styleId = "mots-web-base";
      if (!document.getElementById(styleId)) {
        const style = document.createElement("style");
        style.id = styleId;
        style.textContent = `
          html, body, #root {
            height: 100%;
            margin: 0;
            padding: 0;
            font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }
          :focus-visible {
            outline: 2px solid var(--mots-focus, currentColor);
            outline-offset: 2px;
          }
        `;
        document.head.appendChild(style);
      }
    }
    void loadIdentity().then((stored) => {
      if (!alive) return;
      setIdentity(stored);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Synchronize HTML body & root background color on web when theme changes
  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      document.body.style.backgroundColor = colors.bgMain;
      if (document.documentElement) {
        document.documentElement.style.backgroundColor = colors.bgMain;
        document.documentElement.style.colorScheme = isDark ? "dark" : "light";
        document.documentElement.style.setProperty("--mots-focus", colors.accent);
      }
      const root = document.getElementById("root");
      if (root) {
        root.style.backgroundColor = colors.bgMain;
      }
    }
  }, [colors.accent, colors.bgMain, isDark]);

  const handleReady = async (next: Identity) => {
    await saveIdentity(next);
    setIdentity(next);
  };

  const handleLeave = async () => {
    await clearIdentity();
    setOpenJoin(false);
    setIdentity(undefined);
  };

  const handleRestart = async (mode: "create" | "join") => {
    await clearIdentity();
    setOpenJoin(mode === "join");
    setIdentity(undefined);
  };

  if ((!fontsLoaded && !fontError) || loading) {
    return <Splash />;
  }

  const content =
    identity !== undefined ? (
      <ChatScreen
        identity={identity}
        onLeave={handleLeave}
        onIdentityChange={handleReady}
        onRestart={(mode) => void handleRestart(mode)}
      />
    ) : (
      <OnboardingScreen
        initialJoin={openJoin}
        onReady={async (next) => {
          setOpenJoin(false);
          await handleReady(next);
        }}
      />
    );

  return (
    <KeyboardProvider>
      <StatusBar style={isDark ? "light" : "dark"} />
      <View style={[styles.root, { backgroundColor: colors.bgMain }]}>{content}</View>
    </KeyboardProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <MainApp />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  splash: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.xxl,
  },
  wordmark: {
    ...typeScale.display,
  },
});
