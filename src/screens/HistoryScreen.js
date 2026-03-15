import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, RefreshControl, SectionList, TextInput } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getFuelLogs, getExpenses, deleteFuelLog, deleteExpense, getSettings, getDefaultBikeId } from '../database/db';
import { getCategoryInfo, getRideTagInfo, formatCurrency, formatDate, MONTHS } from '../constants';
import { useTheme } from '../context/ThemeContext';
import GlobalFAB from './GlobalFAB';

const FuelItem = ({ item, currency, onDelete, COLORS, styles }) => {
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
        <MaterialCommunityIcons name="trash-can-outline" size={16} color={COLORS.accentRed} />
      </TouchableOpacity>
    </View>
  );
};

const ExpenseItem = ({ item, currency, onDelete, COLORS, styles }) => {
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
        <MaterialCommunityIcons name="trash-can-outline" size={16} color={COLORS.accentRed} />
      </TouchableOpacity>
    </View>
  );
};

// Group items by YYYY-MM
const groupByMonth = (items) => {
  const map = {};
  for (const item of items) {
    const key = item.date.slice(0, 7); // "YYYY-MM"
    if (!map[key]) map[key] = [];
    map[key].push(item);
  }
  // Sort keys descending (most recent first)
  return Object.keys(map)
    .sort((a, b) => b.localeCompare(a))
    .map(key => ({
      key,
      title: `${MONTHS[parseInt(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`,
      data: map[key],
    }));
};

