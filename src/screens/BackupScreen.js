/**
 * BackupScreen.js
 * Full-featured Cloud Backup screen.
 * Accessible from Settings → Cloud Backup.
 */

import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Image, Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useBackup } from '../context/BackupContext';

const formatRelativeTime = (iso) => {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs !== 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days !== 1 ? 's' : ''} ago`;
};

const formatBytes = (bytes) => {
  if (!bytes) return '';
  const kb = parseInt(bytes) / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
};

export default function BackupScreen({ navigation }) {
  const { COLORS } = useTheme();
  const styles = makeStyles(COLORS);
  const {
    user, isSignedIn, isLoading, isBacking, isRestoring,
    lastBackupTime, backupMeta,
    signIn, signOut, backupNow, restoreNow, checkBackupExists,
  } = useBackup();

  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (isSignedIn) {
      setChecking(true);
      checkBackupExists().finally(() => setChecking(false));
    }
  }, [isSignedIn]);

  const busy = isBacking || isRestoring || isLoading || checking;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Cloud Backup</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Hero Banner */}
      <View style={styles.heroBanner}>
        <View style={styles.heroIconRow}>
          <View style={styles.heroIcon}>
            <MaterialCommunityIcons name="motorbike" size={28} color={COLORS.primary} />
          </View>
          <View style={styles.heroArrows}>
            <MaterialCommunityIcons name="arrow-right" size={16} color={COLORS.textMuted} />
            <MaterialCommunityIcons name="arrow-left" size={16} color={COLORS.textMuted} />
          </View>
          <View style={[styles.heroIcon, { backgroundColor: '#4285F422' }]}>
            <MaterialCommunityIcons name="google-drive" size={28} color="#4285F4" />
          </View>
        </View>
        <Text style={styles.heroTitle}>Keep Your Ride Data Safe</Text>
        <Text style={styles.heroSub}>
          Back up your fuel logs, expenses, bikes and trips to Google Drive.
          Restore them on any device instantly.
        </Text>
      </View>

      {/* Account Card */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>GOOGLE ACCOUNT</Text>
        <View style={styles.card}>
          {isLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={COLORS.primary} />
              <Text style={styles.loadingText}>Loading…</Text>
            </View>
          ) : isSignedIn ? (
            <View style={styles.accountRow}>
              {user?.picture ? (
                <Image source={{ uri: user.picture }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <MaterialCommunityIcons name="account-circle" size={40} color={COLORS.textMuted} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.accountName}>{user?.name}</Text>
                <Text style={styles.accountEmail}>{user?.email}</Text>
                <View style={styles.connectedBadge}>
                  <MaterialCommunityIcons name="check-circle" size={12} color={COLORS.accentGreen} />
                  <Text style={[styles.connectedText, { color: COLORS.accentGreen }]}>Connected</Text>
                </View>
              </View>
              <TouchableOpacity onPress={signOut} style={styles.signOutBtn}>
                <MaterialCommunityIcons name="logout" size={18} color={COLORS.accentRed} />
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <Text style={styles.signInDesc}>
                Sign in with Google to enable automatic cloud backup. Your data is
                stored privately — only this app can access it.
              </Text>
              <TouchableOpacity
                style={styles.googleSignInBtn}
                onPress={signIn}
                disabled={busy}
              >
                <MaterialCommunityIcons name="google" size={20} color={COLORS.white} />
                <Text style={styles.googleSignInText}>Sign in with Google</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* Backup Status */}
      {isSignedIn && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>BACKUP STATUS</Text>
          <View style={styles.card}>
            {checking ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={styles.loadingText}>Checking Drive…</Text>
              </View>
            ) : backupMeta ? (
              <>
                <View style={styles.statusRow}>
                  <View style={[styles.statusDot, { backgroundColor: COLORS.accentGreen }]} />
                  <Text style={styles.statusText}>Backup exists on Google Drive</Text>
                </View>
                <View style={styles.metaGrid}>
                  <View style={styles.metaItem}>
                    <MaterialCommunityIcons name="clock-outline" size={16} color={COLORS.textMuted} />
                    <View>
                      <Text style={styles.metaLabel}>Last Modified</Text>
                      <Text style={styles.metaValue}>
                        {new Date(backupMeta.modifiedTime).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </Text>
                    </View>
                  </View>
                  {backupMeta.size && (
                    <View style={styles.metaItem}>
                      <MaterialCommunityIcons name="file-outline" size={16} color={COLORS.textMuted} />
                      <View>
                        <Text style={styles.metaLabel}>File Size</Text>
                        <Text style={styles.metaValue}>{formatBytes(backupMeta.size)}</Text>
                      </View>
                    </View>
                  )}
                  {lastBackupTime && (
                    <View style={styles.metaItem}>
                      <MaterialCommunityIcons name="upload-outline" size={16} color={COLORS.textMuted} />
                      <View>
                        <Text style={styles.metaLabel}>Last Backed Up</Text>
                        <Text style={styles.metaValue}>{formatRelativeTime(lastBackupTime)}</Text>
                      </View>
                    </View>
                  )}
                </View>
              </>
            ) : (
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: COLORS.accent }]} />
                <Text style={styles.statusText}>No backup found on Drive yet</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Actions */}
      {isSignedIn && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ACTIONS</Text>
          <View style={styles.card}>

            {/* Back Up Now */}
            <TouchableOpacity
              style={[styles.actionRow, isBacking && styles.actionRowDisabled]}
              onPress={backupNow}
              disabled={busy}
            >
              <View style={[styles.actionIcon, { backgroundColor: COLORS.primary + '22' }]}>
                {isBacking
                  ? <ActivityIndicator size="small" color={COLORS.primary} />
                  : <MaterialCommunityIcons name="cloud-upload-outline" size={22} color={COLORS.primary} />
                }
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionTitle}>Back Up Now</Text>
                <Text style={styles.actionSub}>
                  {isBacking ? 'Uploading to Google Drive…' : 'Upload all local data to Google Drive'}
                </Text>
              </View>
              {!isBacking && (
                <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.textMuted} />
              )}
            </TouchableOpacity>

            <View style={styles.divider} />

            {/* Restore from Drive */}
            <TouchableOpacity
              style={[styles.actionRow, isRestoring && styles.actionRowDisabled]}
              onPress={restoreNow}
              disabled={busy}
            >
              <View style={[styles.actionIcon, { backgroundColor: COLORS.accentBlue + '22' }]}>
                {isRestoring
                  ? <ActivityIndicator size="small" color={COLORS.accentBlue} />
                  : <MaterialCommunityIcons name="cloud-download-outline" size={22} color={COLORS.accentBlue} />
                }
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionTitle}>Restore from Drive</Text>
                <Text style={styles.actionSub}>
                  {isRestoring
                    ? 'Downloading from Google Drive…'
                    : backupMeta
                      ? `Restore backup from ${new Date(backupMeta.modifiedTime).toLocaleDateString()}`
                      : 'No backup available to restore'
                  }
                </Text>
              </View>
              {!isRestoring && (
                <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.textMuted} />
              )}
            </TouchableOpacity>

          </View>
        </View>
      )}

      {/* What's Backed Up */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>WHAT GETS BACKED UP</Text>
        <View style={styles.card}>
          {[
            ['motorbike', COLORS.primary, 'Bikes', 'All your bike profiles and tank info'],
            ['gas-station', COLORS.primary, 'Fuel Logs', 'Every fill-up with odometer, cost, station'],
            ['wrench', COLORS.accentGreen, 'Expenses', 'Maintenance costs by category'],
            ['map-marker-path', COLORS.accentBlue, 'Trips', 'Completed and active trip data'],
            ['bell-ring-outline', COLORS.accent, 'Service Reminders', 'Your km-based service schedules'],
            ['cog-outline', COLORS.textMuted, 'Settings', 'Fuel price, currency, default bike'],
          ].map(([icon, color, label, desc], i, arr) => (
            <View key={label} style={[styles.whatRow, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: COLORS.border }]}>
              <View style={[styles.whatIcon, { backgroundColor: color + '22' }]}>
                <MaterialCommunityIcons name={icon} size={18} color={color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.whatLabel}>{label}</Text>
                <Text style={styles.whatDesc}>{desc}</Text>
              </View>
              <MaterialCommunityIcons name="check" size={16} color={COLORS.accentGreen} />
            </View>
          ))}
        </View>
      </View>

      {/* Privacy Note */}
      <View style={styles.privacyNote}>
        <MaterialCommunityIcons name="shield-lock-outline" size={16} color={COLORS.textMuted} />
        <Text style={styles.privacyText}>
          Your backup is stored in a private app folder on your Google Drive — only MotoLog can access it. No one else, including Google or Anthropic, can read your data.
        </Text>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const makeStyles = (COLORS) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, paddingHorizontal: 16 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 20, paddingBottom: 16,
  },
  backBtn: { padding: 8 },
  title: {
    flex: 1, textAlign: 'center',
    fontSize: 20, fontWeight: '800', color: COLORS.text,
  },

  // Hero
  heroBanner: {
    backgroundColor: COLORS.card, borderRadius: 20,
    padding: 24, alignItems: 'center', marginBottom: 20,
    borderWidth: 1, borderColor: COLORS.border,
  },
  heroIconRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  heroIcon: {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: COLORS.primary + '22',
    alignItems: 'center', justifyContent: 'center',
  },
  heroArrows: { gap: 4 },
  heroTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text, marginBottom: 8, textAlign: 'center' },
  heroSub: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 },

  // Sections
  section: { marginBottom: 20 },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: COLORS.textMuted,
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8,
  },
  card: {
    backgroundColor: COLORS.card, borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: COLORS.border,
  },

  // Account
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 4 },
  loadingText: { fontSize: 14, color: COLORS.textMuted },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarFallback: { backgroundColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  accountName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  accountEmail: { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },
  connectedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  connectedText: { fontSize: 11, fontWeight: '700' },
  signOutBtn: {
    padding: 8, backgroundColor: COLORS.accentRed + '18',
    borderRadius: 10,
  },
  signInDesc: { fontSize: 13, color: COLORS.textMuted, marginBottom: 14, lineHeight: 20 },
  googleSignInBtn: {
    backgroundColor: '#4285F4', borderRadius: 12, padding: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, elevation: 4,
  },
  googleSignInText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // Status
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  metaGrid: { gap: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  metaLabel: { fontSize: 11, color: COLORS.textMuted },
  metaValue: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginTop: 1 },

  // Actions
  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 4,
  },
  actionRowDisabled: { opacity: 0.6 },
  actionIcon: {
    width: 46, height: 46, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  actionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  actionSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 12 },

  // What's backed up
  whatRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10,
  },
  whatIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  whatLabel: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  whatDesc: { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },

  // Privacy
  privacyNote: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: COLORS.card, borderRadius: 12,
    padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: COLORS.border,
  },
  privacyText: { flex: 1, fontSize: 11, color: COLORS.textMuted, lineHeight: 17 },
});
