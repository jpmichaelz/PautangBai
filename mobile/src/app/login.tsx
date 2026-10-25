import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  LayoutAnimation,
  UIManager,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/auth-context";
import { Frog } from "@/components/frog";
import { getApiBaseUrl, setApiBaseUrl } from "@/services/api/apiClient";
import PautangBaiLogo from "@/assets/images/PAUTANGBAI_LOGO.svg";
import AuthBg from "@/assets/images/AUTH_BG.svg";

interface LoginScreenProps {
  onNavigateToRegister?: () => void;
}

interface FormError {
  title: string;
  message: string;
  field?: "username" | "password" | "all";
  isNetwork?: boolean;
}

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function LoginScreen({
  onNavigateToRegister,
}: LoginScreenProps = {}) {
  const router = useRouter();
  const { login } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<FormError | null>(null);

  // Advanced server URL toggle
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [serverUrl, setServerUrl] = useState(getApiBaseUrl());

  const dismissError = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setError(null);
  };

  const handleLogin = async () => {
    if (!username.trim()) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setError({
        title: "Username required",
        message: "Please enter your username to continue.",
        field: "username",
      });
      return;
    }
    if (!password) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setError({
        title: "Password required",
        message: "Please enter your password to sign in.",
        field: "password",
      });
      return;
    }

    dismissError();
    setIsSubmitting(true);
    console.log(`[Auth Login] Attempting login for username: "${username.trim()}"`);

    try {
      const res = await login(username.trim(), password);

      if (res.ok) {
        console.log(`[Auth Login SUCCESS] Logged in as: @${username.trim()}`);
        router.replace("/settings");
      } else {
        console.warn(`[Auth Login FAILED] Status ${res.status}:`, res.error, res.errors);
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        if (res.status === 401) {
          setError({
            title: "Invalid Credentials",
            message:
              res.error ||
              "The username or password you entered is incorrect. Please try again.",
            field: "all",
          });
        } else if (res.status === 422 && res.errors) {
          const firstField = Object.keys(res.errors)[0] as
            | "username"
            | "password";
          const firstMsg =
            res.errors[firstField]?.[0] ||
            res.error ||
            "Please check the information you entered.";
          setError({
            title:
              firstField === "password"
                ? "Invalid Password"
                : "Check Your Input",
            message: firstMsg,
            field:
              firstField === "username" || firstField === "password"
                ? firstField
                : "all",
          });
        } else if (res.status === 0 || !res.status) {
          setError({
            title: "Connection Failed",
            message:
              res.error ||
              "Unable to connect to the server. Check your network or adjust the server address.",
            isNetwork: true,
          });
        } else {
          setError({
            title: "Sign In Failed",
            message:
              res.error ||
              "An unexpected error occurred while signing in. Please try again.",
          });
        }
      }
    } catch (err: any) {
      console.error("[Auth Login Exception]:", err);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setError({
        title: "Connection Error",
        message:
          err?.message ||
          "Unable to connect to the server. Check your network or server URL configuration.",
        isNetwork: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };


  const handleSaveServerUrl = () => {
    if (serverUrl.trim()) {
      setApiBaseUrl(serverUrl.trim());
    }
    setShowServerConfig(false);
  };

  const isUsernameInvalid =
    error?.field === "username" || error?.field === "all";
  const isPasswordInvalid =
    error?.field === "password" || error?.field === "all";

  return (
    <View className="flex-1 bg-paper">
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <AuthBg
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid slice"
        />
      </View>
      <SafeAreaView className="flex-1" edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          behavior="padding"
          keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
          className="flex-1"
        >
          <ScrollView
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: "space-between",
            }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
            showsVerticalScrollIndicator={false}
            className="px-6 pt-2 pb-4"
          >
            {/* Top Header: Logo on the top left */}
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                {router.canGoBack() && (
                  <Pressable
                    onPress={() => {
                      if (!isSubmitting) router.back();
                    }}
                    disabled={isSubmitting}
                    className={`w-10 h-10 items-center justify-center rounded-full bg-white border border-frog/40 shadow-xs ${
                      isSubmitting ? "opacity-50" : "active:bg-mint/30"
                    }`}
                    accessibilityLabel="Go back"
                  >
                    <Ionicons name="arrow-back" size={18} color="#173D35" />
                  </Pressable>
                )}
                <PautangBaiLogo width={135} height={42} />
              </View>
              <View className="w-10" />
            </View>

            {/* Center Content: Centered Vertically */}
            <View className="flex-1 justify-center items-center w-full max-w-sm self-center py-4">
              {/* Hero Mascot: Prominent Frog */}
              <View className="items-center mb-3">
                <View
                  className={`w-36 h-36 rounded-full bg-white border-2 items-center justify-center shadow-xs ${
                    error ? "border-danger-600/30" : "border-forest-900/10"
                  }`}
                >
                  <Frog mood={error ? "thinking" : "welcome"} size={104} />
                </View>
                <Text className="text-xl font-black text-forest-900 tracking-tight mt-2 text-center">
                  Welcome Back, Bai!
                </Text>
              </View>

              {/* Modern Error Card */}
              {error && (
                <View
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite"
                  className="w-full bg-[#FFF5F5] border border-[#FCA5A5] rounded-2xl p-3.5 mb-2 shadow-xs"
                >
                  <View className="flex-row items-start gap-3">
                    {/* Icon Badge */}
                    <View className="w-8 h-8 rounded-full bg-[#FEE2E2] items-center justify-center shrink-0 mt-0.5">
                      <Ionicons
                        name={
                          error.isNetwork
                            ? "cloud-offline-outline"
                            : "alert-circle-outline"
                        }
                        size={18}
                        color="#B83D3D"
                      />
                    </View>

                    {/* Content */}
                    <View className="flex-1 pr-1">
                      <Text className="text-xs font-bold text-[#991B1B] tracking-tight">
                        {error.title}
                      </Text>
                      <Text className="text-[12px] text-[#7F1D1D] mt-0.5 leading-[17px] font-medium">
                        {error.message}
                      </Text>

                      {/* Action button if network error */}
                      {error.isNetwork && (
                        <Pressable
                          onPress={() => {
                            LayoutAnimation.configureNext(
                              LayoutAnimation.Presets.easeInEaseOut,
                            );
                            setShowServerConfig(true);
                          }}
                          className="flex-row items-center gap-1.5 mt-2 self-start py-1 px-2.5 rounded-lg bg-[#FEE2E2] active:bg-[#FECACA]"
                          accessibilityRole="button"
                          accessibilityLabel="Configure server URL"
                        >
                          <Ionicons
                            name="server-outline"
                            size={13}
                            color="#991B1B"
                          />
                          <Text className="text-[11px] font-bold text-[#991B1B]">
                            Configure Server Settings
                          </Text>
                        </Pressable>
                      )}
                    </View>

                    {/* Dismiss Button */}
                    <Pressable
                      onPress={dismissError}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      className="w-6 h-6 rounded-full items-center justify-center active:bg-[#FEE2E2]"
                      accessibilityRole="button"
                      accessibilityLabel="Dismiss error"
                    >
                      <Ionicons name="close" size={16} color="#991B1B" />
                    </Pressable>
                  </View>
                </View>
              )}

              {/* Form Fields: Flat Inputs with adjusted button spacing */}
              <View className="w-full gap-3.5 mt-2">
                {/* Username Input */}
                <View>
                  <Text className="text-xs font-bold text-forest-900 mb-1.5 ml-1">
                    Username
                  </Text>
                  <View
                    className={`flex-row items-center rounded-2xl px-4 min-h-[60px] shadow-xs border-2 ${
                      isUsernameInvalid
                        ? "bg-[#FFF8F8] border-[#B83D3D]"
                        : "bg-white border-forest-900/25"
                    }`}
                  >
                    <Ionicons
                      name="person-outline"
                      size={20}
                      color={isUsernameInvalid ? "#B83D3D" : "#287A63"}
                    />
                    <TextInput
                      value={username}
                      onChangeText={(val) => {
                        setUsername(val);
                        if (error) dismissError();
                      }}
                      placeholder="e.g. juan99"
                      placeholderTextColor={
                        isUsernameInvalid ? "#E57373" : "#718096"
                      }
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!isSubmitting}
                      className="flex-1 ml-3 py-3.5 text-ink text-base font-medium"
                    />
                  </View>
                </View>

                {/* Password Input */}
                <View>
                  <Text className="text-xs font-bold text-forest-900 mb-1.5 ml-1">
                    Password
                  </Text>
                  <View
                    className={`flex-row items-center rounded-2xl px-4 min-h-[60px] shadow-xs border-2 ${
                      isPasswordInvalid
                        ? "bg-[#FFF8F8] border-[#B83D3D]"
                        : "bg-white border-forest-900/25"
                    }`}
                  >
                    <Ionicons
                      name="lock-closed-outline"
                      size={20}
                      color={isPasswordInvalid ? "#B83D3D" : "#287A63"}
                    />
                    <TextInput
                      value={password}
                      onChangeText={(val) => {
                        setPassword(val);
                        if (error) dismissError();
                      }}
                      placeholder="Enter your password"
                      placeholderTextColor={
                        isPasswordInvalid ? "#E57373" : "#718096"
                      }
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!isSubmitting}
                      className="flex-1 ml-3 py-3.5 text-ink text-base font-medium"
                    />
                    <Pressable
                      onPress={() => setShowPassword((prev) => !prev)}
                      className="p-1 min-h-[44px] min-w-[44px] items-center justify-center"
                      accessibilityLabel={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      <Ionicons
                        name={showPassword ? "eye-off-outline" : "eye-outline"}
                        size={20}
                        color={isPasswordInvalid ? "#B83D3D" : "#287A63"}
                      />
                    </Pressable>
                  </View>
                </View>

                {/* Login Button with clear breathing room */}
                <Pressable
                  onPress={handleLogin}
                  disabled={isSubmitting}
                  className={`min-h-[58px] rounded-2xl items-center justify-center flex-row gap-2 mt-4 shadow-sm ${
                    isSubmitting
                      ? "bg-forest-900/70"
                      : "bg-forest-900 active:bg-forest-900/90"
                  }`}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Ionicons
                        name="log-in-outline"
                        size={22}
                        color="#FFFFFF"
                      />
                      <Text className="text-white font-black text-base tracking-wide">
                        Log In
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>

            {/* Bottom Options & Navigation */}
            <View className="w-full max-w-sm self-center items-center pb-2">
              {/* Switch to Register */}
              <Pressable
                onPress={() =>
                  onNavigateToRegister
                    ? onNavigateToRegister()
                    : router.push("/register")
                }
                className="py-2.5 px-4 min-h-[44px] items-center justify-center"
              >
                <Text className="text-xs text-white/90 font-bold">
                  Don't have an account yet?{" "}
                  <Text className="font-black text-white underline">
                    Register here
                  </Text>
                </Text>
              </Pressable>

              {/* Collapsible Server URL config for testing */}
              <Pressable
                onPress={() => setShowServerConfig((prev) => !prev)}
                className="flex-row items-center gap-1 py-1"
              >
                <Ionicons name="server-outline" size={13} color="#66716D" />
                <Text className="text-[11px] text-slate font-medium">
                  Server Settings
                </Text>
                <Ionicons
                  name={showServerConfig ? "chevron-up" : "chevron-down"}
                  size={12}
                  color="#66716D"
                />
              </Pressable>

              {showServerConfig && (
                <View className="w-full mt-2 p-3 bg-white border border-border rounded-xl">
                  <Text className="text-[10px] text-slate mb-1">
                    API Base URL (e.g. http://10.0.2.2:8000/api/v1):
                  </Text>
                  <TextInput
                    value={serverUrl}
                    onChangeText={setServerUrl}
                    placeholder="http://10.0.2.2:8000/api/v1"
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="none"
                    autoCorrect={false}
                    className="bg-paper border border-border rounded-lg px-2.5 py-1.5 text-xs text-ink mb-1.5"
                  />
                  <Pressable
                    onPress={handleSaveServerUrl}
                    className="bg-emerald-700 py-1.5 rounded-lg items-center"
                  >
                    <Text className="text-white text-[11px] font-bold">
                      Apply URL
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
