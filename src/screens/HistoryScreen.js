import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getFuelLogs, getExpenses, deleteFuelLog, deleteExpense, getSettings } from '../database/db';
import { COLORS, getCategoryInfo, formatCurrency, formatDate } from '../constants';

const FuelItem = ({ item, currency, onDelete }) => (
  <View style={styles.historyItem}>
    <View style={[styles.historyIcon, { backgroundColor: COLORS.primary + '22' }]}>
      <MaterialCommunityIcons name="gas-station" size={20} color={COLORS.primary} />
    </View>
    <View style={styles.historyContent}>
      <Text style={styles.historyTitle}>{item.litres.toFixed(2)} L — {formatCurrency(item.total_cost, currency)}</Text>
      <Text style={styles.historyMeta}>{formatDate(item.date)} · {item.odometer.toLocaleString()} km</Text>
      {item.station_name ? <Text style={styles.historyNote}>{item.station_name}</Text> : null}
    </View>
    <TouchableOpacity onPress={() => onDelete(item.id)} style={styles.deleteBtn}>
      <MaterialCommunityIcons name="trash-can-outline" size={18} color={COLORS.accentRed} />
    </TouchableOpacity>
  </View>
);

const ExpenseItem = ({ item, currency, onDelete }) => {
  const cat = getCategoryInfo(item.category);
  return (
    <View style={styles.historyItem}>
      <View style={[styles.historyIcon, { backgroundColor: cat.color + '22' }]}>
        <MaterialCommunityIcons name={cat.icon} size={20} color={cat.color} />
      </View>
      <View style={styles.historyContent}>
        <Text style={styles.historyTitle}>{cat.label} — {formatCurrency(item.cost, currency)}</Text>
        <Text style={styles.historyMeta}>{formatDate(item.date)}</Text>
        {item.notes ? <Text style={styles.historyNote}>{item.notes}</Text> : null}
      </View>
      <TouchableOpacity onPress={() => onDelete(item.id)} style={styles.deleteBtn}>
        <MaterialCommunityIcons name="trash-can-outline" size={18} color={COLORS.accentRed} />
      </TouchableOpacity>
    </View>
  );
};

export default function HistoryScreen() {
  const [tab, setTab] = useState('fuel');
  const [fuelLogs, setFuelLogs] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [currency, setCurrency] = useState('BDT');
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(() => {
    try {
      setFuelLogs(getFuelLogs(1, 100));
      setExpenses(getExpenses(1, 100));
      setCurrency(getSettings().currency);
    } catch (e) { console.error(e); }
    finally { setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const confirmDelete = (id, type) => {
    Alert.alert('Delete Entry', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        if (type === 'fuel') { deleteFuelLog(id); setFuelLogs(f => f.filter(i => i.id !== id)); }
        else { deleteExpense(id); setExpenses(e => e.filter(i => i.id !== id)); }
      }},
    ]);
  };

  const data = tab === 'fuel' ? fuelLogs : expenses;

  return (
    <View style={styles.container}>
      <View style={styles.header}><Text style={styles.title}>History</Text></View>
      <View style={styles.tabRow}>
        {[['fuel', 'gas-station', 'Fuel'], ['expense', 'wrench', 'Expenses']].map(([key, icon, label]) => (
          <TouchableOpacity key={key} style={[styles.tab, tab === key && styles.tabActive]} onPress={() => setTab(key)}>
            <MaterialCommunityIcons name={icon} size={16} color={tab === key ? COLORS.white : COLORS.textMuted} />
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label} ({key === 'fuel' ? fuelLogs.length : expenses.length})</Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList
        data={data}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={COLORS.primary} />}
        renderItem={({ item }) => tab === 'fuel'
          ? <FuelItem item={item} currency={currency} onDelete={(id) => confirmDelete(id, 'fuel')} />
          : <ExpenseItem item={item} currency={currency} onDelete={(id) => confirmDelete(id, 'expense')} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name={tab === 'fuel' ? 'gas-station' : 'wrench'} size={60} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>No {tab === 'fuel' ? 'fuel entries' : 'expenses'} yet</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12 },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.text },
  tabRow: { flexDirection: 'row', marginHorizontal: 16, backgroundColor: COLORS.card, borderRadius: 14, padding: 4, marginBottom: 12 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, borderRadius: 10 },
  tabActive: { backgroundColor: COLORS.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
  tabTextActive: { color: COLORS.white },
  list: { paddingHorizontal: 16, paddingBottom: 30 },
  historyItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 14, padding: 14, marginBottom: 10, gap: 12, borderWidth: 1, borderColor: COLORS.border },
  historyIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  historyContent: { flex: 1 },
  historyTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  historyMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 3 },
  historyNote: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2, fontStyle: 'italic' },
  deleteBtn: { padding: 8 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyText: { fontSize: 18, fontWeight: '700', color: COLORS.textSecondary, marginTop: 16 },
});
