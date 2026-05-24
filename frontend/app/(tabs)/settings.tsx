// Settings - account settings, daily target/limits, mode switch, trade history.

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
import { fmtMoney, fmtPips, fmtPrice } from "@/src/format";
import { api, Account, Position } from "@/src/api";

export default function SettingsScreen() {
  const [account, setAccount] = useState<Account | null>(null);
  const [history, setHistory] = useState<Position[]>([]);
  const [target, setTarget] = useState("500");
  const [loss, setLoss] = useState("300");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [acc, hist] = await Promise.all([api.account(), api.history(50)]);
      setAccount(acc);
      setHistory(hist);
      setTarget(String(acc.daily_target));
      setLoss(String(acc.max_daily_loss));
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const switchMode = async () => {
    if (!account) return;
    const newMode = account.mode === "simulation" ? "live" : "simulation";
    if (newMode === "live") {
      Alert.alert(
        "Mode Live indisponible",
        "Connectez un broker MT5 pour activer le mode réel. En attendant, vous restez en simulation.",
      );
      return;
    }
    try {
      const a = await api.setMode(newMode);
      setAccount(a);
    } catch (e: any) {
      Alert.alert("Erreur", e.message);
    }
  };

  const saveTargets = async () => {
    try {
      const a = await api.updateAccountSettings({
        daily_target: Number(target),
        max_daily_loss: Number(loss),
      });
      setAccount(a);
      Alert.alert("✅ Sauvegardé", "Objectifs mis à jour.");
    } catch (e: any) {
      Alert.alert("Erreur", e.message);
    }
  };

  const resetAccount = () => {
    Alert.alert("Réinitialiser le compte", "Cela supprimera toutes les positions et réinitialisera le solde à 10 000€.", [
      { text: "Annuler" },
      {
        text: "Réinitialiser",
        style: "destructive",
        onPress: async () => {
          try {
            const a = await api.resetAccount();
            setAccount(a);
            load();
          } catch (e: any) {
            Alert.alert("Erreur", e.message);
          }
        },
      },
    ]);
  };

  if (loading || !account) {
    return (
      <SafeAreaView style={styles.loader}>
        <ActivityIndicator color={Colors.bull} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Compte</Text>

          {/* Account summary */}
          <View style={styles.card}>
            <View style={styles.row}>
              <View>
                <Text style={styles.label}>Solde</Text>
                <Text style={styles.balance}>{fmtMoney(account.balance, account.currency)}</Text>
              </View>
              <View
                style={[
                  styles.modeChip,
                  { backgroundColor: account.mode === "simulation" ? Colors.accentBg : Colors.bullBg },
                ]}
              >
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: account.mode === "simulation" ? Colors.accent : Colors.bull,
                  }}
                />
                <Text
                  style={[
                    styles.modeChipText,
                    { color: account.mode === "simulation" ? Colors.accent : Colors.bull },
                  ]}
                >
                  {account.mode === "simulation" ? "SIMULATION" : "LIVE"}
                </Text>
              </View>
            </View>
            <View style={styles.subRow}>
              <View>
                <Text style={styles.label}>Levier</Text>
                <Text style={styles.subValue}>1:{account.leverage}</Text>
              </View>
              <View>
                <Text style={styles.label}>Devise</Text>
                <Text style={styles.subValue}>{account.currency}</Text>
              </View>
              <TouchableOpacity testID="switch-mode-btn" onPress={switchMode} style={styles.modeBtn}>
                <Ionicons name="swap-horizontal" size={14} color={Colors.textPrimary} />
                <Text style={styles.modeBtnText}>Basculer</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Daily target settings */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🎯 Objectifs day-trading</Text>
            <Text style={styles.cardSub}>
              Recevez une alerte dès que votre objectif est atteint ou que votre limite de perte est franchie.
            </Text>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Objectif quotidien (€)</Text>
              <TextInput
                testID="daily-target-input"
                style={styles.input}
                value={target}
                onChangeText={setTarget}
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Perte max quotidienne (€)</Text>
              <TextInput
                testID="max-loss-input"
                style={styles.input}
                value={loss}
                onChangeText={setLoss}
                keyboardType="number-pad"
              />
            </View>
            <TouchableOpacity testID="save-targets" style={styles.saveBtn} onPress={saveTargets}>
              <Ionicons name="checkmark" size={16} color="#000" />
              <Text style={styles.saveBtnText}>Sauvegarder</Text>
            </TouchableOpacity>
          </View>

          {/* MT5 connection hint */}
          <View style={styles.mt5Card}>
            <Ionicons name="link" size={18} color={Colors.warning} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.mt5Title}>Connexion MT5 (à venir)</Text>
              <Text style={styles.mt5Sub}>
                L&apos;intégration avec votre broker MetaTrader 5 sera disponible bientôt. Pour le moment, l&apos;app fonctionne en simulation avec données mockées.
              </Text>
            </View>
          </View>

          {/* History */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📜 Historique ({history.length})</Text>
            {history.length === 0 ? (
              <Text style={styles.emptyText}>Aucun trade clôturé pour le moment.</Text>
            ) : (
              history.slice(0, 30).map((p) => (
                <View key={p.id} style={styles.histRow}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                      <Text style={styles.histSym}>{p.symbol}</Text>
                      <View style={[styles.histSide, { backgroundColor: p.side === "buy" ? Colors.bullBg : Colors.bearBg }]}>
                        <Text style={{ color: p.side === "buy" ? Colors.bull : Colors.bear, fontSize: 9, fontWeight: "800" }}>
                          {p.side.toUpperCase()} {p.volume.toFixed(2)}
                        </Text>
                      </View>
                      {p.opened_by === "auto" && (
                        <Ionicons name="flash" size={10} color={Colors.warning} />
                      )}
                    </View>
                    <Text style={styles.histDates}>
                      {fmtPrice(p.open_price, 5)} → {fmtPrice(p.close_price ?? p.current_price, 5)}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={[styles.histPnl, { color: p.pnl >= 0 ? Colors.bull : Colors.bear }]}>
                      {fmtMoney(p.pnl, account.currency)}
                    </Text>
                    <Text style={[styles.histPips, { color: p.pnl >= 0 ? Colors.bull : Colors.bear }]}>
                      {fmtPips(p.pips)} pips
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* Danger zone */}
          <TouchableOpacity testID="reset-account" style={styles.resetBtn} onPress={resetAccount}>
            <Ionicons name="refresh" size={16} color={Colors.bear} />
            <Text style={styles.resetText}>Réinitialiser le compte</Text>
          </TouchableOpacity>

          <Text style={styles.footer}>AutoTrade Pro · Données simulées · v1.0</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  loader: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.bg },
  title: { color: Colors.textPrimary, fontSize: 24, fontWeight: "800", letterSpacing: -0.5, marginBottom: Spacing.md },
  card: { backgroundColor: Colors.surface, borderRadius: 14, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.md },
  cardTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: "700", marginBottom: Spacing.xs },
  cardSub: { color: Colors.textMuted, fontSize: 11, marginBottom: Spacing.sm, lineHeight: 16 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  label: { color: Colors.textMuted, fontSize: 10, fontWeight: "600", letterSpacing: 0.5, textTransform: "uppercase" },
  balance: { color: Colors.textPrimary, fontFamily: FontMono, fontSize: 28, fontWeight: "800", marginTop: 2 },
  subRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: Spacing.md },
  subValue: { color: Colors.textPrimary, fontFamily: FontMono, fontSize: 14, fontWeight: "700", marginTop: 2 },
  modeChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  modeChipText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  modeBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.surfaceHigh, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  modeBtnText: { color: Colors.textPrimary, fontSize: 11, fontWeight: "600" },
  field: { marginBottom: Spacing.md },
  fieldLabel: { color: Colors.textMuted, fontSize: 10, fontWeight: "600", marginBottom: 4, letterSpacing: 0.5, textTransform: "uppercase" },
  input: { backgroundColor: Colors.bg, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, padding: 10, color: Colors.textPrimary, fontSize: 16, fontFamily: FontMono, fontWeight: "700" },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: Colors.bull, padding: 12, borderRadius: 10 },
  saveBtnText: { color: "#000", fontWeight: "800", fontSize: 13 },
  mt5Card: { flexDirection: "row", padding: Spacing.md, backgroundColor: "rgba(251, 191, 36, 0.08)", borderRadius: 12, borderWidth: 1, borderColor: "rgba(251, 191, 36, 0.25)", marginBottom: Spacing.md },
  mt5Title: { color: Colors.textPrimary, fontSize: 13, fontWeight: "700" },
  mt5Sub: { color: Colors.textSecondary, fontSize: 11, lineHeight: 16, marginTop: 2 },
  emptyText: { color: Colors.textMuted, fontSize: 11, textAlign: "center", paddingVertical: Spacing.md },
  histRow: { flexDirection: "row", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border, alignItems: "center" },
  histSym: { color: Colors.textPrimary, fontSize: 13, fontWeight: "700" },
  histSide: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  histDates: { color: Colors.textMuted, fontSize: 10, fontFamily: FontMono, marginTop: 2 },
  histPnl: { fontFamily: FontMono, fontSize: 13, fontWeight: "700" },
  histPips: { fontFamily: FontMono, fontSize: 10, marginTop: 2 },
  resetBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, borderRadius: 12, backgroundColor: Colors.bearBg, borderWidth: 1, borderColor: Colors.bear, marginBottom: Spacing.lg },
  resetText: { color: Colors.bear, fontSize: 13, fontWeight: "700" },
  footer: { color: Colors.textMuted, fontSize: 10, textAlign: "center", marginTop: Spacing.lg },
});
