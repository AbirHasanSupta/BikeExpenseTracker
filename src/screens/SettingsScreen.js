import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, Alert, Share, Switch } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  getSettings, updateSettings, getBikes, addBike, deleteBike, setDefaultBike,
  getServiceReminders, addServiceReminder, updateReminderServiceKm, deleteServiceReminder,
  getLastOdometer, getAllDataForExport,
} from '../database/db';
import { useTheme } from '../context/ThemeContext';
import { checkAndNotifyReminders } from '../utils/notifications';
import { formatDate } from '../constants';

const DEFAULT_REMINDERS = [
  { title: 'Engine Oil Change', intervalKm: 3000 },
  { title: 'Chain Lubrication', intervalKm: 500 },
  { title: 'Air Filter Clean', intervalKm: 5000 },
  { title: 'Full Service', intervalKm: 6000 },
];

export default function SettingsScreen({ navigation }) {
  const { COLORS, theme, toggleTheme } = useTheme();
  const styles = makeStyles(COLORS);

  const [fuelPrice, setFuelPrice] = useState('108');
  const [currency, setCurrency] = useState('BDT');
  const [bikes, setBikes] = useState([]);
  const [defaultBikeId, setDefaultBikeIdState] = useState(1);
  const [newBikeName, setNewBikeName] = useState('');
  const [tankCapacity, setTankCapacity] = useState('12');
  const [showAddBike, setShowAddBike] = useState(false);
  const [reminders, setReminders] = useState([]);
  const [showAddReminder, setShowAddReminder] = useState(false);
  const [reminderTitle, setReminderTitle] = useState('');
  const [reminderInterval, setReminderInterval] = useState('');
  const [reminderLastKm, setReminderLastKm] = useState('');
  const [currentOdometer, setCurrentOdometer] = useState(0);
  const [activeBikeId, setActiveBikeId] = useState(1);

  useEffect(() => { loadData(); }, []);

  const loadData = () => {
    const st = getSettings();
    const bikeId = st.default_bike_id || 1;
    setFuelPrice(String(st.fuel_price));
    setCurrency(st.currency);
    setDefaultBikeIdState(bikeId);
    setActiveBikeId(bikeId);
    setBikes(getBikes());
    const rems = getServiceReminders(bikeId);
    setReminders(rems);
    const odo = getLastOdometer(bikeId);
    setCurrentOdometer(odo);
    // Check and send notifications for due reminders
    checkAndNotifyReminders(rems, odo);
  };

  const handleSaveSettings = () => {
    if (!fuelPrice || parseFloat(fuelPrice) <= 0) { Alert.alert('Invalid', 'Please enter a valid fuel price.'); return; }
    try {
      updateSettings(parseFloat(fuelPrice), currency, activeBikeId, theme);
      Alert.alert('Saved', 'Settings updated successfully.');
    } catch (e) { Alert.alert('Error', 'Failed to save settings.'); }
  };

  const handleSetDefaultBike = (id) => {
    setDefaultBike(id);
    setActiveBikeId(id);
    const rems = getServiceReminders(id);
    setReminders(rems);
    const odo = getLastOdometer(id);
    setCurrentOdometer(odo);
    updateSettings(parseFloat(fuelPrice), currency, id, theme);
    checkAndNotifyReminders(rems, odo);
  };

  const handleAddBike = () => {
    if (!newBikeName.trim()) { Alert.alert('Name Required', 'Please enter a bike name.'); return; }
    addBike(newBikeName.trim(), parseFloat(tankCapacity) || 12, '');
    setNewBikeName(''); setTankCapacity('12'); setShowAddBike(false);
    setBikes(getBikes());
    Alert.alert('Bike Added', `${newBikeName} has been added.`);
  };

  const handleDeleteBike = (bike) => {
    if (bikes.length <= 1) { Alert.alert('Cannot Delete', 'You need at least one bike.'); return; }
    Alert.alert('Delete Bike', `Delete "${bike.bike_name}" and all its data?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        deleteBike(bike.id);
        const remaining = getBikes();
        setBikes(remaining);
        if (activeBikeId === bike.id && remaining.length > 0) handleSetDefaultBike(remaining[0].id);
      }},
    ]);
  };

  const handleAddReminder = (preset = null) => {
    const title = preset ? preset.title : reminderTitle.trim();
    const interval = preset ? preset.intervalKm : parseFloat(reminderInterval);
    const lastKm = preset ? currentOdometer : (parseFloat(reminderLastKm) || currentOdometer);
    if (!title) { Alert.alert('Required', 'Please enter a reminder title.'); return; }
    if (!interval || interval <= 0) { Alert.alert('Required', 'Please enter a valid interval in km.'); return; }
    addServiceReminder({ bikeId: activeBikeId, title, intervalKm: interval, lastServiceKm: lastKm });
    const rems = getServiceReminders(activeBikeId);
    setReminders(rems);
    setShowAddReminder(false);
    setReminderTitle(''); setReminderInterval(''); setReminderLastKm('');
    checkAndNotifyReminders(rems, currentOdometer);
  };

  const handleMarkServiced = (reminder) => {
    Alert.alert('Mark as Serviced', `Set last service km to current odometer (${currentOdometer} km)?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: () => {
        updateReminderServiceKm(reminder.id, currentOdometer);
        const rems = getServiceReminders(activeBikeId);
        setReminders(rems);
        checkAndNotifyReminders(rems, currentOdometer);
      }},
    ]);
  };

  const handleDeleteReminder = (id) => {
    Alert.alert('Delete Reminder', 'Remove this service reminder?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        deleteServiceReminder(id);
        setReminders(getServiceReminders(activeBikeId));
      }},
    ]);
  };

  const handleExportCSV = async () => {
    try {
      const { fuelLogs, expenses } = getAllDataForExport(activeBikeId);
      const activeBike = bikes.find(b => b.id === activeBikeId);
      let csv = `MotoLog Export\nBike: ${activeBike?.bike_name || 'Unknown'}\n\n`;
      csv += 'FUEL LOGS\nDate,Litres,Price/L,Total Cost,Odometer,Station,Notes,Tag\n';
      for (const log of fuelLogs) {
        csv += `${log.date},${log.litres},${log.price_per_litre},${log.total_cost},${log.odometer},"${log.station_name || ''}","${log.notes || ''}",${log.ride_tag || 'personal'}\n`;
      }
      csv += '\nEXPENSES\nDate,Category,Cost,Notes,Tag\n';
      for (const exp of expenses) {
        csv += `${exp.date},${exp.category},${exp.cost},"${exp.notes || ''}",${exp.ride_tag || 'personal'}\n`;
      }
      await Share.share({ message: csv, title: 'Bike Expense Data' });
    } catch (e) { Alert.alert('Export Failed', 'Could not export data.'); }
  };

  const getReminderStatus = (reminder) => {
    const nextDue = reminder.last_service_km + reminder.interval_km;
    const kmLeft = nextDue - currentOdometer;
    if (kmLeft <= 0) return { label: 'OVERDUE', color: COLORS.accentRed, icon: 'alert-circle' };
    if (kmLeft <= 300) return { label: `${kmLeft.toFixed(0)} km left`, color: COLORS.accent, icon: 'alert' };
    if (kmLeft <= 500) return { label: `${kmLeft.toFixed(0)} km left`, color: '#FF9800', icon: 'clock-alert' };
    return { label: `${kmLeft.toFixed(0)} km left`, color: COLORS.accentGreen, icon: 'check-circle' };
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Appearance */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Appearance</Text>
        <View style={styles.card}>
          <View style={styles.themeRow}>
            <View style={styles.themeLeft}>
              <MaterialCommunityIcons name={theme === 'dark' ? 'moon-waning-crescent' : 'white-balance-sunny'} size={22} color={theme === 'dark' ? COLORS.accentPurple : COLORS.accent} />
              <View>
                <Text style={styles.themeLabel}>{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</Text>
                <Text style={styles.themeSubLabel}>Tap to switch theme</Text>
              </View>
            </View>
            <Switch
              value={theme === 'light'}
              onValueChange={toggleTheme}
              trackColor={{ false: COLORS.border, true: COLORS.primary + '88' }}
              thumbColor={theme === 'light' ? COLORS.primary : COLORS.textMuted}
            />
          </View>
        </View>
      </View>

      {/* Fuel Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Fuel Settings</Text>
        <View style={styles.card}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Fuel Price per Litre</Text>
            <View style={styles.inputWrapper}>
              <MaterialCommunityIcons name="currency-bdt" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
              <TextInput style={[styles.input, { paddingLeft: 40 }]} value={fuelPrice} onChangeText={setFuelPrice} keyboardType="decimal-pad" placeholder="108" placeholderTextColor={COLORS.textMuted} />
            </View>
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Currency</Text>
            <View style={styles.currencyRow}>
              {['BDT', 'USD', 'EUR', 'INR'].map(c => (
                <TouchableOpacity key={c} style={[styles.currencyBtn, currency === c && styles.currencyBtnActive]} onPress={() => setCurrency(c)}>
                  <Text style={[styles.currencyText, currency === c && styles.currencyTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSaveSettings}>
            <MaterialCommunityIcons name="content-save" size={18} color={COLORS.white} />
            <Text style={styles.saveBtnText}>Save Settings</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* My Bikes */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>My Bikes</Text>
        <View style={styles.card}>
          {bikes.map(bike => (
            <View key={bike.id} style={styles.bikeItem}>
              <View style={[styles.bikeIcon, { backgroundColor: bike.id === activeBikeId ? COLORS.primary + '22' : COLORS.card }]}>
                <MaterialCommunityIcons name="motorbike" size={20} color={bike.id === activeBikeId ? COLORS.primary : COLORS.textMuted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.bikeName, bike.id === activeBikeId && { color: COLORS.primary }]}>{bike.bike_name}</Text>
                <Text style={styles.bikeDetail}>Tank: {bike.tank_capacity}L</Text>
              </View>
              <View style={styles.bikeActions}>
                {bike.id !== activeBikeId ? (
                  <TouchableOpacity style={styles.setDefaultBtn} onPress={() => handleSetDefaultBike(bike.id)}>
                    <Text style={styles.setDefaultText}>Set Active</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.bikeBadge}><Text style={styles.bikeBadgeText}>Active</Text></View>
                )}
                {bikes.length > 1 && (
                  <TouchableOpacity onPress={() => handleDeleteBike(bike)} style={styles.deleteBtn}>
                    <MaterialCommunityIcons name="trash-can-outline" size={16} color={COLORS.accentRed} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
          {showAddBike ? (
            <View style={styles.addBikeForm}>
              <TextInput style={styles.input} value={newBikeName} onChangeText={setNewBikeName} placeholder="Bike name (e.g. Yamaha FZ)" placeholderTextColor={COLORS.textMuted} />
              <TextInput style={[styles.input, { marginTop: 10 }]} value={tankCapacity} onChangeText={setTankCapacity} placeholder="Tank capacity (litres)" keyboardType="decimal-pad" placeholderTextColor={COLORS.textMuted} />
              <View style={styles.addBikeActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAddBike(false)}><Text style={styles.cancelBtnText}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity style={styles.confirmBtn} onPress={handleAddBike}><Text style={styles.confirmBtnText}>Add Bike</Text></TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.addBikeBtn} onPress={() => setShowAddBike(true)}>
              <MaterialCommunityIcons name="plus-circle" size={18} color={COLORS.primary} />
              <Text style={styles.addBikeBtnText}>Add Another Bike</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Service Reminders */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Service Reminders</Text>
          {currentOdometer > 0 && <Text style={styles.sectionSubtitle}>Current: {currentOdometer.toLocaleString()} km</Text>}
        </View>
        <View style={styles.card}>
          {reminders.length === 0 && <Text style={styles.emptyText}>No reminders yet. Add one below or use a preset.</Text>}
          {reminders.map(reminder => {
            const status = getReminderStatus(reminder);
            return (
              <View key={reminder.id} style={styles.reminderItem}>
                <View style={[styles.reminderStatusIcon, { backgroundColor: status.color + '22' }]}>
                  <MaterialCommunityIcons name={status.icon} size={18} color={status.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reminderTitle}>{reminder.title}</Text>
                  <Text style={styles.reminderDetail}>Every {reminder.interval_km.toLocaleString()} km · Last: {reminder.last_service_km.toLocaleString()} km</Text>
                  <View style={[styles.reminderStatusBadge, { backgroundColor: status.color + '22' }]}>
                    <Text style={[styles.reminderStatusText, { color: status.color }]}>{status.label}</Text>
                  </View>
                </View>
                <View style={styles.reminderActions}>
                  <TouchableOpacity onPress={() => handleMarkServiced(reminder)} style={styles.servicedBtn}>
                    <MaterialCommunityIcons name="check" size={16} color={COLORS.accentGreen} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDeleteReminder(reminder.id)} style={styles.deleteBtn}>
                    <MaterialCommunityIcons name="trash-can-outline" size={16} color={COLORS.accentRed} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}

          {reminders.length === 0 && (
            <View style={styles.presetsSection}>
              <Text style={styles.presetsLabel}>Quick Presets:</Text>
              <View style={styles.presetGrid}>
                {DEFAULT_REMINDERS.map(preset => (
                  <TouchableOpacity key={preset.title} style={styles.presetBtn} onPress={() => handleAddReminder(preset)}>
                    <Text style={styles.presetBtnText}>{preset.title}</Text>
                    <Text style={styles.presetBtnSub}>Every {preset.intervalKm.toLocaleString()} km</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {showAddReminder ? (
            <View style={styles.addReminderForm}>
              <TextInput style={[styles.input, { marginBottom: 10 }]} value={reminderTitle} onChangeText={setReminderTitle} placeholder="e.g. Engine Oil Change" placeholderTextColor={COLORS.textMuted} />
              <TextInput style={[styles.input, { marginBottom: 10 }]} value={reminderInterval} onChangeText={setReminderInterval} placeholder="Interval in km (e.g. 3000)" keyboardType="decimal-pad" placeholderTextColor={COLORS.textMuted} />
              <TextInput style={[styles.input, { marginBottom: 10 }]} value={reminderLastKm} onChangeText={setReminderLastKm} placeholder={`Last service km (default: ${currentOdometer})`} keyboardType="decimal-pad" placeholderTextColor={COLORS.textMuted} />
              <View style={styles.addBikeActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAddReminder(false)}><Text style={styles.cancelBtnText}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity style={styles.confirmBtn} onPress={() => handleAddReminder()}><Text style={styles.confirmBtnText}>Add</Text></TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.addBikeBtn} onPress={() => setShowAddReminder(true)}>
              <MaterialCommunityIcons name="plus-circle" size={18} color={COLORS.primary} />
              <Text style={styles.addBikeBtnText}>Add Custom Reminder</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Export */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Export Data</Text>
        <View style={styles.card}>
          <Text style={styles.exportDesc}>Export all fuel logs and expenses as CSV for the active bike.</Text>
          <TouchableOpacity style={styles.exportBtn} onPress={handleExportCSV}>
            <MaterialCommunityIcons name="export-variant" size={18} color={COLORS.white} />
            <Text style={styles.exportBtnText}>Export as CSV</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* App Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App Info</Text>
        <View style={styles.card}>
          {[['Version', '1.2.0'], ['Database', 'SQLite (Local)'], ['Storage', 'On-device only']].map(([label, value]) => (
            <View key={label} style={styles.infoRow}>
              <Text style={styles.infoLabel}>{label}</Text>
              <Text style={styles.infoValue}>{value}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const makeStyles = (COLORS) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, paddingHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 20, paddingBottom: 16 },
  backBtn: { padding: 8 },
  title: { flex: 1, textAlign: 'center', fontSize: 20, fontWeight: '800', color: COLORS.text },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  sectionSubtitle: { fontSize: 11, color: COLORS.textMuted },
  card: { backgroundColor: COLORS.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.border },
  // Theme toggle
  themeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  themeLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  themeLabel: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  themeSubLabel: { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
  // Inputs
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 8 },
  inputWrapper: { position: 'relative' },
  inputIcon: { position: 'absolute', left: 12, top: 14, zIndex: 1 },
  input: { backgroundColor: COLORS.secondaryLight, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border },
  currencyRow: { flexDirection: 'row', gap: 10 },
  currencyBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: COLORS.secondaryLight, borderWidth: 1, borderColor: COLORS.border },
  currencyBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  currencyText: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
  currencyTextActive: { color: COLORS.white },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.white },
  // Bikes
  bikeItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 12 },
  bikeIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  bikeName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  bikeDetail: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  bikeActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bikeBadge: { backgroundColor: COLORS.accentGreen + '22', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  bikeBadgeText: { fontSize: 11, fontWeight: '700', color: COLORS.accentGreen },
  setDefaultBtn: { backgroundColor: COLORS.primary + '22', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  setDefaultText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },
  deleteBtn: { padding: 6 },
  addBikeBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 14, justifyContent: 'center' },
  addBikeBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  addBikeForm: { paddingTop: 14 },
  addBikeActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  cancelBtn: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: COLORS.secondaryLight, alignItems: 'center' },
  cancelBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
  confirmBtn: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: COLORS.primary, alignItems: 'center' },
  confirmBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.white },
  // Reminders
  reminderItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  reminderStatusIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  reminderTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  reminderDetail: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  reminderStatusBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 6 },
  reminderStatusText: { fontSize: 11, fontWeight: '700' },
  reminderActions: { flexDirection: 'column', gap: 6, alignItems: 'center', marginTop: 4 },
  servicedBtn: { padding: 6, backgroundColor: COLORS.accentGreen + '22', borderRadius: 8 },
  presetsSection: { paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: 4 },
  presetsLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted, marginBottom: 10 },
  presetGrid: { gap: 8 },
  presetBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.secondaryLight, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: COLORS.border },
  presetBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  presetBtnSub: { fontSize: 11, color: COLORS.textMuted },
  addReminderForm: { paddingTop: 14, borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: 8 },
  emptyText: { fontSize: 12, color: COLORS.textMuted, textAlign: 'center', paddingVertical: 8 },
  // Export
  exportDesc: { fontSize: 13, color: COLORS.textMuted, marginBottom: 14 },
  exportBtn: { backgroundColor: COLORS.accentBlue, borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  exportBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.white },
  // Info
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  infoLabel: { fontSize: 13, color: COLORS.textMuted },
  infoValue: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
});
