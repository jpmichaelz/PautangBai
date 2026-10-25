import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/auth-context";
import { Frog } from "@/components/frog";
import { getApiBaseUrl, setApiBaseUrl } from "@/services/api/apiClient";

interface AuthModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AuthModal({ visible, onClose, onSuccess }: AuthModalProps) {
  const { login, register } = useAuth();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Advanced server URL toggle
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [serverUrl, setServerUrl] = useState(getApiBaseUrl());

  const resetForm = () => {
    setUsername("");
    setPassword("");
    setName("");
    setErrorMessage(null);
    setIsSubmitting(false);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (!username.trim()) {
      setErrorMessage("Please enter a username.");
      return;
    }
    if (!password || password.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      let res;
      if (mode === "login") {
        res = await login(username.trim(), password);
      } else {
        res = await register(
          username.trim(),
          password,
          name.trim() || undefined,
        );
      }

      if (res.ok) {
        resetForm();
        onSuccess?.();
        onClose();
      } else {
        setErrorMessage(
          res.error || "Authentication failed. Please check your credentials.",
        );
      }
    } catch {
      setErrorMessage("An unexpected error occurred. Please try again.");
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

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior="padding"
        className="flex-1 justify-end bg-black/50"
      >
        <View className="bg-paper rounded-t-3xl max-h-[92%] border-t border-border overflow-hidden shadow-2xl">
          {/* Header Bar */}
          <View className="flex-row items-center justify-between px-5 pt-4 pb-2 border-b border-border bg-white">
            <View className="flex-row items-center gap-2">
              <Frog mood="welcome" size={36} />
              <View>
                <Text className="text-base font-extrabold text-forest-900">
                  {mode === "login" ? "Log In to PautangBai" : "Create Account"}
                </Text>
                <Text className="text-xs text-slate">
                  Sync & back up your loan records
                </Text>
              </View>
            </View>
            <Pressable
              onPress={handleClose}
              disabled={isSubmitting}
              className="w-10 h-10 items-center justify-center rounded-full bg-slate/10 active:bg-slate/20"
              accessibilityLabel="Close auth dialog"
            >
              <Ionicons name="close" size={20} color="#173D35" />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Mode Switcher */}
            <View className="flex-row bg-border/60 p-1 rounded-xl mb-5">
              <Pressable
                onPress={() => {
                  setMode("login");
                  setErrorMessage(null);
                }}
                className={`flex-1 py-2.5 rounded-lg items-center justify-center min-h-[44px] ${
                  mode === "login" ? "bg-white shadow-xs" : ""
                }`}
              >
                <Text
                  className={`text-sm font-bold ${
                    mode === "login" ? "text-forest-900" : "text-slate"
                  }`}
                >
                  Log In
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setMode("register");
                  setErrorMessage(null);
                }}
                className={`flex-1 py-2.5 rounded-lg items-center justify-center min-h-[44px] ${
                  mode === "register" ? "bg-white shadow-xs" : ""
                }`}
              >
                <Text
                  className={`text-sm font-bold ${
                    mode === "register" ? "text-forest-900" : "text-slate"
                  }`}
                >
                  Create Account
                </Text>
              </Pressable>
            </View>

            {/* Error Banner */}
            {errorMessage && (
              <View className="flex-row items-center gap-2.5 p-3 rounded-xl bg-danger-600/10 border border-danger-600/30 mb-4">
                <Ionicons name="alert-circle" size={18} color="#B83D3D" />
                <Text className="text-xs font-semibold text-danger-600 flex-1 leading-4">
                  {errorMessage}
                </Text>
              </View>
            )}

            {/* Register: Full Name (Optional) */}
            {mode === "register" && (
              <View className="mb-3.5">
                <Text className="text-xs font-bold text-forest-900 mb-1.5 ml-1">
                  Full Name{" "}
                  <Text className="text-slate font-normal">(Optional)</Text>
                </Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Juan Dela Cruz"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="words"
                  editable={!isSubmitting}
                  className="bg-white border border-border rounded-xl px-4 py-3 text-ink text-sm min-h-[48px]"
                />
              </View>
            )}

            {/* Username Input */}
            <View className="mb-3.5">
              <Text className="text-xs font-bold text-forest-900 mb-1.5 ml-1">
                Username
              </Text>
              <View className="flex-row items-center bg-white border border-border rounded-xl px-3.5 min-h-[48px]">
                <Ionicons name="person-outline" size={18} color="#66716D" />
                <TextInput
                  value={username}
                  onChangeText={setUsername}
                  placeholder="e.g. juan99"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isSubmitting}
                  className="flex-1 ml-2.5 py-3 text-ink text-sm"
                />
              </View>
            </View>

            {/* Password Input */}
            <View className="mb-5">
              <Text className="text-xs font-bold text-forest-900 mb-1.5 ml-1">
                Password
              </Text>
              <View className="flex-row items-center bg-white border border-border rounded-xl px-3.5 min-h-[48px]">
                <Ionicons
                  name="lock-closed-outline"
                  size={18}
                  color="#66716D"
                />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder={
                    mode === "register"
                      ? "At least 6 characters"
                      : "Enter password"
                  }
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isSubmitting}
                  className="flex-1 ml-2.5 py-3 text-ink text-sm"
                />
                <Pressable
                  onPress={() => setShowPassword((prev) => !prev)}
                  className="p-1.5 min-h-[40px] min-w-[40px] items-center justify-center"
                  accessibilityLabel={
                    showPassword ? "Hide password" : "Show password"
                  }
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={18}
                    color="#66716D"
                  />
                </Pressable>
              </View>
            </View>

            {/* Submit Button */}
            <Pressable
              onPress={handleSubmit}
              disabled={isSubmitting}
              className={`min-h-[48px] rounded-xl items-center justify-center shadow-sm flex-row gap-2 ${
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
                    name={
                      mode === "login" ? "log-in-outline" : "person-add-outline"
                    }
                    size={20}
                    color="#FFFFFF"
                  />
                  <Text className="text-white font-extrabold text-sm">
                    {mode === "login" ? "Log In" : "Create Account"}
                  </Text>
                </>
              )}
            </Pressable>

            {/* Advanced: API Server URL Configuration */}
            <View className="mt-6 pt-4 border-t border-border/80">
              <Pressable
                onPress={() => setShowServerConfig((prev) => !prev)}
                className="flex-row items-center justify-between py-1 min-h-[44px]"
              >
                <View className="flex-row items-center gap-1.5">
                  <Ionicons name="server-outline" size={14} color="#66716D" />
                  <Text className="text-xs text-slate font-medium">
                    Server Configuration
                  </Text>
                </View>
                <Ionicons
                  name={showServerConfig ? "chevron-up" : "chevron-down"}
                  size={14}
                  color="#66716D"
                />
              </Pressable>

              {showServerConfig && (
                <View className="mt-2 p-3 bg-white border border-border rounded-xl">
                  <Text className="text-[11px] text-slate mb-1.5">
                    Laravel API URL (use 10.0.2.2 for Android emulator, LAN IP
                    for phone):
                  </Text>
                  <TextInput
                    value={serverUrl}
                    onChangeText={setServerUrl}
                    placeholder="http://10.0.2.2:8000/api/v1"
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="none"
                    autoCorrect={false}
                    className="bg-paper border border-border rounded-lg px-3 py-2 text-xs text-ink mb-2"
                  />
                  <Pressable
                    onPress={handleSaveServerUrl}
                    className="bg-emerald-700 py-2 rounded-lg items-center min-h-[36px] justify-center"
                  >
                    <Text className="text-white text-xs font-bold">
                      Apply Server URL
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
