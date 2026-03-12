import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, Alert, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { addFuelLog, getSettings, getLastOdometer, getDefaultBikeId } from '../database/db';
import { RIDE_TAGS, getTodayString, formatCurrency } from '../constants';
import { useTheme } from '../context/ThemeContext';

const InputField = ({ label, value, onChangeText, keyboardType, placeholder, icon, required, COLORS, styles }) => (
  <View style={styles.inputGroup}>
    <Text style={styles.inputLabel}>{label}{required && <Text style={{ color: COLORS.primary }}> *</Text>}</Text>
    <View style={styles.inputWrapper}>
      {icon && <MaterialCommunityIcons name={icon} size={18} color={COLORS.textMuted} style={styles.inputIcon} />}
      <TextInput
        style={[styles.input, icon && { paddingLeft: 40 }]}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType || 'default'}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textMuted}
      />
    </View>
  </View>
);

export default function AddFuelScreen({ navigation }) {
  const { COLORS } = useTheme();
  const styles = makeStyles(COLORS);
  const [entryMethod, setEntryMethod] = useState('price');
  const [date, setDate] = useState(getTodayString());
  const [dateObj, setDateObj] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [amount, setAmount] = useState('');
  const [remainingFuel, setRemainingFuel] = useState('');
  const [odometer, setOdometer] = useState('');
  const [stationName, setStationName] = useState('');
  const [notes, setNotes] = useState('');
  const [rideTag, setRideTag] = useState('personal');
  const [settings, setSettings] = useState({ fuel_price: 108, currency: 'BDT' });
  const [lastOdometer, setLastOdometer] = useState(0);
  const [saving, setSaving] = useState(false);
  const [bikeId, setBikeId] = useState(1);

  useEffect(() => {
    const st = getSettings();
    const bid = getDefaultBikeId();
    setSettings(st);
    setBikeId(bid);
    setLastOdometer(getLastOdometer(bid));
  }, []);

  const fuelPrice = parseFloat(settings.fuel_price) || 108;
  const amountNum = parseFloat(amount) || 0;
  const remainingNum = parseFloat(remainingFuel) || 0;
  const newLitres = entryMethod === 'price' ? amountNum / fuelPrice : amountNum;
  const litres = newLitres + remainingNum;
  const totalCost = entryMethod === 'price' ? amountNum : amountNum * fuelPrice;

  const handleSave = () => {
    if (!amount || !odometer) { Alert.alert('Missing Fields', 'Please enter the fuel amount and odometer reading.'); return; }
    if (parseFloat(odometer) < lastOdometer && lastOdometer > 0) {
      Alert.alert('Check Odometer', `Last reading was ${lastOdometer} km. Current reading seems lower.`); return;
    }
    if (litres <= 0 || totalCost <= 0) { Alert.alert('Invalid Entry', 'Please enter a valid fuel amount.'); return; }
    try {
      setSaving(true);
      addFuelLog({
        bikeId,
        date,
        litres: parseFloat(litres.toFixed(3)),
        pricePerLitre: fuelPrice,
        totalCost: parseFloat(totalCost.toFixed(2)),
        odometer: parseFloat(odometer),
        stationName,
        notes,
        rideTag,
      });
      Alert.alert('Saved!', 'Fuel entry added successfully.', [
        { text: 'Add Another', onPress: () => { setAmount(''); setOdometer(''); setStationName(''); setNotes(''); setRemainingFuel(''); setSaving(false); } },
        { text: 'Done', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert('Error', 'Failed to save. Please try again.');
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Add Fuel Entry</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.toggleRow}>
          {['price', 'litres'].map(method => (
            <TouchableOpacity key={method} style={[styles.toggleBtn, entryMethod === method && styles.toggleActive]} onPress={() => setEntryMethod(method)}>
              <MaterialCommunityIcons name={method === 'price' ? 'currency-bdt' : 'water'} size={16} color={entryMethod === method ? COLORS.white : COLORS.textMuted} />
              <Text style={[styles.toggleText, entryMethod === method && styles.toggleTextActive]}>{method === 'price' ? 'Enter Amount' : 'Enter Litres'}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {amountNum > 0 && (
          <View style={styles.previewCard}>
            <View style={styles.previewItem}>
              <Text style={styles.previewLabel}>Added</Text>
              <Text style={styles.previewValue}>{newLitres.toFixed(2)} L</Text>
            </View>
            <View style={styles.previewDivider} />
            <View style={styles.previewItem}>
              <Text style={styles.previewLabel}>Total in Tank</Text>
              <Text style={[styles.previewValue, { color: COLORS.accentGreen }]}>{litres.toFixed(2)} L</Text>
            </View>
            <View style={styles.previewDivider} />
            <View style={styles.previewItem}>
              <Text style={styles.previewLabel}>Cost</Text>
              <Text style={[styles.previewValue, { color: COLORS.primary }]}>{formatCurrency(totalCost, settings.currency)}</Text>
            </View>
          </View>
        )}

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Date<Text style={{ color: COLORS.primary }}> *</Text></Text>
          <TouchableOpacity style={styles.inputWrapper} onPress={() => setShowDatePicker(true)}>
            <MaterialCommunityIcons name="calendar" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
            <View style={[styles.input, { paddingLeft: 40, justifyContent: 'center' }]}>
              <Text style={{ fontSize: 15, color: COLORS.text }}>{date}</Text>
            </View>
            <MaterialCommunityIcons name="chevron-down" size={18} color={COLORS.textMuted} style={styles.inputIconRight} />
          </TouchableOpacity>
        </View>

        {showDatePicker && Platform.OS === 'android' && (
          <DateTimePicker
            value={dateObj}
            mode="date"
            display="calendar"
            onChange={(event, selectedDate) => {
              setShowDatePicker(false);
              if (event.type === 'set' && selectedDate) {
                setDateObj(selectedDate);
                setDate(`${selectedDate.getFullYear()}-${String(selectedDate.getMonth()+1).padStart(2,'0')}-${String(selectedDate.getDate()).padStart(2,'0')}`);
              }
            }}
          />
        )}

        {showDatePicker && Platform.OS === 'ios' && (
          <Modal transparent animationType="slide" visible={showDatePicker}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalSheet}>
                <View style={styles.modalHeader}>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                    <Text style={styles.modalCancel}>Cancel</Text>
                  </TouchableOpacity>
                  <Text style={styles.modalTitle}>Select Date</Text>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                    <Text style={styles.modalDone}>Done</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={dateObj}
                  mode="date"
                  display="inline"
                  onChange={(event, selectedDate) => {
                    if (selectedDate) {
                      setDateObj(selectedDate);
                      setDate(`${selectedDate.getFullYear()}-${String(selectedDate.getMonth()+1).padStart(2,'0')}-${String(selectedDate.getDate()).padStart(2,'0')}`);
                    }
                  }}
                  style={{ alignSelf: 'center' }}
                />
              </View>
            </View>
          </Modal>
        )}

        <InputField COLORS={COLORS} styles={styles} label={entryMethod === 'price' ? `Amount Paid (${settings.currency})` : 'Litres Added'} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder={entryMethod === 'price' ? 'e.g. 500' : 'e.g. 4.5'} icon={entryMethod === 'price' ? 'currency-bdt' : 'water'} required />

        <InputField COLORS={COLORS} styles={styles} label="Remaining Fuel Before Fill (L)" value={remainingFuel} onChangeText={setRemainingFuel} keyboardType="decimal-pad" placeholder="e.g. 1.5  (leave blank if 0)" icon="gauge" />
        <InputField COLORS={COLORS} styles={styles} label="Odometer Reading (km)" value={odometer} onChangeText={setOdometer} keyboardType="decimal-pad" placeholder={lastOdometer > 0 ? `Last: ${lastOdometer} km` : 'e.g. 15240'} icon="counter" required />

        {lastOdometer > 0 && odometer && parseFloat(odometer) > lastOdometer && (
          <Text style={styles.distanceHint}>Distance since last fill: {(parseFloat(odometer) - lastOdometer).toFixed(0)} km</Text>
        )}

        <InputField COLORS={COLORS} styles={styles} label="Fuel Station (optional)" value={stationName} onChangeText={setStationName} placeholder="e.g. Padma Filling Station" icon="map-marker" />
        <InputField COLORS={COLORS} styles={styles} label="Notes (optional)" value={notes} onChangeText={setNotes} placeholder="Any notes..." icon="note-text" />

        {/* Ride Tag */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Ride Tag</Text>
          <View style={styles.tagRow}>
            {RIDE_TAGS.map(tag => (
              <TouchableOpacity
                key={tag.value}
                style={[styles.tagBtn, rideTag === tag.value && { borderColor: tag.color, backgroundColor: tag.color + '22' }]}
                onPress={() => setRideTag(tag.value)}
              >
                <MaterialCommunityIcons name={tag.icon} size={14} color={rideTag === tag.value ? tag.color : COLORS.textMuted} />
                <Text style={[styles.tagBtnText, rideTag === tag.value && { color: tag.color }]}>{tag.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.7 }]} onPress={handleSave} disabled={saving}>
          <MaterialCommunityIcons name="check-circle" size={22} color={COLORS.white} />
          <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Fuel Entry'}</Text>
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (COLORS) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, paddingHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 20, paddingBottom: 16 },
  backBtn: { padding: 8 },
  title: { flex: 1, textAlign: 'center', fontSize: 20, fontWeight: '800', color: COLORS.text },
  toggleRow: { flexDirection: 'row', backgroundColor: COLORS.card, borderRadius: 14, padding: 4, marginBottom: 16 },
  toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, borderRadius: 10 },
  toggleActive: { backgroundColor: COLORS.primary },
  toggleText: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
  toggleTextActive: { color: COLORS.white },
  previewCard: { flexDirection: 'row', backgroundColor: COLORS.card, borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: COLORS.primary + '40' },
  previewItem: { flex: 1, alignItems: 'center' },
  previewLabel: { fontSize: 11, color: COLORS.textMuted, marginBottom: 4, textTransform: 'uppercase' },
  previewValue: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  previewDivider: { width: 1, backgroundColor: COLORS.border, marginHorizontal: 8 },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 8 },
  inputWrapper: { position: 'relative' },
  inputIcon: { position: 'absolute', left: 12, top: 14, zIndex: 1 },
  input: { backgroundColor: COLORS.card, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border },
  distanceHint: { fontSize: 12, color: COLORS.accentGreen, marginTop: -8, marginBottom: 8, marginLeft: 4 },
  tagRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  tagBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.card },
  tagBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
  inputIconRight: { position: 'absolute', right: 12, top: 14, zIndex: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: COLORS.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 30 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  modalCancel: { fontSize: 15, color: COLORS.textMuted },
  modalDone: { fontSize: 15, fontWeight: '700', color: COLORS.primary },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: 16, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 8, elevation: 8 },
  saveBtnText: { fontSize: 16, fontWeight: '800', color: COLORS.white },
});