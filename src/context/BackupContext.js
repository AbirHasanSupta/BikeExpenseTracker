/**
 * BackupContext.js
 * Manages Google OAuth state and exposes backup/restore actions app-wide.
 *
 * Setup required in app.json (already has expo-auth-session via expo):
 *   "scheme": "motolog"   ← add this to the expo object in app.json
 *
 * Google Cloud Console:
 *   1. Create OAuth 2.0 Client ID → Android + iOS
 *   2. Redirect URI: https://auth.expo.io/@abirsupta/MotoLog
 *   3. Enable Google Drive API
 *   4. Paste your client IDs below.
 */

import React, {
  createContext, useContext, useState, useEffect, useCallback,
} from 'react';
import { Alert, Platform } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  findBackupFile, uploadBackup, downloadBackup,
  buildBackupPayload, restoreFromPayload,
} from '../utils/cloudBackup';
import * as db from '../database/db';

// ─── !! REPLACE THESE WITH YOUR OWN GOOGLE OAUTH CLIENT IDs !! ───────────────
// Get them from: https://console.cloud.google.com/apis/credentials
// Create an OAuth 2.0 Client ID for each platform.
const GOOGLE_CLIENT_IDS = {
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
};
// ─────────────────────────────────────────────────────────────────────────────

WebBrowser.maybeCompleteAuthSession();

const STORAGE_KEYS = {
  USER_INFO: '@motolog_google_user',
  ACCESS_TOKEN: '@motolog_access_token',
  LAST_BACKUP: '@motolog_last_backup',
};

const BackupContext = createContext({
  user: null,
  isSignedIn: false,
  isLoading: false,
  isBacking: false,
  isRestoring: false,
  lastBackupTime: null,
  backupMeta: null,
  signIn: async () => {},
  signOut: async () => {},
  backupNow: async () => {},
  restoreNow: async () => {},
  checkBackupExists: async () => {},
});

