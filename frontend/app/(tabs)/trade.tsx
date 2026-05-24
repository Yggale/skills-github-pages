// Trade screen - place market orders for the selected symbol with SL/TP.

import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors, FontMono, Spacing } from "@/src/theme";
import { fmtPrice, fmtMoney, fmtPct } from "@/src/format";
import { api, Instrument } from "@/src/api";
import { useSymbol } from "@/src/context";
import CandlestickChart from "@/src/components/CandlestickChart";
import { Candle, Indicators } from "@/src/api";

export default function TradeScreen() {
  const { symbol } = useSymbol();
  const [instrument, setInstrument] = useState<Instrument | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [indicators, setIndicators] = useState<Indicators | null>(null);
  const [volume, setVolume] = useState("0.10");
  const [slPips, setSlPips] = useState("20");
  const [tpPips, setTpPips] = useState("40");
  const [useSlTp, setUseSlTp] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [inst, kdat] = await Promise.all([
        api.instrument(symbol),
        api.candles(symbol, { limit: 60, ema_fast: 9, ema_slow: 20, ma_fast: 20, ma_slow: 50 }),
      ]);
      setInstrument(inst);
      setCandles(kdat.candles);
      setIndicators(kdat.indicators);
    } catch (e) {
      console.warn(e);
    }
  }, [symbol]);

  useEffect(() => {
    load();
    const id = setInterval(load, 2000);
    return () => clearInterval(id);
  }, [load]);

  const place = async (side: "buy" | "sell") => {
    if (!instrument) return;
    const vol = parseFloat(volume);
    if (Number.isNaN(vol) || vol <= 0) {
      Alert.alert("Volume invalide", "Volume doit être > 0 (ex: 0.10)");
      return;
    }
    const price = side === "buy" ? instrument.ask : instrument.bid;
    const pip = instrument.digits >= 4 ? 0.0001 : (instrument.digits >= 3 ? 0.01 : 1);
    const sl = useSlTp ? Number(slPips) : null;
    const tp = useSlTp ? Number(tpPips) : null;
    const stopLoss = sl ? (side === "buy" ? price - sl * pip : price + sl * pip) : null;
    const takeProfit = tp ? (side === "buy" ? price + tp * pip : price - tp * pip) : null;
    setSubmitting(true);
    try {
      await api.createOrder({
        symbol: instrument.symbol,
        side,
        volume: vol,
        stop_loss: stopLoss,
        take_profit: takeProfit,
        comment: "Manual",
      });
      Alert.alert("✅ Ordre exécuté", `${side.toUpperCase()} ${vol} ${instrument.symbol} @ ${price.toFixed(instrument.digits)}`);
    } catch (e: any) {
      Alert.alert("Erreur", e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!instrument) {
    return (
      <SafeAreaView style={styles.loader}>
        <ActivityIndicator color={Colors.bull} />
      </SafeAreaView>
    );
  }

  const up = instrument.change >= 0;
  const dayColor = up ? Colors.bull : Colors.bear;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Symbol header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.sym} testID="trade-symbol">{instrument.symbol}</Text>
              <Text style={styles.symName}>{instrument.name}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={[styles.price, { color: dayColor }]}>{fmtPrice(instrument.last, instrument.digits)}</Text>
              <Text style={[styles.change, { color: dayColor }]}>{fmtPct(instrument.change_pct)}</Text>
            </View>
          </View>

          <CandlestickChart
            candles={candles}
            indicators={indicators || undefined}
            digits={instrument.digits}
            height={180}
          />

          {/* Order form */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Nouvel ordre</Text>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Volume (lots)</Text>
              <View style={styles.volRow}>
                <TouchableOpacity testID="vol-dec" onPress={() => setVolume((parseFloat(volume) - 0.01).toFixed(2))} style={styles.stepBtn}>
                  <Ionicons name="remove" size={18} color={Colors.textPrimary} />
                </TouchableOpacity>
                <TextInput
                  testID="volume-input"
                  value={volume}
                  onChangeText={setVolume}
                  keyboardType="decimal-pad"
                  style={styles.volInput}
                  placeholderTextColor={Colors.textMuted}
                />
                <TouchableOpacity testID="vol-inc" onPress={() => setVolume((parseFloat(volume) + 0.01).toFixed(2))} style={styles.stepBtn}>
                  <Ionicons name="add" size={18} color={Colors.textPrimary} />
                </TouchableOpacity>
                <View style={{ flexDirection: "row", gap: 6, marginLeft: 8 }}>
                  {["0.01", "0.10", "1.00"].map((v) => (
                    <TouchableOpacity key={v} onPress={() => setVolume(v)} style={styles.preset} testID={`vol-preset-${v}`}>
                      <Text style={styles.presetText}>{v}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {/* SL/TP toggle */}
            <View style={styles.field}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={styles.fieldLabel}>Stop Loss / Take Profit</Text>
                <TouchableOpacity
                  testID="sltp-toggle"
                  onPress={() => setUseSlTp(!useSlTp)}
                  style={[styles.toggle, useSlTp && styles.toggleOn]}
                >
                  <View style={[styles.toggleBall, useSlTp && styles.toggleBallOn]} />
                </TouchableOpacity>
              </View>
              {useSlTp && (
                <View style={styles.sltpRow}>
                  <View style={styles.sltpCol}>
                    <Text style={styles.sltpLabel}>SL (pips)</Text>
                    <TextInput
                      testID="sl-input"
                      value={slPips}
                      onChangeText={setSlPips}
                      keyboardType="number-pad"
                      style={[styles.sltpInput, { color: Colors.bear }]}
                      placeholderTextColor={Colors.textMuted}
                    />
                  </View>
                  <View style={styles.sltpCol}>
                    <Text style={styles.sltpLabel}>TP (pips)</Text>
                    <TextInput
                      testID="tp-input"
                      value={tpPips}
                      onChangeText={setTpPips}
                      keyboardType="number-pad"
                      style={[styles.sltpInput, { color: Colors.bull }]}
                      placeholderTextColor={Colors.textMuted}
                    />
                  </View>
                </View>
              )}
            </View>

            {/* Buy/Sell buttons */}
            <View style={styles.btnRow}>
              <TouchableOpacity
                testID="sell-button"
                disabled={submitting}
                style={[styles.actionBtn, { backgroundColor: Colors.bearBg, borderColor: Colors.bear }]}
                onPress={() => place("sell")}
              >
                <Text style={[styles.actionLabel, { color: Colors.bear }]}>SELL</Text>
                <Text style={[styles.actionPrice, { color: Colors.bear }]}>{fmtPrice(instrument.bid, instrument.digits)}</Text>
                <Text style={styles.actionHint}>BID</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="buy-button"
                disabled={submitting}
                style={[styles.actionBtn, { backgroundColor: Colors.bullBg, borderColor: Colors.bull }]}
                onPress={() => place("buy")}
              >
                <Text style={[styles.actionLabel, { color: Colors.bull }]}>BUY</Text>
                <Text style={[styles.actionPrice, { color: Colors.bull }]}>{fmtPrice(instrument.ask, instrument.digits)}</Text>
                <Text style={styles.actionHint}>ASK</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.spreadHint}>Spread: {((instrument.ask - instrument.bid) * Math.pow(10, instrument.digits)).toFixed(1)} pts</Text>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Détails du marché</Text>
            <InfoRow label="Plus haut (24h)" value={fmtPrice(instrument.day_high, instrument.digits)} />
            <InfoRow label="Plus bas (24h)" value={fmtPrice(instrument.day_low, instrument.digits)} />
            <InfoRow label="Variation" value={fmtMoney(instrument.change, "")} highlight={dayColor} />
            <InfoRow label="Catégorie" value={instrument.category} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, highlight ? { color: highlight } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  loader: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.bg },
  scroll: { padding: Spacing.lg, paddingBottom: 100 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.md },
  sym: { color: Colors.textPrimary, fontSize: 22, fontWeight: "800", letterSpacing: -0.5 },
  symName: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  price: { fontFamily: FontMono, fontSize: 22, fontWeight: "700" },
  change: { fontFamily: FontMono, fontSize: 12, marginTop: 2 },
  card: { backgroundColor: Colors.surface, borderRadius: 14, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, marginTop: Spacing.md },
  cardTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: "700", marginBottom: Spacing.md },
  field: { marginBottom: Spacing.md },
  fieldLabel: { color: Colors.textSecondary, fontSize: 11, fontWeight: "600", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  volRow: { flexDirection: "row", alignItems: "center" },
  stepBtn: { width: 36, height: 36, borderRadius: 8, backgroundColor: Colors.surfaceHigh, justifyContent: "center", alignItems: "center" },
  volInput: { flex: 1, height: 36, marginHorizontal: 6, backgroundColor: Colors.bg, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 10, color: Colors.textPrimary, fontFamily: FontMono, fontSize: 16, textAlign: "center" },
  preset: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6, backgroundColor: Colors.surfaceHigh },
  presetText: { color: Colors.textPrimary, fontSize: 10, fontWeight: "600", fontFamily: FontMono },
  toggle: { width: 40, height: 22, borderRadius: 11, backgroundColor: Colors.surfaceHigh, padding: 2, justifyContent: "center" },
  toggleOn: { backgroundColor: Colors.bull },
  toggleBall: { width: 18, height: 18, borderRadius: 9, backgroundColor: "#fff" },
  toggleBallOn: { alignSelf: "flex-end" },
  sltpRow: { flexDirection: "row", gap: 10 },
  sltpCol: { flex: 1 },
  sltpLabel: { color: Colors.textMuted, fontSize: 10, fontWeight: "600", marginBottom: 4 },
  sltpInput: { backgroundColor: Colors.bg, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, padding: 10, fontFamily: FontMono, fontSize: 14, fontWeight: "700" },
  btnRow: { flexDirection: "row", gap: 10, marginTop: Spacing.md },
  actionBtn: { flex: 1, borderRadius: 12, padding: 14, alignItems: "center", borderWidth: 2 },
  actionLabel: { fontSize: 14, fontWeight: "900", letterSpacing: 1 },
  actionPrice: { fontFamily: FontMono, fontSize: 20, fontWeight: "800", marginTop: 4 },
  actionHint: { color: Colors.textMuted, fontSize: 9, marginTop: 2, fontWeight: "600" },
  spreadHint: { color: Colors.textMuted, fontSize: 10, marginTop: 8, textAlign: "center", fontFamily: FontMono },
  infoCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, marginTop: Spacing.md },
  infoTitle: { color: Colors.textPrimary, fontSize: 13, fontWeight: "700", marginBottom: Spacing.sm },
  infoRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border },
  infoLabel: { color: Colors.textMuted, fontSize: 11 },
  infoValue: { color: Colors.textPrimary, fontFamily: FontMono, fontSize: 12, fontWeight: "600" },
});
