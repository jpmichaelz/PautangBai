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
  Keyboard,
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
import { FeedbackModal } from "@/components/feedback-modal";

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

  const [step, setStep] = useState<1 | 2>(initialBorrowerId ? 2 : 1);
  const [borrowerSearch, setBorrowerSearch] = useState("");
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
  const [feedback, setFeedback] = useState<{
    visible: boolean;
    type: "success" | "error";
    title: string;
    message: string;
    savedLoan?: Loan;
  } | null>(null);

  useEffect(() => {
    if (initialBorrowerId) {
      setSelectedBorrowerId(initialBorrowerId);
      setStep(2);
    } else if (borrowers.length === 1 && !selectedBorrowerId) {
      setSelectedBorrowerId(borrowers[0].id);
      setStep(2);
    } else if (!selectedBorrowerId) {
      setStep(1);
    }
  }, [initialBorrowerId, borrowers, selectedBorrowerId]);

  const resetForm = () => {
    setSelectedBorrowerId("");
    setStep(1);
    setBorrowerSearch("");
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

  const handleFeedbackClose = () => {
    const saved = feedback?.savedLoan;
    setFeedback(null);
    resetForm();
    onClose();
    if (saved) {
      onSuccess?.(saved);
    }
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

  const selectedBorrower = borrowers.find((b) => b.id === selectedBorrowerId);
  const filteredBorrowers = borrowers.filter((b) => {
    const q = borrowerSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      b.name.toLowerCase().includes(q) ||
      (b.phone && b.phone.includes(q)) ||
      (b.notes && b.notes.toLowerCase().includes(q)) ||
      (b.address && b.address.toLowerCase().includes(q))
    );
  });

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

    Keyboard.dismiss();
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

      const borrowerObj = borrowers.find((b) => b.id === selectedBorrowerId);
      setFeedback({
        visible: true,
        type: "success",
        title: "Loan Recorded!",
        message: `${formatPHP(savedLoan.principal_minor)} loan recorded for ${borrowerObj?.name || "borrower"}.`,
        savedLoan,
      });
    } catch (err) {
      console.error("Failed to create loan:", err);
      setFeedback({
        visible: true,
        type: "error",
        title: "Failed to Create Loan",
        message: "Unable to record loan right now. Please try again.",
      });
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
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1 bg-paper relative"
      >
        {/* Top Back Action Bar */}
        <View className="px-4 pt-3 pb-1 flex-row items-center justify-between">
          <Pressable
            onPress={step === 2 && !initialBorrowerId ? () => setStep(1) : handleClose}
            hitSlop={12}
            className="flex-row items-center gap-1.5 py-1.5 px-2 -ml-2 rounded-xl active:bg-white/60"
            accessibilityLabel="Back"
            accessibilityRole="button"
          >
            <Ionicons name="arrow-back" size={22} color="#173D35" />
            <Text className="text-sm font-bold text-forest-900">
              {step === 2 && !initialBorrowerId ? "Change Borrower" : "Back"}
            </Text>
          </Pressable>

          <View className="px-2.5 py-1 rounded-full bg-forest-900/10">
            <Text className="text-[10px] font-black text-forest-900 tracking-wider">
              {step === 1 ? "STEP 1 OF 2" : "STEP 2 OF 2"}
            </Text>
          </View>
        </View>

        {step === 1 ? (
          <ScrollView
            className="flex-1 px-5"
            contentContainerStyle={{ paddingTop: 8, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Step 1 Header */}
            <View className="items-center mb-5">
              <Frog mood="borrower" size={105} />
              <Text className="text-2xl font-black text-forest-900 mt-2 text-center tracking-tight">
                Kinsa ang Mangungutang?
              </Text>
              <Text className="text-xs font-medium text-slate-600 mt-1 text-center">
                Pilia o pangitaa ang tawo nga tagaan og bag-ong pautang.
              </Text>
            </View>

            {/* Search Bar */}
            <View className="flex-row items-center px-3.5 py-2.5 rounded-2xl bg-white border border-border shadow-xs mb-3">
              <Ionicons name="search" size={18} color="#66716D" style={{ marginRight: 8 }} />
              <TextInput
                placeholder="Search by name, phone, or tag..."
                placeholderTextColor="#9CA3AF"
                value={borrowerSearch}
                onChangeText={setBorrowerSearch}
                className="flex-1 text-sm text-ink"
              />
              {borrowerSearch.length > 0 && (
                <Pressable onPress={() => setBorrowerSearch("")} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                </Pressable>
              )}
            </View>

            {/* Quick Add Borrower Button */}
            <Pressable
              onPress={() => {
                onClose();
                onAddBorrowerPress?.();
              }}
              className="flex-row items-center justify-between p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 mb-4 active:bg-emerald-100"
            >
              <View className="flex-row items-center gap-2.5">
                <View className="w-8 h-8 rounded-full bg-forest items-center justify-center">
                  <Ionicons name="person-add" size={15} color="#FFFFFF" />
                </View>
                <View>
                  <Text className="text-xs font-black text-forest-900">
                    + Dugang Bag-ong Mangungutang
                  </Text>
                  <Text className="text-[11px] text-emerald-800">
                    Wala pa sa listahan? Ilista una diri.
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#15803D" />
            </Pressable>

            {/* Borrower List */}
            <View className="gap-2.5">
              {filteredBorrowers.length === 0 ? (
                <View className="p-8 rounded-2xl bg-white border border-border items-center justify-center gap-2 mt-2">
                  <Frog mood="searchEmpty" size={68} />
                  <Text className="text-sm font-bold text-forest-900 text-center">
                    Walay nakit-an nga mangungutang
                  </Text>
                  <Text className="text-xs text-slate text-center">
                    {borrowerSearch
                      ? `Walay motakdo sa "${borrowerSearch}".`
                      : "Wala pay narekord nga mangungutang."}
                  </Text>
                </View>
              ) : (
                filteredBorrowers.map((b) => {
                  const tagMatch = b.notes?.match(/^\[(.*?)\]/);
                  const tag = tagMatch ? tagMatch[1] : null;

                  return (
                    <Pressable
                      key={b.id}
                      onPress={() => {
                        setSelectedBorrowerId(b.id);
                        setStep(2);
                      }}
                      className="flex-row items-center justify-between p-3.5 rounded-2xl bg-white border border-border active:border-forest active:bg-forest/5 shadow-xs"
                    >
                      <View className="flex-row items-center gap-3 flex-1 mr-2">
                        <View className="w-10 h-10 rounded-full bg-forest-900/10 items-center justify-center">
                          <Ionicons name="person" size={18} color="#173D35" />
                        </View>
                        <View className="flex-1">
                          <View className="flex-row items-center gap-2">
                            <Text
                              numberOfLines={1}
                              className="text-base font-extrabold text-forest-900"
                            >
                              {b.name}
                            </Text>
                            {tag && (
                              <View className="px-2 py-0.5 rounded bg-emerald-100 border border-emerald-200">
                                <Text className="text-[10px] font-bold text-emerald-800">
                                  {tag}
                                </Text>
                              </View>
                            )}
                          </View>
                          <Text numberOfLines={1} className="text-xs text-slate mt-0.5">
                            {b.phone || b.address || "Active Borrower"}
                          </Text>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color="#287A63" />
                    </Pressable>
                  );
                })
              )}
            </View>
          </ScrollView>
        ) : (
          <ScrollView
            className="flex-1 px-5"
            contentContainerStyle={{ paddingTop: 8, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header Mascot */}
            <View className="items-center mb-4">
              <Frog mood="newLoan" size={105} />
              <Text className="text-2xl font-black text-forest-900 mt-2 text-center tracking-tight">
                Bag-ong Pautang
              </Text>
              <Text className="text-xs font-medium text-slate-700 mt-0.5 text-center">
                Ibutang ang kantidad ug tubo sa pautang.
              </Text>
            </View>

            {/* Selected Borrower Banner Card */}
            <View className="flex-row items-center justify-between p-3.5 rounded-2xl bg-white border border-forest/30 shadow-xs mb-4">
              <View className="flex-row items-center gap-3 flex-1 mr-2">
                <View className="w-10 h-10 rounded-full bg-emerald-100 items-center justify-center">
                  <Ionicons name="checkmark-circle" size={20} color="#15803D" />
                </View>
                <View className="flex-1">
                  <Text className="text-[10px] font-black text-forest-900/60 uppercase tracking-wider">
                    Mangungutang / Borrower
                  </Text>
                  <Text numberOfLines={1} className="text-base font-black text-forest-900 mt-0.5">
                    {selectedBorrower?.name || "Selected Borrower"}
                  </Text>
                  <Text numberOfLines={1} className="text-xs text-slate">
                    {selectedBorrower?.phone || selectedBorrower?.address || "Ready for loan"}
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={() => setStep(1)}
                className="py-1.5 px-3 rounded-full bg-forest-900/10 active:bg-forest-900/20"
              >
                <Text className="text-xs font-bold text-forest-900">Ilisi / Change</Text>
              </Pressable>
            </View>

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
        )}

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
    </Modal>
  );
}
