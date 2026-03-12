import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getMonthlyStats, getSettings, getLastFuelLog } from '../database/db';
import { COLORS, MONTHS, formatCurrency, formatDate } from '../constants';

const StatCard = ({ icon, label, value, sub, color }) => (
  <View style={[styles.statCard, { borderLeftColor: color || COLORS.primary }]}>
    <View style={[styles.statIcon, { backgroundColor: (color || COLORS.primary) + '22' }]}>
      <MaterialCommunityIcons name={icon} size={22} color={color || COLORS.primary} />
    </View>
    <View style={styles.statText}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  </View>
);

export default function DashboardScreen({ navigation }) {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [stats, setStats] = useState(null);
  const [settings, setSettings] = useState({ fuel_price: 108, currency: 'BDT' });
  const [lastFuelLog, setLastFuelLog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(() => {
    try {
      const s = getMonthlyStats(1, selectedYear, selectedMonth);
      const st = getSettings();
      const lf = getLastFuelLog(1);
      setStats(s);
      setSettings(st);
      setLastFuelLog(lf);
    } catch (e) {
      console.error('Dashboard load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedMonth, selectedYear]);

  useFocusEffect(useCallback(() => { setLoading(true); loadData(); }, [loadData]));

  const changeMonth = (dir) => {
    let m = selectedMonth + dir;
    let y = selectedYear;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    setSelectedMonth(m);
    setSelectedYear(y);
  };

  const cur = settings.currency;

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={COLORS.primary} />}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.headerGreeting}>Dashboard</Text>
          <Text style={styles.headerSub}>Track your riding costs</Text>
        </View>
        <TouchableOpacity style={styles.settingsBtn} onPress={() => navigation.navigate('Settings')}>
          <MaterialCommunityIcons name="cog" size={24} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.monthSelector}>
        <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.monthArrow}>
          <MaterialCommunityIcons name="chevron-left" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.monthText}>{MONTHS[selectedMonth - 1]} {selectedYear}</Text>
        <TouchableOpacity onPress={() => changeMonth(1)} style={styles.monthArrow}>
          <MaterialCommunityIcons name="chevron-right" size={24} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} size="large" style={{ marginTop: 60 }} />
      ) : (
        <>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>Total Monthly Expense</Text>
            <Text style={styles.heroValue}>{formatCurrency(stats?.totalCost, cur)}</Text>
            <View style={styles.heroRow}>
              <View style={styles.heroItem}>
                <MaterialCommunityIcons name="gas-station" size={16} color="rgba(255,255,255,0.9)" />
                <Text style={styles.heroItemText}>Fuel: {formatCurrency(stats?.totalFuelCost, cur)}</Text>
              </View>
              <View style={styles.heroDivider} />
              <View style={styles.heroItem}>
                <MaterialCommunityIcons name="wrench" size={16} color="rgba(255,255,255,0.9)" />
                <Text style={styles.heroItemText}>Maint: {formatCurrency(stats?.totalMaintenance, cur)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.sectionTitle}>
            <MaterialCommunityIcons name="chart-line" size={18} color={COLORS.primary} />
            <Text style={styles.sectionTitleText}>Riding Stats</Text>
          </View>

          <StatCard icon="map-marker-distance" label="Distance Traveled" value={`${(stats?.distance || 0).toFixed(0)} km`} color={COLORS.accentBlue} />
          <StatCard icon="gas-station" label="Total Fuel Used" value={`${(stats?.totalLitres || 0).toFixed(2)} L`} sub={`@ ${cur} ${settings.fuel_price}/L`} color={COLORS.primary} />
          <StatCard icon="speedometer" label="Average Mileage" value={stats?.mileage > 0 ? `${stats.mileage.toFixed(1)} km/L` : '—'} color={COLORS.accentGreen} />
          <StatCard icon="currency-bdt" label="Cost Per Kilometer" value={stats?.costPerKm > 0 ? `${cur} ${stats.costPerKm.toFixed(2)}/km` : '—'} color={COLORS.accent} />

          {lastFuelLog && (
            <>
              <View style={styles.sectionTitle}>
                <MaterialCommunityIcons name="gas-station" size={18} color={COLORS.primary} />
                <Text style={styles.sectionTitleText}>Last Refuel</Text>
              </View>
              <View style={styles.lastRefuelCard}>
                {[
                  ['Date', formatDate(lastFuelLog.date)],
                  ['Litres', `${lastFuelLog.litres.toFixed(2)} L`],
                  ['Cost', formatCurrency(lastFuelLog.total_cost, cur)],
                  ['Odometer', `${lastFuelLog.odometer.toLocaleString()} km`],
                  lastFuelLog.station_name ? ['Station', lastFuelLog.station_name] : null,
                ].filter(Boolean).map(([label, value]) => (
                  <View key={label} style={styles.lastRefuelRow}>
                    <Text style={styles.lastRefuelLabel}>{label}</Text>
                    <Text style={styles.lastRefuelValue}>{value}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          <View style={styles.sectionTitle}>
            <MaterialCommunityIcons name="lightning-bolt" size={18} color={COLORS.primary} />
            <Text style={styles.sectionTitleText}>Quick Add</Text>
          </View>
          <View style={styles.quickActions}>
            <TouchableOpacity style={[styles.quickBtn, { backgroundColor: COLORS.primary }]} onPress={() => navigation.navigate('AddFuel')}>
              <MaterialCommunityIcons name="gas-station" size={26} color={COLORS.white} />
              <Text style={styles.quickBtnText}>Add Fuel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.quickBtn, { backgroundColor: COLORS.accentGreen }]} onPress={() => navigation.navigate('AddExpense')}>
              <MaterialCommunityIcons name="wrench" size={26} color={COLORS.white} />
              <Text style={styles.quickBtnText}>Add Expense</Text>
            </TouchableOpacity>
          </View>
          <View style={{ height: 30 }} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, paddingHorizontal: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 20, paddingBottom: 10 },
  headerGreeting: { fontSize: 26, fontWeight: '800', color: COLORS.text },
  headerSub: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  settingsBtn: { padding: 8 },
  monthSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: 14, backgroundColor: COLORS.card, borderRadius: 14, paddingVertical: 10 },
  monthArrow: { paddingHorizontal: 20 },
  monthText: { fontSize: 16, fontWeight: '700', color: COLORS.text, minWidth: 160, textAlign: 'center' },
  heroCard: { backgroundColor: COLORS.primary, borderRadius: 20, padding: 22, marginVertical: 6, elevation: 8 },
  heroLabel: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  heroValue: { fontSize: 40, fontWeight: '900', color: COLORS.white, marginVertical: 6 },
  heroRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  heroItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroItemText: { fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: '500' },
  heroDivider: { width: 1, height: 14, backgroundColor: 'rgba(255,255,255,0.4)', marginHorizontal: 16 },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20, marginBottom: 10 },
  sectionTitleText: { fontSize: 15, fontWeight: '700', color: COLORS.text, textTransform: 'uppercase', letterSpacing: 0.5 },
  statCard: { backgroundColor: COLORS.card, borderRadius: 14, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', borderLeftWidth: 4, elevation: 3 },
  statIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  statText: { flex: 1 },
  statValue: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  statLabel: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  statSub: { fontSize: 11, color: COLORS.textSecondary, marginTop: 1 },
  lastRefuelCard: { backgroundColor: COLORS.card, borderRadius: 14, padding: 16, marginBottom: 10 },
  lastRefuelRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  lastRefuelLabel: { fontSize: 13, color: COLORS.textMuted },
  lastRefuelValue: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  quickActions: { flexDirection: 'row', gap: 12, marginBottom: 6 },
  quickBtn: { flex: 1, borderRadius: 16, padding: 18, alignItems: 'center', gap: 8, elevation: 5 },
  quickBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.white },
});
