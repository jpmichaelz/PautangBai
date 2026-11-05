import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  Share,
  ActivityIndicator,
  StyleSheet,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSQLiteContext } from "expo-sqlite";
import { Ionicons } from "@expo/vector-icons";
import { borrowerHelper } from "@/db-helpers/borrowers";
import { loanHelper } from "@/db-helpers/loans";
import { paymentHelper } from "@/db-helpers/payments";
import { useRouter, useFocusEffect } from "expo-router";
import { Frog } from "@/components/frog";
import { syncStateHelper } from "@/services/sync/syncService";
import { seedSampleData } from "@/services/demo/seedSampleData";
import { formatPHP } from "@/services/interest/calculateInterest";
import DashboardBg from "@/assets/images/DASHBOARD_BG.svg";
import PautangBaiLogo from "@/assets/images/PAUTANGBAI_LOGO.svg";

type InterestTypePref =
  | "none"
  | "percentage_monthly"
  | "fixed_amount"
  | "percentage_weekly";
type TermDaysPref = "none" | "15" | "30" | "60";

export default function SettingsScreen() {
  const router = useRouter();
  const db = useSQLiteContext();

  const [stats, setStats] = useState({ borrowers: 0, loans: 0, payments: 0 });
  const [isSeeding, setIsSeeding] = useState(false);
  const [saveIndicator, setSaveIndicator] = useState(false);

  // Lending default preferences
  const [defaultInterestType, setDefaultInterestType] =
    useState<InterestTypePref>("none");
  const [defaultRate, setDefaultRate] = useState("5");
  const [defaultDueDays, setDefaultDueDays] = useState<TermDaysPref>("30");

  // Restore Modal State
  const [isRestoreModalVisible, setIsRestoreModalVisible] = useState(false);
  const [restoreJsonInput, setRestoreJsonInput] = useState("");
  const [isRestoring, setIsRestoring] = useState(false);

  const loadStatsAndPreferences = useCallback(async () => {
    try {
      const [b, l, p, savedType, savedRate, savedDueDays] = await Promise.all([
        borrowerHelper.getAll(db),
        loanHelper.getAll(db),
        paymentHelper.getAll(db),
        syncStateHelper.get(db, "pref_default_interest_type"),
        syncStateHelper.get(db, "pref_default_interest_rate"),
        syncStateHelper.get(db, "pref_default_due_days"),
      ]);

      setStats({ borrowers: b.length, loans: l.length, payments: p.length });

      if (savedType) setDefaultInterestType(savedType as InterestTypePref);
      if (savedRate) setDefaultRate(savedRate);
      if (savedDueDays) setDefaultDueDays(savedDueDays as TermDaysPref);
    } catch (err) {
      console.error("Failed to load settings data:", err);
    }
  }, [db]);

  useEffect(() => {
    loadStatsAndPreferences();
  }, [loadStatsAndPreferences]);

  useFocusEffect(
    useCallback(() => {
      loadStatsAndPreferences();
    }, [loadStatsAndPreferences]),
  );

  const triggerSaveFeedback = () => {
    setSaveIndicator(true);
    setTimeout(() => setSaveIndicator(false), 1500);
  };

  const handleUpdateInterestType = async (type: InterestTypePref) => {
    setDefaultInterestType(type);
    await syncStateHelper.set(db, "pref_default_interest_type", type);
    triggerSaveFeedback();
  };

  const handleUpdateRate = async (rate: string) => {
    const cleanRate = rate.replace(/[^0-9.]/g, "");
    setDefaultRate(cleanRate);
    await syncStateHelper.set(db, "pref_default_interest_rate", cleanRate);
    triggerSaveFeedback();
  };

  const handleUpdateDueDays = async (days: TermDaysPref) => {
    setDefaultDueDays(days);
    await syncStateHelper.set(db, "pref_default_due_days", days);
    triggerSaveFeedback();
  };

  const handleExportJSON = async () => {
    try {
      const [borrowers, loans, payments] = await Promise.all([
        borrowerHelper.getAll(db),
        loanHelper.getAll(db),
        paymentHelper.getAll(db),
      ]);

      const backupData = {
        app: "PautangBai",
        version: "1.0.0",
        schema: "v1",
        exportedAt: new Date().toISOString(),
        summary: {
          borrowers: borrowers.length,
          loans: loans.length,
          payments: payments.length,
        },
        borrowers,
        loans,
        payments,
      };

      const jsonString = JSON.stringify(backupData, null, 2);

      await Share.share({
        title: "PautangBai Full Backup",
        message: jsonString,
      });
    } catch (err) {
      console.error("Export failed:", err);
      Alert.alert("Export Failed", "Unable to export backup data.");
    }
  };

  const handleExportCSV = async () => {
    try {
      const [borrowers, loans] = await Promise.all([
        borrowerHelper.getAll(db),
        loanHelper.getAll(db),
      ]);

      let csv =
        "Borrower Name,Phone,Address,Principal,Interest Type,Interest Rate,Loan Date,Due Date,Status\n";
      const borrowerMap = new Map(borrowers.map((b) => [b.id, b]));

      loans.forEach((l) => {
        const b = borrowerMap.get(l.borrower_id);
        const name = (b?.name || "Unknown").replace(/"/g, '""');
        const phone = (b?.phone || "").replace(/"/g, '""');
        const address = (b?.address || "").replace(/"/g, '""');
        const formattedPrincipal = formatPHP(l.principal_minor).replace(
          /"/g,
          '""',
        );
        const rate = l.interest_rate ? `${l.interest_rate}%` : "0%";

        csv += `"${name}","${phone}","${address}","${formattedPrincipal}","${l.interest_type}","${rate}","${l.loan_date}","${l.due_date || "None"}","${l.status}"\n`;
      });

      await Share.share({
        title: "PautangBai Lending Book (CSV)",
        message: csv,
      });
    } catch (err) {
      console.error("CSV export failed:", err);
      Alert.alert("Export Failed", "Unable to export CSV spreadsheet.");
    }
  };

  const handleRestoreBackup = async () => {
    if (!restoreJsonInput.trim()) {
      Alert.alert(
        "Empty Input",
        "Please paste your PautangBai JSON backup content.",
      );
      return;
    }

    try {
      const parsed = JSON.parse(restoreJsonInput.trim());

      if (
        !parsed ||
        typeof parsed !== "object" ||
        !Array.isArray(parsed.borrowers) ||
        !Array.isArray(parsed.loans)
      ) {
        Alert.alert(
          "Invalid Format",
          "The pasted text is not a valid PautangBai backup JSON structure.",
        );
        return;
      }

      const borrowerCount = parsed.borrowers.length;
      const loanCount = parsed.loans.length;
      const paymentCount = Array.isArray(parsed.payments)
        ? parsed.payments.length
        : 0;

      Alert.alert(
        "Confirm Data Restore",
        `Backup file contains:\n• ${borrowerCount} Borrowers\n• ${loanCount} Loans\n• ${paymentCount} Payments\n\nRestoring will replace existing local records with this backup. Continue?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Restore All",
            style: "destructive",
            onPress: async () => {
              setIsRestoring(true);
              try {
                // Clear existing
                await db.execAsync(`
                  DELETE FROM payments;
                  DELETE FROM loans;
                  DELETE FROM borrowers;
                  DELETE FROM sync_queue;
                `);

                // Restore borrowers
                for (const b of parsed.borrowers) {
                  await db.runAsync(
                    `INSERT INTO borrowers (id, name, phone, email, address, notes, status, created_at, updated_at, deleted_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    b.id,
                    b.name,
                    b.phone ?? null,
                    b.email ?? null,
                    b.address ?? null,
                    b.notes ?? null,
                    b.status ?? "active",
                    b.created_at || new Date().toISOString(),
                    b.updated_at || new Date().toISOString(),
                    b.deleted_at ?? null,
                  );
                }

                // Restore loans
                for (const l of parsed.loans) {
                  await db.runAsync(
                    `INSERT INTO loans (id, borrower_id, principal_minor, currency, interest_type, fixed_charge_minor, interest_rate, interest_period, interest_start_date, loan_date, due_date, notes, status, created_at, updated_at, deleted_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    l.id,
                    l.borrower_id,
                    l.principal_minor,
                    l.currency ?? "PHP",
                    l.interest_type ?? "none",
                    l.fixed_charge_minor ?? 0,
                    l.interest_rate ?? null,
                    l.interest_period ?? null,
                    l.interest_start_date ?? null,
                    l.loan_date,
                    l.due_date ?? null,
                    l.notes ?? null,
                    l.status ?? "active",
                    l.created_at || new Date().toISOString(),
                    l.updated_at || new Date().toISOString(),
                    l.deleted_at ?? null,
                  );
                }

                // Restore payments
                if (Array.isArray(parsed.payments)) {
                  for (const p of parsed.payments) {
                    await db.runAsync(
                      `INSERT INTO payments (id, loan_id, amount_minor, payment_date, payment_method, reference, notes, allocation_json, sync_status, created_at, updated_at, deleted_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                      p.id,
                      p.loan_id,
                      p.amount_minor,
                      p.payment_date,
                      p.payment_method ?? null,
                      p.reference ?? null,
                      p.notes ?? null,
                      p.allocation_json ?? null,
                      p.sync_status ?? "pending",
                      p.created_at || new Date().toISOString(),
                      p.updated_at || new Date().toISOString(),
                      p.deleted_at ?? null,
                    );
                  }
                }

                await loadStatsAndPreferences();
                setIsRestoreModalVisible(false);
                setRestoreJsonInput("");
                Alert.alert(
                  "Restore Successful",
                  `Restored ${borrowerCount} borrowers and ${loanCount} loans.`,
                );
              } catch (restoreErr: any) {
                console.error("Restore failed:", restoreErr);
                Alert.alert(
                  "Restore Failed",
                  restoreErr?.message || "Error importing database records.",
                );
              } finally {
                setIsRestoring(false);
              }
            },
          },
        ],
      );
    } catch (jsonErr) {
      Alert.alert(
        "Invalid JSON",
        "Could not parse the pasted text as JSON. Check for truncation.",
      );
    }
  };

  const handleShowRecoveryGuide = () => {
    Alert.alert(
      "Offline Data & Safety Guide",
      "1. 100% Private on Device:\nYour records are stored securely in SQLite on this phone. No server or internet connection is required.\n\n" +
        "2. Export Excel / CSV:\nExport a human-readable spreadsheet anytime to share with business partners or print.\n\n" +
        "3. JSON Backup & Restore:\nExport your full database before switching phones. You can paste the JSON into a new install to restore all data instantly.",
      [{ text: "Understood" }],
    );
  };

  const handleLoadSampleData = async () => {
    if (isSeeding) return;
    setIsSeeding(true);
    try {
      await seedSampleData(db);
      await loadStatsAndPreferences();

      Alert.alert(
        "Demo Data Ready",
        "Loaded 4 sample borrowers:\n• Maria Santos (₱5,000 - Partial)\n• Juan dela Cruz (₱3,000 - Overdue)\n• Nanay Gloria (₱10,000 - Active)\n• Kuya Cardo (₱2,000 - Fully Paid)",
        [
          { text: "View Home", onPress: () => router.navigate("/") },
          { text: "Done", style: "cancel" },
        ],
      );
    } catch (err: any) {
      console.error("Failed to seed sample data:", err);
      Alert.alert("Error", err?.message || "Failed to load sample data.");
    } finally {
      setIsSeeding(false);
    }
  };

  const handleClearLocalData = () => {
    Alert.alert(
      "Erase Local Database?",
      "This will permanently delete all borrowers, loans, and payments stored on this device. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, Erase Everything",
          style: "destructive",
          onPress: async () => {
            try {
              await db.execAsync(`
                DELETE FROM payments;
                DELETE FROM loans;
                DELETE FROM borrowers;
                DELETE FROM sync_queue;
                DELETE FROM sync_state WHERE key NOT LIKE 'pref_%';
              `);
              await loadStatsAndPreferences();
              Alert.alert(
                "Database Reset",
                "All borrower and loan records have been erased.",
              );
            } catch (err: any) {
              Alert.alert(
                "Error",
                err?.message || "Failed to clear local database.",
              );
            }
          },
        },
      ],
    );
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
        {/* Top App Header */}
        <View className="flex-row justify-between items-center px-4 pt-3 pb-2">
          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.navigate("/");
                }
              }}
              hitSlop={8}
              className="w-9 h-9 rounded-full bg-white border border-border items-center justify-center active:opacity-75 shadow-xs"
              accessibilityLabel="Back to previous screen"
            >
              <Ionicons name="arrow-back" size={20} color="#173D35" />
            </Pressable>
            <PautangBaiLogo width={125} height={38} />
          </View>

          {/* Offline Chip Badge */}
          <View className="flex-row items-center px-2.5 py-1 rounded-full bg-emerald-100/90 border border-emerald-300 gap-1.5 shadow-xs">
            <View className="w-2 h-2 rounded-full bg-emerald-600" />
            <Text className="text-[11px] font-extrabold text-emerald-900 tracking-tight">
              100% Offline · SQLite
            </Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: 110,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Main Hero Card */}
          <View className="rounded-3xl p-5 bg-forest-900 shadow-md mb-4">
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center px-2.5 py-0.5 rounded-full bg-white/10 self-start">
                <Text className="text-mint text-[10px] font-black tracking-widest uppercase">
                  APP PREFERENCES & DATA VAULT
                </Text>
              </View>

              {saveIndicator && (
                <View className="flex-row items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20">
                  <Ionicons name="checkmark-circle" size={12} color="#A8DCC5" />
                  <Text className="text-mint text-[10px] font-bold">Saved</Text>
                </View>
              )}
            </View>

            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-1 pr-2">
                <Text className="text-white text-2xl font-black tracking-tight">
                  Settings
                </Text>
                <Text className="text-slate-300 text-xs font-medium mt-0.5">
                  Private on-device ledger · Zero server needed
                </Text>
              </View>
              <Frog mood="offline" size={64} />
            </View>

            {/* Record Metrics Strip */}
            <View className="flex-row pt-3.5 border-t border-white/15">
              <View className="flex-1 items-center">
                <Text className="text-mint text-[10px] font-bold uppercase tracking-wider mb-0.5">
                  Borrowers
                </Text>
                <Text className="text-white text-lg font-black tracking-tight">
                  {stats.borrowers}
                </Text>
              </View>
              <View className="w-px bg-white/15 h-8 self-center" />
              <View className="flex-1 items-center">
                <Text className="text-mint text-[10px] font-bold uppercase tracking-wider mb-0.5">
                  Loans
                </Text>
                <Text className="text-white text-lg font-black tracking-tight">
                  {stats.loans}
                </Text>
              </View>
              <View className="w-px bg-white/15 h-8 self-center" />
              <View className="flex-1 items-center">
                <Text className="text-mint text-[10px] font-bold uppercase tracking-wider mb-0.5">
                  Payments
                </Text>
                <Text className="text-white text-lg font-black tracking-tight">
                  {stats.payments}
                </Text>
              </View>
            </View>
          </View>

          {/* Section: Lending Defaults */}
          <View className="flex-row items-center gap-1.5 mt-2 mb-2 ml-1">
            <View className="w-1.5 h-1.5 rounded-full bg-forest-900/40" />
            <Text className="text-[11px] font-black text-forest-900/70 tracking-widest uppercase">
              LENDING DEFAULTS
            </Text>
          </View>

          <View className="rounded-3xl bg-white border border-forest-900/10 p-4 shadow-xs mb-4">
            <Text className="text-xs font-bold text-slate mb-2">
              Default Interest Calculation
            </Text>
            <View className="flex-row flex-wrap gap-2 mb-3.5">
              {[
                { id: "none", label: "No Interest (0%)" },
                { id: "percentage_monthly", label: "Monthly %" },
                { id: "fixed_amount", label: "Fixed Fee (₱)" },
                { id: "percentage_weekly", label: "Weekly %" },
              ].map((opt) => {
                const isSelected = defaultInterestType === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() =>
                      handleUpdateInterestType(opt.id as InterestTypePref)
                    }
                    className={`px-3 py-2 rounded-xl border flex-row items-center gap-1.5 ${
                      isSelected
                        ? "bg-forest-900 border-forest-900"
                        : "bg-slate-50 border-border"
                    }`}
                  >
                    {isSelected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={14}
                        color="#A8DCC5"
                      />
                    )}
                    <Text
                      className={`text-xs font-bold ${
                        isSelected ? "text-white" : "text-forest-900"
                      }`}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Interest Rate Selector (Visible when percentage is selected) */}
            {(defaultInterestType === "percentage_monthly" ||
              defaultInterestType === "percentage_weekly") && (
              <View className="pt-3 border-t border-border/70 mb-3.5">
                <Text className="text-xs font-bold text-slate mb-2">
                  Default Interest Percentage
                </Text>
                <View className="flex-row items-center gap-2">
                  {["3", "5", "10", "20"].map((rate) => {
                    const isSelected = defaultRate === rate;
                    return (
                      <Pressable
                        key={rate}
                        onPress={() => handleUpdateRate(rate)}
                        className={`flex-1 py-2 rounded-xl border items-center justify-center ${
                          isSelected
                            ? "bg-forest-900 border-forest-900"
                            : "bg-slate-50 border-border"
                        }`}
                      >
                        <Text
                          className={`text-xs font-black ${
                            isSelected ? "text-white" : "text-forest-900"
                          }`}
                        >
                          {rate}%
                        </Text>
                      </Pressable>
                    );
                  })}
                  <View className="w-20 px-2.5 py-1.5 rounded-xl border border-border bg-slate-50 flex-row items-center">
                    <TextInput
                      value={defaultRate}
                      onChangeText={handleUpdateRate}
                      keyboardType="numeric"
                      maxLength={4}
                      className="flex-1 text-xs font-bold text-ink p-0 text-center"
                      placeholder="Custom"
                    />
                    <Text className="text-xs font-bold text-slate ml-0.5">
                      %
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Default Due Date Duration */}
            <View className="pt-3 border-t border-border/70">
              <Text className="text-xs font-bold text-slate mb-2">
                Default Repayment Period
              </Text>
              <View className="flex-row gap-2">
                {[
                  { id: "15", label: "15 Days" },
                  { id: "30", label: "30 Days" },
                  { id: "60", label: "60 Days" },
                  { id: "none", label: "No Due Date" },
                ].map((term) => {
                  const isSelected = defaultDueDays === term.id;
                  return (
                    <Pressable
                      key={term.id}
                      onPress={() =>
                        handleUpdateDueDays(term.id as TermDaysPref)
                      }
                      className={`flex-1 py-2 rounded-xl border items-center justify-center ${
                        isSelected
                          ? "bg-forest-900 border-forest-900"
                          : "bg-slate-50 border-border"
                      }`}
                    >
                      <Text
                        className={`text-[11px] font-bold ${
                          isSelected ? "text-white" : "text-forest-900"
                        }`}
                      >
                        {term.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          {/* Section: Data Vault & Backups */}
          <View className="flex-row items-center gap-1.5 mt-2 mb-2 ml-1">
            <View className="w-1.5 h-1.5 rounded-full bg-forest-900/40" />
            <Text className="text-[11px] font-black text-forest-900/70 tracking-widest uppercase">
              DATA VAULT & BACKUPS
            </Text>
          </View>

          <View className="rounded-3xl bg-white border border-forest-900/10 overflow-hidden shadow-xs mb-4">
            {/* CSV Export */}
            <Pressable
              className="flex-row items-center px-4 py-3.5 gap-3.5 active:bg-slate-50 min-h-[58px]"
              onPress={handleExportCSV}
            >
              <View className="w-10 h-10 rounded-2xl bg-emerald-500/10 items-center justify-center">
                <Ionicons
                  name="document-text-outline"
                  size={21}
                  color="#16A34A"
                />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-ink">
                  Export Excel / CSV
                </Text>
                <Text className="text-xs text-slate mt-0.5">
                  Shareable spreadsheet of debtors, loans & balances
                </Text>
              </View>
              <View className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200">
                <Text className="text-[10px] font-extrabold text-emerald-800">
                  CSV
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </Pressable>

            <View className="h-px bg-border/60 mx-4" />

            {/* JSON Export */}
            <Pressable
              className="flex-row items-center px-4 py-3.5 gap-3.5 active:bg-slate-50 min-h-[58px]"
              onPress={handleExportJSON}
            >
              <View className="w-10 h-10 rounded-2xl bg-blue-500/10 items-center justify-center">
                <Ionicons
                  name="cloud-download-outline"
                  size={21}
                  color="#2563EB"
                />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-ink">
                  Export Full JSON Backup
                </Text>
                <Text className="text-xs text-slate mt-0.5">
                  Portable device snapshot of your complete ledger
                </Text>
              </View>
              <View className="px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200">
                <Text className="text-[10px] font-extrabold text-blue-800">
                  JSON
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </Pressable>

            <View className="h-px bg-border/60 mx-4" />

            {/* JSON Restore */}
            <Pressable
              className="flex-row items-center px-4 py-3.5 gap-3.5 active:bg-slate-50 min-h-[58px]"
              onPress={() => setIsRestoreModalVisible(true)}
            >
              <View className="w-10 h-10 rounded-2xl bg-purple-500/10 items-center justify-center">
                <Ionicons
                  name="cloud-upload-outline"
                  size={21}
                  color="#7C3AED"
                />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-ink">
                  Restore from JSON Backup
                </Text>
                <Text className="text-xs text-slate mt-0.5">
                  Import previously exported database to this phone
                </Text>
              </View>
              <View className="px-2 py-0.5 rounded-md bg-purple-50 border border-purple-200">
                <Text className="text-[10px] font-extrabold text-purple-800">
                  IMPORT
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </Pressable>

            <View className="h-px bg-border/60 mx-4" />

            {/* Offline Safety Guide */}
            <Pressable
              className="flex-row items-center px-4 py-3.5 gap-3.5 active:bg-slate-50 min-h-[58px]"
              onPress={handleShowRecoveryGuide}
            >
              <View className="w-10 h-10 rounded-2xl bg-amber-500/10 items-center justify-center">
                <Ionicons name="shield-checkmark-outline" size={20} color="#D97706" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-ink">
                  Offline Storage & Safety Guide
                </Text>
                <Text className="text-xs text-slate mt-0.5">
                  How your records stay protected on this device
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </Pressable>
          </View>

          {/* Section: Testing & Demo Sandbox */}
          <View className="flex-row items-center gap-1.5 mt-2 mb-2 ml-1">
            <View className="w-1.5 h-1.5 rounded-full bg-forest-900/40" />
            <Text className="text-[11px] font-black text-forest-900/70 tracking-widest uppercase">
              DEMO & TESTING SANDBOX
            </Text>
          </View>

          <View className="rounded-3xl bg-white border border-forest-900/10 p-4 shadow-xs mb-4">
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-1 pr-3">
                <Text className="text-sm font-bold text-ink">
                  Generate 4 Realistic Demo Debtors
                </Text>
                <Text className="text-xs text-slate mt-0.5 leading-4">
                  Quickly populates Maria Santos, Juan dela Cruz, Nanay Gloria,
                  and Kuya Cardo to test dashboard cards and tables.
                </Text>
              </View>
              <View className="w-10 h-10 rounded-2xl bg-forest-900/10 items-center justify-center">
                <Ionicons name="sparkles" size={20} color="#173D35" />
              </View>
            </View>

            <Pressable
              onPress={handleLoadSampleData}
              disabled={isSeeding}
              className={`min-h-[44px] rounded-2xl bg-forest-900 items-center justify-center flex-row gap-2 active:bg-forest-900/90 shadow-xs ${
                isSeeding ? "opacity-70" : ""
              }`}
            >
              {isSeeding ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="flask-outline" size={17} color="#FFFFFF" />
                  <Text className="text-white text-xs font-black tracking-wide uppercase">
                    Load Demo Records
                  </Text>
                </>
              )}
            </Pressable>
          </View>

          {/* Section: Application Overview */}
          <View className="flex-row items-center gap-1.5 mt-2 mb-2 ml-1">
            <View className="w-1.5 h-1.5 rounded-full bg-forest-900/40" />
            <Text className="text-[11px] font-black text-forest-900/70 tracking-widest uppercase">
              APPLICATION OVERVIEW
            </Text>
          </View>

          <View className="rounded-3xl bg-white border border-forest-900/10 p-4 shadow-xs mb-4">
            <View className="flex-row items-center justify-between pb-3 border-b border-border/60">
              <View className="flex-row items-center gap-2.5">
                <View className="w-8 h-8 rounded-xl bg-forest-900/10 items-center justify-center">
                  <Ionicons name="server-outline" size={17} color="#173D35" />
                </View>
                <Text className="text-xs font-bold text-ink">Database Engine</Text>
              </View>
              <View className="px-2.5 py-0.5 rounded-full bg-emerald-100 border border-emerald-200">
                <Text className="text-[10px] font-extrabold text-emerald-800">
                  SQLite (WAL Mode)
                </Text>
              </View>
            </View>

            <View className="flex-row items-center justify-between py-3 border-b border-border/60">
              <View className="flex-row items-center gap-2.5">
                <View className="w-8 h-8 rounded-xl bg-forest-900/10 items-center justify-center">
                  <Ionicons name="cash-outline" size={17} color="#173D35" />
                </View>
                <Text className="text-xs font-bold text-ink">
                  Currency Format
                </Text>
              </View>
              <Text className="text-xs font-extrabold text-forest-900">
                Philippine Peso (₱ PHP)
              </Text>
            </View>

            <View className="flex-row items-center justify-between pt-3">
              <View className="flex-row items-center gap-2.5">
                <View className="w-8 h-8 rounded-xl bg-forest-900/10 items-center justify-center">
                  <Ionicons name="information-circle-outline" size={17} color="#173D35" />
                </View>
                <Text className="text-xs font-bold text-ink">
                  Build Version
                </Text>
              </View>
              <Text className="text-xs font-bold text-slate">v1.1.0 (Build 6)</Text>
            </View>
          </View>

          {/* Section: Danger Zone */}
          <View className="rounded-3xl bg-white border border-danger-600/30 p-4 shadow-xs mt-2 mb-6">
            <View className="flex-row items-center gap-2 mb-2">
              <Ionicons name="warning-outline" size={18} color="#B83D3D" />
              <Text className="text-xs font-black text-danger-600 uppercase tracking-wider">
                Reset Local Database
              </Text>
            </View>
            <Text className="text-xs text-slate leading-4 mb-3">
              Permanently erase all borrowers, loans, and payments stored on this
              phone. Make sure to export a backup first if needed.
            </Text>

            <Pressable
              onPress={handleClearLocalData}
              className="min-h-[46px] rounded-2xl border border-danger-600/40 bg-danger-600/10 items-center justify-center flex-row gap-2 active:bg-danger-600/20"
            >
              <Ionicons name="trash-outline" size={17} color="#B83D3D" />
              <Text className="text-danger-600 text-xs font-black tracking-wide uppercase">
                Erase All Local Records
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Restore JSON Modal */}
      <Modal
        visible={isRestoreModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsRestoreModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1 justify-end bg-black/60"
        >
          <View className="bg-white rounded-t-3xl p-5 max-h-[85%] border-t border-border">
            <View className="flex-row items-center justify-between pb-3 border-b border-border">
              <View className="flex-row items-center gap-2">
                <View className="w-8 h-8 rounded-xl bg-purple-500/10 items-center justify-center">
                  <Ionicons name="download-outline" size={18} color="#7C3AED" />
                </View>
                <Text className="text-base font-extrabold text-forest-900">
                  Restore Backup JSON
                </Text>
              </View>
              <Pressable
                onPress={() => setIsRestoreModalVisible(false)}
                hitSlop={8}
                className="w-8 h-8 rounded-full bg-slate-100 items-center justify-center active:bg-slate-200"
              >
                <Ionicons name="close" size={18} color="#252B29" />
              </Pressable>
            </View>

            <ScrollView className="py-4" showsVerticalScrollIndicator={false}>
              <Text className="text-xs font-semibold text-slate mb-2">
                Paste the full JSON content from a previously exported backup file:
              </Text>

              <TextInput
                value={restoreJsonInput}
                onChangeText={setRestoreJsonInput}
                placeholder='{"app": "PautangBai", "borrowers": [...], "loans": [...]}'
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={8}
                textAlignVertical="top"
                autoCapitalize="none"
                autoCorrect={false}
                className="w-full h-44 p-3 rounded-2xl border border-border bg-slate-50 text-xs text-ink font-mono"
              />

              <View className="flex-row items-center gap-1.5 mt-3 p-3 rounded-2xl bg-amber-50 border border-amber-200">
                <Ionicons name="information-circle" size={18} color="#D97706" />
                <Text className="flex-1 text-[11px] font-medium text-amber-900">
                  Restoring will safely replace local database tables with this backup snapshot.
                </Text>
              </View>
            </ScrollView>

            <View className="flex-row gap-2 pt-3 border-t border-border">
              <Pressable
                onPress={() => {
                  setRestoreJsonInput("");
                  setIsRestoreModalVisible(false);
                }}
                className="flex-1 min-h-[46px] rounded-2xl border border-border bg-slate-100 items-center justify-center"
              >
                <Text className="text-xs font-bold text-slate">Cancel</Text>
              </Pressable>

              <Pressable
                onPress={handleRestoreBackup}
                disabled={isRestoring || !restoreJsonInput.trim()}
                className={`flex-1 min-h-[46px] rounded-2xl bg-purple-700 items-center justify-center flex-row gap-2 active:bg-purple-800 ${
                  isRestoring || !restoreJsonInput.trim() ? "opacity-60" : ""
                }`}
              >
                {isRestoring ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-done" size={17} color="#FFFFFF" />
                    <Text className="text-xs font-black text-white uppercase tracking-wider">
                      Validate & Restore
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