export default function HistoryScreen({ navigation }) {
  const { COLORS } = useTheme();
  const styles = makeStyles(COLORS);

  const [tab, setTab] = useState('fuel');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [fuelLogs, setFuelLogs] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [currency, setCurrency] = useState('BDT');
  const [refreshing, setRefreshing] = useState(false);
  // Track which month sections are collapsed; default all expanded
  const [collapsedMonths, setCollapsedMonths] = useState({});

  const loadData = useCallback(() => {
    try {
      const bikeId = getDefaultBikeId();
      setFuelLogs(getFuelLogs(bikeId, 500));
      setExpenses(getExpenses(bikeId, 500));
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

  const toggleMonth = (key) => {
    setCollapsedMonths(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const rawData = tab === 'fuel' ? fuelLogs : expenses;

  const filteredData = searchQuery.trim()
    ? rawData.filter(item => {
        const q = searchQuery.toLowerCase();
        if (tab === 'fuel') {
          return (
            (item.station_name || '').toLowerCase().includes(q) ||
            (item.notes || '').toLowerCase().includes(q) ||
            String(item.litres).includes(q) ||
            String(item.total_cost).includes(q) ||
            item.date.includes(q)
          );
        } else {
          const cat = getCategoryInfo(item.category);
          return (
            cat.label.toLowerCase().includes(q) ||
            (item.notes || '').toLowerCase().includes(q) ||
            String(item.cost).includes(q) ||
            item.date.includes(q)
          );
        }
      })
    : rawData;

  const sections = groupByMonth(filteredData);

  // Month total summary
  const getMonthSummary = (items) => {
    if (tab === 'fuel') {
      const totalCost = items.reduce((s, i) => s + (i.total_cost || 0), 0);
      const totalLitres = items.reduce((s, i) => s + (i.litres || 0), 0);
      return `${totalLitres.toFixed(2)} L · ${formatCurrency(totalCost, currency)}`;
    } else {
      const totalCost = items.reduce((s, i) => s + (i.cost || 0), 0);
      return `${items.length} item${items.length !== 1 ? 's' : ''} · ${formatCurrency(totalCost, currency)}`;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>History</Text>
        <TouchableOpacity onPress={() => { setShowSearch(!showSearch); setSearchQuery(''); }} style={styles.searchToggle}>
          <MaterialCommunityIcons name={showSearch ? 'close' : 'magnify'} size={22} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      {showSearch && (
        <View style={styles.searchBar}>
          <MaterialCommunityIcons name="magnify" size={18} color={COLORS.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={tab === 'fuel' ? 'Search station, date, amount...' : 'Search category, notes, date...'}
            placeholderTextColor={COLORS.textMuted}
            autoFocus
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <MaterialCommunityIcons name="close-circle" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      )}

      <View style={styles.tabRow}>
        {[['fuel', 'gas-station', 'Fuel'], ['expense', 'wrench', 'Expenses']].map(([key, icon, label]) => (
          <TouchableOpacity key={key} style={[styles.tab, tab === key && styles.tabActive]} onPress={() => { setTab(key); setSearchQuery(''); }}>
            <MaterialCommunityIcons name={icon} size={16} color={tab === key ? COLORS.white : COLORS.textMuted} />
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>
              {label} ({key === 'fuel' ? fuelLogs.length : expenses.length})
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {searchQuery.length > 0 && (
        <Text style={styles.resultCount}>{filteredData.length} result{filteredData.length !== 1 ? 's' : ''} for "{searchQuery}"</Text>
      )}

      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={COLORS.primary} />}
        renderSectionHeader={({ section }) => (
          <TouchableOpacity
            style={styles.monthHeader}
            onPress={() => toggleMonth(section.key)}
            activeOpacity={0.7}
          >
            <View style={styles.monthHeaderLeft}>
              <MaterialCommunityIcons
                name={collapsedMonths[section.key] ? 'chevron-right' : 'chevron-down'}
                size={18}
                color={COLORS.primary}
              />
              <Text style={styles.monthHeaderTitle}>{section.title}</Text>
            </View>
            <Text style={styles.monthHeaderSummary}>{getMonthSummary(section.data)}</Text>
          </TouchableOpacity>
        )}
        renderItem={({ item, section }) => {
          if (collapsedMonths[section.key]) return null;
          return tab === 'fuel'
            ? <FuelItem item={item} currency={currency} COLORS={COLORS} styles={styles}
                onDelete={(id) => confirmDelete(id, 'fuel')} />
            : <ExpenseItem item={item} currency={currency} COLORS={COLORS} styles={styles}
                onDelete={(id) => confirmDelete(id, 'expense')} />;
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons
              name={searchQuery ? 'magnify-close' : tab === 'fuel' ? 'gas-station' : 'wrench'}
              size={60}
              color={COLORS.textMuted}
            />
            <Text style={styles.emptyText}>
              {searchQuery ? 'No results found' : `No ${tab === 'fuel' ? 'fuel entries' : 'expenses'} yet`}
            </Text>
          </View>
        }
      />
      <GlobalFAB />
    </View>
  );
}

const makeStyles = (COLORS) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12 },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.text },
  searchToggle: { padding: 6 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 12, marginHorizontal: 16, marginBottom: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: COLORS.border },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 14, color: COLORS.text },
  resultCount: { fontSize: 12, color: COLORS.textMuted, paddingHorizontal: 16, marginBottom: 6 },
  tabRow: { flexDirection: 'row', marginHorizontal: 16, backgroundColor: COLORS.card, borderRadius: 14, padding: 4, marginBottom: 12 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, borderRadius: 10 },
  tabActive: { backgroundColor: COLORS.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
  tabTextActive: { color: COLORS.white },
  list: { paddingHorizontal: 16, paddingBottom: 100 },

  // Month section header
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.background,
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  monthHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  monthHeaderTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  monthHeaderSummary: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted },

  // Items
  historyItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 14, padding: 14, marginBottom: 10, gap: 12, borderWidth: 1, borderColor: COLORS.border },
  historyIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  historyContent: { flex: 1 },
  historyTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  historyTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  tagBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  tagBadgeText: { fontSize: 10, fontWeight: '700' },
  historyMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 3 },
  historyNote: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2, fontStyle: 'italic' },
  deleteBtn: { padding: 6 },

  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 16, fontWeight: '700', color: COLORS.textSecondary, marginTop: 16, textAlign: 'center' },
});