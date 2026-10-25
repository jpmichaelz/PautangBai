import { useState, useEffect } from "react";
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
import { Borrower, Loan, LoanInterestType } from "@/types/database";
import { loanHelper } from "@/db-helpers/loans";
import {
  formatPHP,
  calculateTotalChargeMinor,
} from "@/services/interest/calculateInterest";
import { generateUUID } from "@/services/uuid";

import {
  getLocalDateString,
  addDays,
  addWeeks,
  addMonthsSafe,
} from "@/services/date/dateUtils";
import { Frog } from "@/components/frog";

interface LoanFormModalProps {
  visible: boolean;
  borrowers: Borrower[];
  initialBorrowerId?: string;
  onClose: () => void;
  onSuccess?: (loan: Loan) => void;
  onAddBorrowerPress?: () => void;
}

export function LoanFormModal({
  visible,
  borrowers,
  initialBorrowerId,
  onClose,
  onSuccess,
  onAddBorrowerPress,
}: LoanFormModalProps) {
  const db = useSQLiteContext();

  const [selectedBorrowerId, setSelectedBorrowerId] = useState(
    initialBorrowerId || "",
  );
  const [principalInput, setPrincipalInput] = useState("");
  const [interestType, setInterestType] = useState<LoanInterestType>("none");
  const [fixedFeeInput, setFixedFeeInput] = useState("");
  const [percentageRateInput, setPercentageRateInput] = useState("");
  const [termUnits, setTermUnits] = useState("15");
  const [dueDateDays, setDueDateDays] = useState<"none" | "15" | "30" | "60">(
    "30",
  );
  const [loanNotes, setLoanNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialBorrowerId) {
      setSelectedBorrowerId(initialBorrowerId);
    } else if (borrowers.length === 1 && !selectedBorrowerId) {
      setSelectedBorrowerId(borrowers[0].id);
    }
  }, [initialBorrowerId, borrowers, selectedBorrowerId]);

  const resetForm = () => {
    setSelectedBorrowerId("");
    setPrincipalInput("");
    setInterestType("none");
    setFixedFeeInput("");
    setPercentageRateInput("");
    setTermUnits("15");
    setDueDateDays("30");
    setLoanNotes("");
    setIsSubmitting(false);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    resetForm();
    onClose();
  };

  // Calculations
  const parsedPrincipal = parseFloat(principalInput.replace(/,/g, "")) || 0;
  const principalMinor = Math.round(parsedPrincipal * 100);
  const parsedRate = parseFloat(percentageRateInput) || 0;

  let calculatedFeeMinor = 0;
  let termExplanation = "";

  if (interestType === "fixed_amount") {
    calculatedFeeMinor = Math.round(
      (parseFloat(fixedFeeInput.replace(/,/g, "")) || 0) * 100,
    );
  } else if (interestType === "percentage_flat") {
    calculatedFeeMinor = calculateTotalChargeMinor({
      principalMinor,
      interestType: "percentage_flat",
      interestRate: percentageRateInput,
    });
    if (parsedRate > 0) {
      termExplanation = `${parsedRate}% one-time fee`;
    }
  } else if (interestType === "percentage_daily") {
    const days = Math.max(1, parseInt(termUnits, 10) || 1);
    calculatedFeeMinor = calculateTotalChargeMinor({
      principalMinor,
      interestType: "percentage_daily",
      interestRate: percentageRateInput,
      unitsCount: days,
    });
    if (parsedRate > 0) {
      const totalPct = (parsedRate * days).toFixed(1).replace(/\.0$/, "");
      termExplanation = `${parsedRate}%/day × ${days}d = ${totalPct}% total`;
    }
  } else if (interestType === "percentage_weekly") {
    const weeks = Math.max(1, parseInt(termUnits, 10) || 1);
    calculatedFeeMinor = calculateTotalChargeMinor({
      principalMinor,
      interestType: "percentage_weekly",
      interestRate: percentageRateInput,
      unitsCount: weeks,
    });
    if (parsedRate > 0) {
      const totalPct = (parsedRate * weeks).toFixed(1).replace(/\.0$/, "");
      termExplanation = `${parsedRate}%/wk × ${weeks}w = ${totalPct}% total`;
    }
  } else if (interestType === "percentage_monthly") {
    const months = Math.max(1, parseInt(termUnits, 10) || 1);
    calculatedFeeMinor = calculateTotalChargeMinor({
      principalMinor,
      interestType: "percentage_monthly",
      interestRate: percentageRateInput,
      unitsCount: months,
    });
    if (parsedRate > 0) {
      const totalPct = (parsedRate * months).toFixed(1).replace(/\.0$/, "");
      termExplanation = `${parsedRate}%/mo × ${months}mo = ${totalPct}% total`;
    }
  }
  const totalLoanDueMinor = principalMinor + calculatedFeeMinor;

  const handleSave = async () => {
    if (isSubmitting) return;

    if (!selectedBorrowerId) {
      Alert.alert(
        "Kinahanglan og Mangungutang",
        "Palihug pagpili o pagdugang og mangungutang una mag-himo og pautang.",
      );
      return;
    }
    if (principalMinor <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid loan amount.");
      return;
    }

    setIsSubmitting(true);
    try {
      const loanDateStr = getLocalDateString();

      let dueDateStr: string | null = null;
      if (interestType === "percentage_daily") {
        const days = Math.max(1, parseInt(termUnits, 10) || 1);
        dueDateStr = addDays(loanDateStr, days);
      } else if (interestType === "percentage_weekly") {
        const weeks = Math.max(1, parseInt(termUnits, 10) || 1);
        dueDateStr = addWeeks(loanDateStr, weeks);
      } else if (interestType === "percentage_monthly") {
        const months = Math.max(1, parseInt(termUnits, 10) || 1);
        dueDateStr = addMonthsSafe(loanDateStr, months);
      } else if (dueDateDays !== "none") {
        const days = parseInt(dueDateDays, 10) || 30;
        dueDateStr = addDays(loanDateStr, days);
      }

      const id = generateUUID();

      const savedLoan = await loanHelper.create(db, {
        id,
        borrower_id: selectedBorrowerId,
        principal_minor: principalMinor,
        currency: "PHP",
        interest_type: interestType,
        fixed_charge_minor: calculatedFeeMinor,
        interest_rate: interestType.startsWith("percentage")
          ? percentageRateInput.trim() || null
          : null,
        interest_period:
          interestType === "percentage_daily"
            ? "daily"
            : interestType === "percentage_weekly"
              ? "weekly"
              : interestType === "percentage_monthly"
                ? "monthly"
                : null,
        interest_start_date: loanDateStr,
        loan_date: loanDateStr,
        due_date: dueDateStr,
        notes: loanNotes.trim() || null,
        status: "active",
        server_version: null,
      });

      resetForm();
      onClose();
      onSuccess?.(savedLoan);
    } catch (err) {
      console.error("Failed to create loan:", err);
      Alert.alert("Error", "Failed to create loan. Please try again.");
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
      <KeyboardAvoidingView behavior="padding" className="flex-1 bg-paper">
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
            <Frog mood="newLoan" size={130} />
            <Text className="text-2xl font-black text-forest-900 mt-3 text-center tracking-tight">
              Bag-ong Pautang
            </Text>
            <Text className="text-sm font-medium text-slate-700 mt-1 text-center">
              Ibutang ang kantidad ug tubo sa pautang.
            </Text>
          </View>
          {/* Borrower selector */}
          <Text className="text-xs font-bold text-ink uppercase tracking-wider mb-2">
            Mangungutang / Borrower *
          </Text>
          {borrowers.length === 0 ? (
            <View className="mb-4 p-5 rounded-2xl bg-paper border border-dashed border-border items-center justify-center gap-2">
              <Frog mood="borrower" size={60} />
              <Text className="text-xs font-semibold text-slate text-center">
                Walay mangungutang nga nakit-an. Kinahanglan magdugang una og
                mangungutang.
              </Text>
              <Pressable
                onPress={() => {
                  onClose();
                  onAddBorrowerPress?.();
                }}
                className="flex-row items-center gap-1.5 px-4 py-2 rounded-full bg-forest active:opacity-90 mt-1"
              >
                <Ionicons name="person-add" size={15} color="#FFFFFF" />
                <Text className="text-xs font-bold text-white">
                  + Dugang Mangungutang
                </Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mb-4"
            >
              {borrowers.map((b) => (
                <Pressable
                  key={b.id}
                  className={`py-2 px-3.5 rounded-full border mr-2 ${
                    selectedBorrowerId === b.id
                      ? "bg-forest-900 border-forest-900"
                      : "bg-white border-border"
                  }`}
                  onPress={() => setSelectedBorrowerId(b.id)}
                >
                  <Text
                    className={`text-xs font-semibold ${
                      selectedBorrowerId === b.id ? "text-white" : "text-ink"
                    }`}
                  >
                    {b.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          {/* Principal Amount */}
          <Text className="text-xs font-bold text-ink uppercase tracking-wider mb-2">
            Loan Amount (PHP ₱) *
          </Text>
          <TextInput
            placeholder="e.g. 5,000"
            placeholderTextColor="#9CA3AF"
            value={principalInput}
            onChangeText={setPrincipalInput}
            keyboardType="numeric"
            className="rounded-xl border border-border bg-white px-3.5 py-3 text-base text-ink mb-4"
          />

          {/* Interest/Fee Type Selector */}
          <Text className="text-xs font-bold text-ink uppercase tracking-wider mb-2">
            Tubo / Interest Fee
          </Text>
          <View className="flex-row flex-wrap gap-2 mb-4">
            {(
              [
                { key: "none", label: "None (₱0)" },
                { key: "fixed_amount", label: "Fixed Fee (₱)" },
                { key: "percentage_flat", label: "Flat %" },
                { key: "percentage_daily", label: "Daily %" },
                { key: "percentage_weekly", label: "Weekly %" },
                { key: "percentage_monthly", label: "Monthly %" },
              ] as const
            ).map((opt) => (
              <Pressable
                key={opt.key}
                className={`py-2 px-3 rounded-xl border ${
                  interestType === opt.key
                    ? "bg-bai border-bai"
                    : "bg-white border-border"
                }`}
                onPress={() => {
                  setInterestType(opt.key);
                  if (opt.key === "percentage_daily") setTermUnits("15");
                  else if (opt.key === "percentage_weekly") setTermUnits("4");
                  else if (opt.key === "percentage_monthly") setTermUnits("1");
                }}
              >
                <Text
                  className={`text-xs font-bold ${
                    interestType === opt.key ? "text-white" : "text-ink"
                  }`}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {interestType === "fixed_amount" && (
            <View className="mb-4">
              <Text className="text-xs font-bold text-ink uppercase tracking-wider mb-2">
                Fixed Fee Amount (₱)
              </Text>
              <TextInput
                placeholder="e.g. 200"
                placeholderTextColor="#9CA3AF"
                value={fixedFeeInput}
                onChangeText={setFixedFeeInput}
                keyboardType="numeric"
                className="rounded-xl border border-border bg-white px-3.5 py-3 text-base text-ink"
              />
            </View>
          )}

          {interestType.startsWith("percentage") && (
            <View className="mb-4">
              <Text className="text-xs font-bold text-ink uppercase tracking-wider mb-2">
                {interestType === "percentage_daily"
                  ? "Daily Interest Rate (% / day)"
                  : interestType === "percentage_weekly"
                    ? "Weekly Interest Rate (% / week)"
                    : interestType === "percentage_monthly"
                      ? "Monthly Interest Rate (% / month)"
                      : "Flat Interest Rate (%)"}
              </Text>
              <TextInput
                placeholder={
                  interestType === "percentage_daily"
                    ? "e.g. 1"
                    : "e.g. 5 or 10"
                }
                placeholderTextColor="#9CA3AF"
                value={percentageRateInput}
                onChangeText={setPercentageRateInput}
                keyboardType="numeric"
                className="rounded-xl border border-border bg-white px-3.5 py-3 text-base text-ink"
              />
            </View>
          )}

          {interestType === "percentage_daily" && (
            <View className="mb-4">
              <Text className="text-xs font-bold text-ink uppercase tracking-wider mb-2">
                Agreed Term (Days)
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {[
                  { key: "7", label: "7 Days" },
                  { key: "15", label: "15 Days" },
                  { key: "30", label: "30 Days" },
                  { key: "60", label: "60 Days" },
                ].map((opt) => (
                  <Pressable
                    key={opt.key}
                    className={`py-2 px-3 rounded-xl border ${
                      termUnits === opt.key
                        ? "bg-forest-900 border-forest-900"
                        : "bg-white border-border"
                    }`}
                    onPress={() => setTermUnits(opt.key)}
                  >
                    <Text
                      className={`text-xs font-bold ${
                        termUnits === opt.key ? "text-white" : "text-ink"
                      }`}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {interestType === "percentage_weekly" && (
            <View className="mb-4">
              <Text className="text-xs font-bold text-ink uppercase tracking-wider mb-2">
                Agreed Term (Weeks)
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {[
                  { key: "1", label: "1 Week" },
                  { key: "2", label: "2 Weeks" },
                  { key: "3", label: "3 Weeks" },
                  { key: "4", label: "4 Weeks" },
                ].map((opt) => (
                  <Pressable
                    key={opt.key}
                    className={`py-2 px-3 rounded-xl border ${
                      termUnits === opt.key
                        ? "bg-forest-900 border-forest-900"
                        : "bg-white border-border"
                    }`}
                    onPress={() => setTermUnits(opt.key)}
                  >
                    <Text
                      className={`text-xs font-bold ${
                        termUnits === opt.key ? "text-white" : "text-ink"
                      }`}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {interestType === "percentage_monthly" && (
            <View className="mb-4">
              <Text className="text-xs font-bold text-ink uppercase tracking-wider mb-2">
                Agreed Term (Months)
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {[
                  { key: "1", label: "1 Month" },
                  { key: "2", label: "2 Months" },
                  { key: "3", label: "3 Months" },
                  { key: "6", label: "6 Months" },
                ].map((opt) => (
                  <Pressable
                    key={opt.key}
                    className={`py-2 px-3 rounded-xl border ${
                      termUnits === opt.key
                        ? "bg-forest-900 border-forest-900"
                        : "bg-white border-border"
                    }`}
                    onPress={() => setTermUnits(opt.key)}
                  >
                    <Text
                      className={`text-xs font-bold ${
                        termUnits === opt.key ? "text-white" : "text-ink"
                      }`}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Due Date Presets for flat / fixed / none */}
          {["none", "fixed_amount", "percentage_flat"].includes(
            interestType,
          ) && (
            <>
              <Text className="text-xs font-bold text-ink uppercase tracking-wider mb-2">
                Due Date
              </Text>
              <View className="flex-row flex-wrap gap-2 mb-4">
                {[
                  { key: "15", label: "15 Days" },
                  { key: "30", label: "30 Days" },
                  { key: "60", label: "60 Days" },
                  { key: "none", label: "No Due Date" },
                ].map((opt) => (
                  <Pressable
                    key={opt.key}
                    className={`py-2 px-3 rounded-xl border ${
                      dueDateDays === opt.key
                        ? "bg-forest-900 border-forest-900"
                        : "bg-white border-border"
                    }`}
                    onPress={() => setDueDateDays(opt.key as any)}
                  >
                    <Text
                      className={`text-xs font-bold ${
                        dueDateDays === opt.key ? "text-white" : "text-ink"
                      }`}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          {/* Notes */}
          <Text className="text-xs font-bold text-ink uppercase tracking-wider mb-2">
            Notes (Optional)
          </Text>
          <TextInput
            placeholder="e.g. For store inventory"
            placeholderTextColor="#9CA3AF"
            value={loanNotes}
            onChangeText={setLoanNotes}
            className="rounded-xl border border-border bg-white px-3.5 py-3 text-base text-ink mb-4"
          />

          {/* Calculation Preview */}
          <View className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 gap-2 mb-6">
            <Text className="text-[11px] font-extrabold text-forest-900 tracking-wider">
              LOAN SUMMARY PREVIEW
            </Text>
            <View className="flex-row justify-between items-center">
              <Text className="text-xs text-slate">Principal Amount:</Text>
              <Text className="text-sm font-semibold text-ink">
                {formatPHP(principalMinor)}
              </Text>
            </View>
            <View className="flex-row justify-between items-center">
              <View>
                <Text className="text-xs text-slate">Interest / Charge:</Text>
                {termExplanation ? (
                  <Text className="text-[10px] text-amber-700 font-medium">
                    {termExplanation}
                  </Text>
                ) : null}
              </View>
              <Text className="text-sm font-semibold text-amber-700">
                +{formatPHP(calculatedFeeMinor)}
              </Text>
            </View>
            <View className="h-px bg-emerald-200 my-1" />
            <View className="flex-row justify-between items-center">
              <Text className="text-sm font-black text-forest-900">
                Total to Collect:
              </Text>
              <Text className="text-lg font-black text-forest-900">
                {formatPHP(totalLoanDueMinor)}
              </Text>
            </View>
          </View>

          <Pressable
            disabled={isSubmitting}
            className={`py-4 rounded-xl items-center justify-center mb-10 ${
              isSubmitting ? "bg-bai/60" : "bg-bai active:opacity-90"
            }`}
            onPress={handleSave}
          >
            <Text className="text-white font-bold text-base">
              {isSubmitting ? "Creating Loan..." : "Create Loan"}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
