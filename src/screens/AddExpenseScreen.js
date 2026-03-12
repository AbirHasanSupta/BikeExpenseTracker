import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { addExpense, getSettings } from '../database/db';
import { COLORS, EXPENSE_CATEGORIES, getTodayString, formatCurrency } from '../constants';

export default function AddExpenseScreen({ navigation }) {
  const [date, setDate] = useState(getTodayString());
  const [category, setCategory] = useState(null);
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');
  const [settings, setSettings] = useState({ currency: 'BDT' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { setSettings(getSettings()); }, []);

  const selectedCat = EXPENSE_CATEGORIES.find(c => c.value === category);

  const handleSave = () => {
    if (!category) { Alert.alert('Select Category', 'Please select an expense category.'); return; }
    if (!cost || parseFloat(cost) <= 0) { Alert.alert('Enter Cost', 'Please enter a valid cost.'); return; }
    try {
      setSaving(true);
      addExpense({ bikeId: 1, date, category, cost: parseFloat(cost), notes });
      Alert.alert('Saved!', 'Expense added successfully.', [
        { text: 'Add Another', onPress: () => { setCategory(null); setCost(''); setNotes(''); setSaving(false); } },
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
          <Text style={styles.title}>Add Expense</Text>
          <View style={{ width: 40 }} />
        </View>

        <Text style={styles.sectionLabel}>Category <Text style={{ color: COLORS.primary }}>*</Text></Text>
        <View style={styles.categoryGrid}>
          {EXPENSE_CATEGORIES.map((cat) => (
            <TouchableOpacity key={cat.value} style={[styles.catItem, category === cat.value && { borderColor: cat.color, backgroundColor: cat.color + '22' }]} onPress={() => setCategory(cat.value)}>
              <View style={[styles.catIcon, { backgroundColor: cat.color + '22' }]}>
                <MaterialCommunityIcons name={cat.icon} size={20} color={cat.color} />
              </View>
              <Text style={[styles.catLabel, category === cat.value && { color: cat.color }]} numberOfLines={2}>{cat.label}</Text>
              {category === cat.value && <MaterialCommunityIcons name="check-circle" size={14} color={cat.color} style={styles.catCheck} />}
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Date <Text style={{ color: COLORS.primary }}>*</Text></Text>
          <View style={styles.inputWrapper}>
            <MaterialCommunityIcons name="calendar" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
            <TextInput style={[styles.input, { paddingLeft: 40 }]} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={COLORS.textMuted} />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Cost ({settings.currency}) <Text style={{ color: COLORS.primary }}>*</Text></Text>
          <View style={styles.inputWrapper}>
            <MaterialCommunityIcons name="currency-bdt" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
            <TextInput style={[styles.input, { paddingLeft: 40 }]} value={cost} onChangeText={setCost} keyboardType="decimal-pad" placeholder="e.g. 500" placeholderTextColor={COLORS.textMuted} />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Notes (optional)</Text>
          <View style={styles.inputWrapper}>
            <MaterialCommunityIcons name="note-text" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
            <TextInput style={[styles.input, { paddingLeft: 40 }]} value={notes} onChangeText={setNotes} placeholder="Any notes..." placeholderTextColor={COLORS.textMuted} />
          </View>
        </View>

        {category && cost ? (
          <View style={styles.summaryCard}>
            <View style={[styles.summaryIcon, { backgroundColor: (selectedCat?.color || COLORS.primary) + '22' }]}>
              <MaterialCommunityIcons name={selectedCat?.icon || 'wrench'} size={24} color={selectedCat?.color || COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryCategory}>{selectedCat?.label}</Text>
              <Text style={styles.summaryDate}>{date}</Text>
            </View>
            <Text style={[styles.summaryCost, { color: selectedCat?.color || COLORS.primary }]}>{formatCurrency(cost, settings.currency)}</Text>
          </View>
        ) : null}

        <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.7 }]} onPress={handleSave} disabled={saving}>
          <MaterialCommunityIcons name="check-circle" size={22} color={COLORS.white} />
          <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Expense'}</Text>
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
  sectionLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 12 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  catItem: { width: '30%', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 12, padding: 12, borderWidth: 1.5, borderColor: COLORS.border, position: 'relative' },
  catIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  catLabel: { fontSize: 11, color: COLORS.textSecondary, textAlign: 'center', fontWeight: '600' },
  catCheck: { position: 'absolute', top: 6, right: 6 },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 8 },
  inputWrapper: { position: 'relative' },
  inputIcon: { position: 'absolute', left: 12, top: 14, zIndex: 1 },
  input: { backgroundColor: COLORS.card, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border },
  summaryCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 14, padding: 16, marginBottom: 16, gap: 12 },
  summaryIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  summaryCategory: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  summaryDate: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  summaryCost: { fontSize: 18, fontWeight: '800' },
  saveBtn: { backgroundColor: COLORS.accentGreen, borderRadius: 16, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 8, elevation: 8 },
  saveBtnText: { fontSize: 16, fontWeight: '800', color: COLORS.white },
});
