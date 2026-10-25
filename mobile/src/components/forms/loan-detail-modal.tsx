import React from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  Linking,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Loan, Borrower, Payment } from "@/types/database";
import { formatPHP } from "@/services/interest/calculateInterest";
import { calculateLoanBalance } from "@/services/balance/calculateBalance";
import { getLocalDateString } from "@/services/date/dateUtils";
import { Frog } from "@/components/frog";
import DashboardBg from "@/assets/images/DASHBOARD_BG.svg";

interface LoanDetailModalProps {
  visible: boolean;
  onClose: () => void;
  loan: Loan | null;
  borrower: Borrower | null;
  payments: Payment[];
  onRecordPayment?: (loan: Loan) => void;
}

export function LoanDetailModal({
  visible,
  onClose,
  loan,
  borrower,
  payments,
  onRecordPayment,
}: LoanDetailModalProps) {
  if (!loan) return null;

  const loanPayments = payments.filter((p) => p.loan_id === loan.id && !p.deleted_at);
  const balance = calculateLoanBalance(loan, loanPayments);

  const percentPaid = balance.totalOwedMinor > 0
    ? Math.min(100, Math.round((balance.totalPaidMinor / balance.totalOwedMinor) * 100))
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
      presentationStyle="pageSheet"
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
          <View className="px-4 pt-3 pb-2 flex-row items-center justify-between">
            <Pressable
              onPress={onClose}
              hitSlop={12}
              className="flex-row items-center gap-1 py-1.5 px-3 rounded-full bg-white/70 active:bg-white border border-border"
              accessibilityLabel="Back"
            >
              <Ionicons name="arrow-back" size={18} color="#173D35" />
              <Text className="text-forest-900 font-bold text-xs uppercase tracking-wider">
                Close
              </Text>
            </Pressable>

            {/* Status Pill */}
            {balance.isPaid ? (
              <View className="px-3 py-1 rounded-full bg-emerald-100 border border-emerald-300 flex-row items-center gap-1.5">
                <Ionicons name="checkmark-circle" size={14} color="#166534" />
                <Text className="text-xs font-black text-emerald-800 uppercase tracking-wider">
                  Fully Paid
                </Text>
              </View>
            ) : balance.isOverdue ? (
              <View className="px-3 py-1 rounded-full bg-red-100 border border-red-300 flex-row items-center gap-1.5">
                <Ionicons name="alert-circle" size={14} color="#B91C1C" />
                <Text className="text-xs font-black text-red-700 uppercase tracking-wider">
                  Overdue
                </Text>
              </View>
            ) : balance.totalPaidMinor > 0 ? (
              <View className="px-3 py-1 rounded-full bg-amber-100 border border-amber-300 flex-row items-center gap-1.5">
                <Ionicons name="time" size={14} color="#92400E" />
                <Text className="text-xs font-black text-amber-800 uppercase tracking-wider">
                  Partial ({percentPaid}%)
                </Text>
              </View>
            ) : (
              <View className="px-3 py-1 rounded-full bg-emerald-100 border border-emerald-300 flex-row items-center gap-1.5">
                <Ionicons name="ellipse" size={10} color="#166534" />
                <Text className="text-xs font-black text-emerald-800 uppercase tracking-wider">
                  Active
                </Text>
              </View>
            )}
          </View>

          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 8,
              paddingBottom: 40,
              gap: 14,
            }}
          >
            {/* Borrower Profile Card */}
            <View className="rounded-3xl p-5 bg-forest-900 shadow-md">
              <View className="flex-row items-start justify-between">
                <View className="flex-row items-center gap-3.5 flex-1 pr-2">
                  <View className="w-14 h-14 rounded-2xl bg-mint/20 border border-mint/30 items-center justify-center">
                    <Text className="text-mint font-black text-2xl">
                      {borrower?.name ? borrower.name.charAt(0).toUpperCase() : "B"}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2 flex-wrap">
                      <Text className="text-white text-xl font-black tracking-tight">
                        {borrower?.name || "Unknown Borrower"}
                      </Text>
                      {tag && (
                        <View className="px-2 py-0.5 rounded-full bg-white/20">
                          <Text className="text-[10px] font-black text-mint uppercase tracking-wider">
                            {tag}
                          </Text>
                        </View>
                      )}
                    </View>
                    {borrower?.address ? (
                      <View className="flex-row items-center gap-1 mt-1">
                        <Ionicons name="location-outline" size={13} color="#A8DCC5" />
                        <Text className="text-xs text-mint/80 font-medium" numberOfLines={1}>
                          {borrower.address}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>

              {borrower?.phone && (
                <View className="flex-row items-center justify-between mt-4 pt-3.5 border-t border-white/15">
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="call-outline" size={15} color="#A8DCC5" />
                    <Text className="text-white font-bold text-sm">
                      {borrower.phone}
                    </Text>
                  </View>
                  <Pressable
                    className="flex-row items-center gap-1.5 py-1.5 px-3 rounded-full bg-mint active:opacity-90 shadow-xs"
                    onPress={handleCall}
                  >
                    <Ionicons name="call" size={13} color="#173D35" />
                    <Text className="text-forest-900 font-extrabold text-xs">Call</Text>
                  </Pressable>
                </View>
              )}
            </View>

            {/* Repayment Progress Card */}
            <View className="rounded-3xl p-5 bg-white border border-border shadow-xs gap-3.5">
              <View className="flex-row justify-between items-baseline">
                <View>
                  <Text className="text-slate text-[11px] font-bold uppercase tracking-wider">
                    Outstanding Balance
                  </Text>
                  <Text className="text-forest-900 text-3xl font-black tracking-tight mt-0.5">
                    {formatPHP(balance.remainingBalanceMinor)}
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="text-xs font-black text-forest-900">
                    {percentPaid}% Paid
                  </Text>
                  <Text className="text-[11px] text-slate mt-0.5">
                    of {formatPHP(balance.totalOwedMinor)}
                  </Text>
                </View>
              </View>

              {/* Enhanced Visual Progress Bar */}
              <View className="gap-1.5">
                <View className="h-3 rounded-full bg-forest-900/10 overflow-hidden p-0.5">
                  <View
                    className="h-full rounded-full bg-bai"
                    style={{ width: `${percentPaid}%` }}
                  />
                </View>
                <View className="flex-row justify-between items-center px-0.5">
                  <Text className="text-[11px] font-semibold text-slate">
                    Paid: <Text className="font-bold text-forest-900">{formatPHP(balance.totalPaidMinor)}</Text>
                  </Text>
                  <Text className="text-[11px] font-semibold text-slate">
                    Remaining: <Text className="font-bold text-forest-900">{formatPHP(balance.remainingBalanceMinor)}</Text>
                  </Text>
                </View>
              </View>

              {/* 3-Column Ledger Breakdown */}
              <View className="flex-row pt-3 border-t border-border/70">
                <View className="flex-1 items-center border-r border-border/70 pr-2">
                  <Text className="text-[10px] font-bold text-slate uppercase tracking-wider mb-0.5">
                    Principal
                  </Text>
                  <Text className="text-sm font-extrabold text-ink">
                    {formatPHP(balance.principalMinor)}
                  </Text>
                </View>
                <View className="flex-1 items-center border-r border-border/70 px-2">
                  <Text className="text-[10px] font-bold text-slate uppercase tracking-wider mb-0.5">
                    Interest / Fee
                  </Text>
                  <Text className="text-sm font-extrabold text-amber-700">
                    {formatPHP(balance.interestMinor)}
                  </Text>
                </View>
                <View className="flex-1 items-center pl-2">
                  <Text className="text-[10px] font-bold text-slate uppercase tracking-wider mb-0.5">
                    Total Due
                  </Text>
                  <Text className="text-sm font-extrabold text-forest-900">
                    {formatPHP(balance.totalOwedMinor)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Terms and Dates Card */}
            <View className="rounded-3xl p-5 bg-white border border-border shadow-xs gap-3">
              <Text className="text-xs font-black text-forest-900 uppercase tracking-widest">
                LOAN TERMS & SCHEDULE
              </Text>

              <View className="flex-row items-center justify-between py-2 border-b border-border/60">
                <View className="flex-row items-center gap-2">
                  <View className="w-8 h-8 rounded-xl bg-forest-900/10 items-center justify-center">
                    <Ionicons name="calculator-outline" size={16} color="#173D35" />
                  </View>
                  <Text className="text-xs font-bold text-ink">Interest Scheme</Text>
                </View>
                <Text className="text-xs font-extrabold text-forest-900">
                  {formatInterestTypeLabel(loan.interest_type, loan.interest_rate)}
                </Text>
              </View>

              <View className="flex-row items-center justify-between py-2 border-b border-border/60">
                <View className="flex-row items-center gap-2">
                  <View className="w-8 h-8 rounded-xl bg-forest-900/10 items-center justify-center">
                    <Ionicons name="calendar-outline" size={16} color="#173D35" />
                  </View>
                  <Text className="text-xs font-bold text-ink">Date Borrowed</Text>
                </View>
                <Text className="text-xs font-extrabold text-ink">
                  {loan.loan_date}
                </Text>
              </View>

              <View className="flex-row items-center justify-between py-2">
                <View className="flex-row items-center gap-2">
                  <View className={`w-8 h-8 rounded-xl ${dueInfo.isOverdue ? "bg-red-100" : "bg-forest-900/10"} items-center justify-center`}>
                    <Ionicons
                      name="alarm-outline"
                      size={16}
                      color={dueInfo.isOverdue ? "#B91C1C" : "#173D35"}
                    />
                  </View>
                  <View>
                    <Text className="text-xs font-bold text-ink">Due Date</Text>
                    <Text className={`text-[10px] font-bold ${dueInfo.isOverdue ? "text-red-600" : "text-slate"}`}>
                      {dueInfo.text}
                    </Text>
                  </View>
                </View>
                <Text className={`text-xs font-extrabold ${dueInfo.isOverdue ? "text-red-700" : "text-ink"}`}>
                  {loan.due_date || "Open Ended"}
                </Text>
              </View>

              {loan.notes && (
                <View className="mt-1 p-3 rounded-2xl bg-paper/60 border border-border/80">
                  <Text className="text-[11px] font-bold text-forest-900 mb-0.5">Notes</Text>
                  <Text className="text-xs text-slate leading-4">{loan.notes}</Text>
                </View>
              )}
            </View>

            {/* Payment History Section */}
            <View className="gap-2.5">
              <View className="flex-row items-center justify-between px-1">
                <Text className="text-xs font-black text-forest-900 uppercase tracking-widest">
                  PAYMENT HISTORY ({loanPayments.length})
                </Text>
                <Text className="text-xs font-semibold text-emerald-800">
                  Total Paid: {formatPHP(balance.totalPaidMinor)}
                </Text>
              </View>

              {loanPayments.length === 0 ? (
                <View className="rounded-3xl p-6 bg-white border border-border items-center justify-center gap-2 shadow-xs">
                  <Frog mood="happy" size={56} />
                  <Text className="text-sm font-bold text-forest-900">
                    No payments recorded yet
                  </Text>
                  <Text className="text-xs text-slate text-center">
                    Payments made for this loan will appear here with dates and receipts.
                  </Text>
                </View>
              ) : (
                loanPayments.map((p) => (
                  <View
                    key={p.id}
                    className="p-3.5 rounded-2xl bg-white border border-border shadow-xs flex-row items-center justify-between"
                  >
                    <View className="flex-row items-center gap-3">
                      <View className="w-10 h-10 rounded-xl bg-emerald-500/10 items-center justify-center">
                        <Ionicons name="receipt" size={18} color="#16A34A" />
                      </View>
                      <View>
                        <Text className="text-sm font-bold text-ink">
                          {formatPHP(p.amount_minor)}
                        </Text>
                        <Text className="text-xs text-slate mt-0.5">
                          {p.payment_date} • {p.payment_method ? p.payment_method.toUpperCase() : "CASH"}
                        </Text>
                        {p.notes && (
                          <Text className="text-[11px] text-slate-500 mt-0.5 italic">
                            "{p.notes}"
                          </Text>
                        )}
                      </View>
                    </View>

                    <View className="px-2 py-1 rounded-full bg-emerald-50 border border-emerald-200">
                      <Text className="text-[10px] font-extrabold text-emerald-800">
                        Recorded
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>

            {/* Bottom Action Button */}
            <View className="pt-2">
              {!balance.isPaid ? (
                <Pressable
                  className="min-h-[52px] rounded-2xl bg-bai active:opacity-90 items-center justify-center flex-row gap-2 shadow-sm"
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
                <View className="p-4 rounded-2xl bg-emerald-100 border border-emerald-300 flex-row items-center justify-center gap-2">
                  <Frog mood="celebrate" size={32} />
                  <Text className="text-emerald-900 font-extrabold text-sm">
                    Walay Utang Nga Nabilin! (Fully Paid)
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
