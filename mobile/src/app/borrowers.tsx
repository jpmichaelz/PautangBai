import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
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
import { useLocalSearchParams, useFocusEffect } from "expo-router";
import { formatPHP } from "@/services/interest/calculateInterest";
import { calculateLoanBalance } from "@/services/balance/calculateBalance";
import { getLocalDateString } from "@/services/date/dateUtils";
import { Frog } from "@/components/frog";
import {
  BorrowerFormModal,
  LoanFormModal,
  PaymentFormModal,
  LoanDetailModal,
} from "@/components/forms";
import DashboardBg from "@/assets/images/DASHBOARD_BG.svg";
import PautangBaiLogo from "@/assets/images/PAUTANGBAI_LOGO.svg";

type FilterStatus = "all" | "active" | "overdue" | "paid";
type SortOrder = "newest" | "oldest";

type DirectoryItem =
  | {
      type: "loan";
      id: string;
      loan: Loan;
      borrower: Borrower | undefined;
      balance: ReturnType<typeof calculateLoanBalance>;
      payments: Payment[];
      createdAt: string;
    }
  | {
      type: "borrower_only";
      id: string;
      borrower: Borrower;
      createdAt: string;
    };

export default function BorrowersScreen() {
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ action?: string; t?: string }>();

  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [refreshing, setRefreshing] = useState(false);

  // Modals
  const [isBorrowerModalVisible, setIsBorrowerModalVisible] = useState(false);
  const [isPayModalVisible, setIsPayModalVisible] = useState(false);
  const [selectedLoanForPay, setSelectedLoanForPay] = useState<Loan | null>(null);
  const [isLoanModalVisible, setIsLoanModalVisible] = useState(false);
  const [selectedBorrowerForLoan, setSelectedBorrowerForLoan] = useState<Borrower | null>(null);

  // Detail Modal
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
  const [selectedLoanForDetail, setSelectedLoanForDetail] = useState<Loan | null>(null);

  useEffect(() => {
    if (params.action === "new_borrower") {
      setIsBorrowerModalVisible(true);
    }
  }, [params.action, params.t]);

  const loadData = useCallback(async () => {
    try {
      const [borrowerList, loanList, paymentList] = await Promise.all([
        borrowerHelper.getAll(db),
        loanHelper.getAll(db),
        paymentHelper.getAll(db),
      ]);
      setBorrowers(borrowerList);
      setLoans(loanList);
      setPayments(paymentList);
    } catch (err) {
      console.error("Failed to load borrower directory data:", err);
    }
  }, [db]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const borrowerMap = new Map(borrowers.map((b) => [b.id, b]));

  // Combine loans with borrower and calculated balance
  const loansData: DirectoryItem[] = loans
    .filter((l) => l.status !== "cancelled")
    .map((loan) => {
      const loanPayments = payments.filter((p) => p.loan_id === loan.id && !p.deleted_at);
      const balance = calculateLoanBalance(loan, loanPayments);
      const borrower = borrowerMap.get(loan.borrower_id);
      return {
        type: "loan",
        id: loan.id,
        loan,
        borrower,
        balance,
        payments: loanPayments,
        createdAt: loan.created_at || loan.loan_date,
      };
    });

  const borrowerIdsWithLoans = new Set(
    loansData.map((item) => (item as any).loan.borrower_id),
  );
  const borrowerOnlyData: DirectoryItem[] = borrowers
    .filter((b) => !borrowerIdsWithLoans.has(b.id))
    .map((borrower) => ({
      type: "borrower_only",
      id: `borrower_${borrower.id}`,
      borrower,
      createdAt: borrower.created_at || new Date().toISOString(),
    }));

  const allDirectoryItems: DirectoryItem[] = [...loansData, ...borrowerOnlyData];

  // Calculate high-level stats
  const activeDebtsCount = loansData.filter(
    (i) => i.type === "loan" && !i.balance.isPaid,
  ).length;
  const overdueDebtsCount = loansData.filter(
    (i) => i.type === "loan" && i.balance.isOverdue,
  ).length;
  const totalOutstandingMinor = loansData.reduce(
    (sum, i) =>
      sum + (i.type === "loan" ? i.balance.remainingBalanceMinor : 0),
    0,
  );

  // Filter and search
  const filteredItems = allDirectoryItems.filter((item) => {
    if (item.type === "borrower_only") {
      // Borrower without loans appears in "all" tab
      if (filterStatus !== "all") return false;

      const query = searchQuery.toLowerCase().trim();
      if (!query) return true;

      const bName = item.borrower.name.toLowerCase();
      const bPhone = item.borrower.phone || "";
      const bAddr = item.borrower.address?.toLowerCase() || "";
      const bNotes = item.borrower.notes?.toLowerCase() || "";

      return (
        bName.includes(query) ||
        bPhone.includes(query) ||
        bAddr.includes(query) ||
        bNotes.includes(query)
      );
    }

    const { loan, borrower, balance } = item;
    // Filter status tab
    if (filterStatus === "active" && balance.isPaid) return false;
    if (filterStatus === "overdue" && !balance.isOverdue) return false;
    if (filterStatus === "paid" && !balance.isPaid) return false;

    // Search query
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;

    const bName = borrower?.name.toLowerCase() || "";
    const bPhone = borrower?.phone || "";
    const bAddr = borrower?.address?.toLowerCase() || "";
    const lNotes = loan.notes?.toLowerCase() || "";

    return (
      bName.includes(query) ||
      bPhone.includes(query) ||
      bAddr.includes(query) ||
      lNotes.includes(query)
    );
  });

  // Sort items (newest vs oldest)
  const sortedAndFilteredItems = [...filteredItems].sort((a, b) => {
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();
    return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
  });

  const handleDeleteLoan = async (loan: Loan) => {
    try {
      await loanHelper.softDelete(db, loan.id);
      await loadData();
    } catch (err) {
      console.error("Failed to delete loan:", err);
    }
  };

  const handleOpenDetail = (loan: Loan) => {
    setSelectedLoanForDetail(loan);
    setIsDetailModalVisible(true);
  };

  const handleOpenPay = (loan: Loan) => {
    setSelectedLoanForPay(loan);
    setIsPayModalVisible(true);
  };

  const getDueBadge = (dueDateStr: string | null) => {
    if (!dueDateStr) return { text: "No due date", isOverdue: false };
    const today = new Date(getLocalDateString()).getTime();
    const due = new Date(dueDateStr).getTime();
    const diffDays = Math.round((due - today) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) {
      return { text: `${Math.abs(diffDays)}d overdue`, isOverdue: true };
    } else if (diffDays === 0) {
      return { text: "Due today!", isOverdue: false };
    } else {
      return { text: `Due in ${diffDays}d`, isOverdue: false };
    }
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
        {/* Header */}
        <View className="flex-row justify-between items-center px-4 pt-3 pb-2">
          <View className="justify-center">
            <PautangBaiLogo width={135} height={42} />
          </View>

          <Pressable
            className="flex-row items-center gap-1.5 py-2 px-3.5 rounded-full bg-bai active:opacity-90 shadow-xs"
            onPress={() => setIsBorrowerModalVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Add new borrower"
          >
            <Ionicons name="person-add" size={15} color="#FFFFFF" />
            <Text className="text-white font-bold text-xs tracking-wide uppercase">
              Add Debtor
            </Text>
          </Pressable>
        </View>

        {/* Main List */}
        <FlatList
          data={sortedAndFilteredItems}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <View className="mb-2 gap-3.5">
              {/* Page Container Banner */}
              <View className="rounded-3xl p-5 bg-forest-900 shadow-md">
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-row items-center px-2.5 py-0.5 rounded-full bg-white/10 self-start">
                    <Text className="text-mint text-[10px] font-black tracking-widest uppercase">
                      DEBT & BORROWER DIRECTORY
                    </Text>
                  </View>
                </View>

                <View className="flex-row items-center gap-2 mb-3">
                  <View className="flex-1">
                    <Text className="text-white text-2xl font-black tracking-tight">
                      Borrower Debts
                    </Text>
                    <Text className="text-slate-300 text-xs font-medium mt-0.5">
                      Full repayment breakdown & schedules
                    </Text>
                  </View>
                  <Frog mood="borrower" size={68} />
                </View>

                <View className="flex-row pt-3 border-t border-white/15">
                  <View className="flex-1">
                    <Text className="text-mint text-[11px] font-semibold mb-0.5">
                      Active Loans
                    </Text>
                    <Text className="text-white text-base font-bold">
                      {activeDebtsCount}
                    </Text>
                  </View>
                  <View className="w-px bg-white/15 mx-3" />
                  <View className="flex-1">
                    <Text className="text-mint text-[11px] font-semibold mb-0.5">
                      Total Remaining
                    </Text>
                    <Text className="text-emerald-400 text-base font-bold">
                      {formatPHP(totalOutstandingMinor)}
                    </Text>
                  </View>
                  {overdueDebtsCount > 0 && (
                    <>
                      <View className="w-px bg-white/15 mx-3" />
                      <View className="flex-1">
                        <Text className="text-amber-300 text-[11px] font-semibold mb-0.5">
                          Overdue
                        </Text>
                        <Text className="text-amber-400 text-base font-bold">
                          {overdueDebtsCount}
                        </Text>
                      </View>
                    </>
                  )}
                </View>
              </View>

              {/* Search Bar + Sort Toggle */}
              <View className="flex-row items-center gap-2">
                <View className="flex-1 flex-row items-center px-3.5 py-2.5 rounded-2xl bg-white border border-border shadow-xs">
                  <Ionicons
                    name="search"
                    size={18}
                    color="#66716D"
                    className="mr-2"
                  />
                  <TextInput
                    placeholder="Search name, phone, notes..."
                    placeholderTextColor="#9CA3AF"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    className="flex-1 text-sm text-ink"
                    clearButtonMode="while-editing"
                  />
                  {searchQuery.length > 0 && (
                    <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
                      <Ionicons name="close-circle" size={18} color="#66716D" />
                    </Pressable>
                  )}
                </View>

                {/* Sort Toggle Button */}
                <Pressable
                  onPress={() =>
                    setSortOrder((prev) => (prev === "newest" ? "oldest" : "newest"))
                  }
                  className="px-3 py-2.5 rounded-2xl bg-white border border-border shadow-xs flex-row items-center gap-1 active:bg-slate-50 min-h-[46px]"
                  accessibilityRole="button"
                  accessibilityLabel={`Sort: ${sortOrder === "newest" ? "Newest First" : "Oldest First"}`}
                >
                  <Ionicons
                    name={sortOrder === "newest" ? "arrow-down" : "arrow-up"}
                    size={15}
                    color="#173D35"
                  />
                  <Text className="text-[11px] font-black text-forest-900 uppercase tracking-tight">
                    {sortOrder === "newest" ? "New" : "Old"}
                  </Text>
                </Pressable>
              </View>

              {/* Filter Chips */}
              <View className="flex-row gap-2">
                {(
                  [
                    { key: "all", label: "All Debts" },
                    { key: "active", label: `Active (${activeDebtsCount})` },
                    { key: "overdue", label: `Overdue (${overdueDebtsCount})` },
                    { key: "paid", label: "Paid" },
                  ] as const
                ).map((chip) => {
                  const isSelected = filterStatus === chip.key;
                  return (
                    <Pressable
                      key={chip.key}
                      onPress={() => setFilterStatus(chip.key)}
                      className={`py-1.5 px-3 rounded-full border ${
                        isSelected
                          ? "bg-forest-900 border-forest-900"
                          : "bg-white/80 border-border active:bg-white"
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
              enabled={!isBorrowerModalVisible && !isDetailModalVisible && !isPayModalVisible}
            />
          }
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: 100,
            gap: 12,
          }}
          ListEmptyComponent={
            <View className="items-center justify-center py-16 px-4">
              <View className="mb-2">
                <Frog
                  mood={searchQuery ? "searchEmpty" : "borrower"}
                  size={110}
                />
              </View>
              <Text className="text-base font-bold text-forest-900 mb-1">
                {searchQuery ? "No matching records found" : "No debt records yet"}
              </Text>
              <Text className="text-xs text-slate text-center leading-5 max-w-[260px] mb-5">
                {searchQuery
                  ? "Try adjusting your search terms or filter tab."
                  : "Start recording borrowers and their loans to track repayment progress."}
              </Text>
              {!searchQuery && (
                <Pressable
                  className="py-3 px-5 rounded-full bg-bai active:opacity-90"
                  onPress={() => setIsBorrowerModalVisible(true)}
                >
                  <Text className="text-white font-bold text-sm">
                    + Add First Borrower
                  </Text>
                </Pressable>
              )}
            </View>
          }
          renderItem={({ item }) => {
            if (item.type === "borrower_only") {
              const tagMatch = item.borrower.notes?.match(/^\[(.*?)\]/);
              const tag = tagMatch ? tagMatch[1] : null;

              return (
                <Pressable
                  key={item.id}
                  style={{
                    backgroundColor: "#FFFFFF",
                    borderColor: "#A6D9B6",
                  }}
                  className="rounded-3xl p-4 border shadow-xs active:scale-[0.99] gap-3"
                  onPress={() => {
                    setSelectedBorrowerForLoan(item.borrower);
                    setIsLoanModalVisible(true);
                  }}
                >
                  <View className="flex-row justify-between items-start gap-2">
                    <View className="flex-1">
                      <Text className="text-[11px] font-bold text-slate uppercase tracking-wider">
                        Registered Borrower
                      </Text>
                      <Text
                        numberOfLines={1}
                        className="text-2xl font-black text-forest-900 tracking-tight mt-0.5"
                      >
                        {item.borrower.name}
                      </Text>
                    </View>

                    <View className="shrink-0">
                      <View
                        style={{ backgroundColor: "#E8F7EE", borderColor: "#A8DCC5" }}
                        className="px-2.5 py-1 rounded-full border flex-row items-center gap-1"
                      >
                        <Ionicons name="person" size={12} color="#15803D" />
                        <Text className="text-xs font-bold text-forest-900 uppercase">
                          No Loans Yet
                        </Text>
                      </View>
                    </View>
                  </View>

                  {(item.borrower.phone || item.borrower.address || tag) && (
                    <View className="border-t border-slate-100 pt-2 gap-1.5">
                      {tag && (
                        <View className="flex-row items-center gap-1 self-start px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200">
                          <Ionicons name="pricetag" size={11} color="#059669" />
                          <Text className="text-[10px] font-bold text-emerald-800">{tag}</Text>
                        </View>
                      )}
                      {item.borrower.phone && (
                        <View className="flex-row items-center gap-2">
                          <Ionicons name="call-outline" size={14} color="#66716D" />
                          <Text className="text-xs text-slate-700 font-semibold">
                            {item.borrower.phone}
                          </Text>
                        </View>
                      )}
                      {item.borrower.address && (
                        <View className="flex-row items-center gap-2">
                          <Ionicons name="location-outline" size={14} color="#66716D" />
                          <Text className="text-xs text-slate-600 font-medium">
                            {item.borrower.address}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  <Pressable
                    className="min-h-[44px] rounded-2xl bg-forest-900 items-center justify-center flex-row gap-2 active:bg-forest-900/90 shadow-xs"
                    onPress={() => {
                      setSelectedBorrowerForLoan(item.borrower);
                      setIsLoanModalVisible(true);
                    }}
                  >
                    <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
                    <Text className="text-white text-xs font-extrabold tracking-wide uppercase">
                      + Create Loan for {item.borrower.name}
                    </Text>
                  </Pressable>
                </Pressable>
              );
            }

            const { loan, borrower, balance } = item;
            const percentPaid = balance.totalOwedMinor > 0
              ? Math.min(100, Math.round((balance.totalPaidMinor / balance.totalOwedMinor) * 100))
              : 100;
            const dueInfo = getDueBadge(loan.due_date);

            // Extract tag e.g. [Suki]
            const tagMatch = borrower?.notes?.match(/^\[(.*?)\]/);
            const tag = tagMatch ? tagMatch[1] : null;

            const dividerBorder = balance.isOverdue
              ? "border-red-200/60"
              : balance.isPaid
                ? "border-emerald-200/60"
                : "border-slate-100";

            return (
              <Pressable
                key={loan.id}
                style={{
                  backgroundColor: balance.isOverdue
                    ? "#FEF2F2"
                    : balance.isPaid
                      ? "#F0FDF4"
                      : "#FFFFFF",
                  borderColor: balance.isOverdue
                    ? "#F87171"
                    : balance.isPaid
                      ? "#4ADE80"
                      : "#A6D9B6",
                }}
                className="rounded-3xl p-4 border shadow-xs active:scale-[0.99] gap-3"
                onPress={() => handleOpenDetail(loan)}
              >
                {/* Header: Remaining Amount + Status Badge */}
                <View className="flex-row justify-between items-start gap-2">
                  <View className="flex-1">
                    <Text numberOfLines={1} className="text-[11px] font-bold text-slate uppercase tracking-wider">
                      Remaining Balance
                    </Text>
                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      className={`text-2xl font-black tracking-tight mt-0.5 ${
                        balance.isOverdue
                          ? "text-red-900"
                          : balance.isPaid
                            ? "text-emerald-800"
                            : "text-forest-900"
                      }`}
                    >
                      {formatPHP(balance.remainingBalanceMinor)}
                    </Text>
                  </View>

                  {/* Status Pill */}
                  <View className="shrink-0">
                    {balance.isPaid ? (
                      <View
                        style={{ backgroundColor: "#DCFCE7", borderColor: "#86EFAC" }}
                        className="px-2.5 py-1 rounded-full border flex-row items-center gap-1"
                      >
                        <Ionicons name="checkmark-circle" size={13} color="#15803D" />
                        <Text numberOfLines={1} className="text-xs font-black text-emerald-900 uppercase">
                          Fully Paid
                        </Text>
                      </View>
                    ) : balance.isOverdue ? (
                      <View
                        style={{ backgroundColor: "#FEE2E2", borderColor: "#EF4444" }}
                        className="px-2.5 py-1 rounded-full border flex-row items-center gap-1"
                      >
                        <Ionicons name="alert-circle" size={13} color="#B91C1C" />
                        <Text numberOfLines={1} className="text-xs font-black text-red-800 uppercase">
                          {dueInfo.text}
                        </Text>
                      </View>
                    ) : balance.totalPaidMinor > 0 ? (
                      <View
                        style={{ backgroundColor: "#FEF3C7", borderColor: "#F59E0B" }}
                        className="px-2.5 py-1 rounded-full border"
                      >
                        <Text numberOfLines={1} className="text-xs font-black text-amber-900 uppercase">
                          Partial ({percentPaid}%)
                        </Text>
                      </View>
                    ) : (
                      <View
                        style={{ backgroundColor: "#E8F7EE", borderColor: "#A8DCC5" }}
                        className="px-2.5 py-1 rounded-full border"
                      >
                        <Text numberOfLines={1} className="text-xs font-bold text-forest-900 uppercase">
                          {dueInfo.text}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Progress Bar Row */}
                <View className="gap-1">
                  <View
                    className={`h-2 rounded-full overflow-hidden ${
                      balance.isOverdue
                        ? "bg-red-200/50"
                        : balance.isPaid
                          ? "bg-emerald-200/50"
                          : "bg-forest-900/10"
                    }`}
                  >
                    <View
                      className="h-full rounded-full bg-bai"
                      style={{ width: `${percentPaid}%` }}
                    />
                  </View>
                  <View className="flex-row justify-between items-center px-0.5">
                    <Text numberOfLines={1} className="text-xs font-semibold text-slate">
                      Paid: <Text className="font-bold text-forest-900">{formatPHP(balance.totalPaidMinor)}</Text>
                    </Text>
                    <Text numberOfLines={1} className="text-xs font-black text-bai">
                      {percentPaid}% Repaid
                    </Text>
                  </View>
                </View>

                {/* Receipt-style Key-Value Rows */}
                <View className={`border-t ${dividerBorder} mt-1`}>
                  {/* Borrower Row */}
                  <View className={`flex-row justify-between items-center py-2.5 border-b ${dividerBorder}`}>
                    <Text numberOfLines={1} className="text-xs text-slate-500 font-semibold shrink-0 mr-2">
                      Borrower
                    </Text>
                    <View className="flex-row items-center gap-1.5 flex-1 justify-end overflow-hidden">
                      <Text
                        numberOfLines={1}
                        ellipsizeMode="tail"
                        className={`text-sm font-black shrink-1 ${
                          balance.isOverdue
                            ? "text-red-950"
                            : balance.isPaid
                              ? "text-emerald-950"
                              : "text-ink"
                        }`}
                      >
                        {borrower?.name || "Unknown Borrower"}
                      </Text>
                      {tag && (
                        <View
                          style={{
                            backgroundColor: balance.isOverdue
                              ? "#FEE2E2"
                              : balance.isPaid
                                ? "#DCFCE7"
                                : "#E8F7EE",
                          }}
                          className="px-1.5 py-0.5 rounded shrink-0"
                        >
                          <Text
                            numberOfLines={1}
                            className={`text-[10px] font-black ${
                              balance.isOverdue
                                ? "text-red-800"
                                : balance.isPaid
                                  ? "text-emerald-800"
                                  : "text-forest-900"
                            }`}
                          >
                            {tag}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Date Lent Row */}
                  <View className={`flex-row justify-between items-center py-2.5 border-b ${dividerBorder}`}>
                    <Text numberOfLines={1} className="text-xs text-slate-500 font-semibold shrink-0 mr-2">
                      Date Lent
                    </Text>
                    <Text numberOfLines={1} className="text-sm font-bold text-ink">
                      {loan.loan_date}
                    </Text>
                  </View>

                  {/* Due Date Row */}
                  <View className={`flex-row justify-between items-center py-2.5 border-b ${dividerBorder}`}>
                    <Text numberOfLines={1} className="text-xs text-slate-500 font-semibold shrink-0 mr-2">
                      Due Date
                    </Text>
                    <Text
                      numberOfLines={1}
                      className={`text-sm font-bold ${
                        balance.isOverdue ? "text-red-700 font-black" : "text-ink"
                      }`}
                    >
                      {loan.due_date || "No due date"}
                    </Text>
                  </View>

                  {/* Total Owed Row */}
                  <View className={`flex-row justify-between items-center py-2.5 border-b ${dividerBorder}`}>
                    <Text numberOfLines={1} className="text-xs text-slate-500 font-semibold shrink-0 mr-2">
                      Total Owed
                    </Text>
                    <Text numberOfLines={1} className="text-sm font-black text-ink">
                      {formatPHP(balance.totalOwedMinor)}
                    </Text>
                  </View>
                </View>

                {/* Footer Action Buttons */}
                <View className="flex-row gap-2.5 pt-1.5">
                  <Pressable
                    className="flex-1 py-3 rounded-2xl border border-border items-center justify-center bg-white/80 active:bg-white"
                    onPress={() => handleOpenDetail(loan)}
                  >
                    <Text className="text-sm font-extrabold text-forest-900">
                      View Details
                    </Text>
                  </Pressable>

                  {!balance.isPaid && (
                    <Pressable
                      className="flex-1 py-3 rounded-2xl bg-bai items-center justify-center flex-row gap-2 active:opacity-90 shadow-xs"
                      onPress={(e) => {
                        e.stopPropagation();
                        handleOpenPay(loan);
                      }}
                    >
                      <Ionicons name="cash-outline" size={16} color="#FFFFFF" />
                      <Text className="text-sm font-extrabold text-white">
                        Record Pay
                      </Text>
                    </Pressable>
                  )}
                </View>
              </Pressable>
            );
          }}
        />

        {/* Add Borrower Modal */}
        <BorrowerFormModal
          visible={isBorrowerModalVisible}
          onClose={() => {
            setIsBorrowerModalVisible(false);
            loadData();
          }}
          onSuccess={() => loadData()}
        />

        {/* Create Loan Modal */}
        <LoanFormModal
          visible={isLoanModalVisible}
          borrowers={borrowers}
          initialBorrowerId={selectedBorrowerForLoan?.id}
          onClose={() => {
            setIsLoanModalVisible(false);
            setSelectedBorrowerForLoan(null);
            loadData();
          }}
          onSuccess={() => loadData()}
          onAddBorrowerPress={() => {
            setIsLoanModalVisible(false);
            setIsBorrowerModalVisible(true);
          }}
        />

        {/* Loan Detail Modal */}
        <LoanDetailModal
          visible={isDetailModalVisible}
          onClose={() => {
            setIsDetailModalVisible(false);
            loadData();
          }}
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
          onDeleteLoan={handleDeleteLoan}
        />

        {/* Payment Form Modal */}
        <PaymentFormModal
          visible={isPayModalVisible}
          loan={selectedLoanForPay}
          borrowerName={
            selectedLoanForPay
              ? borrowerMap.get(selectedLoanForPay.borrower_id)?.name
              : undefined
          }
          allPayments={payments}
          onClose={() => {
            setIsPayModalVisible(false);
            loadData();
          }}
          onSuccess={() => loadData()}
        />
      </SafeAreaView>
    </View>
  );
}
