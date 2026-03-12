import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, Alert, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { addFuelLog, getSettings, getLastOdometer } from '../database/db';
import { COLORS, getTodayString, formatCurrency } from '../constants';
import DateTimePicker from '@react-native-community/datetimepicker';

const InputField = ({ label, value, onChangeText, keyboardType, placeholder, icon, required }) => (
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
  const [entryMethod, setEntryMethod] = useState('price');
  const [date, setDate] = useState(getTodayString());
  const [amount, setAmount] = useState('');
  const [odometer, setOdometer] = useState('');
  const [stationName, setStationName] = useState('');
  const [notes, setNotes] = useState('');
  const [settings, setSettings] = useState({ fuel_price: 108, currency: 'BDT' });
  const [lastOdometer, setLastOdometer] = useState(0);
  const [saving, setSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    setSettings(getSettings());
    setLastOdometer(getLastOdometer(1));
  }, []);

  const fuelPrice = parseFloat(settings.fuel_price) || 108;
  const amountNum = parseFloat(amount) || 0;
  const litres = entryMethod === 'price' ? amountNum / fuelPrice : amountNum;
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
        bikeId: 1, date,
        litres: parseFloat(litres.toFixed(3)),
        pricePerLitre: fuelPrice,
        totalCost: parseFloat(totalCost.toFixed(2)),
        odometer: parseFloat(odometer),
        stationName, notes,
      });
      Alert.alert('Saved!', 'Fuel entry added successfully.', [
        { text: 'Add Another', onPress: () => { setAmount(''); setOdometer(''); setStationName(''); setNotes(''); setSaving(false); } },
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
            <View style={styles.previewItem}><Text style={styles.previewLabel}>Litres</Text><Text style={styles.previewValue}>{litres.toFixed(2)} L</Text></View>
            <View style={styles.previewDivider} />
            <View style={styles.previewItem}><Text style={styles.previewLabel}>Total Cost</Text><Text style={[styles.previewValue, { color: COLORS.primary }]}>{formatCurrency(totalCost, settings.currency)}</Text></View>
            <View style={styles.previewDivider} />
            <View style={styles.previewItem}><Text style={styles.previewLabel}>Price/L</Text><Text style={styles.previewValue}>{settings.currency} {fuelPrice}</Text></View>
          </View>
        )}

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Date<Text style={{ color: COLORS.primary }}> *</Text></Text>
          <TouchableOpacity style={styles.inputWrapper} onPress={() => setShowDatePicker(true)}>
            <MaterialCommunityIcons name="calendar" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
            <View style={[styles.input, { paddingLeft: 40, justifyContent: 'center' }]}>
              <Text style={{ color: COLORS.text, fontSize: 15 }}>{date}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={new Date(date)}
            mode="date"
            display="default"
            onChange={(event, selectedDate) => {
              setShowDatePicker(false);
              if (selectedDate) setDate(selectedDate.toISOString().split('T')[0]);
            }}
          />
        )}

        <InputField label={entryMethod === 'price' ? `Amount Paid (${settings.currency})` : 'Litres Added'} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder={entryMethod === 'price' ? 'e.g. 500' : 'e.g. 4.5'} icon={entryMethod === 'price' ? 'currency-bdt' : 'water'} required />
        <InputField label="Odometer Reading (km)" value={odometer} onChangeText={setOdometer} keyboardType="decimal-pad" placeholder={lastOdometer > 0 ? `Last: ${lastOdometer} km` : 'e.g. 15240'} icon="counter" required />

        {lastOdometer > 0 && odometer && parseFloat(odometer) > lastOdometer && (
          <Text style={styles.distanceHint}>Distance since last fill: {(parseFloat(odometer) - lastOdometer).toFixed(0)} km</Text>
        )}

        <InputField label="Fuel Station (optional)" value={stationName} onChangeText={setStationName} placeholder="e.g. Padma Filling Station" icon="map-marker" />
        <InputField label="Notes (optional)" value={notes} onChangeText={setNotes} placeholder="Any notes..." icon="note-text" />

        <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.7 }]} onPress={handleSave} disabled={saving}>
          <MaterialCommunityIcons name="check-circle" size={22} color={COLORS.white} />
          <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Fuel Entry'}</Text>
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
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
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: 16, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 8, elevation: 8 },
  saveBtnText: { fontSize: 16, fontWeight: '800', color: COLORS.white },
});
