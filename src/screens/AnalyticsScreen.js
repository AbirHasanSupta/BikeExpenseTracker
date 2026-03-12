import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import { getMonthlyStats, getSettings, getStationStats, getTagStats, getDefaultBikeId } from '../database/db';
import { COLORS, MONTHS, RIDE_TAGS, formatCurrency, getRideTagInfo } from '../constants';
import GlobalFAB from './GlobalFAB';

const W = Dimensions.get('window').width - 32;
const chartConfig = {
  backgroundGradientFrom: COLORS.card,
  backgroundGradientTo: COLORS.card,
  color: (opacity = 1) => `rgba(255, 107, 53, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(168, 178, 196, ${opacity})`,
  strokeWidth: 2,
  barPercentage: 0.6,
  decimalPlaces: 0,
  propsForDots: { r: '4', strokeWidth: '2', stroke: COLORS.primary },
  propsForBackgroundLines: { stroke: COLORS.border, strokeDasharray: '4' },
};

export default function AnalyticsScreen({ navigation }) {
  const [monthlyData, setMonthlyData] = useState([]);
  const [currency, setCurrency] = useState('BDT');
  const [loading, setLoading] = useState(true);
  const [stationStats, setStationStats] = useState([]);
  const [tagStats, setTagStats] = useState([]);

  const loadData = useCallback(() => {
    try {
      const st = getSettings();
      const bikeId = getDefaultBikeId();
      setCurrency(st.currency);
      const now = new Date();
      const months = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const stats = getMonthlyStats(bikeId, d.getFullYear(), d.getMonth() + 1);
        months.push({ label: MONTHS[d.getMonth()].slice(0, 3), ...stats });
      }
      setMonthlyData(months);
      setStationStats(getStationStats(bikeId));
      setTagStats(getTagStats(bikeId, now.getFullYear(), now.getMonth() + 1));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); loadData(); }, [loadData]));

  if (loading) return <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator color={COLORS.primary} size="large" /></View>;

  const hasData = monthlyData.some(m => m.totalCost > 0);
  const current = monthlyData[monthlyData.length - 1] || {};
  const prev = monthlyData[monthlyData.length - 2] || {};
  const costTrend = prev.totalCost > 0 ? ((current.totalCost - prev.totalCost) / prev.totalCost * 100).toFixed(1) : null;

  const safeData = (arr) => arr.map(v => Math.max(0, Math.round(v) || 0));

  const costData = { labels: monthlyData.map(m => m.label), datasets: [{ data: safeData(monthlyData.map(m => m.totalCost)), color: (o = 1) => `rgba(255,107,53,${o})`, strokeWidth: 2 }] };
  const barData = { labels: monthlyData.map(m => m.label), datasets: [{ data: safeData(monthlyData.map(m => m.totalFuelCost)) }] };
  const pieData = [
    { name: 'Fuel', population: Math.round(current.totalFuelCost || 0), color: COLORS.primary, legendFontColor: COLORS.textSecondary, legendFontSize: 13 },
    { name: 'Maint', population: Math.round(current.totalMaintenance || 0), color: COLORS.accentGreen, legendFontColor: COLORS.textSecondary, legendFontSize: 13 },
  ].filter(d => d.population > 0);

  // Tag pie data
  const tagColors = { personal: COLORS.accentBlue, office: '#FF9800', travel: COLORS.accentGreen, other: '#9E9E9E' };
  const tagPieData = tagStats
    .filter(t => t.totalCost > 0)
    .map(t => ({
      name: getRideTagInfo(t.tag).label,
      population: Math.round(t.totalCost),
      color: tagColors[t.tag] || '#9E9E9E',
      legendFontColor: COLORS.textSecondary,
      legendFontSize: 12,
    }));

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Analytics</Text>
        <Text style={styles.subtitle}>Last 6 months</Text>
      </View>

      {!hasData ? (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="chart-line" size={60} color={COLORS.textMuted} />
          <Text style={styles.emptyText}>No data yet</Text>
          <Text style={styles.emptySub}>Add fuel entries to see analytics</Text>
        </View>
      ) : (
        <>
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>This Month</Text>
              <Text style={styles.summaryValue}>{formatCurrency(current.totalCost, currency)}</Text>
              {costTrend && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <MaterialCommunityIcons name={parseFloat(costTrend) > 0 ? 'trending-up' : 'trending-down'} size={14} color={parseFloat(costTrend) > 0 ? COLORS.accentRed : COLORS.accentGreen} />
                  <Text style={{ fontSize: 11, fontWeight: '600', color: parseFloat(costTrend) > 0 ? COLORS.accentRed : COLORS.accentGreen }}>{Math.abs(costTrend)}% vs last month</Text>
                </View>
              )}
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Avg Mileage</Text>
              <Text style={styles.summaryValue}>{current.mileage > 0 ? `${current.mileage.toFixed(1)} km/L` : '—'}</Text>
              <Text style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 4 }}>{current.distance.toFixed(0)} km traveled</Text>
            </View>
          </View>

          {current.costPerKm > 0 && (
            <View style={styles.costKmCard}>
              <MaterialCommunityIcons name="road-variant" size={22} color={COLORS.accent} />
              <Text style={styles.costKmText}>True riding cost: <Text style={{ color: COLORS.accent, fontWeight: '800' }}>{currency} {current.costPerKm.toFixed(2)}/km</Text></Text>
            </View>
          )}

          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Monthly Expenses</Text>
            <LineChart data={costData} width={W} height={200} chartConfig={chartConfig} bezier style={styles.chart} withInnerLines withOuterLines={false} />
          </View>

          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Fuel Cost by Month</Text>
            <BarChart data={barData} width={W} height={200} chartConfig={chartConfig} style={styles.chart} showValuesOnTopOfBars withInnerLines={false} />
          </View>

          {pieData.length > 0 && (
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>This Month Breakdown</Text>
              <PieChart data={pieData} width={W} height={180} chartConfig={chartConfig} accessor="population" backgroundColor="transparent" paddingLeft="15" style={styles.chart} />
            </View>
          )}

          {/* Ride Tag Breakdown */}
          {tagPieData.length > 0 && (
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Spending by Ride Type</Text>
              <PieChart data={tagPieData} width={W} height={180} chartConfig={chartConfig} accessor="population" backgroundColor="transparent" paddingLeft="15" style={styles.chart} />
              <View style={styles.tagStatsList}>
                {tagStats.filter(t => t.totalCost > 0).map(t => {
                  const info = getRideTagInfo(t.tag);
                  return (
                    <View key={t.tag} style={styles.tagStatRow}>
                      <View style={[styles.tagDot, { backgroundColor: tagColors[t.tag] || '#9E9E9E' }]} />
                      <MaterialCommunityIcons name={info.icon} size={14} color={tagColors[t.tag] || '#9E9E9E'} />
                      <Text style={styles.tagStatLabel}>{info.label}</Text>
                      <Text style={styles.tagStatValue}>{formatCurrency(t.totalCost, currency)}</Text>
                      {t.litres > 0 && <Text style={styles.tagStatSub}>{t.litres.toFixed(1)}L</Text>}
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Fuel Station Mileage Comparison */}
          {stationStats.length > 0 && (
            <View style={styles.chartCard}>
              <View style={styles.chartHeaderRow}>
                <Text style={styles.chartTitle}>Station Mileage Comparison</Text>
                <MaterialCommunityIcons name="map-marker-check" size={16} color={COLORS.textMuted} />
              </View>
              <Text style={styles.chartSubtitle}>Average km/L per fuel station (min 2 fills to compare)</Text>
              {stationStats.slice(0, 6).map((station, idx) => {
                const maxMileage = stationStats[0]?.avgMileage || 1;
                const pct = (station.avgMileage / maxMileage) * 100;
                const isTop = idx === 0;
                return (
                  <View key={station.name} style={styles.stationRow}>
                    <View style={styles.stationHeader}>
                      <View style={styles.stationNameRow}>
                        {isTop && <MaterialCommunityIcons name="crown" size={12} color={COLORS.accent} style={{ marginRight: 4 }} />}
                        <Text style={[styles.stationName, isTop && { color: COLORS.accent }]} numberOfLines={1}>{station.name}</Text>
                      </View>
                      <Text style={[styles.stationMileage, isTop && { color: COLORS.accentGreen }]}>
                        {station.avgMileage.toFixed(1)} km/L
                      </Text>
                    </View>
                    <View style={styles.stationBarBg}>
                      <View style={[styles.stationBarFill, { width: `${pct}%`, backgroundColor: isTop ? COLORS.accentGreen : COLORS.primary }]} />
                    </View>
                    <Text style={styles.stationFills}>{station.fills} fill{station.fills !== 1 ? 's' : ''}</Text>
                  </View>
                );
              })}
              {stationStats.length === 0 && (
                <Text style={styles.noStationText}>Add fuel with station names to compare mileage</Text>
              )}
            </View>
          )}

          <View style={{ height: 30 }} />
        </>
      )}
    </ScrollView>
    <GlobalFAB />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, paddingHorizontal: 16 },
  header: { paddingTop: 20, paddingBottom: 16 },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.text },
  subtitle: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  summaryCard: { flex: 1, backgroundColor: COLORS.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: COLORS.border },
  summaryLabel: { fontSize: 12, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryValue: { fontSize: 18, fontWeight: '800', color: COLORS.text, marginTop: 6 },
  costKmCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.card, borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: COLORS.accent + '40' },
  costKmText: { fontSize: 14, color: COLORS.textSecondary, flex: 1 },
  chartCard: { backgroundColor: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border },
  chartHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  chartTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  chartSubtitle: { fontSize: 11, color: COLORS.textMuted, marginBottom: 12 },
  chart: { borderRadius: 8, marginLeft: -8 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyText: { fontSize: 18, fontWeight: '700', color: COLORS.textSecondary, marginTop: 16 },
  emptySub: { fontSize: 13, color: COLORS.textMuted, marginTop: 8, textAlign: 'center' },

  // Tag stats
  tagStatsList: { marginTop: 12, gap: 8 },
  tagStatRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderTopWidth: 1, borderTopColor: COLORS.border },
  tagDot: { width: 8, height: 8, borderRadius: 4 },
  tagStatLabel: { flex: 1, fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  tagStatValue: { fontSize: 13, fontWeight: '800', color: COLORS.text },
  tagStatSub: { fontSize: 11, color: COLORS.textMuted, marginLeft: 4 },

  // Station comparison
  stationRow: { marginBottom: 14 },
  stationHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  stationNameRow: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  stationName: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, flexShrink: 1 },
  stationMileage: { fontSize: 13, fontWeight: '800', color: COLORS.primary },
  stationBarBg: { height: 8, backgroundColor: COLORS.border, borderRadius: 4, overflow: 'hidden' },
  stationBarFill: { height: 8, borderRadius: 4 },
  stationFills: { fontSize: 10, color: COLORS.textMuted, marginTop: 3 },
  noStationText: { fontSize: 12, color: COLORS.textMuted, textAlign: 'center', paddingVertical: 12 },
});