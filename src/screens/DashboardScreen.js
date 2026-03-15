import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Modal, FlatList
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  getMonthlyStats, getSettings, getLastFuelLog, getBikes,
  setDefaultBike, getDefaultBikeId, getLastOdometer, getServiceReminders
} from '../database/db';
import { MONTHS, formatCurrency, formatDate } from '../constants';
import { useTheme } from '../context/ThemeContext';
import GlobalFAB from './GlobalFAB';

const StatCard = ({ icon, label, value, sub, color, COLORS, styles }) => (
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
  const { COLORS } = useTheme();
  const styles = makeStyles(COLORS);
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [stats, setStats] = useState(null);
  const [settings, setSettings] = useState({ fuel_price: 108, currency: 'BDT' });
  const [lastFuelLog, setLastFuelLog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bikes, setBikes] = useState([]);
  const [activeBikeId, setActiveBikeId] = useState(1);
  const [activeBike, setActiveBike] = useState(null);
  const [showBikePicker, setShowBikePicker] = useState(false);
  const [reminders, setReminders] = useState([]);
  const [currentOdometer, setCurrentOdometer] = useState(0);

  const loadData = useCallback(() => {
    try {
      const st = getSettings();
      const bikeList = getBikes();
      const bikeId = st.default_bike_id || 1;
      const s = getMonthlyStats(bikeId, selectedYear, selectedMonth);
      const lf = getLastFuelLog(bikeId);
      const odo = getLastOdometer(bikeId);
      const rems = getServiceReminders(bikeId);
      setSettings(st);
      setBikes(bikeList);
      setActiveBikeId(bikeId);
      setActiveBike(bikeList.find(b => b.id === bikeId) || bikeList[0]);
      setStats(s);
      setLastFuelLog(lf);
      setCurrentOdometer(odo);
      setReminders(rems);
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

  const handleSwitchBike = (bike) => {
    setDefaultBike(bike.id);
    setShowBikePicker(false);
    setLoading(true);
    setActiveBikeId(bike.id);
    setActiveBike(bike);
    try {
      const st = getSettings();
      const s = getMonthlyStats(bike.id, selectedYear, selectedMonth);
      const lf = getLastFuelLog(bike.id);
      const odo = getLastOdometer(bike.id);
      const rems = getServiceReminders(bike.id);
      setSettings(st);
      setStats(s);
      setLastFuelLog(lf);
      setCurrentOdometer(odo);
      setReminders(rems);
    } finally {
      setLoading(false);
    }
  };

  const cur = settings.currency;

  // Tank capacity from active bike
  const tankCapacity = activeBike?.tank_capacity || 12;
  const avgMileage = stats?.mileage || 0;

  // Full tank range = tank capacity × avg mileage
  const estimatedRange = avgMileage > 0 ? (tankCapacity * avgMileage).toFixed(0) : null;

  // Total fuel in tank after last refill = purchased litres + remaining fuel that was already there
  const totalFuelInTank = (lastFuelLog?.litres || 0) + (lastFuelLog?.remaining_fuel || 0);

  // Due service reminders
  const dueReminders = reminders.filter(r => {
    const nextDue = r.last_service_km + r.interval_km;
    const kmLeft = nextDue - currentOdometer;
    return kmLeft <= 500;
  });

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={COLORS.primary} />}
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerGreeting}>Dashboard</Text>
            <Text style={styles.headerSub}>Track your riding costs</Text>
          </View>
          <TouchableOpacity style={styles.settingsBtn} onPress={() => navigation.navigate('Settings')}>
            <MaterialCommunityIcons name="cog" size={24} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Multi-bike switcher */}
        <TouchableOpacity style={styles.bikeSwitcher} onPress={() => setShowBikePicker(true)}>
          <View style={styles.bikeSwitcherLeft}>
            <View style={styles.bikeIconBadge}>
              <MaterialCommunityIcons name="motorbike" size={18} color={COLORS.primary} />
            </View>
            <View>
              <Text style={styles.bikeSwitcherName}>{activeBike?.bike_name || 'My Motorcycle'}</Text>
              <Text style={styles.bikeSwitcherSub}>Tank: {tankCapacity}L · {bikes.length} bike{bikes.length !== 1 ? 's' : ''}</Text>
            </View>
          </View>
          <MaterialCommunityIcons name="chevron-down" size={20} color={COLORS.textMuted} />
        </TouchableOpacity>

        {/* Due service alerts */}
        {dueReminders.length > 0 && (
          <TouchableOpacity style={styles.alertBanner} onPress={() => navigation.navigate('Settings')}>
            <MaterialCommunityIcons name="alert-circle" size={18} color={COLORS.accent} />
            <Text style={styles.alertText}>
              {dueReminders.length} service reminder{dueReminders.length > 1 ? 's' : ''} due soon — {dueReminders[0].title}
            </Text>
            <MaterialCommunityIcons name="chevron-right" size={16} color={COLORS.accent} />
          </TouchableOpacity>
        )}

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

            {/* Tank Range Estimator */}
            {estimatedRange && (
              <>
                <View style={styles.sectionTitle}>
                  <MaterialCommunityIcons name="fuel" size={18} color={COLORS.accentGreen} />
                  <Text style={styles.sectionTitleText}>Tank Range Estimator</Text>
                </View>
                <View style={styles.rangeCard}>
                  <View style={styles.rangeItem}>
                    <MaterialCommunityIcons name="road-variant" size={22} color={COLORS.primary} />
                    <Text style={styles.rangeValue}>{estimatedRange} km</Text>
                    <Text style={styles.rangeLabel}>Full Tank Range</Text>
                  </View>
                  <View style={styles.rangeDivider} />
                  <View style={styles.rangeItem}>
                    <MaterialCommunityIcons name="water" size={22} color={COLORS.accentBlue} />
                    <Text style={[styles.rangeValue, { color: COLORS.accentBlue }]}>
                      {totalFuelInTank > 0 ? `${totalFuelInTank.toFixed(2)} L` : '—'}
                    </Text>
                    <Text style={styles.rangeLabel}>In Tank</Text>
                  </View>
                  <View style={styles.rangeDivider} />
                  <View style={styles.rangeItem}>
                    <MaterialCommunityIcons name="speedometer" size={22} color={COLORS.accent} />
                    <Text style={[styles.rangeValue, { color: COLORS.accent }]}>{avgMileage.toFixed(1)} km/L</Text>
                    <Text style={styles.rangeLabel}>Avg Mileage</Text>
                  </View>
                  <View style={styles.rangeDivider} />
                  <View style={styles.rangeItem}>
                    <MaterialCommunityIcons name="map-marker-check" size={22} color={COLORS.accentGreen} />
                    <Text style={[styles.rangeValue, { color: COLORS.accentGreen }]}>
                      {avgMileage > 0 && totalFuelInTank > 0
                        ? `${Math.round(avgMileage * totalFuelInTank + (lastFuelLog?.odometer || 0))} km`
                        : '—'}
                    </Text>
                    <Text style={styles.rangeLabel}>Next Refill</Text>
                  </View>
                </View>
              </>
            )}

            <View style={styles.sectionTitle}>
              <MaterialCommunityIcons name="chart-line" size={18} color={COLORS.primary} />
              <Text style={styles.sectionTitleText}>Riding Stats</Text>
            </View>

            <StatCard icon="map-marker-distance" label="Distance Traveled" value={`${(stats?.distance || 0).toFixed(0)} km`} color={COLORS.accentBlue} COLORS={COLORS} styles={styles} />
            <StatCard icon="gas-station" label="Total Fuel Used" value={`${(stats?.totalLitres || 0).toFixed(2)} L`} sub={`@ ${cur} ${settings.fuel_price}/L`} color={COLORS.primary} COLORS={COLORS} styles={styles} />
            <StatCard icon="speedometer" label="Average Mileage" value={stats?.mileage > 0 ? `${stats.mileage.toFixed(1)} km/L` : '—'} color={COLORS.accentGreen} COLORS={COLORS} styles={styles} />
            <StatCard icon="currency-bdt" label="Cost Per Kilometer" value={stats?.costPerKm > 0 ? `${cur} ${stats.costPerKm.toFixed(2)}/km` : '—'} color={COLORS.accent} COLORS={COLORS} styles={styles} />

            {lastFuelLog && (
              <>
                <View style={styles.sectionTitle}>
                  <MaterialCommunityIcons name="gas-station" size={18} color={COLORS.primary} />
                  <Text style={styles.sectionTitleText}>Last Refuel</Text>
                </View>
                <View style={styles.lastRefuelCard}>
                  {[
                    ['Date', formatDate(lastFuelLog.date)],
                    ['Purchased', `${lastFuelLog.litres.toFixed(2)} L`],
                    lastFuelLog.remaining_fuel > 0 ? ['Was in Tank', `${lastFuelLog.remaining_fuel.toFixed(2)} L`] : null,
                    ['Total in Tank', `${totalFuelInTank.toFixed(2)} L`],
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

            <View style={{ height: 90 }} />
          </>
        )}
      </ScrollView>

      <GlobalFAB navigation={navigation} />

      {/* Bike Picker Modal */}
      <Modal visible={showBikePicker} transparent animationType="slide" onRequestClose={() => setShowBikePicker(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowBikePicker(false)}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Switch Bike</Text>
            <FlatList
              data={bikes}
              keyExtractor={item => String(item.id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.bikePickerItem, item.id === activeBikeId && styles.bikePickerItemActive]}
                  onPress={() => handleSwitchBike(item)}
                >
                  <View style={[styles.bikePickerIcon, { backgroundColor: item.id === activeBikeId ? COLORS.primary + '33' : COLORS.card }]}>
                    <MaterialCommunityIcons name="motorbike" size={22} color={item.id === activeBikeId ? COLORS.primary : COLORS.textMuted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.bikePickerName, item.id === activeBikeId && { color: COLORS.primary }]}>{item.bike_name}</Text>
                    <Text style={styles.bikePickerDetail}>Tank: {item.tank_capacity}L</Text>
                  </View>
                  {item.id === activeBikeId && <MaterialCommunityIcons name="check-circle" size={20} color={COLORS.primary} />}
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.addBikeModalBtn} onPress={() => { setShowBikePicker(false); navigation.navigate('Settings'); }}>
              <MaterialCommunityIcons name="plus-circle-outline" size={18} color={COLORS.primary} />
              <Text style={styles.addBikeModalText}>Manage Bikes in Settings</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const makeStyles = (COLORS) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, paddingHorizontal: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 20, paddingBottom: 10 },
  headerGreeting: { fontSize: 26, fontWeight: '800', color: COLORS.text },
  headerSub: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  settingsBtn: { padding: 8 },

  bikeSwitcher: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.card, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border },
  bikeSwitcherLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bikeIconBadge: { width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.primary + '22', alignItems: 'center', justifyContent: 'center' },
  bikeSwitcherName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  bikeSwitcherSub: { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },

  alertBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.accent + '18', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 10, borderWidth: 1, borderColor: COLORS.accent + '44' },
  alertText: { flex: 1, fontSize: 12, fontWeight: '600', color: COLORS.accent },

  monthSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: 14, backgroundColor: COLORS.card, borderRadius: 14, paddingVertical: 10, height: 52 },
  monthArrow: { paddingHorizontal: 20 },
  monthText: { fontSize: 16, fontWeight: '700', color: COLORS.text, minWidth: 160, textAlign: 'center' },

  heroCard: { backgroundColor: COLORS.primary, borderRadius: 20, padding: 22, marginVertical: 6, elevation: 8 },
  heroLabel: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  heroValue: { fontSize: 40, fontWeight: '900', color: COLORS.white, marginVertical: 6 },
  heroRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  heroItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroItemText: { fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: '500' },
  heroDivider: { width: 1, height: 14, backgroundColor: 'rgba(255,255,255,0.4)', marginHorizontal: 16 },

  rangeCard: { flexDirection: 'row', backgroundColor: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.accentGreen + '40' },
  rangeItem: { flex: 1, alignItems: 'center', gap: 4 },
  rangeValue: { fontSize: 13, fontWeight: '800', color: COLORS.text, marginTop: 4 },
  rangeLabel: { fontSize: 10, color: COLORS.textMuted, textTransform: 'uppercase', textAlign: 'center' },
  rangeDivider: { width: 1, backgroundColor: COLORS.border, marginHorizontal: 4 },

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

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: COLORS.secondary, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36, maxHeight: '70%' },
  modalHandle: { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text, marginBottom: 16 },
  bikePickerItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 4, borderRadius: 12 },
  bikePickerItemActive: { backgroundColor: COLORS.primary + '11' },
  bikePickerIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bikePickerName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  bikePickerDetail: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  addBikeModalBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', paddingTop: 16, borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: 8 },
  addBikeModalText: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
});