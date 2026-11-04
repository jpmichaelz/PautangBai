import { Platform } from "react-native";
import { NavigationBar, setVisibilityAsync } from "expo-navigation-bar";
import { setStatusBarHidden } from "expo-status-bar";

export function enforceImmersiveSystemBars() {
  if (Platform.OS === "android") {
    setStatusBarHidden(true, "none");
    NavigationBar.setHidden(true);
    setVisibilityAsync("hidden").catch(() => {});
  }
}

