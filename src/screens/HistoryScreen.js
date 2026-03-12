import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, RefreshControl, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getFuelLogs, getExpenses, deleteFuelLog, deleteExpense, getSettings, getDefaultBikeId } from '../database/db';
import { COLORS, getCategoryInfo, getRideTagInfo, formatCurrency, formatDate } from '../constants';
import GlobalFAB from './GlobalFAB';

const TAG_FILTERS = [
  { label: 'All', value: null },
  { label: 'Personal', value: 'personal' },
  { label: 'Office', value: 'office' },
  { label: 'Travel', value: 'travel' },
  { label: 'Other', value: 'other' },
];

const FuelItem = ({ item, currency, onDelete }) => {
  const tag = getRideTagInfo(item.ride_tag || 'personal');
  return (
    <View style={styles.historyItem}>
      <View style={[styles.historyIcon, { backgroundColor: COLORS.primary + '22' }]}>
        <MaterialCommunityIcons name="gas-station" size={20} color={COLORS.primary} />
      </View>
      <View style={styles.historyContent}>
        <View style={styles.historyTitleRow}>
          <Text style={styles.historyTitle}>{item.litres.toFixed(2)} L — {formatCurrency(item.total_cost, currency)}</Text>
          <View style={[styles.tagBadge, { backgroundColor: tag.color + '22' }]}>
            <MaterialCommunityIcons name={tag.icon} size={10} color={tag.color} />
            <Text style={[styles.tagBadgeText, { color: tag.color }]}>{tag.label}</Text>
          </View>
        </View>
        <Text style={styles.historyMeta}>{formatDate(item.date)} · {item.odometer.toLocaleString()} km</Text>
        {item.station_name ? <Text style={styles.historyNote}>{item.station_name}</Text> : null}
      </View>
      <TouchableOpacity onPress={() => onDelete(item.id)} style={styles.deleteBtn}>
        <MaterialCommunityIcons name="trash-can-outline" size={18} color={COLORS.accentRed} />
      </TouchableOpacity>
    </View>
  );
};

const ExpenseItem = ({ item, currency, onDelete }) => {
  const cat = getCategoryInfo(item.category);
  const tag = getRideTagInfo(item.ride_tag || 'personal');
  return (
    <View style={styles.historyItem}>
      <View style={[styles.historyIcon, { backgroundColor: cat.color + '22' }]}>
        <MaterialCommunityIcons name={cat.icon} size={20} color={cat.color} />
      </View>
      <View style={styles.historyContent}>
        <View style={styles.historyTitleRow}>
          <Text style={styles.historyTitle}>{cat.label} — {formatCurrency(item.cost, currency)}</Text>
          <View style={[styles.tagBadge, { backgroundColor: tag.color + '22' }]}>
            <MaterialCommunityIcons name={tag.icon} size={10} color={tag.color} />
            <Text style={[styles.tagBadgeText, { color: tag.color }]}>{tag.label}</Text>
          </View>
        </View>
        <Text style={styles.historyMeta}>{formatDate(item.date)}</Text>
        {item.notes ? <Text style={styles.historyNote}>{item.notes}</Text> : null}
      </View>
      <TouchableOpacity onPress={() => onDelete(item.id)} style={styles.deleteBtn}>
        <MaterialCommunityIcons name="trash-can-outline" size={18} color={COLORS.accentRed} />
      </TouchableOpacity>
    </View>
  );
};

export default function HistoryScreen({ navigation }) {
  const [tab, setTab] = useState('fuel');
  const [tagFilter, setTagFilter] = useState(null);
  const [fuelLogs, setFuelLogs] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [currency, setCurrency] = useState('BDT');
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(() => {
    try {
      const bikeId = getDefaultBikeId();
      setFuelLogs(getFuelLogs(bikeId, 200));
      setExpenses(getExpenses(bikeId, 200));
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

  const rawData = tab === 'fuel' ? fuelLogs : expenses;
  const data = tagFilter ? rawData.filter(i => (i.ride_tag || 'personal') === tagFilter) : rawData;

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

      {/* Tag filter row */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagFilterScroll} contentContainerStyle={styles.tagFilterContent}>
        {TAG_FILTERS.map(f => (
          <TouchableOpacity
            key={String(f.value)}
            style={[styles.tagFilterBtn, tagFilter === f.value && styles.tagFilterBtnActive]}
            onPress={() => setTagFilter(f.value)}
          >
            <Text style={[styles.tagFilterText, tagFilter === f.value && styles.tagFilterTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

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
            <Text style={styles.emptyText}>
              {tagFilter ? `No ${tab === 'fuel' ? 'fuel entries' : 'expenses'} for this tag` : `No ${tab === 'fuel' ? 'fuel entries' : 'expenses'} yet`}
            </Text>
          </View>
        }
      />
      <GlobalFAB />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12 },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.text },
  tabRow: { flexDirection: 'row', marginHorizontal: 16, backgroundColor: COLORS.card, borderRadius: 14, padding: 4, marginBottom: 10 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, borderRadius: 10 },
  tabActive: { backgroundColor: COLORS.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
  tabTextActive: { color: COLORS.white },
  tagFilterScroll: { maxHeight: 46, marginBottom: 8 },
  tagFilterContent: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  tagFilterBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  tagFilterBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tagFilterText: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted },
  tagFilterTextActive: { color: COLORS.white },
  list: { paddingHorizontal: 16, paddingBottom: 30 },
  historyItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 14, padding: 14, marginBottom: 10, gap: 12, borderWidth: 1, borderColor: COLORS.border },
  historyIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  historyContent: { flex: 1 },
  historyTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  historyTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  tagBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  tagBadgeText: { fontSize: 10, fontWeight: '700' },
  historyMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 3 },
  historyNote: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2, fontStyle: 'italic' },
  deleteBtn: { padding: 8 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyText: { fontSize: 16, fontWeight: '700', color: COLORS.textSecondary, marginTop: 16, textAlign: 'center' },
});