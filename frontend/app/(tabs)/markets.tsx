// Markets - browse all instruments by category, tap to select & jump to Trade.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors, FontMono, Spacing } from "@/src/theme";
import { fmtPrice, fmtPct } from "@/src/format";
import { api, Instrument } from "@/src/api";
import { useSymbol } from "@/src/context";

const CATEGORIES = [
  "Forex Majors",
  "Forex Minors",
  "Forex Exotics",
  "Indices",
  "Commodities",
  "Crypto",
  "Stocks",
];

export default function MarketsScreen() {
  const router = useRouter();
  const { setSymbol } = useSymbol();
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [category, setCategory] = useState<string>("Forex Majors");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await api.instruments();
      setInstruments(list);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 2500);
    return () => clearInterval(id);
  }, [load]);

  const filtered = useMemo(
    () => instruments.filter((i) => i.category === category),
    [instruments, category],
  );

  const onSelect = (sym: string) => {
    setSymbol(sym);
    router.push("/(tabs)/trade");
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loader}>
        <ActivityIndicator color={Colors.bull} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Marchés</Text>
        <Text style={styles.subtitle}>{instruments.length} instruments · données simulées</Text>
      </View>

      {/* Category tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll} contentContainerStyle={{ paddingHorizontal: Spacing.lg, gap: 8 }}>
        {CATEGORIES.map((c) => {
          const active = c === category;
          const count = instruments.filter((i) => i.category === c).length;
          return (
            <TouchableOpacity
              key={c}
              testID={`category-tab-${c.toLowerCase().replace(/\s/g, "-")}`}
              onPress={() => setCategory(c)}
              style={[styles.catPill, active && styles.catPillActive]}
            >
              <Text style={[styles.catText, active && styles.catTextActive]}>
                {c} · {count}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 80 }}
        refreshControl={
          <RefreshControl
            tintColor={Colors.bull}
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
      >
        {filtered.map((it) => {
          const up = it.change >= 0;
          return (
            <TouchableOpacity
              key={it.symbol}
              testID={`market-item-${it.symbol}`}
              style={styles.row}
              onPress={() => onSelect(it.symbol)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.sym}>{it.symbol}</Text>
                <Text style={styles.name} numberOfLines={1}>{it.name}</Text>
              </View>
              <View style={{ alignItems: "flex-end", flex: 1 }}>
                <Text style={[styles.price, { color: up ? Colors.bull : Colors.bear }]}>
                  {fmtPrice(it.last, it.digits)}
                </Text>
                <View style={styles.pctRow}>
                  <Ionicons name={up ? "trending-up" : "trending-down"} size={10} color={up ? Colors.bull : Colors.bear} />
                  <Text style={[styles.pct, { color: up ? Colors.bull : Colors.bear }]}>
                    {fmtPct(it.change_pct)}
                  </Text>
                </View>
              </View>
              <View style={styles.bidaskMini}>
                <Text style={styles.bidaskText}>{fmtPrice(it.bid, it.digits)} / {fmtPrice(it.ask, it.digits)}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  loader: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.bg },
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  title: { color: Colors.textPrimary, fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  catScroll: { maxHeight: 44, marginBottom: 8 },
  catPill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  catPillActive: { backgroundColor: Colors.bull, borderColor: Colors.bull },
  catText: { color: Colors.textSecondary, fontSize: 11, fontWeight: "600" },
  catTextActive: { color: "#000", fontWeight: "800" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 8,
  },
  sym: { color: Colors.textPrimary, fontSize: 13, fontWeight: "700" },
  name: { color: Colors.textMuted, fontSize: 10, marginTop: 2 },
  price: { fontFamily: FontMono, fontSize: 14, fontWeight: "700" },
  pctRow: { flexDirection: "row", alignItems: "center", gap: 2, marginTop: 2 },
  pct: { fontFamily: FontMono, fontSize: 11, fontWeight: "600" },
  bidaskMini: { width: 90, alignItems: "flex-end" },
  bidaskText: { color: Colors.textMuted, fontSize: 9, fontFamily: FontMono },
});
