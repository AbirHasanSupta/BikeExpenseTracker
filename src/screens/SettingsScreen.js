import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getSettings, updateSettings, getBikes, addBike } from '../database/db';
import { COLORS } from '../constants';

export default function SettingsScreen({ navigation }) {
  const [fuelPrice, setFuelPrice] = useState('108');
  const [currency, setCurrency] = useState('BDT');
  const [bikes, setBikes] = useState([]);
  const [newBikeName, setNewBikeName] = useState('');
  const [tankCapacity, setTankCapacity] = useState('12');
  const [showAddBike, setShowAddBike] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = () => {
    const st = getSettings();
    setFuelPrice(String(st.fuel_price));
    setCurrency(st.currency);
    setBikes(getBikes());
  };

  const handleSaveSettings = () => {
    if (!fuelPrice || parseFloat(fuelPrice) <= 0) { Alert.alert('Invalid', 'Please enter a valid fuel price.'); return; }
    try {
      updateSettings(parseFloat(fuelPrice), currency);
      Alert.alert('Saved', 'Settings updated successfully.');
    } catch (e) { Alert.alert('Error', 'Failed to save settings.'); }
  };

  const handleAddBike = () => {
    if (!newBikeName.trim()) { Alert.alert('Name Required', 'Please enter a bike name.'); return; }
    addBike(newBikeName.trim(), parseFloat(tankCapacity) || 12, '');
    setNewBikeName('');
    setTankCapacity('12');
    setShowAddBike(false);
    setBikes(getBikes());
    Alert.alert('Bike Added', `${newBikeName} has been added.`);
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

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>My Bikes</Text>
        <View style={styles.card}>
          {bikes.map(bike => (
            <View key={bike.id} style={styles.bikeItem}>
              <View style={styles.bikeIcon}><MaterialCommunityIcons name="motorbike" size={20} color={COLORS.primary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.bikeName}>{bike.bike_name}</Text>
                <Text style={styles.bikeDetail}>Tank: {bike.tank_capacity}L</Text>
              </View>
              <View style={styles.bikeBadge}><Text style={styles.bikeBadgeText}>Active</Text></View>
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

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App Info</Text>
        <View style={styles.card}>
          {[['Version', '1.0.0'], ['Database', 'SQLite (Local)'], ['Storage', 'On-device only']].map(([label, value]) => (
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, paddingHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 20, paddingBottom: 16 },
  backBtn: { padding: 8 },
  title: { flex: 1, textAlign: 'center', fontSize: 20, fontWeight: '800', color: COLORS.text },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { backgroundColor: COLORS.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.border },
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
  bikeItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 12 },
  bikeIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: COLORS.primary + '22', alignItems: 'center', justifyContent: 'center' },
  bikeName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  bikeDetail: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  bikeBadge: { backgroundColor: COLORS.accentGreen + '22', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  bikeBadgeText: { fontSize: 11, fontWeight: '700', color: COLORS.accentGreen },
  addBikeBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 14, justifyContent: 'center' },
  addBikeBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  addBikeForm: { paddingTop: 14 },
  addBikeActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  cancelBtn: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: COLORS.secondaryLight, alignItems: 'center' },
  cancelBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
  confirmBtn: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: COLORS.primary, alignItems: 'center' },
  confirmBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.white },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  infoLabel: { fontSize: 13, color: COLORS.textMuted },
  infoValue: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
});
