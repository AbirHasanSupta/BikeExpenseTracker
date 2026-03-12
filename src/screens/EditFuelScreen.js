import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, Alert, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getFuelLogById, updateFuelLog, getSettings } from '../database/db';
import { useTheme } from '../context/ThemeContext';
import { RIDE_TAGS, formatCurrency } from '../constants';

export default function EditFuelScreen({ navigation, route }) {
  const { COLORS } = useTheme();
  const styles = makeStyles(COLORS);
  const { id } = route.params;

  const [date, setDate] = useState('');
  const [dateObj, setDateObj] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [litres, setLitres] = useState('');
  const [totalCost, setTotalCost] = useState('');
  const [odometer, setOdometer] = useState('');
  const [stationName, setStationName] = useState('');
  const [notes, setNotes] = useState('');
  const [rideTag, setRideTag] = useState('personal');
  const [pricePerLitre, setPricePerLitre] = useState('');
  const [currency, setCurrency] = useState('BDT');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const log = getFuelLogById(id);
    if (!log) { Alert.alert('Error', 'Entry not found.'); navigation.goBack(); return; }
    setDate(log.date);
    setDateObj(new Date(log.date));
    setLitres(String(log.litres));
    setTotalCost(String(log.total_cost));
    setOdometer(String(log.odometer));
    setStationName(log.station_name || '');
    setNotes(log.notes || '');
    setRideTag(log.ride_tag || 'personal');
    setPricePerLitre(String(log.price_per_litre));
    setCurrency(getSettings().currency);
  }, [id]);

  const handleSave = () => {
    if (!litres || !totalCost || !odometer) { Alert.alert('Missing Fields', 'Litres, cost and odometer are required.'); return; }
    try {
      setSaving(true);
      updateFuelLog({
        id,
        date,
        litres: parseFloat(litres),
        pricePerLitre: parseFloat(pricePerLitre) || 0,
        totalCost: parseFloat(totalCost),
        odometer: parseFloat(odometer),
        stationName,
        notes,
        rideTag,
      });
      Alert.alert('Updated!', 'Fuel entry updated.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e) {
      Alert.alert('Error', 'Failed to update.');
      setSaving(false);
    }
  };

  const Field = ({ label, value, onChangeText, keyboardType, placeholder, icon }) => (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.inputWrapper}>
        {icon && <MaterialCommunityIcons name={icon} size={18} color={COLORS.textMuted} style={styles.inputIcon} />}
        <TextInput
          style={[styles.input, icon && { paddingLeft: 40 }]}
          value={value} onChangeText={onChangeText}
          keyboardType={keyboardType || 'default'}
          placeholder={placeholder} placeholderTextColor={COLORS.textMuted}
        />
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Edit Fuel Entry</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Date */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Date</Text>
          <TouchableOpacity style={styles.inputWrapper} onPress={() => setShowDatePicker(true)}>
            <MaterialCommunityIcons name="calendar" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
            <View style={[styles.input, { paddingLeft: 40, justifyContent: 'center' }]}>
              <Text style={{ fontSize: 15, color: COLORS.text }}>{date}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {showDatePicker && Platform.OS === 'android' && (
          <DateTimePicker value={dateObj} mode="date" display="calendar"
            onChange={(e, d) => { setShowDatePicker(false); if (e.type === 'set' && d) { setDateObj(d); setDate(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`); } }} />
        )}
        {showDatePicker && Platform.OS === 'ios' && (
          <Modal transparent animationType="slide" visible={showDatePicker}>
            <View style={styles.modalOverlay}><View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}><Text style={styles.modalCancel}>Cancel</Text></TouchableOpacity>
                <Text style={styles.modalTitle2}>Select Date</Text>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}><Text style={styles.modalDone}>Done</Text></TouchableOpacity>
              </View>
              <DateTimePicker value={dateObj} mode="date" display="inline"
                onChange={(e, d) => { if (d) { setDateObj(d); setDate(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`); } }}
                style={{ alignSelf: 'center' }} />
            </View></View>
          </Modal>
        )}

        <Field label={`Litres`} value={litres} onChangeText={setLitres} keyboardType="decimal-pad" placeholder="e.g. 4.5" icon="water" />
        <Field label={`Total Cost (${currency})`} value={totalCost} onChangeText={setTotalCost} keyboardType="decimal-pad" placeholder="e.g. 500" icon="currency-bdt" />
        <Field label="Price per Litre" value={pricePerLitre} onChangeText={setPricePerLitre} keyboardType="decimal-pad" placeholder="e.g. 108" icon="tag" />
        <Field label="Odometer (km)" value={odometer} onChangeText={setOdometer} keyboardType="decimal-pad" placeholder="e.g. 15240" icon="counter" />
        <Field label="Fuel Station" value={stationName} onChangeText={setStationName} placeholder="e.g. Padma Filling Station" icon="map-marker" />
        <Field label="Notes" value={notes} onChangeText={setNotes} placeholder="Any notes..." icon="note-text" />

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Ride Tag</Text>
          <View style={styles.tagRow}>
            {RIDE_TAGS.map(tag => (
              <TouchableOpacity key={tag.value}
                style={[styles.tagBtn, rideTag === tag.value && { borderColor: tag.color, backgroundColor: tag.color + '22' }]}
                onPress={() => setRideTag(tag.value)}>
                <MaterialCommunityIcons name={tag.icon} size={13} color={rideTag === tag.value ? tag.color : COLORS.textMuted} />
                <Text style={[styles.tagBtnText, rideTag === tag.value && { color: tag.color }]}>{tag.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.7 }]} onPress={handleSave} disabled={saving}>
          <MaterialCommunityIcons name="check-circle" size={22} color={COLORS.white} />
          <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Update Entry'}</Text>
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
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 8 },
  inputWrapper: { position: 'relative' },
  inputIcon: { position: 'absolute', left: 12, top: 14, zIndex: 1 },
  input: { backgroundColor: COLORS.card, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border },
  tagRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  tagBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.card },
  tagBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: 16, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 8, elevation: 8 },
  saveBtnText: { fontSize: 16, fontWeight: '800', color: COLORS.white },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: COLORS.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 30 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalTitle2: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  modalCancel: { fontSize: 15, color: COLORS.textMuted },
  modalDone: { fontSize: 15, fontWeight: '700', color: COLORS.primary },
});
