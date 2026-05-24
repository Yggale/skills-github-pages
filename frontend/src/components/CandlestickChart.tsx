// Lightweight pure-View candlestick chart with indicator overlays.
// No external chart deps - rescales heights based on the visible window.

import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Colors, FontMono } from "@/src/theme";
import { Candle, Indicators } from "@/src/api";

type Props = {
  candles: Candle[];
  indicators?: Indicators;
  height?: number;
  showBB?: boolean;
  showMA?: boolean;
  showEMA?: boolean;
  digits?: number;
};

const CHART_W = 320;

export default function CandlestickChart({
  candles,
  indicators,
  height = 220,
  showBB = true,
  showMA = true,
  showEMA = true,
  digits = 5,
}: Props) {
  const { candleBars, lines, priceMin, priceMax } = useMemo(() => {
    if (!candles.length) return { candleBars: [], lines: {}, priceMin: 0, priceMax: 1 };
    const visible = candles.slice(-60);
    const start = candles.length - visible.length;
    let pMin = Math.min(...visible.map((c) => c.l));
    let pMax = Math.max(...visible.map((c) => c.h));

    const consider = (arr?: (number | null)[]) => {
      if (!arr) return;
      for (let i = start; i < arr.length; i++) {
        const v = arr[i];
        if (v != null) {
          if (v < pMin) pMin = v;
          if (v > pMax) pMax = v;
        }
      }
    };
    if (showBB && indicators) {
      consider(indicators.bb_upper);
      consider(indicators.bb_lower);
    }
    if (showMA && indicators) {
      consider(indicators.ma_fast);
      consider(indicators.ma_slow);
    }
    if (showEMA && indicators) {
      consider(indicators.ema_fast);
      consider(indicators.ema_slow);
    }

    const range = pMax - pMin || 1;
    const pad = range * 0.05;
    pMin -= pad;
    pMax += pad;
    const finalRange = pMax - pMin;
    const scale = (p: number) => height - ((p - pMin) / finalRange) * height;
    const barW = CHART_W / visible.length;

    const bars = visible.map((c, i) => {
      const x = i * barW;
      const top = scale(Math.max(c.o, c.c));
      const bot = scale(Math.min(c.o, c.c));
      const bodyH = Math.max(bot - top, 1);
      const wickTop = scale(c.h);
      const wickBot = scale(c.l);
      const up = c.c >= c.o;
      return { x, barW, top, bodyH, wickTop, wickBot, up };
    });

    const buildLine = (arr?: (number | null)[]) => {
      if (!arr) return [];
      const out: { x: number; y: number; valid: boolean }[] = [];
      for (let i = 0; i < visible.length; i++) {
        const v = arr[start + i];
        const x = i * barW + barW / 2;
        if (v == null) {
          out.push({ x, y: 0, valid: false });
        } else {
          out.push({ x, y: scale(v), valid: true });
        }
      }
      return out;
    };

    return {
      candleBars: bars,
      lines: {
        bb_upper: buildLine(indicators?.bb_upper),
        bb_middle: buildLine(indicators?.bb_middle),
        bb_lower: buildLine(indicators?.bb_lower),
        ma_fast: buildLine(indicators?.ma_fast),
        ma_slow: buildLine(indicators?.ma_slow),
        ema_fast: buildLine(indicators?.ema_fast),
        ema_slow: buildLine(indicators?.ema_slow),
      },
      priceMin: pMin,
      priceMax: pMax,
    };
  }, [candles, indicators, height, showBB, showMA, showEMA]);

  const renderLine = (
    points: { x: number; y: number; valid: boolean }[],
    color: string,
  ) => {
    if (!points || points.length < 2) return null;
    const segs = [];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      if (!a.valid || !b.valid) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      segs.push(
        <View
          key={`${color}-${i}`}
          style={{
            position: "absolute",
            left: a.x,
            top: a.y,
            width: length,
            height: 1.4,
            backgroundColor: color,
            transform: [{ translateY: -0.7 }, { rotateZ: `${angle}deg` }],
            transformOrigin: "0 0" as any,
          }}
        />,
      );
    }
    return segs;
  };

  return (
    <View style={[styles.wrap, { height }]} testID="candlestick-chart">
      {/* Price scale gridlines */}
      {[0.25, 0.5, 0.75].map((p) => (
        <View key={p} style={[styles.gridline, { top: height * p }]} />
      ))}

      {/* Candles */}
      {candleBars.map((b, i) => (
        <React.Fragment key={i}>
          <View
            style={{
              position: "absolute",
              left: b.x + b.barW / 2 - 0.5,
              top: b.wickTop,
              width: 1,
              height: Math.max(b.wickBot - b.wickTop, 1),
              backgroundColor: b.up ? Colors.bull : Colors.bear,
              opacity: 0.7,
            }}
          />
          <View
            style={{
              position: "absolute",
              left: b.x + 1,
              top: b.top,
              width: Math.max(b.barW - 2, 1),
              height: b.bodyH,
              backgroundColor: b.up ? Colors.bull : Colors.bear,
              borderRadius: 1,
            }}
          />
        </React.Fragment>
      ))}

      {/* Indicator overlays */}
      {showBB && (
        <>
          {renderLine(lines.bb_upper, "rgba(59, 130, 246, 0.7)")}
          {renderLine(lines.bb_middle, "rgba(59, 130, 246, 0.35)")}
          {renderLine(lines.bb_lower, "rgba(59, 130, 246, 0.7)")}
        </>
      )}
      {showMA && (
        <>
          {renderLine(lines.ma_fast, "rgba(251, 191, 36, 0.95)")}
          {renderLine(lines.ma_slow, "rgba(244, 114, 182, 0.95)")}
        </>
      )}
      {showEMA && (
        <>
          {renderLine(lines.ema_fast, "rgba(0, 230, 118, 0.95)")}
          {renderLine(lines.ema_slow, "rgba(168, 85, 247, 0.95)")}
        </>
      )}

      {/* Price axis labels */}
      <Text style={[styles.priceLabel, { top: 2 }]}>{priceMax.toFixed(digits)}</Text>
      <Text style={[styles.priceLabel, { bottom: 2 }]}>{priceMin.toFixed(digits)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: CHART_W,
    backgroundColor: "#0A0A0A",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    overflow: "hidden",
    position: "relative",
  },
  gridline: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  priceLabel: {
    position: "absolute",
    right: 4,
    color: Colors.textMuted,
    fontFamily: FontMono,
    fontSize: 9,
  },
});
