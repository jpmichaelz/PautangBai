import React from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  Linking,
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

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = React.useState(false);

  const confirmDelete = () => {
    setIsDeleteConfirmOpen(true);
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
              gap: 12,
            }}
          >
            {/* 1. Borrower Identity Card */}
            <View className="rounded-2xl p-4 bg-white border border-border shadow-xs flex-row items-center justify-between">
              <View className="flex-row items-center gap-3 flex-1 pr-2">
                <View
                  className={`w-11 h-11 rounded-full items-center justify-center border shrink-0 ${
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

                <View className="flex-1">
                  <View className="flex-row items-center gap-1.5 flex-wrap">
                    <Text
                      numberOfLines={1}
                      className="text-base font-black text-ink shrink"
                    >
                      {borrower?.name || "Unknown Borrower"}
                    </Text>
                    {tag && (
                      <View className="px-1.5 py-0.5 rounded bg-mint/40 border border-border">
                        <Text className="text-[10px] font-bold text-forest-900">
                          {tag}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text
                    numberOfLines={1}
                    className="text-xs text-slate font-medium mt-0.5"
                  >
                    {[borrower?.phone, borrower?.address]
                      .filter(Boolean)
                      .join(" • ") || "Borrower"}
                  </Text>
                </View>
              </View>

              {borrower?.phone && (
                <Pressable
                  onPress={handleCall}
                  hitSlop={8}
                  className="py-2 px-3 rounded-xl bg-forest-900/10 border border-forest-900/20 flex-row items-center gap-1.5 active:bg-forest-900/20 shrink-0"
                  accessibilityLabel={`Call ${borrower.phone}`}
                >
                  <Ionicons name="call" size={13} color="#173D35" />
                  <Text className="text-xs font-bold text-forest-900">Call</Text>
                </Pressable>
              )}
            </View>

            {/* 2. Balance & Repayment Card */}
            <View className="rounded-2xl p-4 bg-white border border-border shadow-xs gap-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-xs font-bold text-slate uppercase tracking-wider">
                  {balance.isPaid ? "Total Settled" : "Remaining Balance"}
                </Text>
                {balance.isPaid ? (
                  <View className="px-2.5 py-1 rounded-full bg-emerald-100 flex-row items-center gap-1">
                    <Ionicons
                      name="checkmark-circle"
                      size={12}
                      color="#15803D"
                    />
                    <Text className="text-[11px] font-bold text-emerald-900">
                      Settled
                    </Text>
                  </View>
                ) : balance.isOverdue ? (
                  <View className="px-2.5 py-1 rounded-full bg-red-100 flex-row items-center gap-1">
                    <Ionicons name="alert-circle" size={12} color="#B91C1C" />
                    <Text className="text-[11px] font-bold text-red-900">
                      {dueInfo.text}
                    </Text>
                  </View>
                ) : (
                  <View className="px-2.5 py-1 rounded-full bg-mint/50 flex-row items-center gap-1">
                    <Ionicons name="time-outline" size={12} color="#173D35" />
                    <Text className="text-[11px] font-bold text-forest-900">
                      {dueInfo.text}
                    </Text>
                  </View>
                )}
              </View>

              <Text
                numberOfLines={1}
                style={{ fontVariant: ["tabular-nums"] }}
                className={`text-3xl font-black tracking-tight ${
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

              {/* Progress Bar & Stats */}
              <View className="gap-1.5 pt-0.5">
                <View className="h-2 rounded-full bg-slate-100 overflow-hidden">
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
            </View>

            {/* 3. Loan Information Card */}
            <View className="rounded-2xl p-4 bg-white border border-border shadow-xs">
              <Text className="text-xs font-black text-forest-900 uppercase tracking-widest mb-3">
                Loan Terms
              </Text>

              <View className="gap-2.5">
                <View className="flex-row justify-between items-center">
                  <Text className="text-xs text-slate font-medium">Principal</Text>
                  <Text
                    style={{ fontVariant: ["tabular-nums"] }}
                    className="text-xs font-bold text-ink"
                  >
                    {formatPHP(balance.principalMinor)}
                  </Text>
                </View>

                <View className="flex-row justify-between items-center">
                  <Text className="text-xs text-slate font-medium">Interest</Text>
                  <Text className="text-xs font-bold text-ink">
                    {formatInterestTypeLabel(
                      loan.interest_type,
                      loan.interest_rate,
                    )}
                    {balance.interestMinor > 0 &&
                      ` (+${formatPHP(balance.interestMinor)})`}
                  </Text>
                </View>

                <View className="flex-row justify-between items-center">
                  <Text className="text-xs text-slate font-medium">Total Due</Text>
                  <Text
                    style={{ fontVariant: ["tabular-nums"] }}
                    className="text-xs font-black text-forest-900"
                  >
                    {formatPHP(balance.totalOwedMinor)}
                  </Text>
                </View>

                <View className="h-px bg-slate-100 my-1" />

                <View className="flex-row justify-between items-center">
                  <Text className="text-xs text-slate font-medium">Date Lent</Text>
                  <Text className="text-xs font-bold text-ink">
                    {formatReadableDate(loan.loan_date)}
                  </Text>
                </View>

                <View className="flex-row justify-between items-center">
                  <Text className="text-xs text-slate font-medium">Due Date</Text>
                  <Text
                    className={`text-xs font-bold ${
                      dueInfo.isOverdue && !balance.isPaid
                        ? "text-danger"
                        : "text-ink"
                    }`}
                  >
                    {formatReadableDate(loan.due_date)}
                  </Text>
                </View>

                {loan.notes && (
                  <>
                    <View className="h-px bg-slate-100 my-1" />
                    <View className="flex-row items-start gap-2 pt-0.5">
                      <Ionicons
                        name="document-text-outline"
                        size={14}
                        color="#66716D"
                        style={{ marginTop: 1 }}
                      />
                      <Text className="flex-1 text-xs text-slate font-medium leading-4">
                        {loan.notes}
                      </Text>
                    </View>
                  </>
                )}
              </View>
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
                  Loan Fully Paid
                </Text>
              </View>
            )}
          </View>

          {/* Delete Confirmation Modal */}
          {isDeleteConfirmOpen && (
            <Modal
              visible={isDeleteConfirmOpen}
              transparent
              animationType="fade"
              onRequestClose={() => setIsDeleteConfirmOpen(false)}
            >
              <Pressable
                className="flex-1 bg-black/60 items-center justify-center p-5"
                onPress={() => setIsDeleteConfirmOpen(false)}
              >
                <Pressable
                  className="w-full max-w-sm rounded-3xl bg-white p-6 items-center shadow-lg border border-border/40"
                  onPress={(e) => e.stopPropagation()}
                >
                  <View className="w-16 h-16 rounded-full bg-red-100 items-center justify-center mb-3">
                    <Frog mood="thinking" size={54} />
                  </View>
                  <Text className="text-xl font-black text-forest-900 text-center tracking-tight">
                    Delete Loan?
                  </Text>
                  <Text className="text-xs text-slate-600 text-center mt-2 leading-relaxed">
                    Are you sure you want to delete this loan of {formatPHP(loan.principal_minor)} for {borrower?.name || "this debtor"}? This cannot be undone.
                  </Text>

                  <View className="flex-row gap-3 mt-6 w-full">
                    <Pressable
                      onPress={() => setIsDeleteConfirmOpen(false)}
                      className="flex-1 py-3.5 rounded-2xl bg-forest-900/10 items-center active:bg-forest-900/20"
                    >
                      <Text className="text-sm font-bold text-forest-900">
                        Cancel
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        setIsDeleteConfirmOpen(false);
                        onClose();
                        onDeleteLoan?.(loan);
                      }}
                      className="flex-1 py-3.5 rounded-2xl bg-danger items-center active:bg-danger/90"
                    >
                      <Text className="text-sm font-extrabold text-white">
                        Delete Loan
                      </Text>
                    </Pressable>
                  </View>
                </Pressable>
              </Pressable>
            </Modal>
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
}
