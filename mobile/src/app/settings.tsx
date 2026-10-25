import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  Share,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSQLiteContext } from "expo-sqlite";
import { Ionicons } from "@expo/vector-icons";
import { borrowerHelper } from "@/db-helpers/borrowers";
import { loanHelper } from "@/db-helpers/loans";
import { paymentHelper } from "@/db-helpers/payments";
import { useRouter } from "expo-router";
import { Frog } from "@/components/frog";
import { useAuth } from "@/contexts/auth-context";
import { outboxHelper } from "@/services/sync/outbox";
import { syncService, syncStateHelper } from "@/services/sync/syncService";
import { seedSampleData } from "@/services/demo/seedSampleData";
import DashboardBg from "@/assets/images/DASHBOARD_BG.svg";
import PautangBaiLogo from "@/assets/images/PAUTANGBAI_LOGO.svg";


export default function SettingsScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const { user, isLoggedIn, logout } = useAuth();
  const [stats, setStats] = useState({ borrowers: 0, loans: 0, payments: 0 });
  const [syncStats, setSyncStats] = useState({
    pending: 0,
    failed: 0,
    synced: 0,
  });
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  useEffect(() => {
    async function loadStats() {
      try {
        const [b, l, p, s, lastSync] = await Promise.all([
          borrowerHelper.getAll(db),
          loanHelper.getAll(db),
          paymentHelper.getAll(db),
          outboxHelper.getStats(db),
          syncStateHelper.get(db, "last_synced_at"),
        ]);
        setStats({ borrowers: b.length, loans: l.length, payments: p.length });
        setSyncStats(s);
        setLastSyncedAt(lastSync);
      } catch (err) {
        console.error("Failed to load stats:", err);
      }
    }
    loadStats();
  }, [db]);

  const handleSyncNow = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const result = await syncService.sync(db);
      const [s, lastSync, b, l, p] = await Promise.all([
        outboxHelper.getStats(db),
        syncStateHelper.get(db, "last_synced_at"),
        borrowerHelper.getAll(db),
        loanHelper.getAll(db),
        paymentHelper.getAll(db),
      ]);
      setSyncStats(s);
      setLastSyncedAt(lastSync);
      setStats({ borrowers: b.length, loans: l.length, payments: p.length });

      if (result.success) {
        Alert.alert(
          "Sync Complete",
          `Pushed ${result.pushed} pending operation(s) and pulled ${result.pulled} update(s).`,
        );
      } else {
        Alert.alert(
          "Sync Notice",
          result.errors.join("\n") || "Some operations could not be synced.",
        );
      }
    } catch (err: any) {
      Alert.alert(
        "Sync Error",
        err?.message || "An unexpected error occurred during sync.",
      );
    } finally {
      setIsSyncing(false);
    }
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
        exportedAt: new Date().toISOString(),
        borrowers,
        loans,
        payments,
      };

      const jsonString = JSON.stringify(backupData, null, 2);

      await Share.share({
        title: "PautangBai Backup",
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
        "Borrower Name,Phone,Address,Principal Minor,Interest Type,Loan Date,Status\n";
      const borrowerMap = new Map(borrowers.map((b) => [b.id, b]));

      loans.forEach((l) => {
        const b = borrowerMap.get(l.borrower_id);
        const name = b?.name || "Unknown";
        const phone = b?.phone || "";
        const address = b?.address || "";
        csv += `"${name}","${phone}","${address}",${l.principal_minor},"${l.interest_type}","${l.loan_date}","${l.status}"\n`;
      });

      await Share.share({
        title: "PautangBai Loans CSV",
        message: csv,
      });
    } catch (err) {
      console.error("CSV export failed:", err);
      Alert.alert("Export Failed", "Unable to export CSV.");
    }
  };

  const handleShowRecoveryGuide = () => {
    Alert.alert(
      "Backup & Recovery Guide",
      "1. Export JSON Backup: Saves your full database as a portable file you can save to Google Drive or email.\n\n" +
        "2. Cloud Restore: When switching devices, log into your cloud account and tap 'Sync Now' to pull all your loans and borrowers.\n\n" +
        "3. Offline Guarantee: Your data lives directly in SQLite on this phone and remains fully accessible without internet.",
      [{ text: "Got it" }],
    );
  };

  const handleLoadSampleData = async () => {
    if (isSeeding) return;
    setIsSeeding(true);
    try {
      const result = await seedSampleData(db);
      const [s, b, l, p] = await Promise.all([
        outboxHelper.getStats(db),
        borrowerHelper.getAll(db),
        loanHelper.getAll(db),
        paymentHelper.getAll(db),
      ]);
      setSyncStats(s);
      setStats({ borrowers: b.length, loans: l.length, payments: p.length });

      Alert.alert(
        "Sample Data Generated!",
        "Added 4 realistic debtors with loans:\n\n• Maria Santos: ₱5,000 (Partial, ₱2,000 paid)\n• Juan dela Cruz: ₱3,000 (Overdue)\n• Nanay Gloria: ₱10,000 (Active)\n• Kuya Cardo: ₱2,000 (Fully Paid)\n\nCheck the Home and Borrowers screens to inspect the table and cards!",
        [
          { text: "View Home", onPress: () => router.push("/") },
          { text: "OK", style: "cancel" },
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
      "Reset Local Database?",
      "This will remove all borrowers, loans, and payments stored locally on this phone. Any changes already synced to the cloud remain safe.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Erase Local Data",
          style: "destructive",
          onPress: async () => {
            try {
              await db.execAsync(`
                DELETE FROM payments;
                DELETE FROM loans;
                DELETE FROM borrowers;
                DELETE FROM sync_queue;
                DELETE FROM sync_state;
              `);
              setStats({ borrowers: 0, loans: 0, payments: 0 });
              setSyncStats({ pending: 0, failed: 0, synced: 0 });
              setLastSyncedAt(null);
              Alert.alert("Data Cleared", "Local database has been reset.");
            } catch (err: any) {
              Alert.alert(
                "Error",
                err?.message || "Failed to clear local data.",
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

      {/* Top Header */}
      <View className="flex-row justify-between items-center px-4 pt-3 pb-2">
        <View className="justify-center">
          <PautangBaiLogo width={135} height={42} />
        </View>

        <View className="flex-row items-center px-2.5 py-1 rounded-full bg-emerald-100 gap-1.5">
          <View className="w-2 h-2 rounded-full bg-emerald-600" />
          <Text className="text-xs font-bold text-emerald-800">
            {syncStats.pending > 0 ? `${syncStats.pending} to sync` : "Synced"}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 100,
        }}
      >
        {/* Page Container Banner */}
        <View className="rounded-3xl p-5 bg-forest-900 shadow-lg mb-3">
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center px-2.5 py-0.5 rounded-full bg-white/10 self-start">
              <Text className="text-mint text-[10px] font-black tracking-widest uppercase">
                APP PREFERENCES
              </Text>
            </View>
          </View>

          <View className="flex-row items-center gap-2 mb-3">
            <View className="flex-1">
              <Text className="text-white text-2xl font-black tracking-tight">
                Settings
              </Text>
              <Text className="text-slate-300 text-xs font-medium mt-0.5">
                Offline-first data & cloud sync
              </Text>
            </View>
            <Frog mood="offline" size={68} />
          </View>

          <View className="flex-row pt-3 border-t border-white/15">
            <View className="flex-1">
              <Text className="text-mint text-[11px] font-semibold mb-0.5">
                Local Records
              </Text>
              <Text className="text-white text-base font-bold">
                {stats.borrowers} b · {stats.loans} l · {stats.payments} p
              </Text>
            </View>
            <View className="w-px bg-white/15 mx-3" />
            <View className="flex-1">
              <Text className="text-mint text-[11px] font-semibold mb-0.5">
                Cloud Sync
              </Text>
              <Text className="text-emerald-400 text-base font-bold">
                {syncStats.pending > 0
                  ? `${syncStats.pending} Pending`
                  : "All Synced"}
              </Text>
            </View>
          </View>
        </View>

        {/* Account & Cloud Sync */}
        <View className="flex-row items-center gap-1.5 mt-5 mb-2 ml-1">
          <View className="w-1.5 h-1.5 rounded-full bg-forest-900/40" />
          <Text className="text-[11px] font-black text-forest-900/70 tracking-widest uppercase">
            CLOUD & SYNC
          </Text>
        </View>

        <View className="rounded-3xl bg-white border border-forest-900/10 p-4 shadow-xs">
          {isLoggedIn && user ? (
            <View>
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-3">
                  <View className="w-11 h-11 rounded-2xl bg-forest-900/10 border border-forest-900/15 items-center justify-center">
                    <Ionicons name="person" size={20} color="#173D35" />
                  </View>
                  <View>
                    <Text className="text-base font-extrabold text-forest-900">
                      @{user.username}
                    </Text>
                    {user.name && user.name !== user.username ? (
                      <Text className="text-xs text-slate">{user.name}</Text>
                    ) : (
                      <Text className="text-xs text-slate">Verified Account</Text>
                    )}
                  </View>
                </View>
                <View className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 border border-emerald-200">
                  <View className="w-2 h-2 rounded-full bg-emerald-600" />
                  <Text className="text-[11px] font-bold text-emerald-800">
                    Connected
                  </Text>
                </View>
              </View>

              {/* Sync Status Details */}
              <View className="mt-3.5 p-3 rounded-2xl bg-slate-50 border border-border flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="text-xs font-bold text-forest-900">
                    {syncStats.pending > 0
                      ? `${syncStats.pending} pending update${syncStats.pending > 1 ? "s" : ""}`
                      : "Cloud records up to date"}
                  </Text>
                  <Text className="text-[11px] text-slate mt-0.5">
                    {lastSyncedAt
                      ? `Last synced: ${new Date(lastSyncedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                      : "Not yet synced to cloud"}
                  </Text>
                </View>
                {syncStats.pending > 0 ? (
                  <View className="px-2.5 py-1 rounded-full bg-amber-100 border border-amber-300">
                    <Text className="text-[10px] font-extrabold text-amber-800">
                      {syncStats.pending} to sync
                    </Text>
                  </View>
                ) : (
                  <View className="px-2.5 py-1 rounded-full bg-emerald-100 border border-emerald-300">
                    <Text className="text-[10px] font-extrabold text-emerald-800">
                      Synced
                    </Text>
                  </View>
                )}
              </View>

              <View className="mt-3.5 pt-3 border-t border-border flex-row gap-2.5">
                <Pressable
                  onPress={handleSyncNow}
                  disabled={isSyncing}
                  className={`flex-1 min-h-[46px] rounded-2xl bg-forest-900 items-center justify-center flex-row gap-2 active:bg-forest-900/90 shadow-xs ${
                    isSyncing ? "opacity-70" : ""
                  }`}
                >
                  {isSyncing ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons
                        name="cloud-upload-outline"
                        size={17}
                        color="#FFFFFF"
                      />
                      <Text className="text-xs font-extrabold text-white tracking-wide">
                        Sync Now
                      </Text>
                    </>
                  )}
                </Pressable>

                <Pressable
                  onPress={() => {
                    Alert.alert(
                      "Log Out",
                      "Are you sure you want to log out? Your local records will remain safely on this phone.",
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Log Out",
                          style: "destructive",
                          onPress: () => logout(),
                        },
                      ],
                    );
                  }}
                  className="px-4 min-h-[46px] rounded-2xl border border-danger-600/30 bg-danger-600/5 items-center justify-center flex-row gap-1.5 active:bg-danger-600/10"
                >
                  <Ionicons name="log-out-outline" size={17} color="#B83D3D" />
                  <Text className="text-xs font-bold text-danger-600">
                    Log Out
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View className="p-1">
              <View className="flex-row items-center gap-3.5 mb-3">
                <View className="w-12 h-12 rounded-2xl bg-forest-900/10 border border-forest-900/15 items-center justify-center">
                  <Ionicons name="cloud-outline" size={24} color="#173D35" />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-extrabold text-forest-900">
                    Cloud Backup & Sync
                  </Text>
                  <Text className="text-xs text-slate mt-0.5 leading-4">
                    Protect your records with cloud sync so you can switch phones anytime.
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={() => router.push("/login")}
                className="min-h-[46px] rounded-2xl bg-forest-900 items-center justify-center flex-row gap-2 active:bg-forest-900/90 shadow-xs"
              >
                <Ionicons name="log-in-outline" size={18} color="#FFFFFF" />
                <Text className="text-white text-xs font-extrabold tracking-wide uppercase">
                  Log In or Register
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Local Database Stats Grid */}
        <View className="flex-row items-center gap-1.5 mt-5 mb-2 ml-1">
          <View className="w-1.5 h-1.5 rounded-full bg-forest-900/40" />
          <Text className="text-[11px] font-black text-forest-900/70 tracking-widest uppercase">
            LOCAL DATABASE
          </Text>
        </View>

        <View className="flex-row gap-2.5">
          {/* Borrowers Tile */}
          <View className="flex-1 bg-white border border-forest-900/10 rounded-2xl p-3.5 shadow-xs items-center">
            <View className="w-9 h-9 rounded-xl bg-forest-900/10 items-center justify-center mb-1.5">
              <Ionicons name="people" size={18} color="#173D35" />
            </View>
            <Text className="text-xl font-black text-forest-900 tracking-tight">
              {stats.borrowers}
            </Text>
            <Text className="text-[11px] font-bold text-slate mt-0.5">
              Borrowers
            </Text>
          </View>

          {/* Loans Tile */}
          <View className="flex-1 bg-white border border-forest-900/10 rounded-2xl p-3.5 shadow-xs items-center">
            <View className="w-9 h-9 rounded-xl bg-amber-500/10 items-center justify-center mb-1.5">
              <Ionicons name="wallet" size={18} color="#D97706" />
            </View>
            <Text className="text-xl font-black text-forest-900 tracking-tight">
              {stats.loans}
            </Text>
            <Text className="text-[11px] font-bold text-slate mt-0.5">
              Loans
            </Text>
          </View>

          {/* Payments Tile */}
          <View className="flex-1 bg-white border border-forest-900/10 rounded-2xl p-3.5 shadow-xs items-center">
            <View className="w-9 h-9 rounded-xl bg-emerald-500/10 items-center justify-center mb-1.5">
              <Ionicons name="receipt" size={18} color="#16A34A" />
            </View>
            <Text className="text-xl font-black text-forest-900 tracking-tight">
              {stats.payments}
            </Text>
            <Text className="text-[11px] font-bold text-slate mt-0.5">
              Payments
            </Text>
          </View>
        </View>

        {/* Data Backup & Export */}
        <View className="flex-row items-center gap-1.5 mt-5 mb-2 ml-1">
          <View className="w-1.5 h-1.5 rounded-full bg-forest-900/40" />
          <Text className="text-[11px] font-black text-forest-900/70 tracking-widest uppercase">
            DATA VAULT & EXPORT
          </Text>
        </View>

        <View className="rounded-3xl bg-white border border-forest-900/10 overflow-hidden shadow-xs">
          <Pressable
            className="flex-row items-center px-4 py-3.5 gap-3.5 active:bg-slate-50 min-h-[56px]"
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
                Export to Excel / CSV
              </Text>
              <Text className="text-xs text-slate mt-0.5">
                Spreadsheet of all borrowers, loans & dates
              </Text>
            </View>
            <View className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200">
              <Text className="text-[10px] font-extrabold text-emerald-800">CSV</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </Pressable>

          <View className="h-px bg-border/60 mx-4" />

          <Pressable
            className="flex-row items-center px-4 py-3.5 gap-3.5 active:bg-slate-50 min-h-[56px]"
            onPress={handleExportJSON}
          >
            <View className="w-10 h-10 rounded-2xl bg-blue-500/10 items-center justify-center">
              <Ionicons
                name="code-download-outline"
                size={21}
                color="#2563EB"
              />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-bold text-ink">
                Export JSON Database
              </Text>
              <Text className="text-xs text-slate mt-0.5">
                Complete portable backup file
              </Text>
            </View>
            <View className="px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200">
              <Text className="text-[10px] font-extrabold text-blue-800">JSON</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </Pressable>

          <View className="h-px bg-border/60 mx-4" />

          <Pressable
            className="flex-row items-center px-4 py-3.5 gap-3.5 active:bg-slate-50 min-h-[56px]"
            onPress={handleShowRecoveryGuide}
          >
            <View className="w-10 h-10 rounded-2xl bg-amber-500/10 items-center justify-center">
              <Ionicons name="book-outline" size={20} color="#D97706" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-bold text-ink">
                Backup & Recovery Guide
              </Text>
              <Text className="text-xs text-slate mt-0.5">
                How to transfer or restore your data
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </Pressable>

          <View className="h-px bg-border/60 mx-4" />

          <Pressable
            className="flex-row items-center px-4 py-3.5 gap-3.5 active:bg-slate-50 min-h-[56px]"
            onPress={handleLoadSampleData}
            disabled={isSeeding}
          >
            <View className="w-10 h-10 rounded-2xl bg-forest-900/10 items-center justify-center">
              {isSeeding ? (
                <ActivityIndicator size="small" color="#173D35" />
              ) : (
                <Ionicons name="sparkles" size={20} color="#173D35" />
              )}
            </View>
            <View className="flex-1">
              <Text className="text-sm font-bold text-ink">
                Generate 4 Sample Records
              </Text>
              <Text className="text-xs text-slate mt-0.5">
                Populate table with active, partial, overdue & paid debtors
              </Text>
            </View>
            <View className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200">
              <Text className="text-[10px] font-extrabold text-emerald-800">4 DEMO</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </Pressable>
        </View>

        {/* App Info & Architecture */}
        <View className="flex-row items-center gap-1.5 mt-5 mb-2 ml-1">
          <View className="w-1.5 h-1.5 rounded-full bg-forest-900/40" />
          <Text className="text-[11px] font-black text-forest-900/70 tracking-widest uppercase">
            APPLICATION OVERVIEW
          </Text>
        </View>

        <View className="rounded-3xl bg-white border border-forest-900/10 p-4 shadow-xs">
          <View className="flex-row items-center justify-between pb-3 border-b border-border/60">
            <View className="flex-row items-center gap-2.5">
              <View className="w-8 h-8 rounded-xl bg-forest-900/10 items-center justify-center">
                <Ionicons name="phone-portrait-outline" size={17} color="#173D35" />
              </View>
              <Text className="text-xs font-bold text-ink">Storage Architecture</Text>
            </View>
            <View className="px-2.5 py-0.5 rounded-full bg-emerald-100 border border-emerald-200">
              <Text className="text-[10px] font-extrabold text-emerald-800">Local SQLite</Text>
            </View>
          </View>

          <View className="flex-row items-center justify-between py-3 border-b border-border/60">
            <View className="flex-row items-center gap-2.5">
              <View className="w-8 h-8 rounded-xl bg-forest-900/10 items-center justify-center">
                <Ionicons name="cash-outline" size={17} color="#173D35" />
              </View>
              <Text className="text-xs font-bold text-ink">Currency & Format</Text>
            </View>
            <Text className="text-xs font-extrabold text-forest-900">Philippine Peso (₱ PHP)</Text>
          </View>

          <View className="flex-row items-center justify-between pt-3">
            <View className="flex-row items-center gap-2.5">
              <View className="w-8 h-8 rounded-xl bg-forest-900/10 items-center justify-center">
                <Ionicons name="sparkles-outline" size={17} color="#173D35" />
              </View>
              <Text className="text-xs font-bold text-ink">Version & Tagline</Text>
            </View>
            <Text className="text-xs font-medium text-slate italic">"Imong utang, klaro pirmi."</Text>
          </View>
        </View>

        {/* Danger Zone */}
        <View
          style={{ backgroundColor: "#B83D3D" }}
          className="rounded-3xl p-5 shadow-lg mt-6 mb-8"
        >
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center px-2.5 py-0.5 rounded-full bg-white/20 self-start">
              <Text className="text-white text-[10px] font-black tracking-widest uppercase">
                DANGER ZONE
              </Text>
            </View>
          </View>

          <View className="flex-row items-center gap-3.5 mb-4">
            <View className="w-12 h-12 rounded-2xl bg-white/20 border border-white/25 items-center justify-center">
              <Ionicons name="warning" size={24} color="#FFFFFF" />
            </View>
            <View className="flex-1">
              <Text className="text-xl font-black text-white tracking-tight">
                Reset Local Database
              </Text>
              <Text className="text-xs text-rose-100 font-medium mt-0.5 leading-4">
                Permanently erase all local borrower records, loans, and payments from this device.
              </Text>
            </View>
          </View>

          <View className="pt-3.5 border-t border-white/20">
            <Pressable
              className="min-h-[48px] rounded-2xl bg-white active:bg-rose-50 items-center justify-center flex-row gap-2 shadow-sm"
              onPress={handleClearLocalData}
            >
              <Ionicons name="trash-outline" size={18} color="#B83D3D" />
              <Text className="text-danger-600 text-xs font-black tracking-wide uppercase">
                Erase Local Records
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  </View>
);
}

