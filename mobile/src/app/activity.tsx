import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  Modal,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSQLiteContext } from "expo-sqlite";
import { Ionicons } from "@expo/vector-icons";
import { borrowerHelper } from "@/db-helpers/borrowers";
import { loanHelper } from "@/db-helpers/loans";
import { paymentHelper } from "@/db-helpers/payments";
import { Borrower, Loan, Payment } from "@/types/database";
import { formatPHP } from "@/services/interest/calculateInterest";
import { parseLocalDate } from "@/services/date/dateUtils";
import { Frog } from "@/components/frog";
import { LoanDetailModal, PaymentFormModal } from "@/components/forms";
import { enforceImmersiveSystemBars } from "@/utils/system-bars";
import { useFocusEffect } from "expo-router";
import DashboardBg from "@/assets/images/DASHBOARD_BG.svg";
import PautangBaiLogo from "@/assets/images/PAUTANGBAI_LOGO.svg";

type ActivityFilter = "all" | "payment" | "loan";

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

function formatInterestBadge(loan: Loan): string {
  const rate = loan.interest_rate || "0";
  switch (loan.interest_type) {
    case "percentage_monthly":
      return `${rate}% / mo`;
    case "percentage_weekly":
      return `${rate}% / wk`;
    case "percentage_daily":
      return `${rate}% / day`;
    case "percentage_flat":
      return `${rate}% flat`;
    case "fixed_amount":
      return `+${formatPHP(loan.fixed_charge_minor)} fee`;
    case "none":
    default:
      return "0% interest";
  }
}

interface ActivityItem {
  id: string;
  type: "loan" | "payment";
  date: string;
  borrowerName: string;
  borrower?: Borrower;
  amountMinor: number;
  subtitle: string;
  rawPayment?: Payment;
  rawLoan?: Loan;
}

