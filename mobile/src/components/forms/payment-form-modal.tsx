import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { Ionicons } from "@expo/vector-icons";
import { Loan, Payment } from "@/types/database";
import { paymentHelper } from "@/db-helpers/payments";
import { loanHelper } from "@/db-helpers/loans";
import {
  formatPHP,
  allocatePayment,
} from "@/services/interest/calculateInterest";
import { calculateLoanBalance } from "@/services/balance/calculateBalance";
import { getLocalDateString } from "@/services/date/dateUtils";
import { Frog } from "@/components/frog";
import { generateUUID } from "@/services/uuid";


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
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "GCash" | "Bank">(
    "Cash",
  );
  const [paymentNotes, setPaymentNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setPayAmountInput("");
    setPaymentMethod("Cash");
    setPaymentNotes("");
    setIsSubmitting(false);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    resetForm();
    onClose();
  };

  const handleSave = async () => {
    if (!loan || isSubmitting) return;

    const parsedPay = parseFloat(payAmountInput.replace(/,/g, "")) || 0;
    const payAmountMinor = Math.round(parsedPay * 100);

    if (payAmountMinor <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid payment amount.");
      return;
    }

    const loanPayments = allPayments.filter((p) => p.loan_id === loan.id);
    const balance = calculateLoanBalance(loan, loanPayments);

    if (payAmountMinor > balance.remainingBalanceMinor) {
      Alert.alert(
        "Overpayment Not Allowed",
        `Payment cannot exceed the remaining balance of ${formatPHP(
          balance.remainingBalanceMinor,
        )}.`,
      );
      return;
    }

    setIsSubmitting(true);
    try {
      // Allocate against remaining uncollected interest
      const allocation = allocatePayment(payAmountMinor, balance.interestRemainingMinor);
      const id = generateUUID();
      const todayStr = getLocalDateString();

      await paymentHelper.create(db, {
        id,
        loan_id: loan.id,
        amount_minor: payAmountMinor,
        payment_date: todayStr,
        payment_method: paymentMethod,
        reference: null,
        notes: paymentNotes.trim() || null,
        allocation_json: JSON.stringify(allocation),
        sync_status: "pending",
      });

      resetForm();
      onClose();
      onSuccess?.();
      Alert.alert(
        "Payment Recorded",
        `Recorded ${formatPHP(payAmountMinor)} successfully.`,
      );
    } catch (err) {
      console.error("Failed to record payment:", err);
      Alert.alert("Error", "Failed to record payment. Please try again.");
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
          {/* Organic Mascot Header */}
          <View className="items-center mb-6">
            <Frog mood="payment" size={130} />
            <Text className="text-2xl font-black text-forest-900 mt-3 text-center tracking-tight">
              Dawat og Bayad
            </Text>
            <Text className="text-sm font-medium text-slate-700 mt-1 text-center">
              I-rekord ang bayad aron mabawas sa balanse.
            </Text>
          </View>
          {loan && (
            <View className="p-4 rounded-xl bg-white border border-border mb-4">
              <Text className="text-base font-extrabold text-forest-900">
                {borrowerName || "Borrower"}
              </Text>
              <Text className="text-xs text-slate mt-1">
                Lent: {formatPHP(loan.principal_minor)} • Date: {loan.loan_date}
              </Text>
            </View>
          )}

          <Text className="text-xs font-bold text-ink uppercase tracking-wider mb-2">
            Payment Amount (₱) *
          </Text>
          <TextInput
            placeholder="0.00"
            placeholderTextColor="#9CA3AF"
            value={payAmountInput}
            onChangeText={setPayAmountInput}
            keyboardType="numeric"
            className="rounded-xl border border-border bg-white px-4 py-3 text-2xl font-black text-ink mb-4"
            autoFocus
          />

          {/* Payment Method */}
          <Text className="text-xs font-bold text-ink uppercase tracking-wider mb-2">
            Payment Method
          </Text>
          <View className="flex-row gap-2 mb-4">
            {(["Cash", "GCash", "Bank"] as const).map((method) => (
              <Pressable
                key={method}
                className={`py-2 px-4 rounded-xl border ${
                  paymentMethod === method
                    ? "bg-bai border-bai"
                    : "bg-white border-border"
                }`}
                onPress={() => setPaymentMethod(method)}
              >
                <Text
                  className={`text-xs font-bold ${
                    paymentMethod === method ? "text-white" : "text-ink"
                  }`}
                >
                  {method}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text className="text-xs font-bold text-ink uppercase tracking-wider mb-2">
            Notes (Optional)
          </Text>
          <TextInput
            placeholder="e.g. Partial cash payment at store"
            placeholderTextColor="#9CA3AF"
            value={paymentNotes}
            onChangeText={setPaymentNotes}
            className="rounded-xl border border-border bg-white px-3.5 py-3 text-base text-ink mb-6"
          />

          <Pressable
            disabled={isSubmitting}
            className={`py-4 rounded-xl items-center justify-center mb-10 ${
              isSubmitting ? "bg-emerald-700/60" : "bg-emerald-700 active:opacity-90"
            }`}
            onPress={handleSave}
          >
            <Text className="text-white font-bold text-base">
              {isSubmitting ? "Recording..." : "Confirm Payment"}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
