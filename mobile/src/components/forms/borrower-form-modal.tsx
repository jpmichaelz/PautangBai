import { useState, useEffect, type ComponentProps } from "react";
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
  Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSQLiteContext } from "expo-sqlite";
import { Ionicons } from "@expo/vector-icons";
import { borrowerHelper } from "@/db-helpers/borrowers";
import { loanHelper } from "@/db-helpers/loans";
import { paymentHelper } from "@/db-helpers/payments";
import { calculateLoanBalance } from "@/services/balance/calculateBalance";
import { Borrower } from "@/types/database";
import { Frog } from "@/components/frog";
import { FeedbackModal } from "@/components/feedback-modal";
import { generateUUID } from "@/services/uuid";
import { enforceImmersiveSystemBars } from "@/utils/system-bars";

interface BorrowerFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (borrower: Borrower) => void;
  editingBorrower?: Borrower | null;
  onDelete?: (borrower: Borrower) => void;
}

const QUICK_TAGS: {
  label: string;
  icon: ComponentProps<typeof Ionicons>["name"];
}[] = [
  { label: "Silingan", icon: "home-outline" },
  { label: "Suki", icon: "star-outline" },
  { label: "Kaila", icon: "people-outline" },
  { label: "Pamilya", icon: "heart-outline" },
  { label: "Trabaho", icon: "briefcase-outline" },
  { label: "Classmate", icon: "school-outline" },
];

