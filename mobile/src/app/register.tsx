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
import PautangBaiLogo from "@/assets/images/PAUTANGBAI_LOGO.svg";
import AuthBg from "@/assets/images/AUTH_BG.svg";

interface RegisterScreenProps {
  onNavigateToLogin?: () => void;
}

interface FormError {
  title: string;
  message: string;
  field?: "username" | "password" | "confirmPassword" | "all";
  isNetwork?: boolean;
}

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function RegisterScreen({
  onNavigateToLogin,
}: RegisterScreenProps = {}) {
  const router = useRouter();
  const { register } = useAuth();

  // Form Fields
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<FormError | null>(null);

  const dismissError = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setError(null);
  };

  const handleRegister = async () => {
    if (!username.trim()) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setError({
        title: "Username required",
        message: "Please choose a username to create your account.",
        field: "username",
      });
      return;
    }
    if (username.trim().length < 3) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setError({
        title: "Username too short",
        message: "Username must be at least 3 characters long.",
        field: "username",
      });
      return;
    }
    if (!password || password.length < 6) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setError({
        title: "Password too short",
        message: "Password must be at least 6 characters long.",
        field: "password",
      });
      return;
    }
    if (password !== confirmPassword) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setError({
        title: "Passwords do not match",
        message: "Confirm password does not match. Please retype.",
        field: "confirmPassword",
      });
      return;
    }

    dismissError();
    setIsSubmitting(true);
    console.log(`[Auth Register] Attempting registration for username: "${username.trim()}"`);

    try {
      const res = await register(
        username.trim(),
        password,
        name.trim() || undefined,
      );

      if (res.ok) {
        console.log(`[Auth Register SUCCESS] Registered & logged in as: @${username.trim()}`);
        router.replace("/settings");
      } else {
        console.warn(`[Auth Register FAILED] Status ${res.status}:`, res.error, res.errors);
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        if (res.status === 422 && res.errors) {
          const firstField = Object.keys(res.errors)[0] as
            | "username"
            | "password";
          const firstMsg =
            res.errors[firstField]?.[0] ||
            res.error ||
            "Please check the information you entered.";
          setError({
            title: "Check Your Input",
            message: firstMsg,
            field: firstField === "password" ? "password" : "username",
          });
        } else if (res.status === 0 || !res.status) {
          setError({
            title: "Connection Failed",
            message:
              res.error ||
              "Unable to reach the server. Make sure your device has network access.",
            isNetwork: true,
          });
        } else {
          setError({
            title: "Registration Failed",
            message:
              res.error ||
              "Registration failed. Username may already be taken.",
            field: "username",
          });
        }
      }
    } catch (err: any) {
      console.error("[Auth Register Exception]:", err);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setError({
        title: "Connection Error",
        message:
          err?.message ||
          "Unable to connect to the server. Check your network connection.",
        isNetwork: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };


  const isUsernameInvalid =
    error?.field === "username" || error?.field === "all";
  const isPasswordInvalid =
    error?.field === "password" || error?.field === "all";
  const isConfirmPasswordInvalid =
    error?.field === "confirmPassword" || error?.field === "all";

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
          className="px-6 pt-3 pb-6"
        >
          {/* Top Header: Logo on the top left */}
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Pressable
                onPress={() => {
                  if (isSubmitting) return;
                  if (onNavigateToLogin) {
                    onNavigateToLogin();
                  } else if (router.canGoBack()) {
                    router.back();
                  }
                }}
                disabled={isSubmitting}
                className={`w-10 h-10 items-center justify-center rounded-full bg-white border border-frog/40 shadow-xs ${
                  isSubmitting ? "opacity-50" : "active:bg-mint/30"
                }`}
                accessibilityLabel="Go back"
              >
                <Ionicons name="arrow-back" size={18} color="#173D35" />
              </Pressable>
              <PautangBaiLogo width={135} height={42} />
            </View>
            <View className="w-10" />
          </View>

          {/* Form Content: Centered Vertically */}
          <View className="flex-1 justify-center w-full max-w-sm self-center py-4">
            {/* Hero Mascot: Prominent Frog */}
            <View className="items-center mb-3">
              <View
                className={`w-24 h-24 rounded-full bg-white border-2 items-center justify-center shadow-xs ${
                  error ? "border-danger-600/30" : "border-frog"
                }`}
              >
                <Frog mood={error ? "thinking" : "happy"} size={80} />
              </View>
              <Text className="text-xl font-black text-forest-900 tracking-tight mt-1.5 text-center">
                Create Account
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

            {/* Form Fields: Single Column Layout */}
            <View className="w-full gap-3 mt-1">
              {/* Username Input */}
              <View>
                <Text className="text-xs font-bold text-forest-900 mb-1.5 ml-1">
                  Username <Text className="text-danger-600">*</Text>
                </Text>
                <View
                  className={`flex-row items-center rounded-2xl px-4 min-h-[58px] shadow-xs border-2 ${
                    isUsernameInvalid
                      ? "bg-[#FFF8F8] border-[#B83D3D]"
                      : "bg-white border-forest-900/25"
                  }`}
                >
                  <Ionicons
                    name="at-outline"
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

              {/* Full Name Input */}
              <View>
                <Text className="text-xs font-bold text-forest-900 mb-1.5 ml-1">
                  Your Name{" "}
                  <Text className="text-forest-900/60 font-normal">
                    (Optional)
                  </Text>
                </Text>
                <View className="flex-row items-center bg-white border-2 border-forest-900/25 rounded-2xl px-4 min-h-[58px] shadow-xs">
                  <Ionicons name="person-outline" size={20} color="#287A63" />
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="e.g. Juan Dela Cruz"
                    placeholderTextColor="#718096"
                    autoCapitalize="words"
                    editable={!isSubmitting}
                    className="flex-1 ml-3 py-3.5 text-ink text-base font-medium"
                  />
                </View>
              </View>

              {/* Password Input */}
              <View>
                <Text className="text-xs font-bold text-forest-900 mb-1.5 ml-1">
                  Password <Text className="text-danger-600">*</Text>
                </Text>
                <View
                  className={`flex-row items-center rounded-2xl px-4 min-h-[58px] shadow-xs border-2 ${
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
                    placeholder="At least 6 characters"
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

              {/* Confirm Password Input */}
              <View>
                <Text className="text-xs font-bold text-forest-900 mb-1.5 ml-1">
                  Confirm Password <Text className="text-danger-600">*</Text>
                </Text>
                <View
                  className={`flex-row items-center rounded-2xl px-4 min-h-[58px] shadow-xs border-2 ${
                    isConfirmPasswordInvalid
                      ? "bg-[#FFF8F8] border-[#B83D3D]"
                      : "bg-white border-forest-900/25"
                  }`}
                >
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={20}
                    color={isConfirmPasswordInvalid ? "#B83D3D" : "#287A63"}
                  />
                  <TextInput
                    value={confirmPassword}
                    onChangeText={(val) => {
                      setConfirmPassword(val);
                      if (error) dismissError();
                    }}
                    placeholder="Repeat your password"
                    placeholderTextColor={
                      isConfirmPasswordInvalid ? "#E57373" : "#718096"
                    }
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isSubmitting}
                    className="flex-1 ml-3 py-3.5 text-ink text-base font-medium"
                  />
                </View>
              </View>

              {/* Sign Up Button */}
              <Pressable
                onPress={handleRegister}
                disabled={isSubmitting}
                className={`min-h-[58px] rounded-2xl items-center justify-center flex-row gap-2 mt-3 shadow-sm ${
                  isSubmitting
                    ? "bg-forest-900/70"
                    : "bg-forest-900 active:bg-forest-900/90"
                }`}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="sparkles" size={20} color="#FFFFFF" />
                    <Text className="text-white font-black text-base tracking-wide">
                      Create Account
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>

          {/* Bottom Options & Navigation */}
          <View className="w-full max-w-sm self-center items-center pb-2">
            <Pressable
              onPress={() =>
                onNavigateToLogin ? onNavigateToLogin() : router.push("/login")
              }
              className="py-2.5 px-4 min-h-[44px] items-center justify-center"
            >
              <Text className="text-xs text-white/90 font-bold">
                Already have an account?{" "}
                <Text className="font-black text-white underline">
                  Log In
                </Text>
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </View>
);
}
