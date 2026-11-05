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
import { useLocalSearchParams, useFocusEffect, useRouter, useNavigation } from "expo-router";
import { formatPHP } from "@/services/interest/calculateInterest";
import { calculateLoanBalance } from "@/services/balance/calculateBalance";
import { getLocalDateString, parseLocalDate } from "@/services/date/dateUtils";
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
type SortOrder = "newest" | "highest" | "due_soon" | "oldest";

const SORT_CYCLE: SortOrder[] = ["newest", "highest", "due_soon", "oldest"];
const SORT_LABELS: Record<SortOrder, string> = {
  newest: "Newest",
  highest: "Amount",
  due_soon: "Due Date",
  oldest: "Oldest",
};

function getInitials(name?: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

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

function formatShortDate(dateStr?: string | null): string {
  if (!dateStr) return "";
  const d = parseLocalDate(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const currentYear = new Date().getFullYear();
  const month = SHORT_MONTHS[d.getMonth()];
  const day = d.getDate();
  return d.getFullYear() === currentYear
    ? `${month} ${day}`
    : `${month} ${day}, '${String(d.getFullYear()).slice(-2)}`;
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
  const navigation = useNavigation<any>();
  const router = useRouter();
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
  const [editingBorrower, setEditingBorrower] = useState<Borrower | null>(null);
  const [isPayModalVisible, setIsPayModalVisible] = useState(false);
  const [selectedLoanForPay, setSelectedLoanForPay] = useState<Loan | null>(
    null,
  );
  const [isLoanModalVisible, setIsLoanModalVisible] = useState(false);
  const [selectedBorrowerForLoan, setSelectedBorrowerForLoan] =
    useState<Borrower | null>(null);

  // Detail Modal
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
  const [selectedLoanForDetail, setSelectedLoanForDetail] =
    useState<Loan | null>(null);

  useEffect(() => {
    if (params.action === "new_borrower") {
      setEditingBorrower(null);
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
      const loanPayments = payments.filter(
        (p) => p.loan_id === loan.id && !p.deleted_at,
      );
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

  const allDirectoryItems: DirectoryItem[] = [
    ...loansData,
    ...borrowerOnlyData,
  ];

  // Calculate high-level stats
  const activeDebtsCount = loansData.filter(
    (i) => i.type === "loan" && !i.balance.isPaid,
  ).length;
  const overdueDebtsCount = loansData.filter(
    (i) => i.type === "loan" && i.balance.isOverdue,
  ).length;
  const totalOutstandingMinor = loansData.reduce(
    (sum, i) => sum + (i.type === "loan" ? i.balance.remainingBalanceMinor : 0),
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

  // Sort items
  const sortedAndFilteredItems = [...filteredItems].sort((a, b) => {
    if (sortOrder === "highest") {
      const balA = a.type === "loan" ? a.balance.remainingBalanceMinor : -1;
      const balB = b.type === "loan" ? b.balance.remainingBalanceMinor : -1;
      if (balB !== balA) return balB - balA;
    } else if (sortOrder === "due_soon") {
      const dueA =
        a.type === "loan" && !a.balance.isPaid && a.loan.due_date
          ? new Date(a.loan.due_date).getTime()
          : Number.MAX_SAFE_INTEGER;
      const dueB =
        b.type === "loan" && !b.balance.isPaid && b.loan.due_date
          ? new Date(b.loan.due_date).getTime()
          : Number.MAX_SAFE_INTEGER;
      if (dueA !== dueB) return dueA - dueB;
    }
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();
    return sortOrder === "oldest" ? dateA - dateB : dateB - dateA;
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

          <View className="flex-row items-center gap-2">
            <Pressable
              className="flex-row items-center gap-1.5 py-2 px-3.5 rounded-full bg-bai active:opacity-90 shadow-xs"
              onPress={() => {
                setEditingBorrower(null);
                setIsBorrowerModalVisible(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="Add new borrower"
            >
              <Ionicons name="person-add" size={15} color="#FFFFFF" />
              <Text className="text-white font-bold text-xs tracking-wide uppercase">
                Add Debtor
              </Text>
            </Pressable>

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
          </View>
        </View>

        {/* Main List */}
        <FlatList
          data={sortedAndFilteredItems}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <View className="mb-3 gap-3.5">
              {/* Summary Banner */}
              <View className="rounded-3xl p-5 bg-forest-900 shadow-xs">
                <View className="flex-row items-center justify-between mb-3.5">
                  <View className="flex-1">
                    <Text className="text-white text-2xl font-black tracking-tight">
                      Borrower Ledger
                    </Text>
                    <Text className="text-mint/80 text-xs font-medium mt-1">
                      {borrowers.length}{" "}
                      {borrowers.length === 1 ? "debtor" : "debtors"} •{" "}
                      {activeDebtsCount} active{" "}
                      {activeDebtsCount === 1 ? "loan" : "loans"}
                    </Text>
                  </View>
                  <Frog mood="borrower" size={56} />
                </View>

                <View className="flex-row items-center pt-3.5 border-t border-white/15">
                  <View className="flex-1">
                    <Text className="text-mint/80 text-xs font-semibold">
                      Remaining Balance
                    </Text>
                    <Text
                      style={{ fontVariant: ["tabular-nums"] }}
                      className="text-emerald-400 text-xl font-black mt-0.5"
                    >
                      {formatPHP(totalOutstandingMinor)}
                    </Text>
                  </View>
                  <View className="w-px h-8 bg-white/15 mx-4" />
                  <View>
                    <Text className="text-mint/80 text-xs font-semibold">
                      Active
                    </Text>
                    <Text
                      style={{ fontVariant: ["tabular-nums"] }}
                      className="text-white text-lg font-bold mt-0.5"
                    >
                      {activeDebtsCount}
                    </Text>
                  </View>
                  {overdueDebtsCount > 0 && (
                    <>
                      <View className="w-px h-8 bg-white/15 mx-4" />
                      <View>
                        <Text className="text-amber-300 text-xs font-semibold">
                          Overdue
                        </Text>
                        <Text
                          style={{ fontVariant: ["tabular-nums"] }}
                          className="text-amber-400 text-lg font-bold mt-0.5"
                        >
                          {overdueDebtsCount}
                        </Text>
                      </View>
                    </>
                  )}
                </View>
              </View>

              {/* Search Bar + Sort Action (Matched Height, Fixed Sort Width) */}
              <View className="flex-row items-center gap-2">
                <View className="flex-1 h-11 flex-row items-center px-3.5 rounded-xl bg-white border border-border shadow-xs">
                  <Ionicons
                    name="search"
                    size={17}
                    color="#66716D"
                    style={{ marginRight: 8 }}
                  />
                  <TextInput
                    placeholder="Search name, phone, notes..."
                    placeholderTextColor="#66716D"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    className="flex-1 text-sm text-ink font-medium"
                    clearButtonMode="while-editing"
                  />
                  {searchQuery.length > 0 && (
                    <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
                      <Ionicons name="close-circle" size={17} color="#66716D" />
                    </Pressable>
                  )}
                </View>

                {/* Sort Button (Fixed 108px width so size never jumps on cycle) */}
                <Pressable
                  onPress={() =>
                    setSortOrder((prev) => {
                      const nextIdx =
                        (SORT_CYCLE.indexOf(prev) + 1) % SORT_CYCLE.length;
                      return SORT_CYCLE[nextIdx];
                    })
                  }
                  className="h-11 w-[108px] rounded-xl bg-white border border-border shadow-xs flex-row items-center justify-center gap-1.5 active:bg-slate-50"
                  accessibilityRole="button"
                  accessibilityLabel={`Sort by ${SORT_LABELS[sortOrder]}`}
                >
                  <Ionicons name="swap-vertical" size={15} color="#173D35" />
                  <Text
                    numberOfLines={1}
                    className="text-xs font-extrabold text-forest-900"
                  >
                    {SORT_LABELS[sortOrder]}
                  </Text>
                </Pressable>
              </View>

              {/* Equal-Width Filter Chips Row (Fill Full Width) */}
              <View className="flex-row items-center gap-1.5">
                {[
                  {
                    key: "all" as const,
                    label: "All",
                    count: loansData.length,
                    isAlert: false,
                  },
                  {
                    key: "active" as const,
                    label: "Active",
                    count: activeDebtsCount,
                    isAlert: false,
                  },
                  {
                    key: "overdue" as const,
                    label: "Overdue",
                    count: overdueDebtsCount,
                    isAlert: overdueDebtsCount > 0,
                  },
                  {
                    key: "paid" as const,
                    label: "Settled",
                    count: null,
                    isAlert: false,
                  },
                ].map((chip) => {
                  const isSelected = filterStatus === chip.key;
                  return (
                    <Pressable
                      key={chip.key}
                      onPress={() => setFilterStatus(chip.key)}
                      style={[
                        styles.filterChip,
                        isSelected
                          ? styles.chipSelected
                          : chip.isAlert
                            ? styles.chipAlert
                            : styles.chipDefault,
                      ]}
                    >
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.chipText,
                          isSelected
                            ? styles.chipTextSelected
                            : chip.isAlert
                              ? styles.chipTextAlert
                              : styles.chipTextDefault,
                        ]}
                      >
                        {chip.label}
                      </Text>

                      {chip.count !== null && chip.count > 0 && (
                        <View
                          style={[
                            styles.badge,
                            isSelected
                              ? styles.badgeSelected
                              : chip.isAlert
                                ? styles.badgeAlert
                                : styles.badgeDefault,
                          ]}
                        >
                          <Text
                            style={[
                              styles.badgeText,
                              isSelected
                                ? styles.badgeTextSelected
                                : chip.isAlert
                                  ? styles.badgeTextAlert
                                  : styles.badgeTextDefault,
                            ]}
                          >
                            {chip.count}
                          </Text>
                        </View>
                      )}
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
                !isBorrowerModalVisible &&
                !isDetailModalVisible &&
                !isPayModalVisible
              }
            />
          }
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: 100,
            gap: 16,
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
                {searchQuery
                  ? "No matching records found"
                  : "No debt records yet"}
              </Text>
              <Text className="text-xs text-slate text-center leading-5 max-w-[260px] mb-5">
                {searchQuery
                  ? "Try adjusting your search terms or filter tab."
                  : "Start recording borrowers and their loans to track repayment progress."}
              </Text>
              {!searchQuery && (
                <Pressable
                  className="py-3 px-5 rounded-full bg-bai active:opacity-90"
                  onPress={() => {
                    setEditingBorrower(null);
                    setIsBorrowerModalVisible(true);
                  }}
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
              const initials = getInitials(item.borrower.name);
              const metaParts = [
                item.borrower.phone,
                item.borrower.address,
              ].filter(Boolean);

              return (
                <View
                  key={item.id}
                  className="rounded-3xl p-5 bg-white border border-border shadow-xs gap-4 relative overflow-hidden"
                >
                  {/* Docked Top-Right Corner Status Badge */}
                  <View className="absolute top-0 right-0 px-3.5 py-1.5 rounded-bl-2xl bg-mint/40 border-b border-l border-border flex-row items-center gap-1.5">
                    <Ionicons name="person" size={12} color="#173D35" />
                    <Text className="text-[11px] font-extrabold text-forest-900 uppercase tracking-wide">
                      No Loan Yet
                    </Text>
                  </View>

                  <View className="flex-row items-center gap-3.5 pr-28">
                    {/* Avatar */}
                    <View className="w-12 h-12 rounded-full bg-mint/40 border border-border items-center justify-center shrink-0">
                      <Text className="text-base font-black text-forest-900">
                        {initials}
                      </Text>
                    </View>

                    {/* Identity & Contact */}
                    <View className="flex-1 overflow-hidden">
                      <View className="flex-row items-center gap-2">
                        <Text
                          numberOfLines={1}
                          className="text-lg font-extrabold text-ink shrink"
                        >
                          {item.borrower.name}
                        </Text>
                        {tag && (
                          <View className="px-2 py-0.5 rounded-md bg-mint/40 border border-border shrink-0">
                            <Text className="text-[11px] font-bold text-forest-900">
                              {tag}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text
                        numberOfLines={1}
                        className="text-xs text-slate font-medium mt-1"
                      >
                        {metaParts.length > 0
                          ? metaParts.join(" • ")
                          : "Registered borrower"}
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row items-center gap-2.5">
                    <Pressable
                      className="w-11 h-11 rounded-2xl border border-border bg-mint/20 items-center justify-center active:bg-mint/40 shrink-0"
                      onPress={() => {
                        setEditingBorrower(item.borrower);
                        setIsBorrowerModalVisible(true);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Edit ${item.borrower.name}`}
                    >
                      <Ionicons
                        name="create-outline"
                        size={18}
                        color="#173D35"
                      />
                    </Pressable>

                    <Pressable
                      className="flex-1 py-3 px-4 rounded-2xl bg-forest-900 flex-row items-center justify-center gap-2 active:opacity-90"
                      onPress={() => {
                        setSelectedBorrowerForLoan(item.borrower);
                        setIsLoanModalVisible(true);
                      }}
                    >
                      <Ionicons
                        name="add-circle-outline"
                        size={17}
                        color="#FFFFFF"
                      />
                      <Text className="text-white text-xs font-extrabold tracking-wide uppercase">
                        Create Loan
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            }

            const { loan, borrower, balance } = item;
            const percentPaid =
              balance.totalOwedMinor > 0
                ? Math.min(
                    100,
                    Math.round(
                      (balance.totalPaidMinor / balance.totalOwedMinor) * 100,
                    ),
                  )
                : 100;
            const dueInfo = getDueBadge(loan.due_date);
            const borrowerName = borrower?.name || "Unknown Borrower";
            const initials = getInitials(borrowerName);
            const interestBadge = formatInterestBadge(loan);

            const tagMatch = borrower?.notes?.match(/^\[(.*?)\]/);
            const tag = tagMatch ? tagMatch[1] : null;

            return (
              <View
                key={loan.id}
                className="rounded-3xl p-5 bg-white border border-border shadow-xs gap-4 relative overflow-hidden"
              >
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

                {/* Zone 1: Borrower Identity */}
                <View className="flex-row items-center gap-3.5 pr-28">
                  <View
                    className="w-12 h-12 rounded-full items-center justify-center border shrink-0"
                    style={{
                      backgroundColor: balance.isOverdue
                        ? "#FEF2F2"
                        : balance.isPaid
                          ? "#ECFDF5"
                          : "rgba(205, 245, 216, 0.4)",
                      borderColor: balance.isOverdue
                        ? "#FECACA"
                        : balance.isPaid
                          ? "#A7F3D0"
                          : "#D4E8DC",
                    }}
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
                      {initials}
                    </Text>
                  </View>

                  <View className="flex-1 overflow-hidden">
                    <View className="flex-row items-center gap-2">
                      <Text
                        numberOfLines={1}
                        className="text-lg font-extrabold text-ink shrink"
                      >
                        {borrowerName}
                      </Text>
                    </View>
                    <Text
                      numberOfLines={1}
                      className="text-xs text-slate font-medium mt-1"
                    >
                      Lent {formatShortDate(loan.loan_date)}
                      {loan.due_date
                        ? `  •  Due ${formatShortDate(loan.due_date)}`
                        : ""}
                    </Text>
                  </View>
                </View>

                {/* Zone 2: Financial Summary Box */}
                <View className="rounded-2xl p-4 bg-slate-50 border border-slate-100 gap-3">
                  <View className="flex-row items-end justify-between gap-2">
                    <View className="flex-1">
                      <View className="flex-row items-center gap-2">
                        <Text className="text-[11px] font-bold text-slate uppercase tracking-wider">
                          {balance.isPaid
                            ? "Total Settled"
                            : "Remaining Balance"}
                        </Text>
                        <View className="px-2 py-0.5 rounded-full bg-white border border-slate-200">
                          <Text className="text-[10px] font-extrabold text-forest-900">
                            {interestBadge}
                          </Text>
                        </View>
                      </View>
                      <Text
                        numberOfLines={1}
                        style={{ fontVariant: ["tabular-nums"] }}
                        className={`text-2xl font-black tracking-tight mt-0.5 ${
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

                    <View className="items-end shrink-0">
                      <Text className="text-[11px] font-semibold text-slate">
                        Total Owed
                      </Text>
                      <Text
                        style={{ fontVariant: ["tabular-nums"] }}
                        className="text-sm font-extrabold text-ink mt-0.5"
                      >
                        {formatPHP(balance.totalOwedMinor)}
                      </Text>
                    </View>
                  </View>

                  {/* Progress Track */}
                  <View className="gap-1.5">
                    <View className="h-2 rounded-full bg-slate-200 overflow-hidden">
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

                {/* Zone 3: Action Footer */}
                <View className="flex-row items-center gap-2.5">
                  {borrower && (
                    <Pressable
                      className="w-11 h-11 rounded-2xl border border-border bg-mint/20 items-center justify-center active:bg-mint/40 shrink-0"
                      onPress={() => {
                        setEditingBorrower(borrower);
                        setIsBorrowerModalVisible(true);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Edit ${borrowerName}`}
                    >
                      <Ionicons
                        name="create-outline"
                        size={18}
                        color="#173D35"
                      />
                    </Pressable>
                  )}

                  <Pressable
                    className="flex-1 py-3 rounded-2xl border border-border bg-white items-center justify-center active:bg-slate-50"
                    onPress={() => handleOpenDetail(loan)}
                  >
                    <Text className="text-xs font-extrabold text-forest-900">
                      View Details
                    </Text>
                  </Pressable>

                  {!balance.isPaid && (
                    <Pressable
                      className="flex-1 py-3 rounded-2xl bg-bai flex-row items-center justify-center gap-1.5 active:opacity-90"
                      onPress={() => {
                        handleOpenPay(loan);
                      }}
                    >
                      <Ionicons name="cash-outline" size={16} color="#FFFFFF" />
                      <Text className="text-xs font-extrabold text-white">
                        Record Pay
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
            );
          }}
        />

        {/* Add / Edit Borrower Modal */}
        {isBorrowerModalVisible && (
          <BorrowerFormModal
            visible={isBorrowerModalVisible}
            editingBorrower={editingBorrower}
            onClose={() => {
              setIsBorrowerModalVisible(false);
              setEditingBorrower(null);
              loadData();
            }}
            onSuccess={() => loadData()}
            onDelete={() => loadData()}
          />
        )}

        {/* Create Loan Modal */}
        {isLoanModalVisible && (
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
              setEditingBorrower(null);
              setIsBorrowerModalVisible(true);
            }}
          />
        )}

        {/* Loan Detail Modal */}
        {isDetailModalVisible && (
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
            onEditBorrower={(borrower) => {
              setIsDetailModalVisible(false);
              setEditingBorrower(borrower);
              setIsBorrowerModalVisible(true);
            }}
          />
        )}

        {/* Payment Form Modal */}
        {isPayModalVisible && (
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
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  filterChip: {
    flex: 1,
    height: 40,
    paddingHorizontal: 6,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  chipSelected: {
    backgroundColor: "#173D35",
    borderColor: "#173D35",
  },
  chipAlert: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  chipDefault: {
    backgroundColor: "#FFFFFF",
    borderColor: "#A6D9B6",
  },
  chipText: {
    fontSize: 12,
    fontWeight: "800",
  },
  chipTextSelected: {
    color: "#FFFFFF",
  },
  chipTextAlert: {
    color: "#B91C1C",
  },
  chipTextDefault: {
    color: "#173D35",
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  badgeSelected: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  badgeAlert: {
    backgroundColor: "rgba(254, 202, 202, 0.8)",
  },
  badgeDefault: {
    backgroundColor: "rgba(168, 220, 197, 0.4)",
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  badgeTextSelected: {
    color: "#FFFFFF",
  },
  badgeTextAlert: {
    color: "#991B1B",
  },
  badgeTextDefault: {
    color: "#173D35",
  },
});
