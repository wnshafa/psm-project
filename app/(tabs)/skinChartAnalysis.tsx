import React from 'react';
import {
  StyleSheet,
  Text,
  View
} from 'react-native';
import { COLORS } from "../src/constants/theme";

// ─── Types ─────────────────────────────────────────────────

export type SkinMetric = {
  label: string
  value: number
  color?: string
}

type SkinAnalysisChartProps = {
  data?: SkinMetric[]
  title?: string
  subtitle?: string
}

// ─── Dummy Data ────────────────────────────────────────────

const DEFAULT_METRICS: SkinMetric[] = [
  { label: 'Hydration', value: 72, color: '#4ecdc4' },
  { label: 'Oiliness', value: 45, color: '#ff6b6b' },
  { label: 'Sensitivity', value: 60, color: '#f7b731' },
  { label: 'Brightness', value: 80, color: '#a29bfe' },
]

// ─── Score Label ───────────────────────────────────────────

function getScoreLabel(value: number) {
  if (value >= 75) return { label: 'Great', color: '#51cf66' }
  if (value >= 50) return { label: 'Moderate', color: '#f7b731' }
  return { label: 'Low', color: '#ff6b6b' }
}

// ─── Component ─────────────────────────────────────────────

export default function SkinAnalysisChart({
  data = DEFAULT_METRICS,
  title = 'Skin Analysis',
  subtitle = 'Your latest skin health overview',
}: SkinAnalysisChartProps) {
  return (
    <View style={styles.container}>
      {/* Header */}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>

      {/* Chart */}
      <View style={styles.chartArea}>
        {data.map((metric) => {
          const score = getScoreLabel(metric.value)
          const barColor = metric.color ?? COLORS.primary

          return (
            <View key={metric.label} style={styles.row}>
              {/* Label */}
              <Text style={styles.label}>{metric.label}</Text>

              {/* Bar */}
              <View style={styles.trackBackground}>
                <View
                  style={[
                    styles.trackFill,
                    {
                      flex: metric.value / 100, // ✅ FIXED (NO SCREEN WIDTH)
                      backgroundColor: barColor,
                    },
                  ]}
                />
                <View style={{ flex: 1 - metric.value / 100 }} />
              </View>

              {/* Value */}
              <View style={styles.valueContainer}>
                <Text style={styles.value}>{metric.value}%</Text>
                <Text style={[styles.scoreLabel, { color: score.color }]}>
                  {score.label}
                </Text>
              </View>
            </View>
          )
        })}
      </View>
<View style={styles.card}>
  <Text style={styles.insightTitle}>Skin Insight</Text>

  <Text style={styles.insightText}>
    Your skin shows strong brightness levels, indicating good radiance and tone.
    However, oiliness is relatively low, which may lead to dryness.
    Maintaining hydration will help improve overall skin balance.
  </Text>

  <Text style={styles.insightText}>
    Recommended focus: Use hydrating and brightening products such as
    Vitamin C serum and moisturizers.
  </Text>
</View>
      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#51cf66' }]} />
          <Text style={styles.legendText}>Great ≥75%</Text>
        </View>

        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#f7b731' }]} />
          <Text style={styles.legendText}>Moderate ≥50%</Text>
        </View>

        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#ff6b6b' }]} />
          <Text style={styles.legendText}>Low &lt;50%</Text>
        </View>
      </View>
    </View>
  )
}

// ─── Styles ────────────────────────────────────────────────

const styles = StyleSheet.create({
 screen: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 20, gap: 16, paddingBottom: 40 },
section: {
  backgroundColor: '#F5F7FA', // SAME as products
  borderRadius: 20,
  padding: 16,
},

card: {
  backgroundColor: '#fff',
  padding: 16,
  borderRadius: 16,
  marginTop: 10,

  shadowColor: '#000',
  shadowOpacity: 0.05,
  shadowRadius: 10,
  elevation: 3,
},
  // Header
  header: { marginBottom: 4 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: COLORS.textPrimary },
  headerSubtitle: { fontSize: 14, color: COLORS.textSecondary },

  // Section
 
  container: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
  },
 

  title: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },

  subtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },

  chartArea: {
    gap: 12,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  label: {
    width: 80,
    fontSize: 12,
    color: COLORS.textSecondary,
  },

  trackBackground: {
    flex: 1,
    flexDirection: 'row', // ✅ IMPORTANT
    height: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    overflow: 'hidden',
  },

  trackFill: {
    height: '100%',
    borderRadius: 20,
    minWidth: 6,
  },

  valueContainer: {
    width: 70,
    alignItems: 'flex-end',
  },

  value: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },

  scoreLabel: {
    fontSize: 10,
    fontWeight: '600',
  },

  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 10,
  },
  innerCard: {
  backgroundColor: '#fff',
  borderRadius: 16,
  padding: 16,

  shadowColor: '#000',
  shadowOpacity: 0.05,
  shadowRadius: 10,
  elevation: 3,
},
insightTitle: {
  fontSize: 16,
  fontWeight: "700",
  marginBottom: 8,
  color: COLORS.textPrimary,
},

insightText: {
  fontSize: 13,
  color: COLORS.textSecondary,
  marginBottom: 6,
  lineHeight: 18,
},
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  legendText: {
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  sectionSubtitle: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 12 },
})