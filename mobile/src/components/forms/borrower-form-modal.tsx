import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { Ionicons } from "@expo/vector-icons";
import { borrowerHelper } from "@/db-helpers/borrowers";
import { Borrower } from "@/types/database";
import { Frog } from "@/components/frog";
import { generateUUID } from "@/services/uuid";

interface BorrowerFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (borrower: Borrower) => void;
}

const QUICK_TAGS = ["Silingan", "Suki", "Kaila", "Pamilya", "Trabaho"] as const;

export function BorrowerFormModal({
  visible,
  onClose,
  onSuccess,
}: BorrowerFormModalProps) {
  const db = useSQLiteContext();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setName("");
    setPhone("");
    setAddress("");
    setNotes("");
    setSelectedTag(null);
    setIsSubmitting(false);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    resetForm();
    onClose();
  };

  const toggleTag = (tag: string) => {
    setSelectedTag((prev) => (prev === tag ? null : tag));
  };

  const handleSave = async () => {
    if (isSubmitting) return;

    if (!name.trim()) {
      Alert.alert(
        "Kinahanglan og Ngalan",
        "Palihug ibutang ang kompletong ngalan sa mangungutang.",
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const id = generateUUID();

      let combinedNotes = notes.trim();
      if (selectedTag) {
        combinedNotes = `[${selectedTag}] ${combinedNotes}`.trim();
      }

      const savedBorrower = await borrowerHelper.create(db, {
        id,
        name: name.trim(),
        phone: phone.trim() || null,
        email: null,
        address: address.trim() || null,
        notes: combinedNotes || null,
        status: "active",
      });

      resetForm();
      onClose();
      onSuccess?.(savedBorrower);
    } catch (err) {
      console.error("Failed to create borrower:", err);
      Alert.alert(
        "Error",
        "Dili ma-save ang mangungutang. Palihug sulayi pag-usab.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior="padding"
        className="flex-1 bg-paper"
      >
        {/* Top Back Action Bar */}
        <View className="px-4 pt-3 pb-1 flex-row items-center">
          <Pressable
            onPress={handleClose}
            hitSlop={12}
            className="flex-row items-center gap-1.5 py-1.5 px-2 -ml-2 rounded-xl active:bg-white/60"
            accessibilityLabel="Back"
            accessibilityRole="button"
          >
            <Ionicons name="arrow-back" size={22} color="#173D35" />
            <Text className="text-sm font-bold text-forest-900">Back</Text>
          </Pressable>
        </View>

        <ScrollView
          className="flex-1 px-5"
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Natural Mascot Header (no box-in-box) */}
          <View className="items-center mb-6">
            <Frog mood="borrower" size={130} />
            <Text className="text-2xl font-black text-forest-900 mt-3 text-center tracking-tight">
              Kinsa ang mangutang?
            </Text>
            <Text className="text-sm font-medium text-slate-700 mt-1 text-center max-w-[280px]">
              Ilista ang ngalan ug kontak aron sayon masundan ang pautang.
            </Text>
          </View>

          {/* Full Name */}
          <View className="mb-4">
            <Text className="text-xs font-bold text-ink uppercase tracking-wider mb-2">
              Full Name <Text className="text-rose-600">*</Text>
            </Text>
            <View className="flex-row items-center rounded-xl border border-border bg-white px-3.5 shadow-xs">
              <Ionicons name="person-outline" size={18} color="#287A63" />
              <TextInput
                placeholder="e.g. Maria Santos"
                placeholderTextColor="#9CA3AF"
                value={name}
                onChangeText={setName}
                className="flex-1 px-2.5 py-3 text-base text-ink"
                autoFocus
              />
              {name.length > 0 && (
                <Pressable onPress={() => setName("")} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                </Pressable>
              )}
            </View>
          </View>

          {/* Phone Number */}
          <View className="mb-4">
            <Text className="text-xs font-bold text-ink uppercase tracking-wider mb-2">
              Phone Number
            </Text>
            <View className="flex-row items-center rounded-xl border border-border bg-white px-3.5 shadow-xs">
              <Ionicons name="call-outline" size={18} color="#287A63" />
              <TextInput
                placeholder="e.g. 0917 123 4567"
                placeholderTextColor="#9CA3AF"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                className="flex-1 px-2.5 py-3 text-base text-ink"
              />
            </View>
          </View>

          {/* Address / Location */}
          <View className="mb-4">
            <Text className="text-xs font-bold text-ink uppercase tracking-wider mb-2">
              Address / Location
            </Text>
            <View className="flex-row items-center rounded-xl border border-border bg-white px-3.5 shadow-xs">
              <Ionicons name="location-outline" size={18} color="#287A63" />
              <TextInput
                placeholder="e.g. Purok 3, Barangay San Jose"
                placeholderTextColor="#9CA3AF"
                value={address}
                onChangeText={setAddress}
                className="flex-1 px-2.5 py-3 text-base text-ink"
              />
            </View>
          </View>

          {/* Quick Category Chips */}
          <View className="mb-4">
            <Text className="text-xs font-bold text-ink uppercase tracking-wider mb-2">
              Category / Tag
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {QUICK_TAGS.map((tag) => {
                const isSelected = selectedTag === tag;
                return (
                  <Pressable
                    key={tag}
                    onPress={() => toggleTag(tag)}
                    className={`px-3 py-1.5 rounded-full border ${
                      isSelected
                        ? "bg-forest border-forest"
                        : "bg-white border-border"
                    } active:scale-95`}
                  >
                    <Text
                      className={`text-xs font-bold ${
                        isSelected ? "text-white" : "text-slate"
                      }`}
                    >
                      {isSelected ? `✓ ${tag}` : tag}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Notes */}
          <View className="mb-6">
            <Text className="text-xs font-bold text-ink uppercase tracking-wider mb-2">
              Notes
            </Text>
            <View className="flex-row items-start rounded-xl border border-border bg-white px-3.5 py-2 shadow-xs">
              <Ionicons
                name="create-outline"
                size={18}
                color="#287A63"
                style={{ marginTop: 2 }}
              />
              <TextInput
                placeholder="Any personal note, reference, or reminder..."
                placeholderTextColor="#9CA3AF"
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                className="flex-1 px-2.5 py-1 text-base text-ink min-h-[72px]"
                textAlignVertical="top"
              />
            </View>
          </View>

          {/* Primary Save Button */}
          <Pressable
            disabled={isSubmitting}
            className={`flex-row items-center justify-center gap-2 py-4 rounded-xl shadow-sm ${
              isSubmitting ? "bg-forest/60" : "bg-forest active:opacity-90"
            }`}
            onPress={handleSave}
          >
            <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
            <Text className="text-white font-extrabold text-base">
              {isSubmitting ? "Saving..." : "Save Borrower"}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