export default function ActivityScreen() {
  const db = useSQLiteContext();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [allPayments, setAllPayments] = useState<Payment[]>([]);
  const [filterType, setFilterType] = useState<ActivityFilter>("all");
  const [selectedActivity, setSelectedActivity] = useState<ActivityItem | null>(
    null,
  );
  const [refreshing, setRefreshing] = useState(false);

  // Full Loan Detail & Payment Modals
  const [selectedLoanForDetail, setSelectedLoanForDetail] =
    useState<Loan | null>(null);
  const [selectedBorrowerForDetail, setSelectedBorrowerForDetail] =
    useState<Borrower | null>(null);
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
  const [selectedLoanForPay, setSelectedLoanForPay] = useState<Loan | null>(
    null,
  );
  const [isPayModalVisible, setIsPayModalVisible] = useState(false);

  const loadActivities = useCallback(async () => {
    try {
      const [borrowers, loans, payments] = await Promise.all([
        borrowerHelper.getAll(db),
        loanHelper.getAll(db),
        paymentHelper.getAll(db),
      ]);

      setAllPayments(payments);

      const borrowerMap = new Map<string, Borrower>();
      borrowers.forEach((b) => borrowerMap.set(b.id, b));

      const loanMap = new Map<string, Loan>();
      loans.forEach((l) => loanMap.set(l.id, l));

      const items: ActivityItem[] = [];

      loans.forEach((l) => {
        const borrower = borrowerMap.get(l.borrower_id);
        const borrowerName = borrower?.name || "Unknown Borrower";
        const feeDesc = formatInterestBadge(l);

        items.push({
          id: "act_l_" + l.id,
          type: "loan",
          date: l.loan_date,
          borrowerName,
          borrower,
          amountMinor: l.principal_minor,
          subtitle: `New Loan • ${feeDesc}`,
          rawLoan: l,
        });
      });

      payments.forEach((p) => {
        const loan = loanMap.get(p.loan_id);
        const borrower = loan ? borrowerMap.get(loan.borrower_id) : undefined;
        const borrowerName = borrower?.name || "Unknown Borrower";
        const method = p.payment_method ? ` • ${p.payment_method}` : "";

        items.push({
          id: "act_p_" + p.id,
          type: "payment",
          date: p.payment_date,
          borrowerName,
          borrower,
          amountMinor: p.amount_minor,
          subtitle: `Payment Received${method}`,
          rawPayment: p,
          rawLoan: loan,
        });
      });

      items.sort((a, b) => b.date.localeCompare(a.date));
      setActivities(items);
    } catch (err) {
      console.error("Failed to load activity:", err);
    }
  }, [db]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  useFocusEffect(
    useCallback(() => {
      loadActivities();
    }, [loadActivities]),
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadActivities();
    setRefreshing(false);
  }, [loadActivities]);

  const handleDeleteLoan = async (loan: Loan) => {
    try {
      await loanHelper.softDelete(db, loan.id);
      await loadActivities();
    } catch (err) {
      console.error("Failed to delete loan:", err);
    }
  };

  const renderAllocationDetails = (payment?: Payment) => {
    if (!payment?.allocation_json) return null;
    try {
      const parsed = JSON.parse(payment.allocation_json);
      return (
        <View className="pt-3 border-t border-slate-200/80 flex-row">
          <View className="flex-1">
            <Text className="text-[10px] font-bold text-slate uppercase tracking-wider">
              Applied to Principal
            </Text>
            <Text
              style={{ fontVariant: ["tabular-nums"] }}
              className="text-sm font-extrabold text-ink mt-0.5"
            >
              {formatPHP(parsed.appliedToPrincipalMinor || 0)}
            </Text>
          </View>
          <View className="w-px bg-slate-200 mx-3" />
          <View className="flex-1 items-end">
            <Text className="text-[10px] font-bold text-slate uppercase tracking-wider">
              Applied to Interest
            </Text>
            <Text
              style={{ fontVariant: ["tabular-nums"] }}
              className="text-sm font-extrabold text-amber-700 mt-0.5"
            >
              {formatPHP(parsed.appliedToInterestMinor || 0)}
            </Text>
          </View>
        </View>
      );
    } catch {
      return null;
    }
  };

  const paymentsCount = activities.filter((a) => a.type === "payment").length;
  const loansCount = activities.filter((a) => a.type === "loan").length;
  const totalCollectedMinor = activities
    .filter((a) => a.type === "payment")
    .reduce((sum, a) => sum + a.amountMinor, 0);

  const filteredActivities = activities.filter((a) =>
    filterType === "all" ? true : a.type === filterType,
  );

  return (
    <View className="flex-1 bg-paper">
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <DashboardBg
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid slice"
        />
      </View>
      <SafeAreaView className="flex-1" edges={["top"]}>
        {/* Top Header */}
        <View className="flex-row justify-between items-center px-4 pt-3 pb-2">
          <View className="justify-center">
            <PautangBaiLogo width={135} height={42} />
          </View>

          <View className="flex-row items-center px-2.5 py-1 rounded-full bg-emerald-100 gap-1.5">
            <Ionicons name="receipt-outline" size={14} color="#065F46" />
            <Text className="text-xs font-bold text-emerald-800">
              {activities.length} Records
            </Text>
          </View>
        </View>

        <FlatList
          data={filteredActivities}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <View className="mb-2 gap-3.5">
              {/* Page Container Banner */}
              <View className="rounded-3xl p-5 bg-forest-900 shadow-xs">
                <View className="flex-row items-center justify-between mb-3.5">
                  <View className="flex-1">
                    <Text className="text-white text-2xl font-black tracking-tight">
                      Activity
                    </Text>
                    <Text className="text-mint/80 text-xs font-medium mt-1">
                      Audit trail of loans & payments
                    </Text>
                  </View>
                  <Frog mood="payment" size={56} />
                </View>

                <View className="flex-row items-center pt-3.5 border-t border-white/15">
                  <View className="flex-1">
                    <Text className="text-mint/80 text-xs font-semibold">
                      Total Collected
                    </Text>
                    <Text
                      style={{ fontVariant: ["tabular-nums"] }}
                      className="text-emerald-400 text-xl font-black mt-0.5"
                    >
                      {formatPHP(totalCollectedMinor)}
                    </Text>
                  </View>
                  <View className="w-px h-8 bg-white/15 mx-4" />
                  <View>
                    <Text className="text-mint/80 text-xs font-semibold">
                      Payments
                    </Text>
                    <Text
                      style={{ fontVariant: ["tabular-nums"] }}
                      className="text-white text-lg font-bold mt-0.5"
                    >
                      {paymentsCount}
                    </Text>
                  </View>
                  <View className="w-px h-8 bg-white/15 mx-4" />
                  <View>
                    <Text className="text-mint/80 text-xs font-semibold">
                      Loans
                    </Text>
                    <Text
                      style={{ fontVariant: ["tabular-nums"] }}
                      className="text-white text-lg font-bold mt-0.5"
                    >
                      {loansCount}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Filter Chips */}
              <View className="flex-row gap-2">
                {(
                  [
                    { key: "all", label: `All (${activities.length})` },
                    { key: "payment", label: `Payments (${paymentsCount})` },
                    { key: "loan", label: `Loans (${loansCount})` },
                  ] as const
                ).map((chip) => {
                  const isSelected = filterType === chip.key;
                  return (
                    <Pressable
                      key={chip.key}
                      onPress={() => setFilterType(chip.key)}
                      className={`py-2 px-4 rounded-full border ${
                        isSelected
                          ? "bg-forest-900 border-forest-900"
                          : "bg-white/90 border-border active:bg-white"
                      }`}
                    >
                      <Text
                        className={`text-xs font-bold ${
                          isSelected ? "text-white" : "text-forest-900"
                        }`}
                      >
                        {chip.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#287A63"
              colors={["#287A63"]}
              enabled={
                !selectedActivity && !isDetailModalVisible && !isPayModalVisible
              }
            />
          }
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 4,
            paddingBottom: 100,
            gap: 10,
          }}
          ListEmptyComponent={
            <View className="items-center justify-center py-16 px-4">
              <View className="mb-2">
                <Frog mood="empty" size={120} />
              </View>
              <Text className="text-base font-bold text-forest-900 mb-1">
                No activity yet
              </Text>
              <Text className="text-xs text-slate text-center leading-5 max-w-[260px]">
                When you record a loan or payment, the transaction history will
                appear here.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isLoan = item.type === "loan";

            return (
              <Pressable
                onPress={() => setSelectedActivity(item)}
                className="flex-row items-center p-4 rounded-2xl bg-white border border-border gap-3.5 shadow-xs active:bg-slate-50"
              >
                <View
                  className={`w-11 h-11 rounded-full items-center justify-center border shrink-0 ${
                    isLoan
                      ? "bg-amber-50 border-amber-200"
                      : "bg-emerald-50 border-emerald-200"
                  }`}
                >
                  <Ionicons
                    name={isLoan ? "arrow-up-outline" : "arrow-down-outline"}
                    size={20}
                    color={isLoan ? "#D97706" : "#16A34A"}
                  />
                </View>

                <View className="flex-1 overflow-hidden">
                  <Text
                    numberOfLines={1}
                    className="text-base font-extrabold text-ink"
                  >
                    {item.borrowerName}
                  </Text>
                  <Text
                    numberOfLines={1}
                    className="text-xs text-slate font-medium mt-0.5"
                  >
                    {item.subtitle}
                  </Text>
                  <Text className="text-[11px] text-slate/80 font-medium mt-0.5">
                    {formatReadableDate(item.date)}
                  </Text>
                </View>

                <View className="items-end shrink-0">
                  <Text
                    style={{ fontVariant: ["tabular-nums"] }}
                    className={`text-base font-black ${
                      isLoan ? "text-ink" : "text-emerald-700"
                    }`}
                  >
                    {isLoan ? "-" : "+"}
                    {formatPHP(item.amountMinor)}
                  </Text>
                  <View className="flex-row items-center gap-0.5 mt-1">
                    <Text className="text-[11px] font-bold text-slate">
                      Receipt
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={12}
                      color="#66716D"
                    />
                  </View>
                </View>
              </Pressable>
            );
          }}
        />

        {/* Transaction Receipt Bottom Sheet Modal */}
        <Modal
          visible={!!selectedActivity}
          transparent
          statusBarTranslucent
          navigationBarTranslucent
          onShow={enforceImmersiveSystemBars}
          animationType="fade"
          onRequestClose={() => setSelectedActivity(null)}
        >
          <Pressable
            className="flex-1 bg-black/45 justify-end"
            onPress={() => setSelectedActivity(null)}
          >
            <Pressable
              className="bg-white rounded-t-3xl pt-3 px-5 pb-8 border-t border-border relative overflow-hidden"
              onPress={(e) => e.stopPropagation()}
            >
              {/* Drag Handle */}
              <View className="w-10 h-1 rounded-full bg-slate-200 self-center mb-4" />

              {selectedActivity && (
                <View className="gap-4">
                  {/* Docked Top-Right Corner Type Badge */}
                  {selectedActivity.type === "payment" ? (
                    <View className="absolute -top-3 right-0 px-3.5 py-1.5 rounded-bl-2xl bg-emerald-100 border-b border-l border-emerald-300 flex-row items-center gap-1.5">
                      <Ionicons
                        name="checkmark-circle"
                        size={13}
                        color="#15803D"
                      />
                      <Text className="text-[11px] font-black text-emerald-900 uppercase tracking-wide">
                        Payment Record
                      </Text>
                    </View>
                  ) : (
                    <View className="absolute -top-3 right-0 px-3.5 py-1.5 rounded-bl-2xl bg-amber-100 border-b border-l border-amber-300 flex-row items-center gap-1.5">
                      <Ionicons
                        name="arrow-up-circle"
                        size={13}
                        color="#B45309"
                      />
                      <Text className="text-[11px] font-black text-amber-900 uppercase tracking-wide">
                        Loan Released
                      </Text>
                    </View>
                  )}

                  {/* Zone 1: Borrower Identity */}
                  <View className="flex-row items-center gap-3.5 pr-28">
                    <View className="w-12 h-12 rounded-full bg-mint/40 border border-border items-center justify-center shrink-0">
                      <Text className="text-base font-black text-forest-900">
                        {getInitials(selectedActivity.borrowerName)}
                      </Text>
                    </View>
                    <View className="flex-1 overflow-hidden">
                      <Text
                        numberOfLines={1}
                        className="text-lg font-extrabold text-ink"
                      >
                        {selectedActivity.borrowerName}
                      </Text>
                      <Text className="text-xs text-slate font-medium mt-0.5">
                        {formatReadableDate(selectedActivity.date)}
                        {selectedActivity.rawPayment?.payment_method
                          ? `  •  via ${selectedActivity.rawPayment.payment_method}`
                          : ""}
                      </Text>
                    </View>
                  </View>

                  {/* Zone 2: Financial Receipt Box */}
                  <View className="rounded-2xl p-4 bg-slate-50 border border-slate-100 gap-3">
                    <View className="flex-row items-start justify-between">
                      <View>
                        <Text className="text-[11px] font-bold text-slate uppercase tracking-wider">
                          {selectedActivity.type === "payment"
                            ? "Amount Received"
                            : "Principal Released"}
                        </Text>
                        <Text
                          style={{ fontVariant: ["tabular-nums"] }}
                          className={`text-3xl font-black tracking-tight mt-0.5 ${
                            selectedActivity.type === "payment"
                              ? "text-emerald-700"
                              : "text-forest-900"
                          }`}
                        >
                          {selectedActivity.type === "payment" ? "+" : "-"}
                          {formatPHP(selectedActivity.amountMinor)}
                        </Text>
                      </View>

                      {/* Sync or Interest Badge */}
                      {selectedActivity.type === "payment" ? (
                        <View className="px-2.5 py-1 rounded-full bg-white border border-slate-200 flex-row items-center gap-1">
                          <Ionicons
                            name={
                              selectedActivity.rawPayment?.sync_status ===
                              "synced"
                                ? "cloud-done-outline"
                                : "phone-portrait-outline"
                            }
                            size={12}
                            color="#173D35"
                          />
                          <Text className="text-[10px] font-extrabold text-forest-900">
                            {selectedActivity.rawPayment?.sync_status ===
                            "synced"
                              ? "Synced"
                              : "Saved on device"}
                          </Text>
                        </View>
                      ) : selectedActivity.rawLoan ? (
                        <View className="px-2.5 py-1 rounded-full bg-white border border-slate-200">
                          <Text className="text-[10px] font-extrabold text-forest-900">
                            {formatInterestBadge(selectedActivity.rawLoan)}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Payment Allocation Breakdown OR Loan Due Date Breakdown */}
                    {selectedActivity.type === "payment" ? (
                      renderAllocationDetails(selectedActivity.rawPayment)
                    ) : selectedActivity.rawLoan ? (
                      <View className="pt-3 border-t border-slate-200/80 flex-row">
                        <View className="flex-1">
                          <Text className="text-[10px] font-bold text-slate uppercase tracking-wider">
                            Interest / Fee
                          </Text>
                          <Text
                            style={{ fontVariant: ["tabular-nums"] }}
                            className="text-sm font-extrabold text-amber-700 mt-0.5"
                          >
                            {formatPHP(
                              selectedActivity.rawLoan.fixed_charge_minor || 0,
                            )}
                          </Text>
                        </View>
                        <View className="w-px bg-slate-200 mx-3" />
                        <View className="flex-1 items-end">
                          <Text className="text-[10px] font-bold text-slate uppercase tracking-wider">
                            Due Date
                          </Text>
                          <Text className="text-sm font-extrabold text-ink mt-0.5">
                            {formatReadableDate(
                              selectedActivity.rawLoan.due_date,
                            )}
                          </Text>
                        </View>
                      </View>
                    ) : null}
                  </View>

                  {/* Notes if present */}
                  {(selectedActivity.rawPayment?.notes ||
                    selectedActivity.rawLoan?.notes) && (
                    <View className="p-3 rounded-2xl bg-mint/20 border border-border/80 flex-row items-start gap-2">
                      <Ionicons
                        name="document-text-outline"
                        size={15}
                        color="#173D35"
                        style={{ marginTop: 1 }}
                      />
                      <Text className="flex-1 text-xs text-forest-900 font-medium leading-4">
                        {selectedActivity.rawPayment?.notes ||
                          selectedActivity.rawLoan?.notes}
                      </Text>
                    </View>
                  )}

                  {/* Footer Actions */}
                  <View className="flex-row items-center gap-2.5 pt-1">
                    <Pressable
                      onPress={() => setSelectedActivity(null)}
                      className="flex-1 py-3.5 rounded-2xl border border-border bg-white items-center justify-center active:bg-slate-50"
                    >
                      <Text className="text-xs font-extrabold text-forest-900">
                        Close
                      </Text>
                    </Pressable>

                    {selectedActivity.rawLoan && (
                      <Pressable
                        onPress={() => {
                          const loan = selectedActivity.rawLoan!;
                          const borrower = selectedActivity.borrower || null;
                          setSelectedActivity(null);
                          setSelectedLoanForDetail(loan);
                          setSelectedBorrowerForDetail(borrower);
                          setIsDetailModalVisible(true);
                        }}
                        className="flex-1 py-3.5 rounded-2xl bg-forest-900 flex-row items-center justify-center gap-1.5 active:opacity-90"
                      >
                        <Text className="text-xs font-extrabold text-white">
                          View Full Loan
                        </Text>
                        <Ionicons
                          name="arrow-forward"
                          size={14}
                          color="#FFFFFF"
                        />
                      </Pressable>
                    )}
                  </View>
                </View>
              )}
            </Pressable>
          </Pressable>
        </Modal>

        {/* Full Loan Detail Modal */}
        <LoanDetailModal
          visible={isDetailModalVisible}
          onClose={() => {
            setIsDetailModalVisible(false);
            loadActivities();
          }}
          loan={selectedLoanForDetail}
          borrower={selectedBorrowerForDetail}
          payments={allPayments}
          onRecordPayment={(loan) => {
            setSelectedLoanForPay(loan);
            setIsPayModalVisible(true);
          }}
          onDeleteLoan={handleDeleteLoan}
        />

        {/* Record Payment Modal */}
        <PaymentFormModal
          visible={isPayModalVisible}
          loan={selectedLoanForPay}
          borrowerName={selectedBorrowerForDetail?.name}
          allPayments={allPayments}
          onClose={() => {
            setIsPayModalVisible(false);
            loadActivities();
          }}
          onSuccess={() => loadActivities()}
        />
      </SafeAreaView>
    </View>
  );
}
