import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSQLiteContext } from "expo-sqlite";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect, useNavigation } from "expo-router";
import { borrowerHelper } from "@/db-helpers/borrowers";
import { loanHelper } from "@/db-helpers/loans";
import { paymentHelper } from "@/db-helpers/payments";
import { Borrower, Loan, Payment } from "@/types/database";
import { formatPHP } from "@/services/interest/calculateInterest";
import { calculateLoanBalance } from "@/services/balance/calculateBalance";
import { Frog } from "@/components/frog";
import DashboardBg from "@/assets/images/DASHBOARD_BG.svg";
import PautangBaiLogo from "@/assets/images/PAUTANGBAI_LOGO.svg";

export default function AnalyticsScreen() {
  const navigation = useNavigation<any>();
  const router = useRouter();
  const db = useSQLiteContext();

  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadAllData = useCallback(async () => {
    try {
      const [bList, lList, pList] = await Promise.all([
        borrowerHelper.getAll(db),
        loanHelper.getAll(db),
        paymentHelper.getAll(db),
      ]);
      setBorrowers(bList);
      setLoans(lList);
      setPayments(pList);
    } catch (err) {
      console.error("Failed to load analytics data:", err);
    }
  }, [db]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  useFocusEffect(
    useCallback(() => {
      loadAllData();
    }, [loadAllData]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAllData();
    setRefreshing(false);
  };

  // Compute Tubo vs Puhunan aggregation across non-cancelled loans
  const validLoans = loans.filter((l) => l.status !== "cancelled");

  let totalPrincipalLentMinor = 0;
  let totalPrincipalPaidMinor = 0;
  let outstandingCapitalMinor = 0;
  let totalInterestEarnedMinor = 0;
  let uncollectedInterestMinor = 0;
  let totalOwedMinor = 0;
  let totalPaidMinor = 0;
  let totalRemainingBalanceMinor = 0;

  let settledLoansCount = 0;
  let activeLoansCount = 0;
  let overdueLoansCount = 0;
  let overdueBalanceMinor = 0;

  validLoans.forEach((loan) => {
    const loanPayments = payments.filter(
      (p) => p.loan_id === loan.id && !p.deleted_at,
    );
    const balance = calculateLoanBalance(loan, loanPayments);

    totalPrincipalLentMinor += balance.principalMinor;
    totalPrincipalPaidMinor += balance.principalPaidMinor;
    outstandingCapitalMinor += balance.principalRemainingMinor;
    totalInterestEarnedMinor += balance.interestPaidMinor;
    uncollectedInterestMinor += balance.interestRemainingMinor;
    totalOwedMinor += balance.totalOwedMinor;
    totalPaidMinor += balance.totalPaidMinor;
    totalRemainingBalanceMinor += balance.remainingBalanceMinor;

    if (balance.isPaid) {
      settledLoansCount++;
    } else {
      activeLoansCount++;
      if (balance.isOverdue) {
        overdueLoansCount++;
        overdueBalanceMinor += balance.remainingBalanceMinor;
      }
    }
  });

  const capitalRecoveryPercent =
    totalPrincipalLentMinor > 0
      ? Math.min(
          100,
          Math.round((totalPrincipalPaidMinor / totalPrincipalLentMinor) * 100),
        )
      : 0;

  const totalRoiPercent =
    totalPrincipalLentMinor > 0
      ? ((totalInterestEarnedMinor / totalPrincipalLentMinor) * 100).toFixed(1)
      : "0.0";

  const totalProjectedProfitMinor =
    totalInterestEarnedMinor + uncollectedInterestMinor;

  const totalProfitRealizedPercent =
    totalProjectedProfitMinor > 0
      ? Math.min(
          100,
          Math.round(
            (totalInterestEarnedMinor / totalProjectedProfitMinor) * 100,
          ),
        )
      : 0;

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

          <View className="flex-row items-center gap-2">
            {/* Settings Shortcut */}
            <Pressable
              onPress={() => {
                try {
                  navigation.navigate("settings");
                } catch {
                  router.navigate("/settings");
                }
              }}
              hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
              className="w-10 h-10 rounded-full bg-white border border-border items-center justify-center active:opacity-75 shadow-xs"
              accessibilityRole="button"
              accessibilityLabel="Settings"
            >
              <Ionicons name="settings-outline" size={19} color="#173D35" />
            </Pressable>

            <View className="flex-row items-center px-2.5 py-1 rounded-full bg-emerald-100 gap-1.5">
              <View className="w-2 h-2 rounded-full bg-emerald-600" />
              <Text className="text-xs font-bold text-emerald-800">
                Offline
              </Text>
            </View>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: 110,
            gap: 14,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#287A63"
              colors={["#287A63"]}
            />
          }
        >
          {/* Hero Profit Card: Tubo Nadawat (Profit in Hand) */}
          <View className="rounded-3xl p-6 bg-forest-900">
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center px-2.5 py-1 rounded-full bg-white/10">
                <Text className="text-mint text-[10px] font-black tracking-widest uppercase">
                  TUBO UG PUHUNAN SUMMARY
                </Text>
              </View>

              <View className="flex-row items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20">
                <Ionicons name="arrow-up" size={12} color="#75C99C" />
                <Text className="text-[11px] font-extrabold text-mint">
                  +{totalRoiPercent}% Tubo
                </Text>
              </View>
            </View>

            <View className="flex-row items-center gap-3 mb-4">
              <View className="flex-1">
                <Text className="text-mint/80 text-[11px] font-extrabold tracking-widest uppercase mb-1">
                  Tubo Nadawat (Profit Collected)
                </Text>
                <Text
                  className="text-white text-3xl font-black tracking-tight"
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {formatPHP(totalInterestEarnedMinor)}
                </Text>
                <Text className="text-slate-300 text-xs font-medium mt-1">
                  Cash profit already received in your hand
                </Text>
              </View>
              <Frog mood="celebrate" size={72} />
            </View>

            {/* Bottom 3-Metric Bar */}
            <View className="flex-row pt-3.5 border-t border-white/15">
              <View className="flex-1">
                <Text className="text-mint text-[11px] font-semibold mb-0.5">
                  Puhunan Nabawi
                </Text>
                <Text
                  style={{ fontVariant: ["tabular-nums"] }}
                  className="text-white text-base font-bold"
                >
                  {capitalRecoveryPercent}%
                </Text>
                <Text className="text-[10px] text-slate-300">
                  of capital returned
                </Text>
              </View>

              <View className="w-px bg-white/15 mx-3" />

              <View className="flex-1">
                <Text className="text-mint text-[11px] font-semibold mb-0.5">
                  Tubo Paabuton
                </Text>
                <Text
                  style={{ fontVariant: ["tabular-nums"] }}
                  className="text-emerald-400 text-base font-bold"
                >
                  {formatPHP(uncollectedInterestMinor)}
                </Text>
                <Text className="text-[10px] text-slate-300">
                  pending collection
                </Text>
              </View>
            </View>
          </View>

          {/* Quick Cash Flow Snapshot Card */}
          <View className="flex-row gap-3">
            <View className="flex-1 p-4 rounded-2xl bg-white border border-border">
              <View className="flex-row items-center gap-1.5 mb-1">
                <View className="w-2 h-2 rounded-full bg-emerald-600" />
                <Text className="text-[11px] font-bold text-slate uppercase">
                  Total Nadawat
                </Text>
              </View>
              <Text
                style={{ fontVariant: ["tabular-nums"] }}
                className="text-lg font-black text-forest-900"
                numberOfLines={1}
              >
                {formatPHP(totalPaidMinor)}
              </Text>
              <Text className="text-[10px] text-slate-500 mt-0.5">
                Principal + tubo collected
              </Text>
            </View>

            <View className="flex-1 p-4 rounded-2xl bg-white border border-border">
              <View className="flex-row items-center gap-1.5 mb-1">
                <View className="w-2 h-2 rounded-full bg-amber-500" />
                <Text className="text-[11px] font-bold text-slate uppercase">
                  Total Kobrahonon
                </Text>
              </View>
              <Text
                style={{ fontVariant: ["tabular-nums"] }}
                className="text-lg font-black text-ink"
                numberOfLines={1}
              >
                {formatPHP(totalRemainingBalanceMinor)}
              </Text>
              <Text className="text-[10px] text-slate-500 mt-0.5">
                Remaining debt in field
              </Text>
            </View>
          </View>

          {/* Puhunan (Capital) Health Card */}
          <View className="rounded-3xl p-5 bg-white border border-border gap-3.5">
            <View className="flex-row justify-between items-center">
              <View>
                <Text className="text-base font-black text-forest-900">
                  Puhunan (Capital) Health
                </Text>
                <Text className="text-xs text-slate font-medium">
                  Original money lent out vs money that returned
                </Text>
              </View>
              <View className="w-9 h-9 rounded-2xl bg-forest-900/10 items-center justify-center">
                <Ionicons name="wallet-outline" size={18} color="#173D35" />
              </View>
            </View>

            <View className="flex-row gap-3 pt-1">
              {/* Puhunan sa Gawas */}
              <View className="flex-1 p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200">
                <Text className="text-[11px] font-black text-amber-950 uppercase tracking-wide mb-1">
                  Puhunan sa Gawas
                </Text>
                <Text
                  style={{ fontVariant: ["tabular-nums"] }}
                  className="text-lg font-black text-ink"
                  numberOfLines={1}
                >
                  {formatPHP(outstandingCapitalMinor)}
                </Text>
                <Text className="text-[10px] text-amber-800 font-medium mt-0.5">
                  Still with borrowers
                </Text>
              </View>

              {/* Puhunan Nabawi */}
              <View className="flex-1 p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200">
                <Text className="text-[11px] font-black text-emerald-950 uppercase tracking-wide mb-1">
                  Puhunan Nabawi
                </Text>
                <Text
                  style={{ fontVariant: ["tabular-nums"] }}
                  className="text-lg font-black text-emerald-800"
                  numberOfLines={1}
                >
                  {formatPHP(totalPrincipalPaidMinor)}
                </Text>
                <Text className="text-[10px] text-emerald-800 font-medium mt-0.5">
                  Back in your pocket
                </Text>
              </View>
            </View>

            {/* Recovery Progress Bar */}
            <View className="gap-1.5 pt-1">
              <View className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                <View
                  className="h-full rounded-full bg-emerald-600"
                  style={{ width: `${capitalRecoveryPercent}%` }}
                />
              </View>
              <View className="flex-row justify-between items-center">
                <Text className="text-xs text-slate font-medium">
                  Total Principal Lent:{" "}
                  <Text className="font-bold text-ink">
                    {formatPHP(totalPrincipalLentMinor)}
                  </Text>
                </Text>
                <Text className="text-xs font-black text-emerald-700">
                  {capitalRecoveryPercent}% Recovered
                </Text>
              </View>
            </View>
          </View>

          {/* Tubo (Profit) Breakdown Card */}
          <View className="rounded-3xl p-5 bg-white border border-border gap-3.5">
            <View className="flex-row justify-between items-center">
              <View>
                <Text className="text-base font-black text-forest-900">
                  Tubo (Profit) Breakdown
                </Text>
                <Text className="text-xs text-slate font-medium">
                  Collected earnings vs remaining expected interest
                </Text>
              </View>
              <View className="w-9 h-9 rounded-2xl bg-emerald-100 items-center justify-center">
                <Ionicons name="trending-up" size={18} color="#047857" />
              </View>
            </View>

            <View className="flex-row gap-3 pt-1">
              {/* Tubo Nadawat */}
              <View className="flex-1 p-3.5 rounded-2xl bg-mint/30 border border-border">
                <Text className="text-[11px] font-black text-forest-900 uppercase tracking-wide mb-1">
                  Tubo Nadawat
                </Text>
                <Text
                  style={{ fontVariant: ["tabular-nums"] }}
                  className="text-lg font-black text-forest-900"
                  numberOfLines={1}
                >
                  {formatPHP(totalInterestEarnedMinor)}
                </Text>
                <Text className="text-[10px] text-forest-900/80 font-medium mt-0.5">
                  Collected profit
                </Text>
              </View>

              {/* Tubo Paabuton */}
              <View className="flex-1 p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <Text className="text-[11px] font-black text-slate-700 uppercase tracking-wide mb-1">
                  Tubo Paabuton
                </Text>
                <Text
                  style={{ fontVariant: ["tabular-nums"] }}
                  className="text-lg font-black text-ink"
                  numberOfLines={1}
                >
                  {formatPHP(uncollectedInterestMinor)}
                </Text>
                <Text className="text-[10px] text-slate font-medium mt-0.5">
                  Pending upon full pay
                </Text>
              </View>
            </View>

            {/* Profit Realization Progress Bar */}
            <View className="gap-1.5 pt-1">
              <View className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                <View
                  className="h-full rounded-full bg-bai"
                  style={{ width: `${totalProfitRealizedPercent}%` }}
                />
              </View>
              <View className="flex-row justify-between items-center">
                <Text className="text-xs text-slate font-medium">
                  Total Expected Profit:{" "}
                  <Text className="font-bold text-ink">
                    {formatPHP(totalProjectedProfitMinor)}
                  </Text>
                </Text>
                <Text className="text-xs font-black text-bai">
                  {totalProfitRealizedPercent}% Realized
                </Text>
              </View>
            </View>
          </View>

          {/* Portfolio Status 4-Grid */}
          <View className="gap-2.5">
            <Text className="text-base font-black text-forest-900">
              Loan Portfolio Overview
            </Text>

            <View className="flex-row gap-3">
              <View className="flex-1 p-4 rounded-2xl bg-white border border-border">
                <View className="flex-row justify-between items-center mb-1">
                  <Text className="text-xs text-slate font-medium">
                    Total Released
                  </Text>
                  <Ionicons
                    name="documents-outline"
                    size={15}
                    color="#173D35"
                  />
                </View>
                <Text className="text-xl font-black text-ink">
                  {validLoans.length}
                </Text>
                <Text className="text-[11px] text-slate-500 mt-0.5">
                  {borrowers.length} total debtors
                </Text>
              </View>

              <View className="flex-1 p-4 rounded-2xl bg-white border border-border">
                <View className="flex-row justify-between items-center mb-1">
                  <Text className="text-xs text-slate font-medium">
                    Fully Settled
                  </Text>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={16}
                    color="#15803D"
                  />
                </View>
                <Text className="text-xl font-black text-emerald-700">
                  {settledLoansCount}
                </Text>
                <Text className="text-[11px] text-emerald-800 font-medium mt-0.5">
                  100% paid off
                </Text>
              </View>
            </View>

            <View className="flex-row gap-3">
              <View className="flex-1 p-4 rounded-2xl bg-white border border-border">
                <View className="flex-row justify-between items-center mb-1">
                  <Text className="text-xs text-slate font-medium">
                    Currently Active
                  </Text>
                  <Ionicons name="time-outline" size={15} color="#287A63" />
                </View>
                <Text className="text-xl font-black text-forest-900">
                  {activeLoansCount}
                </Text>
                <Text className="text-[11px] text-slate-500 mt-0.5">
                  {formatPHP(totalRemainingBalanceMinor)}
                </Text>
              </View>

              <View className="flex-1 p-4 rounded-2xl bg-white border border-border">
                <View className="flex-row justify-between items-center mb-1">
                  <Text className="text-xs text-slate font-medium">
                    Overdue Risk
                  </Text>
                  <Ionicons
                    name="alert-circle-outline"
                    size={16}
                    color={overdueLoansCount > 0 ? "#DC2626" : "#66716D"}
                  />
                </View>
                <Text
                  className={`text-xl font-black ${
                    overdueLoansCount > 0 ? "text-danger" : "text-ink"
                  }`}
                >
                  {overdueLoansCount}
                </Text>
                <Text className="text-[11px] text-slate-500 mt-0.5">
                  {overdueLoansCount > 0
                    ? formatPHP(overdueBalanceMinor)
                    : "No overdue debt"}
                </Text>
              </View>
            </View>
          </View>

          {/* Friendly Mascot Advice Card */}
          <View className="p-4 rounded-2xl bg-mint/40 border border-border flex-row items-center gap-3">
            <Frog
              mood={
                overdueLoansCount > 0
                  ? "reminder"
                  : validLoans.length === 0
                    ? "empty"
                    : "happy"
              }
              size={56}
            />
            <View className="flex-1">
              <Text className="text-xs font-black text-forest-900">
                {overdueLoansCount > 0
                  ? "Pahinumdom sa Negosyo, Bai"
                  : validLoans.length === 0
                    ? "Pagsugod og Pautang"
                    : "Nindot ang Dagan!"}
              </Text>
              <Text className="text-[11px] text-forest-900/80 font-medium mt-0.5 leading-4">
                {overdueLoansCount > 0
                  ? `Adunay ${overdueLoansCount} ka overdue nga pautang. Kobrahon una ang puhunan aron dili mabitin ang pondo.`
                  : validLoans.length === 0
                    ? "Ilista ang imong unang pautang aron makita ang tubo ug puhunan dinhi."
                    : "Nagbalik ang imong puhunan ug nakatubo na. Ipadayon ang pagrekord sa mga bayad pirmi!"}
              </Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
