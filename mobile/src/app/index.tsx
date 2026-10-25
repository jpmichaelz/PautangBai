import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  Modal,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSQLiteContext } from "expo-sqlite";
import { Ionicons } from "@expo/vector-icons";
import { borrowerHelper } from "@/db-helpers/borrowers";
import { loanHelper } from "@/db-helpers/loans";
import { paymentHelper } from "@/db-helpers/payments";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Borrower, Loan, Payment } from "@/types/database";
import { formatPHP } from "@/services/interest/calculateInterest";
import { calculateLoanBalance } from "@/services/balance/calculateBalance";
import { Frog } from "@/components/frog";
import {
  LoanFormModal,
  PaymentFormModal,
  BorrowerFormModal,
  LoanDetailModal,
} from "@/components/forms";
import DashboardBg from "@/assets/images/DASHBOARD_BG.svg";
import PautangBaiLogo from "@/assets/images/PAUTANGBAI_LOGO.svg";

export default function HomeScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ action?: string; t?: string }>();

  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Modal states
  const [isLoanModalVisible, setIsLoanModalVisible] = useState(false);
  const [isPayModalVisible, setIsPayModalVisible] = useState(false);
  const [isBorrowerModalVisible, setIsBorrowerModalVisible] = useState(false);
  const [isNotifModalVisible, setIsNotifModalVisible] = useState(false);
  const [selectedLoanForPay, setSelectedLoanForPay] = useState<Loan | null>(null);

  // Detail Modal
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
  const [selectedLoanForDetail, setSelectedLoanForDetail] = useState<Loan | null>(null);

  useEffect(() => {
    if (params.action === "new_loan") {
      setIsLoanModalVisible(true);
    }
  }, [params.action, params.t]);

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
      console.error("Failed to load dashboard data:", err);
    }
  }, [db]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAllData();
    setRefreshing(false);
  };

  const borrowerMap = new Map(borrowers.map((b) => [b.id, b]));

  let totalLentMinor = 0;
  let totalOutstandingMinor = 0;
  let overdueLoansCount = 0;

  // Active loans with balances
  const activeLoansWithBalance = loans
    .filter((l) => l.status !== "cancelled")
    .map((l) => {
      const loanPayments = payments.filter((p) => p.loan_id === l.id && !p.deleted_at);
      const balance = calculateLoanBalance(l, loanPayments);
      totalLentMinor += l.principal_minor;
      totalOutstandingMinor += balance.remainingBalanceMinor;
      if (balance.isOverdue) overdueLoansCount++;
      return {
        loan: l,
        borrower: borrowerMap.get(l.borrower_id),
        balance,
      };
    })
    .filter((item) => item.balance.remainingBalanceMinor > 0);

  const totalCollectedMinor = payments
    .filter((p) => !p.deleted_at)
    .reduce((sum, p) => sum + p.amount_minor, 0);

  // Recent Activities (last 5 transactions: payments received & loans released)
  const recentActivities = [
    ...loans.map((l) => ({
      id: `loan_${l.id}`,
      type: "loan" as const,
      date: l.loan_date,
      borrowerName: borrowerMap.get(l.borrower_id)?.name || "Unknown Borrower",
      amountMinor: l.principal_minor,
      subtitle: "New Loan Released",
      createdAt: l.created_at || l.loan_date,
    })),
    ...payments
      .filter((p) => !p.deleted_at)
      .map((p) => {
        const loan = loans.find((l) => l.id === p.loan_id);
        const borrower = loan ? borrowerMap.get(loan.borrower_id) : null;
        return {
          id: `pay_${p.id}`,
          type: "payment" as const,
          date: p.payment_date,
          borrowerName: borrower?.name || "Unknown Borrower",
          amountMinor: p.amount_minor,
          subtitle: `Payment Received${p.payment_method ? ` • ${p.payment_method}` : ""}`,
          createdAt: p.created_at || p.payment_date,
        };
      }),
  ]
    .sort((a, b) => {
      const dateCmp = b.date.localeCompare(a.date);
      if (dateCmp !== 0) return dateCmp;
      return b.createdAt.localeCompare(a.createdAt);
    })
    .slice(0, 5);

  const handleOpenDetailModal = (loan: Loan) => {
    setSelectedLoanForDetail(loan);
    setIsDetailModalVisible(true);
  };

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
            {/* Notification Bell */}
            <Pressable
              onPress={() => setIsNotifModalVisible(true)}
              className="w-9 h-9 rounded-full bg-white border border-border items-center justify-center relative active:opacity-75 shadow-xs"
              accessibilityLabel="Notifications"
            >
              <Ionicons name="notifications-outline" size={18} color="#173D35" />
              {overdueLoansCount > 0 && (
                <View className="absolute -top-1 -right-1 bg-amber min-w-[17px] h-[17px] rounded-full items-center justify-center px-1 border-2 border-white">
                  <Text className="text-[9px] font-extrabold text-forest-900">
                    {overdueLoansCount > 9 ? "9+" : overdueLoansCount}
                  </Text>
                </View>
              )}
            </Pressable>

            <View className="flex-row items-center px-2.5 py-1 rounded-full bg-emerald-100 gap-1.5">
              <View className="w-2 h-2 rounded-full bg-emerald-600" />
              <Text className="text-xs font-bold text-emerald-800">Offline</Text>
            </View>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: 100,
            gap: 14,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#287A63"
              colors={["#287A63"]}
              enabled={
                !isLoanModalVisible &&
                !isPayModalVisible &&
                !isBorrowerModalVisible &&
                !isNotifModalVisible &&
                !isDetailModalVisible
              }
            />
          }
        >
          {/* Overdue Alert Banner */}
          {overdueLoansCount > 0 && (
            <Pressable
              onPress={() => router.push("/borrowers")}
              className="flex-row items-center gap-2.5 p-3 rounded-2xl bg-amber-100 border border-amber-300 active:opacity-90 shadow-xs"
            >
              <Frog mood="reminder" size={42} />
              <View className="flex-1">
                <Text className="text-amber-950 font-black text-xs">
                  {overdueLoansCount}{" "}
                  {overdueLoansCount === 1 ? "loan is" : "loans are"} past due date!
                </Text>
                <Text className="text-amber-800 text-[11px] font-semibold mt-0.5">
                  Tap to view borrower details & contact them
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#78350F" />
            </Pressable>
          )}

          {/* Hero Financial Summary Card */}
          <View className="rounded-3xl p-6 bg-forest-900 shadow-md">
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center px-2.5 py-0.5 rounded-full bg-white/10 self-start">
                <Text className="text-mint text-[10px] font-black tracking-widest uppercase">
                  DASHBOARD OVERVIEW
                </Text>
              </View>
            </View>

            <View className="flex-row items-center gap-2 mb-4">
              <View className="flex-1">
                <Text className="text-mint/80 text-[11px] font-extrabold tracking-widest mb-1">
                  TOTAL OUTSTANDING DEBT
                </Text>
                <Text
                  className="text-white text-3xl font-black tracking-tight"
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {formatPHP(totalOutstandingMinor)}
                </Text>
                <Text className="text-slate-300 text-xs font-medium mt-1">
                  Across {activeLoansWithBalance.length} active{" "}
                  {activeLoansWithBalance.length === 1 ? "loan" : "loans"}
                </Text>
              </View>
              <Frog mood="happy" size={76} />
            </View>

            <View className="flex-row pt-3.5 border-t border-white/15">
              <View className="flex-1">
                <Text className="text-mint text-[11px] font-semibold mb-0.5">
                  Total Lent
                </Text>
                <Text className="text-white text-base font-bold">
                  {formatPHP(totalLentMinor)}
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

          {/* Quick Action Buttons */}
          <View className="flex-row gap-3">
            <Pressable
              className="flex-1 flex-row items-center justify-center gap-2 py-3.5 rounded-2xl bg-bai active:opacity-90 shadow-xs"
              onPress={() => {
                if (borrowers.length === 0) {
                  setIsBorrowerModalVisible(true);
                  return;
                }
                setIsLoanModalVisible(true);
              }}
            >
              <Ionicons name="add-circle" size={19} color="#FFFFFF" />
              <Text className="text-white font-extrabold text-sm tracking-wide">
                New Loan
              </Text>
            </Pressable>

            <Pressable
              className="flex-1 flex-row items-center justify-center gap-2 py-3.5 rounded-2xl bg-white border border-border active:bg-slate-50 shadow-xs"
              onPress={() => setIsBorrowerModalVisible(true)}
            >
              <Ionicons name="person-add" size={17} color="#173D35" />
              <Text className="text-forest-900 font-extrabold text-sm tracking-wide">
                New Debtor
              </Text>
            </Pressable>
          </View>

          {/* Recent Activity Section */}
          <View className="flex-row justify-between items-center mt-1">
            <View>
              <Text className="text-lg font-black text-forest-900">
                Recent Activity
              </Text>
              <Text className="text-xs text-slate font-medium">
                Latest transactions & payments
              </Text>
            </View>
            <Pressable
              onPress={() => router.push("/activity")}
              className="py-1 px-2.5 rounded-full bg-forest-900/10 active:opacity-80"
            >
              <Text className="text-xs font-extrabold text-forest-900">
                View All →
              </Text>
            </Pressable>
          </View>

          {/* Activity List */}
          {recentActivities.length === 0 ? (
            <View className="rounded-3xl p-8 bg-white border border-border items-center justify-center gap-2 shadow-xs">
              <Frog mood="happy" size={76} />
              <Text className="text-base font-extrabold text-forest-900 mt-1">
                No Transactions Yet
              </Text>
              <Text className="text-xs text-slate text-center max-w-[260px] leading-4">
                Record a loan or payment to see your recent transaction history here.
              </Text>
            </View>
          ) : (
            recentActivities.map((item) => {
              const isLoan = item.type === "loan";
              return (
                <Pressable
                  key={item.id}
                  onPress={() => router.push("/activity")}
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
                    <Text className="text-sm font-bold text-ink" numberOfLines={1}>
                      {item.borrowerName}
                    </Text>
                    <Text className="text-xs text-slate mt-0.5" numberOfLines={1}>
                      {item.subtitle}
                    </Text>
                    <Text className="text-[11px] text-slate-400 mt-0.5">
                      {item.date}
                    </Text>
                  </View>

                  <View className="items-end">
                    <Text
                      className={`text-sm font-black ${
                        isLoan ? "text-ink" : "text-emerald-600"
                      }`}
                    >
                      {isLoan ? "-" : "+"}
                      {formatPHP(item.amountMinor)}
                    </Text>
                    <Text className="text-[10px] text-slate-400 mt-0.5">
                      Details &gt;
                    </Text>
                  </View>
                </Pressable>
              );
            })
          )}
        </ScrollView>

        {/* Form Modals */}
        <LoanFormModal
          visible={isLoanModalVisible}
          borrowers={borrowers}
          onClose={() => setIsLoanModalVisible(false)}
          onSuccess={() => loadAllData()}
          onAddBorrowerPress={() => setIsBorrowerModalVisible(true)}
        />

        <PaymentFormModal
          visible={isPayModalVisible}
          loan={selectedLoanForPay}
          borrowerName={
            selectedLoanForPay
              ? borrowerMap.get(selectedLoanForPay.borrower_id)?.name
              : undefined
          }
          allPayments={payments}
          onClose={() => setIsPayModalVisible(false)}
          onSuccess={() => loadAllData()}
        />

        <BorrowerFormModal
          visible={isBorrowerModalVisible}
          onClose={() => setIsBorrowerModalVisible(false)}
          onSuccess={() => loadAllData()}
        />

        {/* Loan Detail Modal */}
        <LoanDetailModal
          visible={isDetailModalVisible}
          onClose={() => setIsDetailModalVisible(false)}
          loan={selectedLoanForDetail}
          borrower={
            selectedLoanForDetail
              ? borrowerMap.get(selectedLoanForDetail.borrower_id) || null
              : null
          }
          payments={payments}
          onRecordPayment={(loan) => {
            setSelectedLoanForPay(loan);
            setIsPayModalVisible(true);
          }}
        />

        {/* Notification Modal */}
        <Modal
          visible={isNotifModalVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setIsNotifModalVisible(false)}
        >
          <SafeAreaView className="flex-1 bg-paper">
            <View className="flex-row justify-between items-center px-5 py-4 border-b border-border bg-white">
              <View className="flex-row items-center gap-2.5">
                <Ionicons name="notifications" size={22} color="#173D35" />
                <Text className="text-lg font-black text-forest-900">
                  Notifications
                </Text>
              </View>
              <Pressable
                onPress={() => setIsNotifModalVisible(false)}
                className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center active:opacity-70"
              >
                <Ionicons name="close" size={20} color="#252B29" />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
              {overdueLoansCount > 0 ? (
                <>
                  <View className="p-4 rounded-2xl bg-amber-50 border border-amber-300 flex-row items-center gap-3">
                    <Frog mood="reminder" size={56} />
                    <View className="flex-1">
                      <Text className="text-sm font-extrabold text-amber-900">
                        Action Needed
                      </Text>
                      <Text className="text-xs text-amber-800 mt-0.5 leading-4">
                        You have {overdueLoansCount}{" "}
                        {overdueLoansCount === 1 ? "loan" : "loans"} past the due
                        date. Check in with your borrowers.
                      </Text>
                    </View>
                  </View>

                  <Text className="text-xs font-bold text-slate uppercase tracking-wider mt-2">
                    Overdue Reminders
                  </Text>

                  {activeLoansWithBalance
                    .filter((item) => item.balance.isOverdue)
                    .map((item) => (
                      <Pressable
                        key={item.loan.id}
                        className="p-4 rounded-2xl bg-white border border-border shadow-xs active:bg-slate-50"
                        onPress={() => {
                          setIsNotifModalVisible(false);
                          handleOpenDetailModal(item.loan);
                        }}
                      >
                        <View className="flex-row justify-between items-start mb-2">
                          <View>
                            <Text className="text-base font-bold text-ink">
                              {item.borrower?.name || "Unknown Borrower"}
                            </Text>
                            <Text className="text-xs text-danger font-medium mt-0.5">
                              Due date: {item.loan.due_date || "Past due"}
                            </Text>
                          </View>
                          <Text className="text-base font-black text-forest-900">
                            {formatPHP(item.balance.remainingBalanceMinor)}
                          </Text>
                        </View>
                        <Pressable
                          onPress={() => {
                            setIsNotifModalVisible(false);
                            setSelectedLoanForPay(item.loan);
                            setIsPayModalVisible(true);
                          }}
                          className="mt-2 py-2 px-3 rounded-xl bg-bai flex-row items-center justify-center gap-1.5 active:opacity-90"
                        >
                          <Ionicons
                            name="cash-outline"
                            size={15}
                            color="#FFFFFF"
                          />
                          <Text className="text-xs font-bold text-white">
                            Record Payment
                          </Text>
                        </Pressable>
                      </Pressable>
                    ))}
                </>
              ) : (
                <View className="items-center justify-center py-20 px-4">
                  <Frog mood="happy" size={100} />
                  <Text className="text-base font-bold text-forest-900 mt-4 mb-1">
                    All caught up, bai!
                  </Text>
                  <Text className="text-xs text-slate text-center leading-5 max-w-[260px]">
                    No overdue loans or urgent alerts. Everything is running
                    smoothly offline.
                  </Text>
                </View>
              )}
            </ScrollView>
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    </View>
  );
}
