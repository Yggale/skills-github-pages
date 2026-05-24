// Dashboard - main MT5-style overview screen.
// Shows: equity, daily target progress, live chart with indicators, open positions.

import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors, FontMono, Spacing } from "@/src/theme";
import { fmtMoney, fmtPct, fmtPrice, fmtPips } from "@/src/format";
import {
  api,
  Account,
  DailyStats,
  Instrument,
  Position,
  Candle,
  Indicators,
} from "@/src/api";
import { useSymbol } from "@/src/context";
import CandlestickChart from "@/src/components/CandlestickChart";
import RsiChart from "@/src/components/RsiChart";

export default function Dashboard() {
  const { symbol } = useSymbol();
  const [account, setAccount] = useState<Account | null>(null);
  const [stats, setStats] = useState<DailyStats | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [instrument, setInstrument] = useState<Instrument | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [indicators, setIndicators] = useState<Indicators | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [alertedToday, setAlertedToday] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const [acc, s, pos, inst, kdat] = await Promise.all([
        api.account(),
        api.dailyStats(),
        api.positions("open"),
        api.instrument(symbol),
        api.candles(symbol, { limit: 80, ema_fast: 9, ema_slow: 20, ma_fast: 20, ma_slow: 50 }),
      ]);
      setAccount(acc);
      setStats(s);
      setPositions(pos);
      setInstrument(inst);
      setCandles(kdat.candles);
      setIndicators(kdat.indicators);
      // Alert when target reached
      if (s.target_reached && !alertedToday) {
        setAlertedToday(true);
        Alert.alert(
          "🎯 Objectif atteint !",
          `Votre objectif quotidien de ${fmtMoney(s.daily_target, acc.currency)} a été atteint. Pensez à sécuriser vos gains.`,
        );
      }
      if (s.loss_limit_hit) {
        Alert.alert(
          "⚠️ Limite de perte atteinte",
          `Vous avez atteint votre limite de perte quotidienne (${fmtMoney(-s.max_daily_loss, acc.currency)}). Le trading auto est suspendu.`,
        );
      }
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [symbol, alertedToday]);

  useEffect(() => {
    loadAll();
    const id = setInterval(loadAll, 2500);
    return () => clearInterval(id);
  }, [loadAll]);

  const onRefresh = () => {
    setRefreshing(true);
    loadAll();
  };

  const closePosition = async (id: string) => {
    try {
      await api.closePosition(id);
      loadAll();
    } catch (e: any) {
      Alert.alert("Erreur", e.message);
    }
  };

  if (loading || !account || !stats || !instrument) {
    return (
      <SafeAreaView style={styles.loader}>
        <ActivityIndicator color={Colors.bull} />
      </SafeAreaView>
    );
  }

  const dayDir = instrument.change >= 0 ? "up" : "down";
  const dayColor = dayDir === "up" ? Colors.bull : Colors.bear;
  const progressPct = Math.max(0, Math.min(stats.target_progress, 100));

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl tintColor={Colors.bull} refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.brand}>AutoTrade Pro</Text>
            <Text style={styles.mode}>
              {account.mode === "simulation" ? "● SIMULATION" : "● LIVE"}
              <Text style={styles.modeDim}> · Levier 1:{account.leverage}</Text>
            </Text>
          </View>
          <View style={[styles.modeBadge, { backgroundColor: account.mode === "simulation" ? Colors.accentBg : Colors.bullBg }]}>
            <Text style={[styles.modeBadgeText, { color: account.mode === "simulation" ? Colors.accent : Colors.bull }]}>
              {account.mode === "simulation" ? "DEMO" : "LIVE"}
            </Text>
          </View>
        </View>

        {/* Balance & Equity */}
        <View style={styles.balanceCard} testID="balance-card">
          <Text style={styles.cardLabel}>Equity</Text>
          <Text style={styles.balanceBig}>{fmtMoney(account.equity, account.currency)}</Text>
          <View style={styles.balanceRow}>
            <View style={styles.balanceCol}>
              <Text style={styles.miniLabel}>Solde</Text>
              <Text style={styles.miniValue}>{fmtMoney(account.balance, account.currency)}</Text>
            </View>
            <View style={styles.balanceCol}>
              <Text style={styles.miniLabel}>Marge libre</Text>
              <Text style={styles.miniValue}>{fmtMoney(account.free_margin, account.currency)}</Text>
            </View>
            <View style={styles.balanceCol}>
              <Text style={styles.miniLabel}>Marge</Text>
              <Text style={styles.miniValue}>{fmtMoney(account.margin, account.currency)}</Text>
            </View>
          </View>
        </View>

        {/* Daily Target */}
        <View style={styles.card} testID="daily-target-card">
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>🎯 Objectif quotidien</Text>
            <Text style={[styles.cardSub, { color: stats.target_reached ? Colors.bull : Colors.textSecondary }]}>
              {progressPct.toFixed(0)}%
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${progressPct}%`,
                  backgroundColor: stats.target_reached ? Colors.bull : Colors.accent,
                },
              ]}
            />
          </View>
          <View style={styles.targetRow}>
            <View>
              <Text style={styles.miniLabel}>Gains réalisés</Text>
              <Text style={[styles.targetVal, { color: stats.realized_pnl >= 0 ? Colors.bull : Colors.bear }]}>
                {fmtMoney(stats.realized_pnl, account.currency)}
              </Text>
            </View>
            <View>
              <Text style={styles.miniLabel}>Objectif</Text>
              <Text style={styles.targetVal}>{fmtMoney(stats.daily_target, account.currency)}</Text>
            </View>
            <View>
              <Text style={styles.miniLabel}>Restant</Text>
              <Text style={styles.targetVal}>
                {fmtMoney(Math.max(stats.daily_target - stats.realized_pnl, 0), account.currency)}
              </Text>
            </View>
          </View>
          {stats.target_reached && (
            <View style={[styles.alertPill, { backgroundColor: Colors.bullBg }]} testID="target-reached-alert">
              <Ionicons name="trophy" size={14} color={Colors.bull} />
              <Text style={[styles.alertText, { color: Colors.bull }]}> Objectif atteint ! Sécurisez vos gains 💰</Text>
            </View>
          )}
          {stats.loss_limit_hit && (
            <View style={[styles.alertPill, { backgroundColor: Colors.bearBg }]} testID="loss-limit-alert">
              <Ionicons name="warning" size={14} color={Colors.bear} />
              <Text style={[styles.alertText, { color: Colors.bear }]}> Limite de perte atteinte</Text>
            </View>
          )}
        </View>

        {/* Quick stats */}
        <View style={styles.statsRow}>
          <Stat label="Trades" value={String(stats.trades)} />
          <Stat label="Win rate" value={`${stats.win_rate.toFixed(0)}%`} highlight={stats.win_rate >= 50 ? Colors.bull : undefined} />
          <Stat label="Flottant" value={fmtMoney(stats.floating_pnl, account.currency)} highlight={stats.floating_pnl >= 0 ? Colors.bull : Colors.bear} />
          <Stat label="Ouvertes" value={String(stats.open_positions)} />
        </View>

        {/* Chart Section */}
        <View style={styles.chartSection}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.symbolHeader} testID="chart-symbol">{instrument.symbol}</Text>
              <Text style={styles.symbolName}>{instrument.name}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={[styles.priceBig, { color: dayColor }]} testID="chart-price">
                {fmtPrice(instrument.last, instrument.digits)}
              </Text>
              <Text style={[styles.changeText, { color: dayColor }]}>
                {fmtPct(instrument.change_pct)}
              </Text>
            </View>
          </View>

          <CandlestickChart
            candles={candles}
            indicators={indicators || undefined}
            digits={instrument.digits}
            height={200}
          />

          <View style={styles.legendRow}>
            <Legend color="rgba(0, 230, 118, 0.95)" label="EMA 9" />
            <Legend color="rgba(168, 85, 247, 0.95)" label="EMA 20" />
            <Legend color="rgba(251, 191, 36, 0.95)" label="MA 20" />
            <Legend color="rgba(244, 114, 182, 0.95)" label="MA 50" />
            <Legend color="rgba(59, 130, 246, 0.7)" label="BB" />
          </View>

          {indicators && (
            <View style={{ marginTop: 8 }}>
              <RsiChart values={indicators.rsi} overbought={70} oversold={30} />
            </View>
          )}

          {/* Bid/Ask quick info */}
          <View style={styles.bidAskRow}>
            <View style={[styles.bidAskCell, { borderColor: Colors.bear }]}>
              <Text style={styles.bidAskLabel}>BID (Vente)</Text>
              <Text style={[styles.bidAskVal, { color: Colors.bear }]}>{fmtPrice(instrument.bid, instrument.digits)}</Text>
            </View>
            <View style={[styles.bidAskCell, { borderColor: Colors.bull }]}>
              <Text style={styles.bidAskLabel}>ASK (Achat)</Text>
              <Text style={[styles.bidAskVal, { color: Colors.bull }]}>{fmtPrice(instrument.ask, instrument.digits)}</Text>
            </View>
          </View>
        </View>

        {/* Open positions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Positions ouvertes</Text>
            <Text style={styles.sectionSub}>{positions.length}</Text>
          </View>

          {positions.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={32} color={Colors.textMuted} />
              <Text style={styles.emptyText}>Aucune position ouverte</Text>
            </View>
          ) : (
            positions.map((p) => (
              <View key={p.id} style={styles.posRow} testID={`position-${p.id}`}>
                <View style={{ flex: 1 }}>
                  <View style={styles.posTopRow}>
                    <Text style={styles.posSymbol}>{p.symbol}</Text>
                    <View style={[styles.sideBadge, { backgroundColor: p.side === "buy" ? Colors.bullBg : Colors.bearBg }]}>
                      <Text style={{ color: p.side === "buy" ? Colors.bull : Colors.bear, fontSize: 10, fontWeight: "700" }}>
                        {p.side === "buy" ? "BUY" : "SELL"} {p.volume.toFixed(2)}
                      </Text>
                    </View>
                    {p.opened_by === "auto" && (
                      <View style={styles.autoBadge}>
                        <Ionicons name="flash" size={9} color={Colors.warning} />
                        <Text style={styles.autoBadgeText}>AUTO</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.posPrices}>
                    {fmtPrice(p.open_price, 5)} → {fmtPrice(p.current_price, 5)}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={[styles.posPnl, { color: p.pnl >= 0 ? Colors.bull : Colors.bear }]}>
                    {fmtMoney(p.pnl, account.currency)}
                  </Text>
                  <Text style={[styles.posPips, { color: p.pnl >= 0 ? Colors.bull : Colors.bear }]}>
                    {fmtPips(p.pips)} pips
                  </Text>
                </View>
                <TouchableOpacity
                  testID={`close-position-${p.id}`}
                  style={styles.closeBtn}
                  onPress={() => closePosition(p.id)}
                >
                  <Ionicons name="close" size={16} color={Colors.textPrimary} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.miniLabel}>{label}</Text>
      <Text style={[styles.statValue, highlight ? { color: highlight } : null]}>{value}</Text>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={{ width: 10, height: 2, backgroundColor: color, marginRight: 4 }} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  loader: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.bg },
  scroll: { padding: Spacing.lg, paddingBottom: 80 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.lg },
  brand: { color: Colors.textPrimary, fontSize: 22, fontWeight: "800", letterSpacing: -0.5 },
  mode: { color: Colors.bull, fontSize: 11, fontWeight: "600", marginTop: 2 },
  modeDim: { color: Colors.textMuted, fontWeight: "400" },
  modeBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  modeBadgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  balanceCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  cardLabel: { color: Colors.textMuted, fontSize: 11, fontWeight: "600", letterSpacing: 1 },
  balanceBig: { color: Colors.textPrimary, fontFamily: FontMono, fontSize: 34, fontWeight: "700", marginTop: 6, letterSpacing: -1 },
  balanceRow: { flexDirection: "row", justifyContent: "space-between", marginTop: Spacing.md },
  balanceCol: { flex: 1 },
  miniLabel: { color: Colors.textMuted, fontSize: 10, fontWeight: "600", letterSpacing: 0.5, textTransform: "uppercase" },
  miniValue: { color: Colors.textPrimary, fontFamily: FontMono, fontSize: 14, marginTop: 2, fontWeight: "600" },
  card: { backgroundColor: Colors.surface, borderRadius: 14, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.md },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.sm },
  cardTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: "700" },
  cardSub: { color: Colors.textSecondary, fontFamily: FontMono, fontSize: 14, fontWeight: "700" },
  progressTrack: { height: 8, backgroundColor: "#222226", borderRadius: 4, overflow: "hidden", marginTop: Spacing.xs },
  progressFill: { height: "100%", borderRadius: 4 },
  targetRow: { flexDirection: "row", justifyContent: "space-between", marginTop: Spacing.md },
  targetVal: { color: Colors.textPrimary, fontFamily: FontMono, fontSize: 14, fontWeight: "700", marginTop: 2 },
  alertPill: { flexDirection: "row", alignItems: "center", padding: 8, borderRadius: 8, marginTop: Spacing.md },
  alertText: { fontSize: 12, fontWeight: "600" },
  statsRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: Spacing.md, gap: 8 },
  statBox: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statValue: { color: Colors.textPrimary, fontFamily: FontMono, fontSize: 13, fontWeight: "700", marginTop: 2 },
  chartSection: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  symbolHeader: { color: Colors.textPrimary, fontSize: 20, fontWeight: "800", letterSpacing: -0.5 },
  symbolName: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  priceBig: { fontFamily: FontMono, fontSize: 22, fontWeight: "700" },
  changeText: { fontFamily: FontMono, fontSize: 12, fontWeight: "600", marginTop: 2 },
  legendRow: { flexDirection: "row", flexWrap: "wrap", marginTop: Spacing.sm, gap: 12 },
  legendItem: { flexDirection: "row", alignItems: "center" },
  legendText: { color: Colors.textSecondary, fontSize: 10, fontFamily: FontMono },
  bidAskRow: { flexDirection: "row", gap: 8, marginTop: Spacing.md },
  bidAskCell: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1.5, alignItems: "center", backgroundColor: Colors.bg },
  bidAskLabel: { color: Colors.textMuted, fontSize: 10, fontWeight: "600", letterSpacing: 0.5 },
  bidAskVal: { fontFamily: FontMono, fontSize: 18, fontWeight: "700", marginTop: 4 },
  section: { backgroundColor: Colors.surface, borderRadius: 14, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.sm },
  sectionTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: "700" },
  sectionSub: { color: Colors.textMuted, fontSize: 12, fontWeight: "600" },
  emptyState: { alignItems: "center", paddingVertical: Spacing.lg },
  emptyText: { color: Colors.textMuted, fontSize: 12, marginTop: Spacing.xs },
  posRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 10 },
  posTopRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  posSymbol: { color: Colors.textPrimary, fontSize: 13, fontWeight: "700" },
  sideBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  autoBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(251, 191, 36, 0.15)", paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, gap: 2 },
  autoBadgeText: { color: Colors.warning, fontSize: 8, fontWeight: "800", letterSpacing: 0.5 },
  posPrices: { color: Colors.textMuted, fontSize: 10, fontFamily: FontMono, marginTop: 2 },
  posPnl: { fontFamily: FontMono, fontSize: 14, fontWeight: "700" },
  posPips: { fontFamily: FontMono, fontSize: 10, marginTop: 2 },
  closeBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.surfaceHigh, justifyContent: "center", alignItems: "center" },
});
