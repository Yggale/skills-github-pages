// Mini RSI line chart anchored to the same window as the main chart.

import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Colors, FontMono } from "@/src/theme";

type Props = {
  values: (number | null)[];
  overbought: number;
  oversold: number;
  height?: number;
};

const W = 320;

export default function RsiChart({ values, overbought, oversold, height = 80 }: Props) {
  const segments = useMemo(() => {
    if (!values || values.length < 2) return [];
    const window = values.slice(-60);
    const w = W / window.length;
    const pts = window.map((v, i) => ({
      x: i * w + w / 2,
      y: v == null ? null : height - (v / 100) * height,
    }));
    const segs = [];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      if (a.y == null || b.y == null) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      segs.push(
        <View
          key={i}
          style={{
            position: "absolute",
            left: a.x,
            top: a.y,
            width: length,
            height: 1.4,
            backgroundColor: Colors.accent,
            transform: [{ translateY: -0.7 }, { rotateZ: `${angle}deg` }],
            transformOrigin: "0 0" as any,
          }}
        />,
      );
    }
    return segs;
  }, [values, height]);

  const last = values.length ? values[values.length - 1] : null;

  return (
    <View style={[styles.wrap, { height }]} testID="rsi-chart">
      {/* Overbought / oversold bands */}
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: height - (overbought / 100) * height,
          height: 1,
          backgroundColor: "rgba(255, 59, 48, 0.45)",
        }}
      />
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: height - (oversold / 100) * height,
          height: 1,
          backgroundColor: "rgba(0, 230, 118, 0.45)",
        }}
      />
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: height - (50 / 100) * height,
          height: 1,
          backgroundColor: "rgba(255,255,255,0.06)",
        }}
      />
      {segments}
      <Text style={[styles.label, { top: 2 }]}>RSI {last != null ? last.toFixed(1) : "—"}</Text>
      <Text style={[styles.tick, { top: height - (overbought / 100) * height - 12 }]}>{overbought}</Text>
      <Text style={[styles.tick, { top: height - (oversold / 100) * height + 2 }]}>{oversold}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: W,
    backgroundColor: "#0A0A0A",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    overflow: "hidden",
    position: "relative",
  },
  label: {
    position: "absolute",
    left: 6,
    color: Colors.textSecondary,
    fontFamily: FontMono,
    fontSize: 10,
  },
  tick: {
    position: "absolute",
    right: 4,
    color: Colors.textMuted,
    fontFamily: FontMono,
    fontSize: 9,
  },
});
