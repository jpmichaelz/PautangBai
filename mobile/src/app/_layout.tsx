import "@/global.css";

import { DarkTheme, DefaultTheme, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { SQLiteProvider, useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import {
  AppState,
  useColorScheme,
  LogBox,
  StyleSheet,
  View,
} from "react-native";
import { NavigationBar } from "expo-navigation-bar";
import { StatusBar } from "expo-status-bar";
import Animated, {
  SlideInRight,
  SlideOutLeft,
  SlideInLeft,
  SlideOutRight,
} from "react-native-reanimated";

import { enforceImmersiveSystemBars } from "@/utils/system-bars";
import AppTabs from "@/components/app-tabs";
import { DATABASE_NAME, migrateDbIfNeeded } from "@/database/migrate";
import { useAutoSync } from "@/services/sync/useAutoSync";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { Colors } from "@/constants/theme";
import LoginScreen from "./login";
import RegisterScreen from "./register";

LogBox.ignoreLogs([
  "ImageBackground is deprecated",
  "setLayoutAnimationEnabledExperimental",
  "CssInterop upgrade warning",
  "Components need to set a variable during the initial render",
]);

const originalWarn = console.warn;
console.warn = (...args: unknown[]) => {
  if (
    typeof args[0] === "string" &&
    (args[0].includes("ImageBackground is deprecated") ||
      args[0].includes("setLayoutAnimationEnabledExperimental") ||
      args[0].includes("CssInterop upgrade warning") ||
      args[0].includes("Components need to set a variable"))
  ) {
    return;
  }
  originalWarn(...args);
};

const CustomDefaultTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: Colors.light.background,
    card: Colors.light.card,
    text: Colors.light.text,
    border: Colors.light.border,
  },
};

const CustomDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: Colors.dark.background,
    card: Colors.dark.card,
    text: Colors.dark.text,
    border: Colors.dark.border,
  },
};

SplashScreen.preventAutoHideAsync();

function AppNavigation() {
  const { canAccessApp, isLoading } = useAuth();
  const db = useSQLiteContext();
  useAutoSync(db);

  const [authView, setAuthView] = useState<"login" | "register">("login");
  const [direction, setDirection] = useState<"forward" | "backward">("forward");

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isLoading]);

  if (isLoading) {
    return null;
  }

  if (!canAccessApp) {
    return (
      <View style={{ flex: 1, overflow: "hidden" }}>
        <Animated.View
          key={authView}
          entering={
            direction === "forward"
              ? SlideInRight.duration(280)
              : SlideInLeft.duration(280)
          }
          exiting={
            direction === "forward"
              ? SlideOutLeft.duration(240)
              : SlideOutRight.duration(240)
          }
          style={[StyleSheet.absoluteFill, { width: "100%", height: "100%" }]}
        >
          {authView === "register" ? (
            <RegisterScreen
              onNavigateToLogin={() => {
                setDirection("backward");
                setAuthView("login");
              }}
            />
          ) : (
            <LoginScreen
              onNavigateToRegister={() => {
                setDirection("forward");
                setAuthView("register");
              }}
            />
          )}
        </Animated.View>
      </View>
    );
  }

  return <AppTabs />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    enforceImmersiveSystemBars();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        enforceImmersiveSystemBars();
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <ThemeProvider
      value={colorScheme === "dark" ? CustomDarkTheme : CustomDefaultTheme}
    >
      <StatusBar hidden />
      <NavigationBar hidden />
      <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDbIfNeeded}>
        <AuthProvider>
          <AppNavigation />
        </AuthProvider>
      </SQLiteProvider>
    </ThemeProvider>
  );
}
