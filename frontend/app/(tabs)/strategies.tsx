// Strategies - configure & toggle automated trading strategies (RSI, BB, MA, EMA).

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
import { api, Strategy, Instrument } from "@/src/api";

export default function StrategiesScreen() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [editing, setEditing] = useState<Strategy | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [s, inst] = await Promise.all([api.strategies(), api.instruments()]);
      setStrategies(s);
      setInstruments(inst);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (id: string) => {
    try {
      await api.toggleStrategy(id);
      load();
    } catch (e: any) {
      Alert.alert("Erreur", e.message);
    }
  };

  const save = async () => {
    if (!editing) return;
    try {
      await api.saveStrategy(editing);
      setEditing(null);
      load();
    } catch (e: any) {
      Alert.alert("Erreur", e.message);
    }
  };

  const newStrategy = () => {
    setEditing({
      id: cryptoRandom(),
      name: "Nouvelle stratégie",
      enabled: false,
      symbols: ["AUDUSD"],
      use_rsi: true,
      rsi_period: 14,
      rsi_oversold: 30,
      rsi_overbought: 70,
      use_bb: true,
      bb_period: 20,
      bb_mult: 2.0,
      use_ma: true,
      ma_fast: 20,
      ma_slow: 50,
      use_ema: true,
      ema_fast: 9,
      ema_slow: 20,
      volume: 0.1,
      stop_loss_pips: 20,
      take_profit_pips: 40,
      max_open_positions: 3,
      confirm_signals: 2,
    });
  };

  const deleteStrategy = (id: string) => {
    Alert.alert("Supprimer", "Êtes-vous sûr ?", [
      { text: "Annuler" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          try {
            await api.deleteStrategy(id);
            load();
          } catch (e: any) {
            Alert.alert("Erreur", e.message);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loader}>
        <ActivityIndicator color={Colors.bull} />
      </SafeAreaView>
    );
  }

  if (editing) {
    return (
      <StrategyEditor
        strategy={editing}
        setStrategy={setEditing}
        onCancel={() => setEditing(null)}
        onSave={save}
        instruments={instruments}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Trading auto</Text>
        <TouchableOpacity testID="new-strategy-btn" style={styles.newBtn} onPress={newStrategy}>
          <Ionicons name="add" size={18} color="#000" />
          <Text style={styles.newBtnText}>Nouvelle</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 100 }}>
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={16} color={Colors.accent} />
          <Text style={styles.infoText}>
            Les stratégies day-trading utilisent RSI + Bollinger + EMA 9/20 + MA 20/50 pour générer des signaux. Activez une stratégie pour démarrer le trading automatique.
          </Text>
        </View>

        {strategies.map((s) => (
          <View key={s.id} style={styles.card} testID={`strategy-${s.id}`}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>{s.name}</Text>
                <Text style={styles.cardSyms}>{s.symbols.join(" · ")}</Text>
              </View>
              <TouchableOpacity
                testID={`toggle-strategy-${s.id}`}
                onPress={() => toggle(s.id)}
                style={[styles.toggle, s.enabled && styles.toggleOn]}
              >
                <View style={[styles.toggleBall, s.enabled && styles.toggleBallOn]} />
              </TouchableOpacity>
            </View>

            <View style={styles.tagsRow}>
              {s.use_rsi && <Tag label={`RSI ${s.rsi_period} (${s.rsi_oversold}/${s.rsi_overbought})`} color={Colors.accent} />}
              {s.use_bb && <Tag label={`BB ${s.bb_period}/${s.bb_mult}`} color={Colors.accent} />}
              {s.use_ma && <Tag label={`MA ${s.ma_fast}/${s.ma_slow}`} color="rgba(251, 191, 36, 1)" />}
              {s.use_ema && <Tag label={`EMA ${s.ema_fast}/${s.ema_slow}`} color={Colors.bull} />}
            </View>

            <View style={styles.riskRow}>
              <RiskCol label="Volume" value={`${s.volume.toFixed(2)} lot`} />
              <RiskCol label="SL" value={`${s.stop_loss_pips} pips`} />
              <RiskCol label="TP" value={`${s.take_profit_pips} pips`} />
              <RiskCol label="Max pos" value={String(s.max_open_positions)} />
            </View>

            <View style={styles.actionsRow}>
              <TouchableOpacity testID={`edit-strategy-${s.id}`} style={styles.editBtn} onPress={() => setEditing(s)}>
                <Ionicons name="create-outline" size={14} color={Colors.textPrimary} />
                <Text style={styles.editBtnText}>Modifier</Text>
              </TouchableOpacity>
              <TouchableOpacity testID={`delete-strategy-${s.id}`} style={styles.delBtn} onPress={() => deleteStrategy(s.id)}>
                <Ionicons name="trash-outline" size={14} color={Colors.bear} />
              </TouchableOpacity>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: s.enabled ? Colors.bullBg : Colors.surfaceHigh },
                ]}
              >
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: s.enabled ? Colors.bull : Colors.textMuted,
                  }}
                />
                <Text style={[styles.statusText, { color: s.enabled ? Colors.bull : Colors.textMuted }]}>
                  {s.enabled ? "ACTIF" : "INACTIF"}
                </Text>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function StrategyEditor({
  strategy,
  setStrategy,
  onCancel,
  onSave,
  instruments,
}: {
  strategy: Strategy;
  setStrategy: (s: Strategy) => void;
  onCancel: () => void;
  onSave: () => void;
  instruments: Instrument[];
}) {
  const update = <K extends keyof Strategy>(k: K, v: Strategy[K]) => setStrategy({ ...strategy, [k]: v });
  const toggleSym = (sym: string) => {
    const has = strategy.symbols.includes(sym);
    update("symbols", has ? strategy.symbols.filter((s) => s !== sym) : [...strategy.symbols, sym]);
  };
  const forexSyms = instruments.filter((i) => i.category.startsWith("Forex")).slice(0, 20);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <TouchableOpacity testID="cancel-edit" onPress={onCancel} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>Configuration</Text>
          <TouchableOpacity testID="save-strategy" style={styles.newBtn} onPress={onSave}>
            <Ionicons name="checkmark" size={18} color="#000" />
            <Text style={styles.newBtnText}>Sauver</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
          <Section title="Identité">
            <FieldText label="Nom" value={strategy.name} onChangeText={(v) => update("name", v)} testID="strategy-name" />
          </Section>

          <Section title="Instruments (Forex)">
            <View style={styles.symGrid}>
              {forexSyms.map((i) => {
                const sel = strategy.symbols.includes(i.symbol);
                return (
                  <TouchableOpacity
                    key={i.symbol}
                    testID={`sym-${i.symbol}`}
                    style={[styles.symPill, sel && styles.symPillOn]}
                    onPress={() => toggleSym(i.symbol)}
                  >
                    <Text style={[styles.symPillText, sel && { color: "#000", fontWeight: "800" }]}>{i.symbol}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Section>

          <Section title="RSI - Force Relative">
            <Switch label="Activer" value={strategy.use_rsi} onValueChange={(v) => update("use_rsi", v)} testID="use-rsi" />
            {strategy.use_rsi && (
              <View style={styles.row3}>
                <FieldNum label="Période" value={strategy.rsi_period} onChangeText={(v) => update("rsi_period", Number(v) || 14)} testID="rsi-period" />
                <FieldNum label="Survente" value={strategy.rsi_oversold} onChangeText={(v) => update("rsi_oversold", Number(v) || 30)} testID="rsi-oversold" />
                <FieldNum label="Surachat" value={strategy.rsi_overbought} onChangeText={(v) => update("rsi_overbought", Number(v) || 70)} testID="rsi-overbought" />
              </View>
            )}
          </Section>

          <Section title="Bandes de Bollinger">
            <Switch label="Activer" value={strategy.use_bb} onValueChange={(v) => update("use_bb", v)} testID="use-bb" />
            {strategy.use_bb && (
              <View style={styles.row2}>
                <FieldNum label="Période" value={strategy.bb_period} onChangeText={(v) => update("bb_period", Number(v) || 20)} testID="bb-period" />
                <FieldNum label="Écart-type" value={strategy.bb_mult} onChangeText={(v) => update("bb_mult", Number(v) || 2.0)} testID="bb-mult" decimal />
              </View>
            )}
          </Section>

          <Section title="Moyennes Mobiles (MA)">
            <Switch label="Activer" value={strategy.use_ma} onValueChange={(v) => update("use_ma", v)} testID="use-ma" />
            {strategy.use_ma && (
              <View style={styles.row2}>
                <FieldNum label="MA rapide" value={strategy.ma_fast} onChangeText={(v) => update("ma_fast", Number(v) || 20)} testID="ma-fast" />
                <FieldNum label="MA lente" value={strategy.ma_slow} onChangeText={(v) => update("ma_slow", Number(v) || 50)} testID="ma-slow" />
              </View>
            )}
          </Section>

          <Section title="EMA - Exponentielle (Réactivité)">
            <Switch label="Activer" value={strategy.use_ema} onValueChange={(v) => update("use_ema", v)} testID="use-ema" />
            {strategy.use_ema && (
              <>
                <View style={styles.row2}>
                  <FieldNum label="EMA rapide" value={strategy.ema_fast} onChangeText={(v) => update("ema_fast", Number(v) || 9)} testID="ema-fast" />
                  <FieldNum label="EMA lente" value={strategy.ema_slow} onChangeText={(v) => update("ema_slow", Number(v) || 20)} testID="ema-slow" />
                </View>
                <Text style={styles.hint}>💡 EMA 9 capture la réactivité, EMA 20 confirme la tendance courte.</Text>
              </>
            )}
          </Section>

          <Section title="Gestion du risque">
            <View style={styles.row3}>
              <FieldNum label="Volume (lots)" value={strategy.volume} onChangeText={(v) => update("volume", Number(v) || 0.1)} testID="vol" decimal />
              <FieldNum label="SL (pips)" value={strategy.stop_loss_pips} onChangeText={(v) => update("stop_loss_pips", Number(v) || 20)} testID="sl-pips" />
              <FieldNum label="TP (pips)" value={strategy.take_profit_pips} onChangeText={(v) => update("take_profit_pips", Number(v) || 40)} testID="tp-pips" />
            </View>
            <View style={styles.row2}>
              <FieldNum label="Max positions" value={strategy.max_open_positions} onChangeText={(v) => update("max_open_positions", Number(v) || 3)} testID="max-pos" />
              <FieldNum label="Signaux requis" value={strategy.confirm_signals} onChangeText={(v) => update("confirm_signals", Number(v) || 2)} testID="confirm-signals" />
            </View>
          </Section>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Switch({ label, value, onValueChange, testID }: { label: string; value: boolean; onValueChange: (v: boolean) => void; testID?: string }) {
  return (
    <View style={styles.switchRow}>
      <Text style={styles.switchLabel}>{label}</Text>
      <TouchableOpacity testID={testID} style={[styles.toggle, value && styles.toggleOn]} onPress={() => onValueChange(!value)}>
        <View style={[styles.toggleBall, value && styles.toggleBallOn]} />
      </TouchableOpacity>
    </View>
  );
}

function FieldText({ label, value, onChangeText, testID }: { label: string; value: string; onChangeText: (v: string) => void; testID?: string }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput testID={testID} style={styles.input} value={value} onChangeText={onChangeText} placeholderTextColor={Colors.textMuted} />
    </View>
  );
}

function FieldNum({ label, value, onChangeText, testID, decimal }: { label: string; value: number; onChangeText: (v: string) => void; testID?: string; decimal?: boolean }) {
  return (
    <View style={{ flex: 1, marginBottom: 6 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        testID={testID}
        keyboardType={decimal ? "decimal-pad" : "number-pad"}
        style={[styles.input, { fontFamily: FontMono }]}
        value={String(value)}
        onChangeText={onChangeText}
        placeholderTextColor={Colors.textMuted}
      />
    </View>
  );
}

function Tag({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.tag, { borderColor: color }]}>
      <Text style={[styles.tagText, { color }]}>{label}</Text>
    </View>
  );
}

function RiskCol({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.riskLabel}>{label}</Text>
      <Text style={styles.riskValue}>{value}</Text>
    </View>
  );
}

function cryptoRandom() {
  // RFC4122-ish without expo-crypto dep.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  loader: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  iconBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center", backgroundColor: Colors.surface },
  title: { color: Colors.textPrimary, fontSize: 22, fontWeight: "800", letterSpacing: -0.5 },
  newBtn: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.bull, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, gap: 4 },
  newBtnText: { color: "#000", fontWeight: "800", fontSize: 12 },
  infoBox: { flexDirection: "row", gap: 8, padding: 12, backgroundColor: Colors.accentBg, borderRadius: 10, marginBottom: Spacing.md, alignItems: "flex-start" },
  infoText: { color: Colors.textPrimary, fontSize: 11, flex: 1, lineHeight: 16 },
  card: { backgroundColor: Colors.surface, borderRadius: 14, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.md },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: Spacing.sm },
  cardName: { color: Colors.textPrimary, fontSize: 15, fontWeight: "700" },
  cardSyms: { color: Colors.textMuted, fontSize: 10, marginTop: 2, fontFamily: FontMono },
  toggle: { width: 42, height: 24, borderRadius: 12, backgroundColor: Colors.surfaceHigh, padding: 2, justifyContent: "center" },
  toggleOn: { backgroundColor: Colors.bull },
  toggleBall: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff" },
  toggleBallOn: { alignSelf: "flex-end" },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: Spacing.sm },
  tag: { borderWidth: 1, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
  tagText: { fontSize: 10, fontWeight: "700", fontFamily: FontMono },
  riskRow: { flexDirection: "row", paddingVertical: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border, marginBottom: Spacing.sm },
  riskLabel: { color: Colors.textMuted, fontSize: 9, fontWeight: "600", letterSpacing: 0.5, textTransform: "uppercase" },
  riskValue: { color: Colors.textPrimary, fontFamily: FontMono, fontSize: 12, fontWeight: "700", marginTop: 2 },
  actionsRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  editBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.surfaceHigh, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  editBtnText: { color: Colors.textPrimary, fontSize: 11, fontWeight: "600" },
  delBtn: { backgroundColor: Colors.bearBg, padding: 7, borderRadius: 8 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, marginLeft: "auto" },
  statusText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  section: { backgroundColor: Colors.surface, borderRadius: 14, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.md },
  sectionTitle: { color: Colors.textPrimary, fontSize: 13, fontWeight: "700", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 },
  switchLabel: { color: Colors.textPrimary, fontSize: 13, fontWeight: "600" },
  fieldLabel: { color: Colors.textMuted, fontSize: 10, fontWeight: "600", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 },
  input: { backgroundColor: Colors.bg, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, padding: 10, color: Colors.textPrimary, fontSize: 14 },
  row2: { flexDirection: "row", gap: 10, marginTop: 4 },
  row3: { flexDirection: "row", gap: 8, marginTop: 4 },
  symGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  symPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: Colors.surfaceHigh, borderWidth: 1, borderColor: Colors.border },
  symPillOn: { backgroundColor: Colors.bull, borderColor: Colors.bull },
  symPillText: { color: Colors.textPrimary, fontSize: 11, fontWeight: "600", fontFamily: FontMono },
  hint: { color: Colors.textSecondary, fontSize: 11, fontStyle: "italic", marginTop: 8, lineHeight: 16 },
});