export const BackupProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBacking, setIsBacking] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [lastBackupTime, setLastBackupTime] = useState(null);
  const [backupMeta, setBackupMeta] = useState(null);

  // expo-auth-session Google provider
  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: GOOGLE_CLIENT_IDS.androidClientId,
    iosClientId: GOOGLE_CLIENT_IDS.iosClientId,
    webClientId: GOOGLE_CLIENT_IDS.webClientId,
    scopes: [
      'openid',
      'profile',
      'email',
      'https://www.googleapis.com/auth/drive.appdata',
    ],
  });

  // ── Restore session on mount ───────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [storedUser, storedToken, storedBackup] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.USER_INFO),
          AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN),
          AsyncStorage.getItem(STORAGE_KEYS.LAST_BACKUP),
        ]);
        if (storedUser) setUser(JSON.parse(storedUser));
        if (storedToken) setAccessToken(storedToken);
        if (storedBackup) setLastBackupTime(storedBackup);
      } catch (_) {}
      setIsLoading(false);
    })();
  }, []);

  // ── Handle OAuth response ──────────────────────────────────────────────────
  useEffect(() => {
    if (response?.type === 'success') {
      const token = response.authentication?.accessToken;
      if (token) handleSuccessfulAuth(token);
    }
  }, [response]);

  const handleSuccessfulAuth = async (token) => {
    try {
      setIsLoading(true);
      setAccessToken(token);
      await AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token);

      // Fetch user profile
      const profileRes = await fetch(
        'https://www.googleapis.com/oauth2/v3/userinfo',
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const profile = await profileRes.json();
      const userInfo = {
        id: profile.sub,
        name: profile.name,
        email: profile.email,
        picture: profile.picture,
      };
      setUser(userInfo);
      await AsyncStorage.setItem(STORAGE_KEYS.USER_INFO, JSON.stringify(userInfo));

      // Check if there's existing backup data on Drive
      const existing = await findBackupFile(token);
      if (existing) {
        setBackupMeta(existing);
        // Prompt user: restore or keep local?
        Alert.alert(
          '☁️ Backup Found',
          `We found a backup from ${new Date(existing.modifiedTime).toLocaleDateString()} on your Google Drive.\n\nWould you like to restore it?`,
          [
            {
              text: 'Restore Backup',
              onPress: () => performRestore(token),
            },
            {
              text: 'Keep Local Data',
              style: 'cancel',
              onPress: () => {
                // Immediately back up local data to Drive
                performBackup(token);
              },
            },
          ]
        );
      } else {
        // No existing backup — upload local data immediately
        await performBackup(token);
        Alert.alert('✅ Signed In', `Welcome, ${userInfo.name}!\nYour data has been backed up to Google Drive.`);
      }
    } catch (e) {
      console.error('Auth error:', e);
      Alert.alert('Sign-in Error', 'Could not complete Google sign-in. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Sign In ────────────────────────────────────────────────────────────────
  const signIn = useCallback(async () => {
    if (!request) {
      Alert.alert(
        'Configuration Needed',
        'Google OAuth is not configured yet.\n\nAdd your Google Client IDs to src/context/BackupContext.js to enable cloud backup.',
        [{ text: 'OK' }]
      );
      return;
    }
    await promptAsync();
  }, [request, promptAsync]);

  // ── Sign Out ───────────────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    Alert.alert(
      'Sign Out',
      'Sign out of Google? Your local data will remain on this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await Promise.all([
              AsyncStorage.removeItem(STORAGE_KEYS.USER_INFO),
              AsyncStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN),
            ]);
            setUser(null);
            setAccessToken(null);
            setBackupMeta(null);
          },
        },
      ]
    );
  }, []);

  // ── Backup ─────────────────────────────────────────────────────────────────
  const performBackup = async (token) => {
    const t = token || accessToken;
    if (!t) return false;
    try {
      setIsBacking(true);
      const payload = buildBackupPayload(db);
      await uploadBackup(t, payload);
      const now = new Date().toISOString();
      setLastBackupTime(now);
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_BACKUP, now);
      // Refresh meta
      const meta = await findBackupFile(t);
      if (meta) setBackupMeta(meta);
      return true;
    } catch (e) {
      console.error('Backup error:', e);
      return false;
    } finally {
      setIsBacking(false);
    }
  };

  const backupNow = useCallback(async () => {
    if (!accessToken) {
      Alert.alert('Not Signed In', 'Please sign in to Google to back up your data.');
      return;
    }
    const ok = await performBackup(accessToken);
    if (ok) {
      Alert.alert('✅ Backup Complete', 'Your data has been saved to Google Drive.');
    } else {
      Alert.alert('Backup Failed', 'Could not back up to Google Drive. Check your connection and try again.');
    }
  }, [accessToken]);

  // ── Restore ────────────────────────────────────────────────────────────────
  const performRestore = async (token) => {
    const t = token || accessToken;
    if (!t) return false;
    try {
      setIsRestoring(true);
      const payload = await downloadBackup(t);
      if (!payload) {
        Alert.alert('No Backup', 'No backup file found on Google Drive.');
        return false;
      }
      // Get raw db handle via a known sync call
      const SQLite = require('expo-sqlite');
      const dbHandle = SQLite.openDatabaseSync('bike_expense.db');
      const stats = restoreFromPayload(dbHandle, payload);
      const now = new Date().toISOString();
      setLastBackupTime(now);
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_BACKUP, now);
      return stats;
    } catch (e) {
      console.error('Restore error:', e);
      return false;
    } finally {
      setIsRestoring(false);
    }
  };

  const restoreNow = useCallback(async () => {
    if (!accessToken) {
      Alert.alert('Not Signed In', 'Please sign in to Google first.');
      return;
    }
    Alert.alert(
      '⚠️ Restore Backup',
      'This will REPLACE all current data on this device with your backed-up data. This cannot be undone.\n\nContinue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: async () => {
            const stats = await performRestore(accessToken);
            if (stats) {
              Alert.alert(
                '✅ Restore Complete',
                `Restored:\n• ${stats.bikes} bike(s)\n• ${stats.fuelLogs} fuel logs\n• ${stats.expenses} expenses\n• ${stats.reminders} reminders\n• ${stats.trips} trips\n\nPlease restart the app for changes to take effect.`
              );
            } else {
              Alert.alert('Restore Failed', 'Could not restore from Google Drive. Please try again.');
            }
          },
        },
      ]
    );
  }, [accessToken]);

  const checkBackupExists = useCallback(async () => {
    if (!accessToken) return null;
    try {
      const meta = await findBackupFile(accessToken);
      setBackupMeta(meta);
      return meta;
    } catch (_) {
      return null;
    }
  }, [accessToken]);

  return (
    <BackupContext.Provider
      value={{
        user,
        isSignedIn: !!user,
        isLoading,
        isBacking,
        isRestoring,
        lastBackupTime,
        backupMeta,
        signIn,
        signOut,
        backupNow,
        restoreNow,
        checkBackupExists,
      }}
    >
      {children}
    </BackupContext.Provider>
  );
};

export const useBackup = () => useContext(BackupContext);
