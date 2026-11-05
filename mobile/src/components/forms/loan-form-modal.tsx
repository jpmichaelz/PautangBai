import { useState, useEffect } from "react";
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
  isValidDateString,
} from "@/services/date/dateUtils";
import { Frog, FrogMood } from "@/components/frog";
import { FeedbackModal } from "@/components/feedback-modal";
import { enforceImmersiveSystemBars } from "@/utils/system-bars";
import { syncStateHelper } from "@/services/sync/syncService";

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
  const [isBorrowerPickerOpen, setIsBorrowerPickerOpen] = useState(false);
  const [borrowerSearch, setBorrowerSearch] = useState("");

  const [principalInput, setPrincipalInput] = useState("");
  const [interestType, setInterestType] = useState<LoanInterestType>("none");
  const [fixedFeeInput, setFixedFeeInput] = useState("");
  const [percentageRateInput, setPercentageRateInput] = useState("");
  const [termUnits, setTermUnits] = useState("1");
  const [loanDateMode, setLoanDateMode] = useState<
    "today" | "yesterday" | "custom"
  >("today");
  const [customLoanDate, setCustomLoanDate] = useState("");
  const [dueDateDays, setDueDateDays] = useState<
    "none" | "15" | "30" | "60" | "custom"
  >("30");
  const [customDueDate, setCustomDueDate] = useState("");
  const [loanNotes, setLoanNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [feedback, setFeedback] = useState<{
    visible: boolean;
    type: "success" | "error";
    mood?: FrogMood;
    title: string;
    message: string;
    buttonText?: string;
    action?: () => void;
    savedLoan?: Loan;
  } | null>(null);

  useEffect(() => {
    if (initialBorrowerId) {
      setSelectedBorrowerId(initialBorrowerId);
    } else if (borrowers.length === 1 && !selectedBorrowerId) {
      setSelectedBorrowerId(borrowers[0].id);
    }
  }, [initialBorrowerId, borrowers, selectedBorrowerId]);

  useEffect(() => {
    if (visible) {
      (async () => {
        try {
          const [savedType, savedRate, savedDueDays] = await Promise.all([
            syncStateHelper.get(db, "pref_default_interest_type"),
            syncStateHelper.get(db, "pref_default_interest_rate"),
            syncStateHelper.get(db, "pref_default_due_days"),
          ]);
          if (savedType) setInterestType(savedType as LoanInterestType);
          if (savedRate) setPercentageRateInput(savedRate);
          if (savedDueDays) setDueDateDays(savedDueDays as any);
        } catch {
          // fallback to defaults
        }
      })();
    }
  }, [visible, db]);

  const resetForm = () => {
    setSelectedBorrowerId(initialBorrowerId || "");
    setShowValidation(false);
    setIsBorrowerPickerOpen(false);
    setBorrowerSearch("");
    setPrincipalInput("");
    setInterestType("none");
    setFixedFeeInput("");
    setPercentageRateInput("");
    setTermUnits("1");
    setLoanDateMode("today");
    setCustomLoanDate("");
    setDueDateDays("30");
    setCustomDueDate("");
    setLoanNotes("");
    setIsSubmitting(false);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    resetForm();
    onClose();
  };

  const handleFeedbackClose = () => {
    const action = feedback?.action;
    const saved = feedback?.savedLoan;
    setFeedback(null);
    if (action) {
      action();
      return;
    }
    if (saved) {
      resetForm();
      onClose();
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
    if (calculatedFeeMinor > 0) {
      termExplanation = "Patong sa utang";
    }
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

  const effectiveLoanDate =
    loanDateMode === "today"
      ? getLocalDateString()
      : loanDateMode === "yesterday"
        ? addDays(getLocalDateString(), -1)
        : customLoanDate.trim() || getLocalDateString();

  let previewDueDate: string | null = null;
  if (interestType === "percentage_daily") {
    const days = Math.max(1, parseInt(termUnits, 10) || 1);
    previewDueDate = addDays(effectiveLoanDate, days);
  } else if (interestType === "percentage_weekly") {
    const weeks = Math.max(1, parseInt(termUnits, 10) || 1);
    previewDueDate = addWeeks(effectiveLoanDate, weeks);
  } else if (interestType === "percentage_monthly") {
    const months = Math.max(1, parseInt(termUnits, 10) || 1);
    previewDueDate = addMonthsSafe(effectiveLoanDate, months);
  } else if (dueDateDays === "custom") {
    previewDueDate = customDueDate.trim() || null;
  } else if (dueDateDays !== "none") {
    const days = parseInt(dueDateDays, 10) || 30;
    previewDueDate = addDays(effectiveLoanDate, days);
  }

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

  const isPercentageMode = interestType.startsWith("percentage");

  const handleSave = async () => {
    if (isSubmitting) return;

    if (!selectedBorrowerId) {
      setShowValidation(true);
      setFeedback({
        visible: true,
        type: "error",
        mood: "thinking",
        title: "Kinsa ang Mangungutang?",
        message:
          "Palihug pagpili o pagdugang og mangungutang una ilista kining pautang.",
        buttonText: "Pili og Mangungutang",
        action: () => setIsBorrowerPickerOpen(true),
      });
      return;
    }
    if (principalMinor <= 0) {
      setShowValidation(true);
      setFeedback({
        visible: true,
        type: "error",
        mood: "thinking",
        title: "Pila ang Pautang?",
        message:
          "Palihug ibutang ang insaktong kantidad sa pautang (pananglitan: ₱1,000 o ₱5,000).",
        buttonText: "Tarunga ang Kantidad",
      });
      return;
    }

    Keyboard.dismiss();
    setIsSubmitting(true);
    try {
      const todayStr = getLocalDateString();
      let loanDateStr = todayStr;
      if (loanDateMode === "yesterday") {
        loanDateStr = addDays(todayStr, -1);
      } else if (loanDateMode === "custom") {
        const trimmed = customLoanDate.trim();
        if (!isValidDateString(trimmed)) {
          setFeedback({
            visible: true,
            type: "error",
            mood: "thinking",
            title: "Sayop ang Petsa sa Utang",
            message:
              "Palihug gamita ang YYYY-MM-DD nga format (pananglitan: 2026-10-15).",
            buttonText: "Tarunga ang Petsa",
          });
          setIsSubmitting(false);
          return;
        }
        loanDateStr = trimmed;
      }

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
      } else if (dueDateDays === "custom") {
        const trimmedDue = customDueDate.trim();
        if (!isValidDateString(trimmedDue)) {
          setFeedback({
            visible: true,
            type: "error",
            mood: "thinking",
            title: "Sayop ang Tingbayad (Due Date)",
            message:
              "Palihug gamita ang YYYY-MM-DD nga format (pananglitan: 2026-11-30).",
            buttonText: "Tarunga ang Petsa",
          });
          setIsSubmitting(false);
          return;
        }
        if (trimmedDue < loanDateStr) {
          setFeedback({
            visible: true,
            type: "error",
            mood: "thinking",
            title: "Sayop ang Tingbayad (Due Date)",
            message: `Ang tingbayad (${trimmedDue}) dili pwede mas sayo kaysa petsa sa utang (${loanDateStr}).`,
            buttonText: "Tarunga ang Petsa",
          });
          setIsSubmitting(false);
          return;
        }
        dueDateStr = trimmedDue;
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
              Bag-ong Pautang
            </Text>

            <View style={{ width: 64 }} />
          </View>

          <ScrollView
            className="flex-1 px-5"
            contentContainerStyle={{ paddingTop: 8, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* 1. Borrower Selector Card */}
            <Text className="text-xs font-bold text-ink uppercase tracking-wider mb-2">
              Mangungutang / Borrower *
            </Text>
            {selectedBorrower ? (
              <Pressable
                onPress={() => setIsBorrowerPickerOpen(true)}
                className="flex-row items-center justify-between p-3.5 rounded-2xl bg-white border border-forest/30 shadow-xs mb-4 active:bg-forest/5"
              >
                <View className="flex-row items-center gap-3 flex-1 mr-2">
                  <View className="w-10 h-10 rounded-full bg-emerald-100 items-center justify-center">
                    <Ionicons name="person" size={18} color="#15803D" />
                  </View>
                  <View className="flex-1">
                    <Text
                      numberOfLines={1}
                      className="text-base font-black text-forest-900"
                    >
                      {selectedBorrower.name}
                    </Text>
                    <Text numberOfLines={1} className="text-xs text-slate-600">
                      {selectedBorrower.phone ||
                        selectedBorrower.address ||
                        "Active Borrower"}
                    </Text>
                  </View>
                </View>
                <View className="flex-row items-center gap-1 py-1.5 px-3 rounded-full bg-forest-900/10">
                  <Text className="text-xs font-bold text-forest-900">Change</Text>
                  <Ionicons name="chevron-down" size={13} color="#173D35" />
                </View>
              </Pressable>
            ) : (
              <View className="mb-4">
                <Pressable
                  onPress={() => {
                    setShowValidation(false);
                    setIsBorrowerPickerOpen(true);
                  }}
                  className={`flex-row items-center justify-between p-3.5 rounded-2xl bg-white border shadow-xs active:bg-forest/5 ${
                    showValidation
                      ? "border-danger bg-red-50/30"
                      : "border-dashed border-forest/50"
                  }`}
                >
                  <View className="flex-row items-center gap-3">
                    <View
                      className={`w-10 h-10 rounded-full items-center justify-center ${
                        showValidation ? "bg-red-100" : "bg-forest-900/10"
                      }`}
                    >
                      <Ionicons
                        name="person-add"
                        size={18}
                        color={showValidation ? "#DC2626" : "#173D35"}
                      />
                    </View>
                    <Text
                      className={`text-sm font-bold ${
                        showValidation ? "text-danger" : "text-forest-900"
                      }`}
                    >
                      Pilia ang Mangungutang / Select Borrower
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-down"
                    size={18}
                    color={showValidation ? "#DC2626" : "#173D35"}
                  />
                </Pressable>
                {showValidation && (
                  <Text className="text-xs font-semibold text-danger mt-1.5 ml-1">
                    * Palihug pagpili og mangungutang
                  </Text>
                )}
              </View>
            )}

            {/* 2. Principal Loan Amount */}
            <Text className="text-xs font-bold text-ink uppercase tracking-wider mb-2">
              Loan Amount (PHP ₱) *
            </Text>
            <View
              className={`flex-row items-center rounded-2xl border bg-white px-4 py-3 shadow-xs mb-1 ${
                showValidation && principalMinor <= 0
                  ? "border-danger bg-red-50/20"
                  : "border-border"
              }`}
            >
              <Text className="text-2xl font-black text-forest-900 mr-2">₱</Text>
              <TextInput
                placeholder="0.00"
                placeholderTextColor="#9CA3AF"
                value={principalInput}
                onChangeText={(text) => {
                  setPrincipalInput(text);
                  if (showValidation) setShowValidation(false);
                }}
                maxLength={11}
                keyboardType="numeric"
                className="flex-1 text-2xl font-black text-ink p-0"
              />
              {principalInput.length > 0 && (
                <Pressable onPress={() => setPrincipalInput("")} hitSlop={8}>
                  <Ionicons name="close-circle" size={20} color="#9CA3AF" />
                </Pressable>
              )}
            </View>
            {showValidation && principalMinor <= 0 && (
              <Text className="text-xs font-semibold text-danger mb-3 ml-1">
                * Palihug ibutang ang kantidad sa pautang
              </Text>
            )}
            {!(showValidation && principalMinor <= 0) && (
              <View className="mb-3" />
            )}

            {/* 3. Date Borrowed / Petsa sa Utang */}
            <Text className="text-xs font-bold text-ink uppercase tracking-wider mb-2">
              Date Borrowed / Petsa sa Utang
            </Text>
            <View className="flex-row gap-2 mb-2">
              {[
                { key: "today", label: "Today" },
                { key: "yesterday", label: "Yesterday" },
                { key: "custom", label: "Custom Date" },
              ].map((opt) => (
                <Pressable
                  key={opt.key}
                  className={`flex-1 py-2.5 px-3 rounded-xl border items-center justify-center ${
                    loanDateMode === opt.key
                      ? "bg-forest-900 border-forest-900"
                      : "bg-white border-border"
                  }`}
                  onPress={() => {
                    setLoanDateMode(opt.key as any);
                    if (opt.key === "custom" && !customLoanDate) {
                      setCustomLoanDate(getLocalDateString());
                    }
                  }}
                >
                  <Text
                    className={`text-xs font-bold ${
                      loanDateMode === opt.key ? "text-white" : "text-ink"
                    }`}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            {loanDateMode === "custom" && (
              <View className="mb-4">
                <TextInput
                  placeholder="YYYY-MM-DD (e.g. 2026-10-15)"
                  placeholderTextColor="#9CA3AF"
                  value={customLoanDate}
                  onChangeText={setCustomLoanDate}
                  maxLength={10}
                  className="rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm text-ink"
                />
                <Text className="text-[11px] text-slate-500 mt-1">
                  Format: YYYY-MM-DD (Year-Month-Day)
                </Text>
              </View>
            )}

            {/* 4. Tubo / Interest Fee */}
            <Text className="text-xs font-bold text-ink uppercase tracking-wider mb-2 mt-2">
              Tubo / Interest
            </Text>
            {/* Primary Mode Tabs */}
            <View className="flex-row gap-2 mb-3">
              {[
                { key: "none", label: "Walay Tubo" },
                { key: "fixed_amount", label: "Patong (₱)" },
                { key: "percentage", label: "Porsyento (%)" },
              ].map((tab) => {
                const isSelected =
                  tab.key === "percentage"
                    ? isPercentageMode
                    : interestType === tab.key;
                return (
                  <Pressable
                    key={tab.key}
                    className={`flex-1 py-2.5 px-2 rounded-xl border items-center justify-center ${
                      isSelected
                        ? "bg-bai border-bai"
                        : "bg-white border-border"
                    }`}
                    onPress={() => {
                      if (tab.key === "percentage") {
                        if (!isPercentageMode) {
                          setInterestType("percentage_monthly");
                          setTermUnits("1");
                        }
                      } else {
                        setInterestType(tab.key as LoanInterestType);
                      }
                    }}
                  >
                    <Text
                      className={`text-xs font-bold text-center ${
                        isSelected ? "text-white" : "text-ink"
                      }`}
                    >
                      {tab.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Patong / Fixed Fee Input */}
            {interestType === "fixed_amount" && (
              <View className="mb-4 p-3.5 rounded-2xl bg-white border border-border shadow-xs">
                <Text className="text-xs font-bold text-ink uppercase tracking-wider mb-2">
                  Kantidad sa Patong / Tubo (₱)
                </Text>
                <View className="flex-row items-center rounded-xl border border-border bg-white px-3.5 py-2.5">
                  <Text className="text-base font-black text-forest-900 mr-2">
                    ₱
                  </Text>
                  <TextInput
                    placeholder="e.g. 100 o 200"
                    placeholderTextColor="#9CA3AF"
                    value={fixedFeeInput}
                    onChangeText={setFixedFeeInput}
                    keyboardType="numeric"
                    className="flex-1 text-base font-bold text-ink p-0"
                  />
                </View>
              </View>
            )}

            {/* Percentage Interest Configuration */}
            {isPercentageMode && (
              <View className="mb-4 p-3.5 rounded-2xl bg-white border border-border shadow-xs gap-3">
                {/* Sub-period Selector */}
                <View>
                  <Text className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                    Interest Type
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {[
                      { key: "percentage_flat", label: "Flat % (One-time)" },
                      { key: "percentage_monthly", label: "Monthly %" },
                      { key: "percentage_weekly", label: "Weekly %" },
                      { key: "percentage_daily", label: "Daily %" },
                    ].map((opt) => (
                      <Pressable
                        key={opt.key}
                        className={`py-2 px-3 rounded-xl border ${
                          interestType === opt.key
                            ? "bg-forest-900 border-forest-900"
                            : "bg-white border-border"
                        }`}
                        onPress={() => {
                          setInterestType(opt.key as LoanInterestType);
                          if (opt.key === "percentage_daily") setTermUnits("15");
                          else if (opt.key === "percentage_weekly")
                            setTermUnits("4");
                          else if (opt.key === "percentage_monthly")
                            setTermUnits("1");
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
                </View>

                {/* Percentage Rate Input */}
                <View>
                  <Text className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                    {interestType === "percentage_daily"
                      ? "Daily Rate (%)"
                      : interestType === "percentage_weekly"
                        ? "Weekly Rate (%)"
                        : interestType === "percentage_monthly"
                          ? "Monthly Rate (%)"
                          : "Flat Rate (%)"}
                  </Text>
                  <View className="flex-row items-center rounded-xl border border-border bg-white px-3.5 py-2.5">
                    <TextInput
                      placeholder={
                        interestType === "percentage_daily"
                          ? "e.g. 1"
                          : "e.g. 5 or 10"
                      }
                      placeholderTextColor="#9CA3AF"
                      value={percentageRateInput}
                      onChangeText={(text) => {
                        const cleaned = text.replace(/[^0-9.]/g, "").slice(0, 5);
                        setPercentageRateInput(cleaned);
                      }}
                      maxLength={5}
                      keyboardType="numeric"
                      className="flex-1 text-base font-bold text-ink p-0"
                    />
                    <Text className="text-base font-bold text-slate-600 ml-2">
                      %
                    </Text>
                  </View>
                </View>

                {/* Term Units for periodic percentage */}
                {interestType === "percentage_daily" && (
                  <View>
                    <Text className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                      Agreed Term (Days)
                    </Text>
                    <View className="flex-row gap-2">
                      {[
                        { key: "7", label: "7 Days" },
                        { key: "15", label: "15 Days" },
                        { key: "30", label: "30 Days" },
                        { key: "60", label: "60 Days" },
                      ].map((opt) => (
                        <Pressable
                          key={opt.key}
                          className={`flex-1 py-2 px-2 rounded-xl border items-center ${
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
                  <View>
                    <Text className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                      Agreed Term (Weeks)
                    </Text>
                    <View className="flex-row gap-2">
                      {[
                        { key: "1", label: "1 Wk" },
                        { key: "2", label: "2 Wks" },
                        { key: "3", label: "3 Wks" },
                        { key: "4", label: "4 Wks" },
                      ].map((opt) => (
                        <Pressable
                          key={opt.key}
                          className={`flex-1 py-2 px-2 rounded-xl border items-center ${
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
                  <View>
                    <Text className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                      Agreed Term (Months)
                    </Text>
                    <View className="flex-row gap-2">
                      {[
                        { key: "1", label: "1 Mo" },
                        { key: "2", label: "2 Mos" },
                        { key: "3", label: "3 Mos" },
                        { key: "6", label: "6 Mos" },
                      ].map((opt) => (
                        <Pressable
                          key={opt.key}
                          className={`flex-1 py-2 px-2 rounded-xl border items-center ${
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
              </View>
            )}

            {/* 5. Due Date / Deadline */}
            {["none", "fixed_amount", "percentage_flat"].includes(
              interestType,
            ) ? (
              <View className="mb-4">
                <Text className="text-xs font-bold text-ink uppercase tracking-wider mb-2">
                  Due Date / Tingbayad
                </Text>
                <View className="flex-row flex-wrap gap-2 mb-2">
                  {[
                    { key: "15", label: "15 Days" },
                    { key: "30", label: "30 Days" },
                    { key: "60", label: "60 Days" },
                    { key: "custom", label: "Custom" },
                    { key: "none", label: "No Due Date" },
                  ].map((opt) => (
                    <Pressable
                      key={opt.key}
                      className={`py-2 px-3 rounded-xl border ${
                        dueDateDays === opt.key
                          ? "bg-forest-900 border-forest-900"
                          : "bg-white border-border"
                      }`}
                      onPress={() => {
                        setDueDateDays(opt.key as any);
                        if (opt.key === "custom" && !customDueDate) {
                          setCustomDueDate(addDays(effectiveLoanDate, 30));
                        }
                      }}
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
                {dueDateDays === "custom" && (
                  <View className="mb-2">
                    <TextInput
                      placeholder="YYYY-MM-DD (e.g. 2026-11-30)"
                      placeholderTextColor="#9CA3AF"
                      value={customDueDate}
                      onChangeText={setCustomDueDate}
                      maxLength={10}
                      className="rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm text-ink"
                    />
                    <Text className="text-[11px] text-slate-500 mt-1">
                      Format: YYYY-MM-DD (Year-Month-Day)
                    </Text>
                  </View>
                )}
                {previewDueDate && (
                  <Text className="text-xs font-medium text-emerald-800">
                    Deadline: {previewDueDate}
                  </Text>
                )}
              </View>
            ) : (
              <View className="mb-4 p-3 rounded-xl bg-forest-900/5 border border-forest-900/10 flex-row items-center justify-between">
                <View>
                  <Text className="text-[10px] font-bold text-slate-600 uppercase">
                    Auto-calculated Due Date
                  </Text>
                  <Text className="text-xs font-black text-forest-900 mt-0.5">
                    {previewDueDate || "Based on agreed term"}
                  </Text>
                </View>
                <Ionicons name="calendar" size={16} color="#173D35" />
              </View>
            )}

            {/* 6. Notes (Optional) */}
            <Text className="text-xs font-bold text-ink uppercase tracking-wider mb-2">
              Notes (Optional)
            </Text>
            <TextInput
              placeholder="e.g. Para sa sari-sari store puhunan"
              placeholderTextColor="#9CA3AF"
              value={loanNotes}
              onChangeText={setLoanNotes}
              className="rounded-xl border border-border bg-white px-3.5 py-3 text-sm text-ink mb-5"
            />

            {/* 7. Calculation Summary Preview */}
            <View className="p-4 rounded-2xl bg-white border border-forest/20 shadow-xs gap-2 mb-6">
              <View className="flex-row items-center justify-between pb-2 border-b border-border/60">
                <Text className="text-xs font-black text-forest-900 uppercase tracking-wider">
                  Loan Summary
                </Text>
                <View className="flex-row items-center gap-1">
                  <Ionicons name="calendar-outline" size={13} color="#66716D" />
                  <Text className="text-xs font-semibold text-slate-600">
                    {effectiveLoanDate}
                  </Text>
                </View>
              </View>

              <View className="flex-row justify-between items-center">
                <Text className="text-xs text-slate-600">Principal (Gipautang):</Text>
                <Text className="text-sm font-bold text-ink">
                  {formatPHP(principalMinor)}
                </Text>
              </View>

              <View className="flex-row justify-between items-center">
                <View>
                  <Text className="text-xs text-slate-600">Interest / Tubo:</Text>
                  {termExplanation ? (
                    <Text className="text-[10px] text-amber-700 font-medium">
                      {termExplanation}
                    </Text>
                  ) : null}
                </View>
                <Text className="text-sm font-bold text-amber-700">
                  +{formatPHP(calculatedFeeMinor)}
                </Text>
              </View>

              {previewDueDate ? (
                <View className="flex-row justify-between items-center">
                  <Text className="text-xs text-slate-600">Due Date (Tingbayad):</Text>
                  <Text className="text-xs font-bold text-forest-900">
                    {previewDueDate}
                  </Text>
                </View>
              ) : null}

              <View className="h-px bg-forest-900/10 my-1" />

              <View className="flex-row justify-between items-baseline">
                <View>
                  <Text className="text-sm font-black text-forest-900">
                    Total to Collect:
                  </Text>
                  <Text className="text-[10px] text-slate-500">
                    Total bayranan
                  </Text>
                </View>
                <Text className="text-xl font-black text-forest-900">
                  {formatPHP(totalLoanDueMinor)}
                </Text>
              </View>
            </View>

            {/* Submit Button */}
            <Pressable
              disabled={isSubmitting}
              className={`py-4 rounded-2xl items-center justify-center mb-8 shadow-xs ${
                !selectedBorrowerId || principalMinor <= 0
                  ? "bg-slate-300 active:bg-slate-300"
                  : "bg-forest-900 active:bg-forest-900/90"
              }`}
              onPress={handleSave}
            >
              <Text
                className={`font-extrabold text-base ${
                  !selectedBorrowerId || principalMinor <= 0
                    ? "text-slate-600"
                    : "text-white"
                }`}
              >
                {isSubmitting
                  ? "Recording Loan..."
                  : !selectedBorrowerId
                  ? "Pili og Mangungutang (Select Borrower)"
                  : principalMinor <= 0
                  ? "Ibutang ang Kantidad (Enter Amount)"
                  : "Ilista ang Pautang (Save Loan)"}
              </Text>
            </Pressable>
          </ScrollView>

          {/* Borrower Selector Picker Modal */}
          <Modal
            visible={isBorrowerPickerOpen}
            animationType="slide"
            presentationStyle={
              Platform.OS === "ios" ? "pageSheet" : "fullScreen"
            }
            statusBarTranslucent
            onShow={enforceImmersiveSystemBars}
            onRequestClose={() => setIsBorrowerPickerOpen(false)}
          >
            <SafeAreaView className="flex-1 bg-paper" edges={["top", "bottom"]}>
              <View className="px-5 pt-4 pb-3 flex-row items-center justify-between border-b border-border/40">
                <Pressable
                  onPress={() => setIsBorrowerPickerOpen(false)}
                  hitSlop={12}
                  className="w-9 h-9 rounded-full bg-white/80 border border-border items-center justify-center shadow-xs"
                >
                  <Ionicons name="close" size={20} color="#173D35" />
                </Pressable>

                <Text className="text-base font-black text-forest-900">
                  Pilia ang Mangungutang
                </Text>

                <View style={{ width: 36 }} />
              </View>

              <View className="flex-1 px-5 pt-3">
                {/* Search Bar */}
                <View className="flex-row items-center px-3.5 py-2.5 rounded-2xl bg-white border border-border shadow-xs mb-3">
                  <Ionicons
                    name="search"
                    size={18}
                    color="#66716D"
                    style={{ marginRight: 8 }}
                  />
                  <TextInput
                    placeholder="Search by name, phone, or tag..."
                    placeholderTextColor="#9CA3AF"
                    value={borrowerSearch}
                    onChangeText={setBorrowerSearch}
                    className="flex-1 text-sm text-ink"
                    autoFocus
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
                    setIsBorrowerPickerOpen(false);
                    onClose();
                    onAddBorrowerPress?.();
                  }}
                  className="flex-row items-center justify-between p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 mb-3 active:bg-emerald-100"
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

                {/* List of Borrowers */}
                <ScrollView
                  className="flex-1"
                  contentContainerStyle={{ paddingBottom: 30 }}
                  keyboardShouldPersistTaps="handled"
                >
                  {filteredBorrowers.length === 0 ? (
                    <View className="p-8 rounded-2xl bg-white border border-border items-center justify-center gap-2 mt-2">
                      <Frog mood="searchEmpty" size={68} />
                      <Text className="text-sm font-bold text-forest-900 text-center">
                        Walay nakit-an nga mangungutang
                      </Text>
                      <Text className="text-xs text-slate-600 text-center">
                        {borrowerSearch
                          ? `Walay motakdo sa "${borrowerSearch}".`
                          : "Wala pay narekord nga mangungutang."}
                      </Text>
                    </View>
                  ) : (
                    <View className="gap-2">
                      {filteredBorrowers.map((b) => {
                        const isSelected = b.id === selectedBorrowerId;
                        const tagMatch = b.notes?.match(/^\[(.*?)\]/);
                        const tag = tagMatch ? tagMatch[1] : null;

                        return (
                          <Pressable
                            key={b.id}
                            onPress={() => {
                              setSelectedBorrowerId(b.id);
                              setIsBorrowerPickerOpen(false);
                            }}
                            className={`flex-row items-center justify-between p-3.5 rounded-2xl border shadow-xs ${
                              isSelected
                                ? "bg-forest-900/5 border-forest-900"
                                : "bg-white border-border active:border-forest"
                            }`}
                          >
                            <View className="flex-row items-center gap-3 flex-1 mr-2">
                              <View
                                className={`w-10 h-10 rounded-full items-center justify-center ${
                                  isSelected ? "bg-forest-900" : "bg-forest-900/10"
                                }`}
                              >
                                <Ionicons
                                  name="person"
                                  size={18}
                                  color={isSelected ? "#FFFFFF" : "#173D35"}
                                />
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
                                <Text
                                  numberOfLines={1}
                                  className="text-xs text-slate-600 mt-0.5"
                                >
                                  {b.phone || b.address || "Active Borrower"}
                                </Text>
                              </View>
                            </View>
                            {isSelected ? (
                              <Ionicons
                                name="checkmark-circle"
                                size={20}
                                color="#173D35"
                              />
                            ) : (
                              <Ionicons
                                name="chevron-forward"
                                size={18}
                                color="#287A63"
                              />
                            )}
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </ScrollView>
              </View>
            </SafeAreaView>
          </Modal>

          {/* Feedback Modal for success/error alerts */}
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