import React from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  Linking,
  Alert,
  StyleSheet,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Loan, Borrower, Payment } from "@/types/database";
import { formatPHP } from "@/services/interest/calculateInterest";
import { calculateLoanBalance } from "@/services/balance/calculateBalance";
import { getLocalDateString, parseLocalDate } from "@/services/date/dateUtils";
import { Frog } from "@/components/frog";
import { enforceImmersiveSystemBars } from "@/utils/system-bars";
import DashboardBg from "@/assets/images/DASHBOARD_BG.svg";

const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function formatReadableDate(dateStr?: string | null): string {
  if (!dateStr) return "Open Ended";
  const d = parseLocalDate(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function getInitials(name?: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface LoanDetailModalProps {
  visible: boolean;
  onClose: () => void;
  loan: Loan | null;
  borrower: Borrower | null;
  payments: Payment[];
  onRecordPayment?: (loan: Loan) => void;
  onDeleteLoan?: (loan: Loan) => void;
  onEditBorrower?: (borrower: Borrower) => void;
}

export function LoanDetailModal({
  visible,
  onClose,
  loan,
  borrower,
  payments,
  onRecordPayment,
  onDeleteLoan,
  onEditBorrower,
}: LoanDetailModalProps) {
  if (!loan) return null;

  const confirmDelete = () => {
    Alert.alert(
      "Delete Loan Record?",
      `Are you sure you want to delete this loan of ${formatPHP(loan.principal_minor)} for ${borrower?.name || "this borrower"}? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            onClose();
            onDeleteLoan?.(loan);
          },
        },
      ],
    );
  };

  const loanPayments = payments.filter(
    (p) => p.loan_id === loan.id && !p.deleted_at,
  );
  const balance = calculateLoanBalance(loan, loanPayments);

  const percentPaid =
    balance.totalOwedMinor > 0
      ? Math.min(
          100,
          Math.round((balance.totalPaidMinor / balance.totalOwedMinor) * 100),
        )
      : 100;

  // Due date calculation
  let dueInfo = { text: "No due date set", isOverdue: false };
  if (loan.due_date) {
    const today = new Date(getLocalDateString()).getTime();
    const due = new Date(loan.due_date).getTime();
    const diffDays = Math.round((due - today) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) {
      dueInfo = {
        text: `${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? "" : "s"} overdue`,
        isOverdue: true,
      };
    } else if (diffDays === 0) {
      dueInfo = { text: "Due today!", isOverdue: false };
    } else {
      dueInfo = {
        text: `Due in ${diffDays} day${diffDays === 1 ? "" : "s"}`,
        isOverdue: false,
      };
    }
  }

  // Extract tag from notes if any
  let tagMatch = borrower?.notes?.match(/^\[(.*?)\]/);
  const tag = tagMatch ? tagMatch[1] : null;

  const handleCall = () => {
    if (borrower?.phone) {
      Linking.openURL(`tel:${borrower.phone}`);
    }
  };

  const formatInterestTypeLabel = (type: string, rate: string | null) => {
    switch (type) {
      case "percentage_monthly":
        return `${rate || "0"}% Monthly`;
      case "percentage_daily":
        return `${rate || "0"}% Daily`;
      case "percentage_weekly":
        return `${rate || "0"}% Weekly`;
      case "percentage_flat":
        return `${rate || "0"}% Flat Fee`;
      case "fixed_amount":
        return "Fixed Fee";
      case "none":
      default:
        return "Zero Interest";
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
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-paper">
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <DashboardBg
            width="100%"
            height="100%"
            preserveAspectRatio="xMidYMid slice"
          />
        </View>

        <SafeAreaView className="flex-1" edges={["top", "bottom"]}>
          {/* Top Bar */}
          <View className="px-5 pt-5 pb-2 flex-row items-center justify-between">
            <Pressable
              onPress={onClose}
              hitSlop={12}
              className="flex-row items-center gap-1.5 py-2 px-3 rounded-full bg-white/80 active:bg-white border border-border shadow-xs"
              accessibilityLabel="Back"
            >
              <Ionicons name="arrow-back" size={18} color="#173D35" />
              <Text className="text-forest-900 font-extrabold text-xs">
                Back
              </Text>
            </Pressable>

            <View className="flex-row items-center gap-2">
              {borrower && onEditBorrower && (
                <Pressable
                  onPress={() => onEditBorrower(borrower)}
                  hitSlop={8}
                  className="flex-row items-center gap-1 py-2 px-3 rounded-full bg-white/80 border border-border active:bg-white shadow-xs"
                  accessibilityLabel="Edit Borrower"
                >
                  <Ionicons name="create-outline" size={14} color="#173D35" />
                  <Text className="text-xs font-extrabold text-forest-900">
                    Edit Debtor
                  </Text>
                </Pressable>
              )}
              {onDeleteLoan && (
                <Pressable
                  onPress={confirmDelete}
                  hitSlop={8}
                  className="flex-row items-center gap-1 py-2 px-3 rounded-full bg-red-50 border border-red-200 active:bg-red-100"
                  accessibilityLabel="Delete Loan"
                >
                  <Ionicons name="trash-outline" size={14} color="#DC2626" />
                  <Text className="text-xs font-bold text-danger">Delete</Text>
                </Pressable>
              )}
            </View>
          </View>

          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 8,
              paddingBottom: 32,
              gap: 16,
            }}
          >
            {/* Unified Hero Statement Card */}
            <View className="rounded-3xl p-5 bg-white border border-border shadow-xs gap-4 relative overflow-hidden">
              {/* Docked Top-Right Corner Status Badge */}
              {balance.isPaid ? (
                <View className="absolute top-0 right-0 px-3.5 py-1.5 rounded-bl-2xl bg-emerald-100 border-b border-l border-emerald-300 flex-row items-center gap-1.5">
                  <Ionicons
                    name="checkmark-circle"
                    size={13}
                    color="#15803D"
                  />
                  <Text className="text-[11px] font-black text-emerald-900 uppercase tracking-wide">
                    Settled
                  </Text>
                </View>
              ) : balance.isOverdue ? (
                <View className="absolute top-0 right-0 px-3.5 py-1.5 rounded-bl-2xl bg-red-100 border-b border-l border-red-300 flex-row items-center gap-1.5">
                  <Ionicons name="alert-circle" size={13} color="#B91C1C" />
                  <Text className="text-[11px] font-black text-red-900 uppercase tracking-wide">
                    {dueInfo.text}
                  </Text>
                </View>
              ) : (
                <View className="absolute top-0 right-0 px-3.5 py-1.5 rounded-bl-2xl bg-mint/50 border-b border-l border-border flex-row items-center gap-1.5">
                  <Ionicons name="time-outline" size={13} color="#173D35" />
                  <Text className="text-[11px] font-extrabold text-forest-900 uppercase tracking-wide">
                    {dueInfo.text}
                  </Text>
                </View>
              )}

              {/* Zone 1: Borrower Identity + Quick Call */}
              <View className="flex-row items-center gap-3.5 pr-28">
                <View
                  className={`w-12 h-12 rounded-full items-center justify-center border shrink-0 ${
                    balance.isOverdue
                      ? "bg-red-50 border-red-200"
                      : balance.isPaid
                        ? "bg-emerald-50 border-emerald-200"
                        : "bg-mint/40 border-border"
                  }`}
                >
                  <Text
                    className={`text-base font-black ${
                      balance.isOverdue
                        ? "text-danger"
                        : balance.isPaid
                          ? "text-emerald-800"
                          : "text-forest-900"
                    }`}
                  >
                    {getInitials(borrower?.name)}
                  </Text>
                </View>

                <View className="flex-1 overflow-hidden">
                  <View className="flex-row items-center gap-2">
                    <Text
                      numberOfLines={1}
                      className="text-lg font-extrabold text-ink shrink"
                    >
                      {borrower?.name || "Unknown Borrower"}
                    </Text>
                    {tag && (
                      <View className="px-2 py-0.5 rounded-md bg-mint/40 border border-border shrink-0">
                        <Text className="text-[11px] font-bold text-forest-900">
                          {tag}
                        </Text>
                      </View>
                    )}
                    {borrower && onEditBorrower && (
                      <Pressable
                        onPress={() => onEditBorrower(borrower)}
                        hitSlop={8}
                        className="px-2 py-0.5 rounded-full bg-mint/30 border border-border flex-row items-center gap-1 active:bg-mint/60 shrink-0"
                        accessibilityRole="button"
                        accessibilityLabel={`Edit ${borrower.name}`}
                      >
                        <Ionicons
                          name="create-outline"
                          size={12}
                          color="#173D35"
                        />
                        <Text className="text-[10px] font-extrabold text-forest-900">
                          Edit
                        </Text>
                      </Pressable>
                    )}
                  </View>

                  {borrower?.phone || borrower?.address ? (
                    <Text
                      numberOfLines={1}
                      className="text-xs text-slate font-medium mt-1"
                    >
                      {[borrower?.phone, borrower?.address]
                        .filter(Boolean)
                        .join(" • ")}
                    </Text>
                  ) : (
                    <Text className="text-xs text-slate font-medium mt-1">
                      Registered debtor
                    </Text>
                  )}
                </View>
              </View>

              {borrower?.phone && (
                <Pressable
                  onPress={handleCall}
                  className="py-2.5 px-3.5 rounded-2xl bg-mint/25 border border-border flex-row items-center justify-between active:bg-mint/40"
                >
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="call" size={15} color="#173D35" />
                    <Text className="text-xs font-extrabold text-forest-900">
                      Call {borrower.phone}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color="#173D35" />
                </Pressable>
              )}

              {/* Zone 2: Financial Breakdown Box */}
              <View className="rounded-2xl p-4 bg-slate-50 border border-slate-100 gap-3.5">
                <View className="flex-row items-end justify-between gap-2">
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-[11px] font-bold text-slate uppercase tracking-wider">
                        {balance.isPaid ? "Total Settled" : "Remaining Balance"}
                      </Text>
                      <View className="px-2 py-0.5 rounded-full bg-white border border-slate-200">
                        <Text className="text-[10px] font-extrabold text-forest-900">
                          {formatInterestTypeLabel(
                            loan.interest_type,
                            loan.interest_rate,
                          )}
                        </Text>
                      </View>
                    </View>
                    <Text
                      numberOfLines={1}
                      style={{ fontVariant: ["tabular-nums"] }}
                      className={`text-3xl font-black tracking-tight mt-0.5 ${
                        balance.isOverdue
                          ? "text-danger"
                          : balance.isPaid
                            ? "text-emerald-700"
                            : "text-forest-900"
                      }`}
                    >
                      {formatPHP(
                        balance.isPaid
                          ? balance.totalOwedMinor
                          : balance.remainingBalanceMinor,
                      )}
                    </Text>
                  </View>
                </View>

                {/* Progress Bar */}
                <View className="gap-1.5">
                  <View className="h-2.5 rounded-full bg-slate-200 overflow-hidden">
                    <View
                      className={`h-full rounded-full ${
                        balance.isOverdue ? "bg-amber-500" : "bg-bai"
                      }`}
                      style={{ width: `${percentPaid}%` }}
                    />
                  </View>
                  <View className="flex-row justify-between items-center">
                    <Text
                      style={{ fontVariant: ["tabular-nums"] }}
                      className="text-xs font-semibold text-slate"
                    >
                      Paid:{" "}
                      <Text className="font-bold text-ink">
                        {formatPHP(balance.totalPaidMinor)}
                      </Text>
                    </Text>
                    <Text
                      style={{ fontVariant: ["tabular-nums"] }}
                      className="text-xs font-extrabold text-bai"
                    >
                      {percentPaid}% Repaid
                    </Text>
                  </View>
                </View>

                {/* 3-Column Principal / Interest / Total Strip */}
                <View className="flex-row pt-3 border-t border-slate-200/80">
                  <View className="flex-1">
                    <Text className="text-[10px] font-bold text-slate uppercase tracking-wider">
                      Principal
                    </Text>
                    <Text
                      style={{ fontVariant: ["tabular-nums"] }}
                      className="text-sm font-extrabold text-ink mt-0.5"
                    >
                      {formatPHP(balance.principalMinor)}
                    </Text>
                  </View>
                  <View className="w-px bg-slate-200 mx-2.5" />
                  <View className="flex-1">
                    <Text className="text-[10px] font-bold text-slate uppercase tracking-wider">
                      Interest / Fee
                    </Text>
                    <Text
                      style={{ fontVariant: ["tabular-nums"] }}
                      className="text-sm font-extrabold text-amber-700 mt-0.5"
                    >
                      {formatPHP(balance.interestMinor)}
                    </Text>
                  </View>
                  <View className="w-px bg-slate-200 mx-2.5" />
                  <View className="flex-1 items-end">
                    <Text className="text-[10px] font-bold text-slate uppercase tracking-wider">
                      Total Due
                    </Text>
                    <Text
                      style={{ fontVariant: ["tabular-nums"] }}
                      className="text-sm font-extrabold text-forest-900 mt-0.5"
                    >
                      {formatPHP(balance.totalOwedMinor)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Zone 3: Compact 2-Column Schedule Strip */}
              <View className="flex-row gap-2.5">
                <View className="flex-1 p-3 rounded-2xl bg-slate-50 border border-slate-100 flex-row items-center gap-2.5">
                  <View className="w-8 h-8 rounded-xl bg-mint/40 items-center justify-center">
                    <Ionicons
                      name="calendar-outline"
                      size={15}
                      color="#173D35"
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[10px] font-bold text-slate uppercase">
                      Date Lent
                    </Text>
                    <Text
                      numberOfLines={1}
                      className="text-xs font-extrabold text-ink mt-0.5"
                    >
                      {formatReadableDate(loan.loan_date)}
                    </Text>
                  </View>
                </View>

                <View
                  className={`flex-1 p-3 rounded-2xl border flex-row items-center gap-2.5 ${
                    dueInfo.isOverdue && !balance.isPaid
                      ? "bg-red-50/70 border-red-200"
                      : "bg-slate-50 border-slate-100"
                  }`}
                >
                  <View
                    className={`w-8 h-8 rounded-xl items-center justify-center ${
                      dueInfo.isOverdue && !balance.isPaid
                        ? "bg-red-100"
                        : "bg-mint/40"
                    }`}
                  >
                    <Ionicons
                      name="alarm-outline"
                      size={15}
                      color={
                        dueInfo.isOverdue && !balance.isPaid
                          ? "#B91C1C"
                          : "#173D35"
                      }
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[10px] font-bold text-slate uppercase">
                      Due Date
                    </Text>
                    <Text
                      numberOfLines={1}
                      className={`text-xs font-extrabold mt-0.5 ${
                        dueInfo.isOverdue && !balance.isPaid
                          ? "text-danger"
                          : "text-ink"
                      }`}
                    >
                      {formatReadableDate(loan.due_date)}
                    </Text>
                  </View>
                </View>
              </View>

              {loan.notes && (
                <View className="p-3 rounded-2xl bg-mint/20 border border-border/80 flex-row items-start gap-2">
                  <Ionicons
                    name="document-text-outline"
                    size={15}
                    color="#173D35"
                    style={{ marginTop: 1 }}
                  />
                  <Text className="flex-1 text-xs text-forest-900 font-medium leading-4">
                    {loan.notes}
                  </Text>
                </View>
              )}
            </View>

            {/* Payment History Section */}
            <View className="gap-2.5">
              <View className="flex-row items-center justify-between px-1">
                <Text className="text-xs font-black text-forest-900 uppercase tracking-widest">
                  Payment History ({loanPayments.length})
                </Text>
                {loanPayments.length > 0 && (
                  <Text
                    style={{ fontVariant: ["tabular-nums"] }}
                    className="text-xs font-bold text-emerald-800"
                  >
                    Total: {formatPHP(balance.totalPaidMinor)}
                  </Text>
                )}
              </View>

              {loanPayments.length === 0 ? (
                <View className="rounded-3xl p-6 bg-white border border-border items-center justify-center gap-2 shadow-xs">
                  <Frog mood="happy" size={52} />
                  <Text className="text-sm font-bold text-forest-900">
                    No payments recorded yet
                  </Text>
                  <Text className="text-xs text-slate text-center max-w-[240px]">
                    Tap Record Payment below whenever the borrower makes a
                    partial or full payment.
                  </Text>
                </View>
              ) : (
                <View className="rounded-3xl bg-white border border-border shadow-xs overflow-hidden">
                  {loanPayments.map((p, index) => (
                    <View
                      key={p.id}
                      className={`p-4 flex-row items-center justify-between ${
                        index < loanPayments.length - 1
                          ? "border-b border-slate-100"
                          : ""
                      }`}
                    >
                      <View className="flex-row items-center gap-3 flex-1 pr-2">
                        <View className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-200 items-center justify-center shrink-0">
                          <Ionicons
                            name="checkmark"
                            size={18}
                            color="#16A34A"
                          />
                        </View>
                        <View className="flex-1">
                          <Text
                            style={{ fontVariant: ["tabular-nums"] }}
                            className="text-base font-black text-ink"
                          >
                            +{formatPHP(p.amount_minor)}
                          </Text>
                          <Text className="text-xs text-slate font-medium mt-0.5">
                            {formatReadableDate(p.payment_date)} •{" "}
                            {p.payment_method
                              ? p.payment_method.toUpperCase()
                              : "CASH"}
                          </Text>
                          {p.notes && (
                            <Text className="text-xs text-slate-500 mt-0.5 italic">
                              "{p.notes}"
                            </Text>
                          )}
                        </View>
                      </View>

                      <View className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 shrink-0">
                        <Text className="text-[10px] font-extrabold text-emerald-800">
                          {p.sync_status === "synced" ? "Synced" : "Saved"}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </ScrollView>

          {/* Sticky Bottom Action Bar */}
          <View className="px-4 pt-3 pb-3 bg-paper/95 border-t border-border/70">
            {!balance.isPaid ? (
              <Pressable
                className="min-h-[52px] rounded-2xl bg-bai active:opacity-90 items-center justify-center flex-row gap-2 shadow-xs"
                onPress={() => {
                  onClose();
                  onRecordPayment?.(loan);
                }}
              >
                <Ionicons name="cash-outline" size={20} color="#FFFFFF" />
                <Text className="text-white font-extrabold text-sm tracking-wide uppercase">
                  Record Payment Now
                </Text>
              </Pressable>
            ) : (
              <View className="p-3.5 rounded-2xl bg-emerald-100 border border-emerald-300 flex-row items-center justify-center gap-2">
                <Frog mood="celebrate" size={28} />
                <Text className="text-emerald-900 font-extrabold text-xs">
                  Walay Utang Nga Nabilin! (Fully Paid)
                </Text>
              </View>
            )}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
