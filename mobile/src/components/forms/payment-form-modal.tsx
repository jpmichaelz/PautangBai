import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSQLiteContext } from "expo-sqlite";
import { Ionicons } from "@expo/vector-icons";
import { Loan, Payment } from "@/types/database";
import { paymentHelper } from "@/db-helpers/payments";
import {
  formatPHP,
  allocatePayment,
} from "@/services/interest/calculateInterest";
import { calculateLoanBalance } from "@/services/balance/calculateBalance";
import {
  getLocalDateString,
  addDays,
  isValidDateString,
} from "@/services/date/dateUtils";
import { Frog, FrogMood } from "@/components/frog";
import { FeedbackModal } from "@/components/feedback-modal";
import { generateUUID } from "@/services/uuid";
import { enforceImmersiveSystemBars } from "@/utils/system-bars";

interface PaymentFormModalProps {
  visible: boolean;
  loan: Loan | null;
  borrowerName?: string;
  allPayments?: Payment[];
  onClose: () => void;
  onSuccess?: () => void;
}

export function PaymentFormModal({
  visible,
  loan,
  borrowerName,
  allPayments = [],
  onClose,
  onSuccess,
}: PaymentFormModalProps) {
  const db = useSQLiteContext();

  const [payAmountInput, setPayAmountInput] = useState("");
  const [paymentDateMode, setPaymentDateMode] = useState<
    "today" | "yesterday" | "custom"
  >("today");
  const [customPaymentDate, setCustomPaymentDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "GCash" | "Bank">(
    "Cash",
  );
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [feedback, setFeedback] = useState<{
    visible: boolean;
    type: "success" | "error";
    mood?: FrogMood;
    title: string;
    message: string;
    buttonText?: string;
  } | null>(null);

  const loanPayments = loan
    ? allPayments.filter((p) => p.loan_id === loan.id)
    : [];
  const balance = loan
    ? calculateLoanBalance(loan, loanPayments)
    : { remainingBalanceMinor: 0, interestRemainingMinor: 0, principalRemainingMinor: 0 };

  const parsedPay = parseFloat(payAmountInput.replace(/,/g, "")) || 0;
  const payAmountMinor = Math.round(parsedPay * 100);

  const isOverpaid = payAmountMinor > balance.remainingBalanceMinor;

  const resetForm = () => {
    setPayAmountInput("");
    setPaymentDateMode("today");
    setCustomPaymentDate("");
    setPaymentMethod("Cash");
    setPaymentReference("");
    setPaymentNotes("");
    setShowValidation(false);
    setIsSubmitting(false);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    resetForm();
    onClose();
  };

  const handleFeedbackClose = () => {
    const wasSuccess = feedback?.type === "success";
    setFeedback(null);
    if (wasSuccess) {
      resetForm();
      onClose();
      onSuccess?.();
    }
  };

  const handleSave = async () => {
    if (!loan || isSubmitting) return;

    if (payAmountMinor <= 0) {
      setShowValidation(true);
      setFeedback({
        visible: true,
        type: "error",
        mood: "thinking",
        title: "Enter Amount",
        message: "Please enter the amount paid.",
        buttonText: "OK",
      });
      return;
    }

    if (isOverpaid) {
      setShowValidation(true);
      setFeedback({
        visible: true,
        type: "error",
        mood: "thinking",
        title: "Amount Too High",
        message: `The payment (${formatPHP(
          payAmountMinor,
        )}) cannot be more than the remaining balance (${formatPHP(
          balance.remainingBalanceMinor,
        )}).`,
        buttonText: "Adjust Amount",
      });
      return;
    }

    Keyboard.dismiss();
    setIsSubmitting(true);
    try {
      const todayStr = getLocalDateString();
      let paymentDateStr = todayStr;
      if (paymentDateMode === "yesterday") {
        paymentDateStr = addDays(todayStr, -1);
      } else if (paymentDateMode === "custom") {
        const trimmed = customPaymentDate.trim();
        if (!isValidDateString(trimmed)) {
          setFeedback({
            visible: true,
            type: "error",
            mood: "thinking",
            title: "Invalid Payment Date",
            message:
              "Please use the YYYY-MM-DD format (example: 2026-10-15).",
            buttonText: "Fix Date",
          });
          setIsSubmitting(false);
          return;
        }
        if (loan.loan_date && trimmed < loan.loan_date) {
          setFeedback({
            visible: true,
            type: "error",
            mood: "thinking",
            title: "Invalid Payment Date",
            message: `Payment date (${trimmed}) cannot be earlier than loan date (${loan.loan_date}).`,
            buttonText: "Fix Date",
          });
          setIsSubmitting(false);
          return;
        }
        paymentDateStr = trimmed;
      }

      // Allocate against remaining uncollected interest
      const allocation = allocatePayment(
        payAmountMinor,
        balance.interestRemainingMinor,
      );
      const id = generateUUID();

      await paymentHelper.create(db, {
        id,
        loan_id: loan.id,
        amount_minor: payAmountMinor,
        payment_date: paymentDateStr,
        payment_method: paymentMethod,
        reference: paymentReference.trim() || null,
        notes: paymentNotes.trim() || null,
        allocation_json: JSON.stringify(allocation),
        sync_status: "pending",
      });

      setFeedback({
        visible: true,
        type: "success",
        mood: "celebrate",
        title: "Payment Recorded!",
        message: `Payment of ${formatPHP(
          payAmountMinor,
        )} was successfully recorded for ${borrowerName || "the borrower"}.`,
        buttonText: "Done",
      });
    } catch (err) {
      console.error("Failed to record payment:", err);
      setFeedback({
        visible: true,
        type: "error",
        mood: "thinking",
        title: "Error",
        message: "There was a problem saving this payment. Please try again.",
        buttonText: "Try Again",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}
      statusBarTranslucent
      onShow={enforceImmersiveSystemBars}
      onRequestClose={handleClose}
    >
      <SafeAreaView className="flex-1 bg-paper" edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1 relative"
        >
          {/* Top Header Bar */}
          <View className="px-5 pt-4 pb-2 flex-row items-center justify-between">
            <Pressable
              onPress={handleClose}
              hitSlop={12}
              className="flex-row items-center gap-1.5 py-2 px-3 rounded-full bg-white/80 border border-border active:bg-white shadow-xs"
              accessibilityLabel="Back"
              accessibilityRole="button"
            >
              <Ionicons name="arrow-back" size={18} color="#173D35" />
              <Text className="text-xs font-extrabold text-forest-900">Back</Text>
            </Pressable>

            <Text className="text-base font-black text-forest-900 tracking-tight">
              Record Payment
            </Text>

            <View style={{ width: 64 }} />
          </View>

          <ScrollView
            className="flex-1 px-5"
            contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Mascot Header */}
            <View className="items-center mb-4">
              <Frog
                mood={
                  isOverpaid
                    ? "thinking"
                    : payAmountMinor > 0
                    ? "celebrate"
                    : "payment"
                }
                size={88}
              />
              <Text className="text-xs font-medium text-slate-700 mt-2 text-center">
                Record payment to deduct from remaining balance.
              </Text>
            </View>

            {/* Borrower & Balance Info Card */}
            {loan && (
              <View className="p-4 rounded-2xl bg-white border border-border mb-4 shadow-xs">
                <View className="flex-row items-center justify-between">
                  <Text className="text-base font-black text-forest-900">
                    {borrowerName || "Borrower"}
                  </Text>
                  <View className="px-2.5 py-0.5 rounded-full bg-emerald-100">
                    <Text className="text-[11px] font-bold text-emerald-800">
                      Active
                    </Text>
                  </View>
                </View>
                <View className="h-px bg-border/40 my-2.5" />
                <View className="flex-row justify-between items-center">
                  <Text className="text-xs text-slate-600">
                    Remaining Balance:
                  </Text>
                  <Text className="text-base font-black text-forest-900">
                    {formatPHP(balance.remainingBalanceMinor)}
                  </Text>
                </View>
              </View>
            )}

            {/* Payment Amount Input */}
            <Text className="text-xs font-bold text-ink uppercase tracking-wider mb-2">
              Payment Amount (₱) *
            </Text>
            <View
              className={`flex-row items-center rounded-2xl border bg-white px-4 py-3 shadow-xs mb-1.5 ${
                isOverpaid || (showValidation && payAmountMinor <= 0)
                  ? "border-danger bg-red-50/20"
                  : "border-border"
              }`}
            >
              <Text className="text-2xl font-black text-forest-900 mr-2">₱</Text>
              <TextInput
                placeholder="0.00"
                placeholderTextColor="#9CA3AF"
                value={payAmountInput}
                onChangeText={(text) => {
                  setPayAmountInput(text);
                  if (showValidation) setShowValidation(false);
                }}
                maxLength={11}
                keyboardType="numeric"
                className="flex-1 text-2xl font-black text-ink p-0"
                autoFocus
              />
              {payAmountInput.length > 0 && (
                <Pressable onPress={() => setPayAmountInput("")} hitSlop={8}>
                  <Ionicons name="close-circle" size={20} color="#9CA3AF" />
                </Pressable>
              )}
            </View>
            {showValidation && payAmountMinor <= 0 && (
              <Text className="text-xs font-semibold text-danger mb-3 ml-1">
                * Please enter payment amount
              </Text>
            )}
            {isOverpaid && (
              <View className="flex-row items-center justify-between mb-3 ml-1">
                <Text className="text-xs font-semibold text-danger flex-1 mr-2">
                  * Amount cannot exceed balance ({formatPHP(balance.remainingBalanceMinor)})
                </Text>
                <Pressable
                  onPress={() => {
                    setPayAmountInput(
                      (balance.remainingBalanceMinor / 100).toFixed(2),
                    );
                    if (showValidation) setShowValidation(false);
                  }}
                  className="py-1 px-2.5 rounded-full bg-forest-900/10 active:bg-forest-900/20 flex-row items-center gap-1"
                >
                  <Ionicons name="sparkles" size={12} color="#173D35" />
                  <Text className="text-[11px] font-bold text-forest-900">
                    Cap to Max
                  </Text>
                </Pressable>
              </View>
            )}
            {!isOverpaid && payAmountMinor > 0 && (
              <View className="flex-row items-center gap-1.5 mb-3 ml-1">
                {balance.remainingBalanceMinor - payAmountMinor === 0 ? (
                  <Text className="text-xs font-bold text-emerald-700">
                    New Balance: ₱0.00 • Fully Paid! 🎉
                  </Text>
                ) : (
                  <Text className="text-xs font-semibold text-slate-600">
                    New Balance:{" "}
                    {formatPHP(balance.remainingBalanceMinor - payAmountMinor)}
                  </Text>
                )}
              </View>
            )}
            {!isOverpaid &&
              !(showValidation && payAmountMinor <= 0) &&
              !(payAmountMinor > 0) && <View className="mb-3" />}

            {/* Quick full-pay button */}
            {balance.remainingBalanceMinor > 0 && (
              <Pressable
                onPress={() => {
                  setPayAmountInput(
                    (balance.remainingBalanceMinor / 100).toFixed(2),
                  );
                  if (showValidation) setShowValidation(false);
                }}
                className="self-start py-1.5 px-3 rounded-full bg-forest-900/10 active:bg-forest-900/20 mb-4 flex-row items-center gap-1.5"
              >
                <Ionicons name="checkmark-done" size={14} color="#173D35" />
                <Text className="text-xs font-bold text-forest-900">
                  Pay Full Balance ({formatPHP(balance.remainingBalanceMinor)})
                </Text>
              </Pressable>
            )}

            {/* Payment Date */}
            <Text className="text-xs font-bold text-ink uppercase tracking-wider mb-2">
              Payment Date
            </Text>
            <View className="flex-row gap-2 mb-2">
              {[
                { key: "today", label: "Today", icon: "calendar" },
                { key: "yesterday", label: "Yesterday", icon: "time-outline" },
                { key: "custom", label: "Pick Date", icon: "calendar-outline" },
              ].map((opt) => (
                <Pressable
                  key={opt.key}
                  className={`flex-1 py-2.5 px-2 rounded-xl border flex-row items-center justify-center gap-1.5 ${
                    paymentDateMode === opt.key
                      ? "bg-forest-900 border-forest-900"
                      : "bg-white border-border"
                  }`}
                  onPress={() => {
                    setPaymentDateMode(opt.key as any);
                    if (opt.key === "custom" && !customPaymentDate) {
                      setCustomPaymentDate(getLocalDateString());
                    }
                  }}
                >
                  <Ionicons
                    name={opt.icon as any}
                    size={14}
                    color={paymentDateMode === opt.key ? "#FFFFFF" : "#66716D"}
                  />
                  <Text
                    className={`text-xs font-bold ${
                      paymentDateMode === opt.key ? "text-white" : "text-ink"
                    }`}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            {paymentDateMode === "custom" && (
              <View className="mb-4">
                <TextInput
                  placeholder="YYYY-MM-DD (e.g. 2026-10-15)"
                  placeholderTextColor="#9CA3AF"
                  value={customPaymentDate}
                  onChangeText={setCustomPaymentDate}
                  maxLength={10}
                  className="rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm text-ink"
                />
                <Text className="text-[11px] text-slate-500 mt-1">
                  Format: YYYY-MM-DD (Year-Month-Day)
                </Text>
              </View>
            )}

            {/* Payment Method */}
            <Text className="text-xs font-bold text-ink uppercase tracking-wider mb-2">
              Payment Method
            </Text>
            <View className="flex-row gap-2 mb-3">
              {[
                { key: "Cash", label: "Cash", icon: "cash-outline" },
                { key: "GCash", label: "GCash", icon: "phone-portrait-outline" },
                { key: "Bank", label: "Bank", icon: "business-outline" },
              ].map((m) => (
                <Pressable
                  key={m.key}
                  className={`flex-1 py-2.5 px-2 rounded-xl border flex-row items-center justify-center gap-1.5 ${
                    paymentMethod === m.key
                      ? "bg-forest-900 border-forest-900"
                      : "bg-white border-border"
                  }`}
                  onPress={() => setPaymentMethod(m.key as any)}
                >
                  <Ionicons
                    name={m.icon as any}
                    size={15}
                    color={paymentMethod === m.key ? "#FFFFFF" : "#66716D"}
                  />
                  <Text
                    className={`text-xs font-bold ${
                      paymentMethod === m.key ? "text-white" : "text-ink"
                    }`}
                  >
                    {m.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {(paymentMethod === "GCash" || paymentMethod === "Bank") && (
              <View className="mb-3">
                <Text className="text-xs font-bold text-ink uppercase tracking-wider mb-1.5">
                  Reference Number (Optional)
                </Text>
                <TextInput
                  placeholder="e.g. Ref # or last 4 digits"
                  placeholderTextColor="#9CA3AF"
                  value={paymentReference}
                  onChangeText={setPaymentReference}
                  className="rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm text-ink"
                />
              </View>
            )}

            {/* Notes */}
            <Text className="text-xs font-bold text-ink uppercase tracking-wider mb-2">
              Notes (Optional)
            </Text>
            <TextInput
              placeholder="e.g. Paid in cash at store"
              placeholderTextColor="#9CA3AF"
              value={paymentNotes}
              onChangeText={setPaymentNotes}
              className="rounded-xl border border-border bg-white px-3.5 py-3 text-sm text-ink mb-6"
            />
          </ScrollView>

          {/* Pinned Bottom Submit Bar */}
          <View className="p-5 pt-3 bg-paper border-t border-border/40">
            <Pressable
              disabled={isSubmitting}
              className={`py-3.5 rounded-2xl items-center justify-center shadow-xs ${
                payAmountMinor <= 0 || isOverpaid
                  ? "bg-slate-300 active:bg-slate-300"
                  : "bg-forest-900 active:bg-forest-900/90"
              }`}
              onPress={handleSave}
            >
              <Text
                className={`font-extrabold text-base ${
                  payAmountMinor <= 0 || isOverpaid
                    ? "text-slate-600"
                    : "text-white"
                }`}
              >
                {isSubmitting
                  ? "Saving..."
                  : isOverpaid
                  ? "Amount Exceeds Balance"
                  : payAmountMinor > 0
                  ? `Save Payment — ${formatPHP(payAmountMinor)}`
                  : "Save Payment"}
              </Text>
            </Pressable>
          </View>

          {/* Branded Feedback Modal */}
          {feedback && (
            <FeedbackModal
              visible={feedback.visible}
              type={feedback.type}
              mood={
                feedback.mood ||
                (feedback.type === "success" ? "celebrate" : "thinking")
              }
              title={feedback.title}
              message={feedback.message}
              buttonText={
                feedback.buttonText ||
                (feedback.type === "success" ? "Done" : "Try Again")
              }
              onClose={handleFeedbackClose}
            />
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
