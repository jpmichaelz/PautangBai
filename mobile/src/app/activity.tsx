import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  Modal,
  Alert,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSQLiteContext } from "expo-sqlite";
import { Ionicons } from "@expo/vector-icons";
import { borrowerHelper } from "@/db-helpers/borrowers";
import { loanHelper } from "@/db-helpers/loans";
import { paymentHelper } from "@/db-helpers/payments";
import { Loan, Payment } from "@/types/database";
import { formatPHP } from "@/services/interest/calculateInterest";
import { Frog } from "@/components/frog";
import DashboardBg from "@/assets/images/DASHBOARD_BG.svg";
import PautangBaiLogo from "@/assets/images/PAUTANGBAI_LOGO.svg";


interface ActivityItem {
  id: string;
  type: "loan" | "payment";
  date: string;
  borrowerName: string;
  amountMinor: number;
  subtitle: string;
  rawPayment?: Payment;
  rawLoan?: Loan;
}

export default function ActivityScreen() {
  const db = useSQLiteContext();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<ActivityItem | null>(null);
  const [isVoiding, setIsVoiding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadActivities = useCallback(async () => {
    try {
      const [borrowers, loans, payments] = await Promise.all([
        borrowerHelper.getAll(db),
        loanHelper.getAll(db),
        paymentHelper.getAll(db),
      ]);

      const borrowerMap = new Map<string, string>();
      borrowers.forEach((b) => borrowerMap.set(b.id, b.name));

      const loanMap = new Map<string, Loan>();
      loans.forEach((l) => loanMap.set(l.id, l));

      const items: ActivityItem[] = [];

      loans.forEach((l) => {
        const borrowerName =
          borrowerMap.get(l.borrower_id) || "Unknown Borrower";
        let feeDesc = "No interest";
        if (l.interest_type === "fixed_amount") {
          feeDesc = `+${formatPHP(l.fixed_charge_minor)} fixed fee`;
        } else if (l.interest_type === "percentage_flat") {
          feeDesc = `${l.interest_rate}% flat fee`;
        } else if (l.interest_type === "percentage_daily") {
          feeDesc = `${l.interest_rate}% daily`;
        } else if (l.interest_type === "percentage_weekly") {
          feeDesc = `${l.interest_rate}% weekly`;
        } else if (l.interest_type === "percentage_monthly") {
          feeDesc = `${l.interest_rate}% monthly`;
        }

        items.push({
          id: "act_l_" + l.id,
          type: "loan",
          date: l.loan_date,
          borrowerName,
          amountMinor: l.principal_minor,
          subtitle: `New Loan • ${feeDesc}`,
          rawLoan: l,
        });
      });

      payments.forEach((p) => {
        const loan = loanMap.get(p.loan_id);
        const borrowerName = loan
          ? borrowerMap.get(loan.borrower_id) || "Unknown"
          : "Unknown";
        const method = p.payment_method ? ` via ${p.payment_method}` : "";

        items.push({
          id: "act_p_" + p.id,
          type: "payment",
          date: p.payment_date,
          borrowerName,
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

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadActivities();
    setRefreshing(false);
  }, [loadActivities]);

  const handleVoidPayment = (item: ActivityItem) => {
    if (!item.rawPayment || isVoiding) return;

    Alert.alert(
      "Void Payment?",
      `Are you sure you want to void this payment of ${formatPHP(
        item.amountMinor,
      )}? This amount will be added back to the loan balance.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Void Payment",
          style: "destructive",
          onPress: async () => {
            setIsVoiding(true);
            try {
              await paymentHelper.reverse(db, item.rawPayment!.id);
              setSelectedActivity(null);
              await loadActivities();
              Alert.alert(
                "Payment Voided",
                `Payment of ${formatPHP(item.amountMinor)} was reversed and balance restored.`,
              );
            } catch (err) {
              console.error("Failed to void payment:", err);
              Alert.alert("Error", "Failed to void payment. Please try again.");
            } finally {
              setIsVoiding(false);
            }
          },
        },
      ],
    );
  };

  const renderAllocationDetails = (payment?: Payment) => {
    if (!payment?.allocation_json) return null;
    try {
      const parsed = JSON.parse(payment.allocation_json);
      return (
        <View className="rounded-xl bg-slate-50 border border-slate-200 p-3 gap-1.5 mt-2">
          <Text className="text-[11px] font-bold text-slate uppercase tracking-wider">
            Payment Breakdown
          </Text>
          <View className="flex-row justify-between">
            <Text className="text-xs text-slate">Applied to Fee/Interest:</Text>
            <Text className="text-xs font-bold text-ink">
              {formatPHP(parsed.appliedToInterestMinor || 0)}
            </Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-xs text-slate">Applied to Principal:</Text>
            <Text className="text-xs font-bold text-ink">
              {formatPHP(parsed.appliedToPrincipalMinor || 0)}
            </Text>
          </View>
        </View>
      );
    } catch {
      return null;
    }
  };

  const paymentsCount = activities.filter((a) => a.type === "payment").length;
  const totalCollectedMinor = activities
    .filter((a) => a.type === "payment")
    .reduce((sum, a) => sum + a.amountMinor, 0);

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
        data={activities}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View className="mb-3">
            {/* Page Container Banner */}
            <View className="rounded-3xl p-5 bg-forest-900 shadow-lg">
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-row items-center px-2.5 py-0.5 rounded-full bg-white/10 self-start">
                  <Text className="text-mint text-[10px] font-black tracking-widest uppercase">
                    TRANSACTION LEDGER
                  </Text>
                </View>
              </View>

              <View className="flex-row items-center gap-2 mb-3">
                <View className="flex-1">
                  <Text className="text-white text-2xl font-black tracking-tight">
                    Activity
                  </Text>
                  <Text className="text-slate-300 text-xs font-medium mt-0.5">
                    Audit trail of loans & payments
                  </Text>
                </View>
                <Frog mood="payment" size={68} />
              </View>

              <View className="flex-row pt-3 border-t border-white/15">
                <View className="flex-1">
                  <Text className="text-mint text-[11px] font-semibold mb-0.5">
                    Payments Recorded
                  </Text>
                  <Text className="text-white text-base font-bold">
                    {paymentsCount}
                  </Text>
                </View>
                <View className="w-px bg-white/15 mx-3" />
                <View className="flex-1">
                  <Text className="text-mint text-[11px] font-semibold mb-0.5">
                    Total Collected
                  </Text>
                  <Text className="text-emerald-400 text-base font-bold">
                    {formatPHP(totalCollectedMinor)}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#287A63"
            colors={["#287A63"]}
            enabled={!isVoiding}
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
              className="flex-row items-center p-3.5 rounded-2xl bg-white border border-border gap-3 shadow-xs active:bg-slate-50"
            >
              <View
                className={`w-10 h-10 rounded-full items-center justify-center ${
                  isLoan ? "bg-amber-100" : "bg-emerald-100"
                }`}
              >
                <Ionicons
                  name={isLoan ? "arrow-up-outline" : "arrow-down-outline"}
                  size={20}
                  color={isLoan ? "#D97706" : "#16A34A"}
                />
              </View>

              <View className="flex-1">
                <Text className="text-sm font-bold text-ink">
                  {item.borrowerName}
                </Text>
                <Text className="text-xs text-slate mt-0.5">
                  {item.subtitle}
                </Text>
                <Text className="text-[11px] text-slate-400 mt-0.5">
                  {item.date}
                </Text>
              </View>

              <View className="items-end">
                <Text
                  className={`text-sm font-black ${isLoan ? "text-ink" : "text-emerald-600"}`}
                >
                  {isLoan ? "-" : "+"}
                  {formatPHP(item.amountMinor)}
                </Text>
                <Text className="text-[10px] text-slate-400 mt-0.5">View &gt;</Text>
              </View>
            </Pressable>
          );
        }}
      />

      {/* Transaction Details & Void Action Modal */}
      <Modal
        visible={!!selectedActivity}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedActivity(null)}
      >
        <Pressable
          className="flex-1 bg-black/40 justify-center px-5"
          onPress={() => setSelectedActivity(null)}
        >
          <Pressable
            className="bg-white rounded-3xl p-5 shadow-lg border border-border"
            onPress={(e) => e.stopPropagation()}
          >
            {selectedActivity && (
              <View className="gap-4">
                <View className="flex-row justify-between items-center">
                  <View className="flex-row items-center gap-2">
                    <View
                      className={`w-8 h-8 rounded-full items-center justify-center ${
                        selectedActivity.type === "loan"
                          ? "bg-amber-100"
                          : "bg-emerald-100"
                      }`}
                    >
                      <Ionicons
                        name={
                          selectedActivity.type === "loan"
                            ? "arrow-up-outline"
                            : "arrow-down-outline"
                        }
                        size={16}
                        color={
                          selectedActivity.type === "loan"
                            ? "#D97706"
                            : "#16A34A"
                        }
                      />
                    </View>
                    <Text className="text-base font-extrabold text-forest-900">
                      {selectedActivity.type === "loan"
                        ? "Loan Transaction"
                        : "Payment Record"}
                    </Text>
                  </View>
                  <Pressable
                    hitSlop={12}
                    onPress={() => setSelectedActivity(null)}
                    className="p-1 rounded-full active:bg-slate-100"
                  >
                    <Ionicons name="close" size={20} color="#64748B" />
                  </Pressable>
                </View>

                {/* Amount Display */}
                <View className="items-center py-2 bg-slate-50 rounded-2xl border border-slate-100">
                  <Text className="text-xs font-semibold text-slate">Amount</Text>
                  <Text className="text-2xl font-black text-forest-900 mt-0.5">
                    {formatPHP(selectedActivity.amountMinor)}
                  </Text>
                </View>

                {/* Detail rows */}
                <View className="gap-2.5 px-1">
                  <View className="flex-row justify-between">
                    <Text className="text-xs text-slate">Borrower:</Text>
                    <Text className="text-xs font-bold text-ink">
                      {selectedActivity.borrowerName}
                    </Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text className="text-xs text-slate">Date:</Text>
                    <Text className="text-xs font-bold text-ink">
                      {selectedActivity.date}
                    </Text>
                  </View>
                  {selectedActivity.rawPayment?.payment_method && (
                    <View className="flex-row justify-between">
                      <Text className="text-xs text-slate">Method:</Text>
                      <Text className="text-xs font-bold text-ink">
                        {selectedActivity.rawPayment.payment_method}
                      </Text>
                    </View>
                  )}
                  {selectedActivity.rawPayment?.notes && (
                    <View className="flex-row justify-between">
                      <Text className="text-xs text-slate">Notes:</Text>
                      <Text className="text-xs font-bold text-ink">
                        {selectedActivity.rawPayment.notes}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Allocation breakdown for payments */}
                {selectedActivity.type === "payment" &&
                  renderAllocationDetails(selectedActivity.rawPayment)}

                {/* Void Payment Action */}
                {selectedActivity.type === "payment" && (
                  <Pressable
                    disabled={isVoiding}
                    onPress={() => handleVoidPayment(selectedActivity)}
                    className="mt-2 py-3 rounded-xl bg-red-50 border border-red-200 items-center justify-center active:bg-red-100"
                  >
                    <Text className="text-red-700 font-extrabold text-xs">
                      {isVoiding ? "Voiding..." : "Bawi-on ang Bayad (Void Payment)"}
                    </Text>
                  </Pressable>
                )}
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  </View>
);
}

