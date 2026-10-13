import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';

export default function GlobalFAB() {
  const navigation = useNavigation();
  const { COLORS } = useTheme();
  const styles = makeStyles(COLORS);
  const [open, setOpen] = useState(false);

  const navigateTo = (screen) => {
    setOpen(false);
    // Defer navigation until modal has closed to avoid stack/modal race crashes
    requestAnimationFrame(() => {
      try {
        navigation.navigate(screen);
      } catch (_) {}
    });
  };

  return (
    <>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.menuContainer} pointerEvents="box-none">
            <TouchableOpacity style={styles.menuItem} onPress={() => navigateTo('AddFuel')}>
              <Text style={styles.menuLabel}>Add Fuel</Text>
              <View style={[styles.menuBtn, { backgroundColor: COLORS.primary }]}>
                <MaterialCommunityIcons name="gas-station" size={22} color={COLORS.white} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => navigateTo('AddExpense')}>
              <Text style={styles.menuLabel}>Add Expense</Text>
              <View style={[styles.menuBtn, { backgroundColor: COLORS.accentGreen }]}>
                <MaterialCommunityIcons name="wrench" size={22} color={COLORS.white} />
              </View>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {!open && (
        <TouchableOpacity style={styles.fab} onPress={() => setOpen(true)} activeOpacity={0.85}>
          <MaterialCommunityIcons name="plus" size={28} color={COLORS.white} />
        </TouchableOpacity>
      )}
    </>
  );
}

const makeStyles = (COLORS) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  menuContainer: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    alignItems: 'flex-end',
    gap: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  menuLabel: {
    backgroundColor: 'rgba(0,0,0,0.75)',
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    overflow: 'hidden',
  },
  menuBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 10,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    zIndex: 100,
  },
});