export function BorrowerFormModal({
  visible,
  onClose,
  onSuccess,
  editingBorrower,
  onDelete,
}: BorrowerFormModalProps) {
  const db = useSQLiteContext();
  const isEditing = Boolean(editingBorrower);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    visible: boolean;
    type: "success" | "error";
    title: string;
    message: string;
    savedBorrower?: Borrower;
  } | null>(null);

  const resetForm = () => {
    setName("");
    setPhone("");
    setAddress("");
    setNotes("");
    setSelectedTag(null);
    setShowMoreDetails(false);
    setIsSubmitting(false);
  };

  useEffect(() => {
    if (!visible) return;

    if (editingBorrower) {
      setName(editingBorrower.name || "");
      setPhone(editingBorrower.phone || "");
      setAddress(editingBorrower.address || "");

      const rawNotes = editingBorrower.notes || "";
      const tagMatch = rawNotes.match(/^\[(.*?)\]\s*(.*)$/s);
      if (tagMatch) {
        setSelectedTag(tagMatch[1]);
        const strippedNotes = tagMatch[2] || "";
        setNotes(strippedNotes);
        setShowMoreDetails(
          Boolean(editingBorrower.address || strippedNotes.trim()),
        );
      } else {
        setSelectedTag(null);
        setNotes(rawNotes);
        setShowMoreDetails(
          Boolean(editingBorrower.address || rawNotes.trim()),
        );
      }
    } else {
      resetForm();
    }
  }, [visible, editingBorrower]);

  const handleClose = () => {
    if (isSubmitting) return;
    resetForm();
    onClose();
  };

  const handleFeedbackClose = () => {
    const saved = feedback?.savedBorrower;
    setFeedback(null);
    resetForm();
    onClose();
    if (saved) {
      onSuccess?.(saved);
    }
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

    Keyboard.dismiss();
    setIsSubmitting(true);
    try {
      let combinedNotes = notes.trim();
      if (selectedTag) {
        combinedNotes = `[${selectedTag}] ${combinedNotes}`.trim();
      }

      if (editingBorrower) {
        const updates = {
          name: name.trim(),
          phone: phone.trim() || null,
          address: address.trim() || null,
          notes: combinedNotes || null,
        };
        await borrowerHelper.update(db, editingBorrower.id, updates);

        const updatedBorrower: Borrower = {
          ...editingBorrower,
          ...updates,
          updated_at: new Date().toISOString(),
        };

        setFeedback({
          visible: true,
          type: "success",
          title: "Borrower Updated!",
          message: `${updatedBorrower.name}'s profile has been updated.`,
          savedBorrower: updatedBorrower,
        });
      } else {
        const id = generateUUID();

        const savedBorrower = await borrowerHelper.create(db, {
          id,
          name: name.trim(),
          phone: phone.trim() || null,
          email: null,
          address: address.trim() || null,
          notes: combinedNotes || null,
          status: "active",
        });

        setFeedback({
          visible: true,
          type: "success",
          title: "Borrower Added!",
          message: `${savedBorrower.name} has been added to your borrower directory.`,
          savedBorrower,
        });
      }
    } catch (err) {
      console.error("Failed to save borrower:", err);
      setFeedback({
        visible: true,
        type: "error",
        title: "Failed to Save",
        message: "Unable to save borrower right now. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteBorrower = async () => {
    if (!editingBorrower || isSubmitting) return;

    try {
      const borrowerLoans = await loanHelper.getByBorrowerId(
        db,
        editingBorrower.id,
      );
      const nonCancelledLoans = borrowerLoans.filter(
        (l) => l.status !== "cancelled",
      );

      let activeUnpaidCount = 0;
      for (const loan of nonCancelledLoans) {
        const loanPayments = await paymentHelper.getByLoanId(db, loan.id);
        const balance = calculateLoanBalance(loan, loanPayments);
        if (balance.remainingBalanceMinor > 0) {
          activeUnpaidCount++;
        }
      }

      if (activeUnpaidCount > 0) {
        Alert.alert(
          "Cannot Delete Borrower",
          `${editingBorrower.name} still has ${activeUnpaidCount} unpaid ${
            activeUnpaidCount === 1 ? "loan" : "loans"
          }. Please settle or delete active loans first before removing this borrower.`,
        );
        return;
      }

      Alert.alert(
        "Delete Borrower?",
        `Are you sure you want to remove ${editingBorrower.name} from your directory?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              setIsSubmitting(true);
              try {
                await borrowerHelper.softDelete(db, editingBorrower.id);
                const deleted = editingBorrower;
                resetForm();
                onClose();
                onDelete?.(deleted);
              } catch (err) {
                console.error("Failed to delete borrower:", err);
                Alert.alert(
                  "Delete Failed",
                  "Unable to delete borrower right now. Please try again.",
                );
              } finally {
                setIsSubmitting(false);
              }
            },
          },
        ],
      );
    } catch (err) {
      console.error("Error checking borrower loans before delete:", err);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}
      statusBarTranslucent
      navigationBarTranslucent
      onShow={enforceImmersiveSystemBars}
      onRequestClose={handleClose}
    >
      <SafeAreaView className="flex-1 bg-paper" edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1 relative"
        >
          {/* Top Back Action Bar */}
          <View className="px-5 pt-5 pb-2 flex-row items-center">
            <Pressable
              onPress={handleClose}
              hitSlop={12}
              className="flex-row items-center gap-1.5 py-2 px-3 rounded-full bg-white/80 border border-border active:bg-white shadow-xs"
              accessibilityLabel="Back"
              accessibilityRole="button"
            >
              <Ionicons name="arrow-back" size={18} color="#173D35" />
              <Text className="text-xs font-extrabold text-forest-900">
                Back
              </Text>
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
                {isEditing ? "Edit Borrower Profile" : "Kinsa ang mangutang?"}
              </Text>
              <Text className="text-sm font-medium text-slate-700 mt-1 text-center max-w-[280px]">
                {isEditing
                  ? "Update name, contact details, or category tag."
                  : "Ilista ang ngalan ug kontak aron sayon masundan ang pautang."}
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
                  autoFocus={!isEditing}
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
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-xs font-bold text-ink uppercase tracking-wider">
                  Phone Number
                </Text>
                <Text className="text-[11px] font-semibold text-slate/70">
                  Optional
                </Text>
              </View>
              <View className="flex-row items-center rounded-xl border border-border bg-white px-3.5 shadow-xs">
                <Ionicons name="call-outline" size={18} color="#287A63" />
                <TextInput
                  placeholder="e.g. 0917 123 4567 (optional)"
                  placeholderTextColor="#9CA3AF"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  className="flex-1 px-2.5 py-3 text-base text-ink"
                />
              </View>
            </View>

            {/* Quick Category Chips (3x2 Equal Bento Grid) */}
            <View className="mb-4">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-xs font-bold text-ink uppercase tracking-wider">
                  Category / Tag
                </Text>
                <Text className="text-[11px] font-semibold text-slate/70">
                  Optional
                </Text>
              </View>
              <View className="flex-row flex-wrap justify-between gap-y-2.5">
                {QUICK_TAGS.map(({ label, icon }) => {
                  const isSelected = selectedTag === label;
                  return (
                    <Pressable
                      key={label}
                      onPress={() => toggleTag(label)}
                      style={{ width: "31.5%" }}
                      className={`py-2.5 px-2 rounded-xl border flex-row items-center justify-center gap-1.5 ${
                        isSelected
                          ? "bg-forest-900 border-forest-900 shadow-xs"
                          : "bg-white border-border active:bg-mint/30"
                      }`}
                    >
                      <Ionicons
                        name={isSelected ? "checkmark-circle" : icon}
                        size={15}
                        color={isSelected ? "#FFFFFF" : "#287A63"}
                      />
                      <Text
                        numberOfLines={1}
                        className={`text-xs font-extrabold ${
                          isSelected ? "text-white" : "text-forest-900"
                        }`}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* + Add address or note toggle */}
            {!showMoreDetails ? (
              <Pressable
                onPress={() => setShowMoreDetails(true)}
                className="mb-6 py-3 px-4 rounded-xl border border-dashed border-border bg-white/60 flex-row items-center justify-center gap-2 active:bg-white"
              >
                <Ionicons name="add-circle-outline" size={18} color="#287A63" />
                <Text className="text-xs font-extrabold text-forest-900">
                  Add address or note (optional)
                </Text>
              </Pressable>
            ) : (
              <>
                {/* Address / Location */}
                <View className="mb-4">
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-xs font-bold text-ink uppercase tracking-wider">
                      Address / Location
                    </Text>
                    <Pressable
                      onPress={() => setShowMoreDetails(false)}
                      hitSlop={8}
                    >
                      <Text className="text-xs font-bold text-bai">Hide</Text>
                    </Pressable>
                  </View>
                  <View className="flex-row items-center rounded-xl border border-border bg-white px-3.5 shadow-xs">
                    <Ionicons
                      name="location-outline"
                      size={18}
                      color="#287A63"
                    />
                    <TextInput
                      placeholder="e.g. Purok 3, Barangay San Jose"
                      placeholderTextColor="#9CA3AF"
                      value={address}
                      onChangeText={setAddress}
                      className="flex-1 px-2.5 py-3 text-base text-ink"
                    />
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
              </>
            )}

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
                {isSubmitting
                  ? "Saving..."
                  : isEditing
                    ? "Save Changes"
                    : "Save Borrower"}
              </Text>
            </Pressable>

            {/* Delete Borrower Button (Edit Mode Only) */}
            {isEditing && (
              <Pressable
                disabled={isSubmitting}
                className="mt-3 flex-row items-center justify-center gap-2 py-3.5 rounded-xl bg-red-50 border border-red-200 active:bg-red-100"
                onPress={handleDeleteBorrower}
                accessibilityRole="button"
                accessibilityLabel="Delete Borrower"
              >
                <Ionicons name="trash-outline" size={18} color="#DC2626" />
                <Text className="text-danger font-extrabold text-sm">
                  Delete Borrower
                </Text>
              </Pressable>
            )}
          </ScrollView>

          {feedback && (
            <FeedbackModal
              visible={feedback.visible}
              type={feedback.type}
              mood={feedback.type === "success" ? "celebrate" : "thinking"}
              title={feedback.title}
              message={feedback.message}
              buttonText={feedback.type === "success" ? "Done" : "Try Again"}
              onClose={handleFeedbackClose}
            />
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
