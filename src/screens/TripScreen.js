import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, FlatList, Alert, Modal, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { addTrip, endTrip, getTrips, getActiveTrip, deleteTrip, getDefaultBikeId, getLastOdometer } from '../database/db';
import { useTheme } from '../context/ThemeContext';
import { RIDE_TAGS, getTodayString, formatDate, getRideTagInfo } from '../constants';

export default function TripScreen() {
  const { COLORS } = useTheme();
  const styles = makeStyles(COLORS);

  const [trips, setTrips] = useState([]);
  const [activeTrip, setActiveTrip] = useState(null);
  const [showStartModal, setShowStartModal] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);
  const [title, setTitle] = useState('');
  const [startOdo, setStartOdo] = useState('');
  const [endOdo, setEndOdo] = useState('');
  const [notes, setNotes] = useState('');
  const [rideTag, setRideTag] = useState('personal');
  const [bikeId, setBikeId] = useState(1);

  const loadData = useCallback(() => {
    const bid = getDefaultBikeId();
    setBikeId(bid);
    setTrips(getTrips(bid, 100));
    setActiveTrip(getActiveTrip(bid));
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const handleStartTrip = () => {
    if (!title.trim()) { Alert.alert('Required', 'Please enter a trip title.'); return; }
    if (!startOdo || parseFloat(startOdo) <= 0) { Alert.alert('Required', 'Please enter a valid start odometer reading.'); return; }
    addTrip({ bikeId, title: title.trim(), date: getTodayString(), startOdometer: parseFloat(startOdo), notes, rideTag });
    setTitle(''); setStartOdo(''); setNotes(''); setRideTag('personal');
    setShowStartModal(false);
    loadData();
  };

  const handleEndTrip = () => {
    if (!endOdo || parseFloat(endOdo) <= 0) { Alert.alert('Required', 'Please enter the end odometer reading.'); return; }
    if (parseFloat(endOdo) <= activeTrip.start_odometer) {
      Alert.alert('Invalid', 'End odometer must be greater than start odometer.'); return;
    }
    endTrip(activeTrip.id, parseFloat(endOdo));
    setEndOdo('');
    setShowEndModal(false);
    loadData();
  };

  const handleDelete = (id) => {
    Alert.alert('Delete Trip', 'Remove this trip?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { deleteTrip(id); loadData(); } },
    ]);
  };

  const lastOdo = getLastOdometer(bikeId);

  const renderTrip = ({ item }) => {
    const tag = getRideTagInfo(item.ride_tag || 'personal');
    const distance = item.end_odometer ? (item.end_odometer - item.start_odometer).toFixed(0) : null;
    const isActive = item.status === 'active';
    return (
      <View style={[styles.tripCard, isActive && styles.tripCardActive]}>
        <View style={styles.tripTop}>
          <View style={styles.tripLeft}>
            <View style={[styles.tripIcon, { backgroundColor: isActive ? COLORS.primary + '33' : COLORS.card }]}>
              <MaterialCommunityIcons name={isActive ? 'map-marker-path' : 'flag-checkered'} size={20} color={isActive ? COLORS.primary : COLORS.accentGreen} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.tripTitleRow}>
                <Text style={styles.tripTitle} numberOfLines={1}>{item.title}</Text>
                {isActive && <View style={styles.activeBadge}><Text style={styles.activeBadgeText}>ACTIVE</Text></View>}
              </View>
              <Text style={styles.tripDate}>{formatDate(item.date)}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.deleteBtn}>
            <MaterialCommunityIcons name="trash-can-outline" size={16} color={COLORS.accentRed} />
          </TouchableOpacity>
        </View>

        <View style={styles.tripStats}>
          <View style={styles.tripStat}>
            <Text style={styles.tripStatLabel}>Start</Text>
            <Text style={styles.tripStatValue}>{item.start_odometer.toLocaleString()} km</Text>
          </View>
          <MaterialCommunityIcons name="arrow-right" size={16} color={COLORS.textMuted} />
          <View style={styles.tripStat}>
            <Text style={styles.tripStatLabel}>End</Text>
            <Text style={styles.tripStatValue}>{item.end_odometer ? `${item.end_odometer.toLocaleString()} km` : '—'}</Text>
          </View>
          <View style={[styles.tripStat, { alignItems: 'flex-end' }]}>
            <Text style={styles.tripStatLabel}>Distance</Text>
            <Text style={[styles.tripStatValue, { color: distance ? COLORS.accentGreen : COLORS.textMuted }]}>
              {distance ? `${distance} km` : '—'}
            </Text>
          </View>
        </View>

        <View style={styles.tripBottom}>
          <View style={[styles.tagBadge, { backgroundColor: tag.color + '22' }]}>
            <MaterialCommunityIcons name={tag.icon} size={10} color={tag.color} />
            <Text style={[styles.tagBadgeText, { color: tag.color }]}>{tag.label}</Text>
          </View>
          {item.notes ? <Text style={styles.tripNotes} numberOfLines={1}>{item.notes}</Text> : null}
          {isActive && (
            <TouchableOpacity style={styles.endTripBtn} onPress={() => setShowEndModal(true)}>
              <MaterialCommunityIcons name="flag-checkered" size={14} color={COLORS.white} />
              <Text style={styles.endTripBtnText}>End Trip</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Trips</Text>
        <TouchableOpacity style={styles.startBtn} onPress={() => {
          if (activeTrip) { Alert.alert('Active Trip', 'End the current trip before starting a new one.'); return; }
          setStartOdo(lastOdo > 0 ? String(lastOdo) : '');
          setShowStartModal(true);
        }}>
          <MaterialCommunityIcons name="plus" size={18} color={COLORS.white} />
          <Text style={styles.startBtnText}>Start Trip</Text>
        </TouchableOpacity>
      </View>

      {activeTrip && (
        <View style={styles.activeTripBanner}>
          <MaterialCommunityIcons name="map-marker-path" size={18} color={COLORS.primary} />
          <Text style={styles.activeTripText} numberOfLines={1}>
            Active: <Text style={{ fontWeight: '800' }}>{activeTrip.title}</Text> · {activeTrip.start_odometer.toLocaleString()} km
          </Text>
          <TouchableOpacity style={styles.endBannerBtn} onPress={() => setShowEndModal(true)}>
            <Text style={styles.endBannerBtnText}>End</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={trips}
        keyExtractor={item => String(item.id)}
        renderItem={renderTrip}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="map-marker-path" size={60} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>No trips yet</Text>
            <Text style={styles.emptySub}>Tap "Start Trip" to log a journey</Text>
          </View>
        }
      />

      {/* Start Trip Modal */}
      <Modal visible={showStartModal} transparent animationType="slide" onRequestClose={() => setShowStartModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Start New Trip</Text>

            <Text style={styles.inputLabel}>Trip Title *</Text>
            <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="e.g. Cox's Bazar Trip" placeholderTextColor={COLORS.textMuted} />

            <Text style={styles.inputLabel}>Start Odometer (km) *</Text>
            <TextInput style={styles.input} value={startOdo} onChangeText={setStartOdo} keyboardType="decimal-pad" placeholder={lastOdo > 0 ? `Current: ${lastOdo} km` : 'e.g. 15240'} placeholderTextColor={COLORS.textMuted} />

            <Text style={styles.inputLabel}>Ride Tag</Text>
            <View style={styles.tagRow}>
              {RIDE_TAGS.map(tag => (
                <TouchableOpacity
                  key={tag.value}
                  style={[styles.tagBtn, rideTag === tag.value && { borderColor: tag.color, backgroundColor: tag.color + '22' }]}
                  onPress={() => setRideTag(tag.value)}
                >
                  <MaterialCommunityIcons name={tag.icon} size={13} color={rideTag === tag.value ? tag.color : COLORS.textMuted} />
                  <Text style={[styles.tagBtnText, rideTag === tag.value && { color: tag.color }]}>{tag.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Notes (optional)</Text>
            <TextInput style={styles.input} value={notes} onChangeText={setNotes} placeholder="Any notes..." placeholderTextColor={COLORS.textMuted} />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowStartModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleStartTrip}>
                <MaterialCommunityIcons name="map-marker-path" size={16} color={COLORS.white} />
                <Text style={styles.confirmBtnText}>Start</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* End Trip Modal */}
      <Modal visible={showEndModal} transparent animationType="slide" onRequestClose={() => setShowEndModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>End Trip</Text>
            {activeTrip && <Text style={styles.modalSubtitle}>"{activeTrip?.title}" · Started at {activeTrip?.start_odometer?.toLocaleString()} km</Text>}

            <Text style={styles.inputLabel}>End Odometer (km) *</Text>
            <TextInput style={styles.input} value={endOdo} onChangeText={setEndOdo} keyboardType="decimal-pad" placeholder="e.g. 15820" placeholderTextColor={COLORS.textMuted} autoFocus />

            {endOdo && activeTrip && parseFloat(endOdo) > activeTrip.start_odometer && (
              <Text style={styles.distanceHint}>
                Distance: {(parseFloat(endOdo) - activeTrip.start_odometer).toFixed(0)} km
              </Text>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowEndModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: COLORS.accentGreen }]} onPress={handleEndTrip}>
                <MaterialCommunityIcons name="flag-checkered" size={16} color={COLORS.white} />
                <Text style={styles.confirmBtnText}>End Trip</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (COLORS) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12 },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.text },
  startBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12 },
  startBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.white },
  activeTripBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.primary + '18', marginHorizontal: 16, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 10, borderWidth: 1, borderColor: COLORS.primary + '44' },
  activeTripText: { flex: 1, fontSize: 13, color: COLORS.text },
  endBannerBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8 },
  endBannerBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.white },
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  tripCard: { backgroundColor: COLORS.card, borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  tripCardActive: { borderColor: COLORS.primary + '66', borderWidth: 1.5 },
  tripTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  tripLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  tripIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tripTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  tripTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, flex: 1 },
  activeBadge: { backgroundColor: COLORS.primary, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  activeBadgeText: { fontSize: 9, fontWeight: '800', color: COLORS.white, letterSpacing: 0.5 },
  tripDate: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  deleteBtn: { padding: 6 },
  tripStats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.background, borderRadius: 10, padding: 10, marginBottom: 10 },
  tripStat: { flex: 1, alignItems: 'center' },
  tripStatLabel: { fontSize: 10, color: COLORS.textMuted, textTransform: 'uppercase', marginBottom: 2 },
  tripStatValue: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  tripBottom: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  tagBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  tagBadgeText: { fontSize: 10, fontWeight: '700' },
  tripNotes: { flex: 1, fontSize: 11, color: COLORS.textMuted, fontStyle: 'italic' },
  endTripBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.accentGreen, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, marginLeft: 'auto' },
  endTripBtnText: { fontSize: 11, fontWeight: '700', color: COLORS.white },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyText: { fontSize: 18, fontWeight: '700', color: COLORS.textSecondary, marginTop: 16 },
  emptySub: { fontSize: 13, color: COLORS.textMuted, marginTop: 6 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: COLORS.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
  modalSubtitle: { fontSize: 12, color: COLORS.textMuted, marginBottom: 16 },
  inputLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: COLORS.background, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border },
  distanceHint: { fontSize: 12, color: COLORS.accentGreen, marginTop: 6, fontWeight: '600' },
  tagRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  tagBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.background },
  tagBtnText: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: COLORS.background, alignItems: 'center' },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.textMuted },
  confirmBtn: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: COLORS.primary, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  confirmBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.white },
});
