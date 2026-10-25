import React, { useState, useEffect } from "react";
// layout-critical positioning uses style props: className is not applied to Svg and absolute/zIndex are unreliable via NativeWind here
import { View, Text, Pressable, Dimensions, Alert } from "react-native";
import { Tabs, useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSQLiteContext } from "expo-sqlite";
import Svg, { Path } from "react-native-svg";
import { getLocalDateString } from "@/services/date/dateUtils";

type BottomTabBarProps = Parameters<
  NonNullable<React.ComponentProps<typeof Tabs>["tabBar"]>
>[0];

type TabRouteName = "index" | "borrowers" | "activity" | "settings";

interface TabMeta {
  label: string;
  activeIcon: keyof typeof Ionicons.glyphMap;
  inactiveIcon: keyof typeof Ionicons.glyphMap;
}

const TAB_CONFIG: Record<TabRouteName, TabMeta> = {
  index: {
    label: "Home",
    activeIcon: "home",
    inactiveIcon: "home-outline",
  },
  borrowers: {
    label: "Borrowers",
    activeIcon: "people",
    inactiveIcon: "people-outline",
  },
  activity: {
    label: "Activity",
    activeIcon: "receipt",
    inactiveIcon: "receipt-outline",
  },
  settings: {
    label: "Settings",
    activeIcon: "settings",
    inactiveIcon: "settings-outline",
  },
};

function ImpeccableFloatingScoopedTabBar({
  state,
  descriptors,
  emitter,
  navigateToTab,
  insets,
}: BottomTabBarProps) {
  const router = useRouter();
  const db = useSQLiteContext();
  const [overdueCount, setOverdueCount] = useState(0);
  const [borrowerCount, setBorrowerCount] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [screenWidth, setScreenWidth] = useState(
    Dimensions.get("window").width,
  );

  useEffect(() => {
    let isMounted = true;
    async function checkCounts() {
      try {
        const todayStr = getLocalDateString();
        const [overdueRows, borrowerRows] = await Promise.all([
          db.getAllAsync<{ count: number }>(
            `SELECT COUNT(*) as count FROM loans WHERE status = 'active' AND due_date IS NOT NULL AND due_date < ?`,
            [todayStr],
          ),
          db.getAllAsync<{ count: number }>(
            `SELECT COUNT(*) as count FROM borrowers WHERE deleted_at IS NULL`,
          ),
        ]);
        if (isMounted) {
          if (overdueRows && overdueRows[0]) {
            setOverdueCount(overdueRows[0].count);
          }
          if (borrowerRows && borrowerRows[0]) {
            setBorrowerCount(borrowerRows[0].count);
          }
        }
      } catch {
        // silent fallback
      }
    }

    checkCounts();
    const timer = setInterval(checkCounts, 3000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [db]);

  // Floating Island Geometry
  const horizontalMargin = 16;
  const bottomOffset = Math.max(insets.bottom, 12);
  const W = Math.max(screenWidth - horizontalMargin * 2, 280);
  const H = 64; // Height of the capsule body
  const headroom = 24; // Elevation headroom for the 64px hero button
  const totalHeight = headroom + H;
  const cx = W / 2;
  const curveOffset = 52;
  const dipDepth = 48;
  const R = 28; // Outer corner radius of the floating capsule
  const k = R * 0.552285; // Cubic Bezier circle approximation factor

  // Continuous closed path for a floating capsule with a central scooped cradle
  const islandPath = `M ${R} ${headroom}
    L ${cx - curveOffset} ${headroom}
    C ${cx - 35} ${headroom}, ${cx - 35} ${headroom + dipDepth}, ${cx} ${headroom + dipDepth}
    C ${cx + 35} ${headroom + dipDepth}, ${cx + 35} ${headroom}, ${cx + curveOffset} ${headroom}
    L ${W - R} ${headroom}
    C ${W - R + k} ${headroom}, ${W} ${headroom + R - k}, ${W} ${headroom + R}
    L ${W} ${totalHeight - R}
    C ${W} ${totalHeight - R + k}, ${W - R + k} ${totalHeight}, ${W - R} ${totalHeight}
    L ${R} ${totalHeight}
    C ${R - k} ${totalHeight}, 0 ${totalHeight - R + k}, 0 ${totalHeight - R}
    L 0 ${headroom + R}
    C 0 ${headroom + R - k}, ${R - k} ${headroom}, ${R} ${headroom}
    Z`;

  const handleAction = (type: "new_loan" | "new_borrower") => {
    setIsMenuOpen(false);
    if (type === "new_loan") {
      if (borrowerCount === 0) {
        Alert.alert(
          "Walay Mangungutang",
          "Kinahanglan magdugang una og mangungutang usa makahimo og pautang.",
          [
            { text: "Kanselahon", style: "cancel" },
            {
              text: "Dugang Mangungutang",
              onPress: () => {
                router.push({
                  pathname: "/borrowers",
                  params: { action: "new_borrower", t: String(Date.now()) },
                });
              },
            },
          ],
        );
        return;
      }
      router.push({
        pathname: "/",
        params: { action: "new_loan", t: String(Date.now()) },
      });
    } else {
      router.push({
        pathname: "/borrowers",
        params: { action: "new_borrower", t: String(Date.now()) },
      });
    }
  };

  const renderTab = (route: (typeof state.routes)[0], index: number) => {
    const config = TAB_CONFIG[route.name as TabRouteName];
    if (!config) return null;

    const isFocused = state.index === index;
    const hasBadge = route.name === "activity" && overdueCount > 0;

    const onPress = () => {
      if (isMenuOpen) setIsMenuOpen(false);
      const event = emitter.emit({
        type: "tabPress",
        target: route.key,
        canPreventDefault: true,
      });

      if (!isFocused && !event.defaultPrevented) {
        navigateToTab(route.key);
      }
    };

    const onLongPress = () => {
      emitter.emit({
        type: "tabLongPress",
        target: route.key,
      });
    };

    return (
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: isFocused }}
        accessibilityLabel={config.label}
        onPress={onPress}
        onLongPress={onLongPress}
        className="w-full items-center justify-center py-1 active:opacity-75"
      >
        <View className="w-7 h-6 items-center justify-center self-center relative mb-0.5">
          <Ionicons
            name={isFocused ? config.activeIcon : config.inactiveIcon}
            size={22}
            color={isFocused ? "#173D35" : "#6E7E78"}
          />
          {hasBadge && (
            <View className="absolute -top-1 -right-2 bg-amber border-[1.5px] border-white min-w-[16px] h-4 rounded-full items-center justify-center px-1">
              <Text className="text-[9px] font-extrabold text-forest text-center">
                {overdueCount > 9 ? "9+" : overdueCount}
              </Text>
            </View>
          )}
        </View>
        <Text
          className={`text-[10px] text-center self-center ${
            isFocused ? "text-forest font-bold" : "text-[#6E7E78] font-medium"
          }`}
          numberOfLines={1}
        >
          {config.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <>
      {/* Backdrop overlay when speed-dial is open */}
      {isMenuOpen && (
        <Pressable
          className="bg-black/15"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 998,
          }}
          onPress={() => setIsMenuOpen(false)}
        />
      )}

      {/* Floating Speed-Dial Pills above center button */}
      {isMenuOpen && (
        <View
          className="items-center justify-center gap-3"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            zIndex: 1000,
            bottom: bottomOffset + totalHeight + 10,
          }}
          pointerEvents="box-none"
        >
          <Pressable
            onPress={() => handleAction("new_borrower")}
            className="flex-row items-center gap-2 bg-white px-5 py-2.5 rounded-full border border-border shadow-lg active:scale-95 active:opacity-90"
            style={{ elevation: 8 }}
          >
            <Ionicons name="person-add" size={17} color="#173D35" />
            <Text className="text-[13px] font-semibold text-forest text-center">
              Bag-ong Mangungutang
            </Text>
          </Pressable>

          {borrowerCount > 0 && (
            <Pressable
              onPress={() => handleAction("new_loan")}
              className="flex-row items-center gap-2 bg-white px-5 py-2.5 rounded-full border border-border shadow-lg active:scale-95 active:opacity-90"
              style={{ elevation: 8 }}
            >
              <MaterialCommunityIcons
                name="cash-plus"
                size={19}
                color="#173D35"
              />
              <Text className="text-[13px] font-semibold text-forest text-center">
                Bag-ong Pautang
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Floating Scooped Island Container */}
      <View
        style={{
          position: "absolute",
          left: horizontalMargin,
          right: horizontalMargin,
          bottom: bottomOffset,
          height: totalHeight,
          zIndex: 999,
          shadowColor: "#173D35",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.12,
          shadowRadius: 16,
          elevation: 8,
        }}
        onLayout={(e) => setScreenWidth(Dimensions.get("window").width)}
        pointerEvents="box-none"
      >
        {/* SVG Floating Scooped Island Path */}
        <Svg
          width={W}
          height={totalHeight}
          style={{ position: "absolute", top: 0, left: 0 }}
        >
          <Path
            d={islandPath}
            fill="#FFFFFF"
            stroke="#E2E8E4"
            strokeWidth={1.5}
          />
        </Svg>

        {/* 5 Equal Columns for Tab Buttons */}
        <View
          className="flex-row items-center justify-between w-full px-1"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: headroom,
            height: H,
          }}
        >
          {/* Column 1: Home */}
          <View className="flex-1 h-full items-center justify-center">
            {state.routes[0] && renderTab(state.routes[0], 0)}
          </View>

          {/* Column 2: Borrowers */}
          <View className="flex-1 h-full items-center justify-center">
            {state.routes[1] && renderTab(state.routes[1], 1)}
          </View>

          {/* Column 3: Center Column Spacer */}
          <View style={{ width: 64, height: "100%" }} />

          {/* Column 4: Activity */}
          <View className="flex-1 h-full items-center justify-center">
            {state.routes[2] && renderTab(state.routes[2], 2)}
          </View>

          {/* Column 5: Settings */}
          <View className="flex-1 h-full items-center justify-center">
            {state.routes[3] && renderTab(state.routes[3], 3)}
          </View>
        </View>

        {/* Elevated Center Hero Green Circle Button */}
        <View
          style={{
            position: "absolute",
            left: cx - 32,
            top: 3,
            width: 64,
            height: 64,
            zIndex: 60,
          }}
          pointerEvents="box-none"
        >
          <Pressable
            onPress={() => setIsMenuOpen((prev) => !prev)}
            accessibilityRole="button"
            accessibilityLabel="Pautang actions"
            className="w-[64px] h-[64px] rounded-full bg-forest border-[3.5px] border-white items-center justify-center shadow-xl active:scale-95 active:opacity-90"
            style={{
              elevation: 10,
              shadowColor: "#173D35",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.35,
              shadowRadius: 8,
            }}
          >
            {isMenuOpen ? (
              <Ionicons name="close" size={30} color="#FFFFFF" />
            ) : (
              <MaterialCommunityIcons
                name="cash-plus"
                size={30}
                color="#FFFFFF"
              />
            )}
          </Pressable>
        </View>
      </View>
    </>
  );
}

export default function AppTabs() {
  return (
    <Tabs
      tabBar={(props) => <ImpeccableFloatingScoopedTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: "transparent",
          borderTopWidth: 0,
          elevation: 0,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="borrowers" options={{ title: "Borrowers" }} />
      <Tabs.Screen name="activity" options={{ title: "Activity" }} />
      <Tabs.Screen name="settings" options={{ title: "Settings" }} />
    </Tabs>
  );
}
