/**
 * BackupContext.js
 * Manages Google OAuth state and exposes backup/restore actions app-wide.
 *
 * Google Cloud Console setup:
 *   1. Create OAuth 2.0 Client IDs (Android + Web; iOS optional)
 *   2. Enable Google Drive API
 *   3. Android package: com.abirsupta.MotoLog (SHA-1 from EAS credentials)
 *   4. Set EXPO_PUBLIC_GOOGLE_*_CLIENT_ID in .env / EAS secrets
 */

import React, {
  createContext, useContext, useState, useEffect, useCallback, useRef,
} from 'react';
import { Alert, Platform } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  findBackupFile, uploadBackup, downloadBackup,
  buildBackupPayload, restoreFromPayload,
} from '../utils/cloudBackup';
import * as db from '../database/db';
import { getDbHandle } from '../database/db';

const GOOGLE_CLIENT_IDS = {
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '',
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '',
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '',
};

// `useAuthRequest` requires a client ID while it initializes. Supplying a
// placeholder keeps an unconfigured production build from crashing during
// startup; signIn below prevents that placeholder from ever being used.
const PLACEHOLDER_CLIENT_ID = '000000000000-placeholder.apps.googleusercontent.com';
const configuredClientId = Platform.select({
  android: GOOGLE_CLIENT_IDS.androidClientId,
  ios: GOOGLE_CLIENT_IDS.iosClientId,
  default: GOOGLE_CLIENT_IDS.webClientId,
}) || '';

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
  isConfigured: false,
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
  const handlingAuth = useRef(false);

  const redirectUri = makeRedirectUri({
    scheme: 'motolog',
    path: 'oauth',
  });

  const authConfig = {
    androidClientId: GOOGLE_CLIENT_IDS.androidClientId || PLACEHOLDER_CLIENT_ID,
    iosClientId: GOOGLE_CLIENT_IDS.iosClientId || PLACEHOLDER_CLIENT_ID,
    webClientId: GOOGLE_CLIENT_IDS.webClientId || PLACEHOLDER_CLIENT_ID,
    scopes: [
      'openid',
      'profile',
      'email',
      'https://www.googleapis.com/auth/drive.appdata',
    ],
    redirectUri,
    selectAccount: true,
  };

  // Hook must always run; signIn guards when IDs are missing.
  const [request, response, promptAsync] = Google.useAuthRequest(authConfig);

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

  const clearSession = useCallback(async () => {
    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEYS.USER_INFO),
      AsyncStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN),
    ]);
    setUser(null);
    setAccessToken(null);
    setBackupMeta(null);
  }, []);

  const performBackup = useCallback(async (token) => {
    const t = token || accessToken;
    if (!t) return false;
    try {
      setIsBacking(true);
      const payload = buildBackupPayload(db);
      await uploadBackup(t, payload);
      const now = new Date().toISOString();
      setLastBackupTime(now);
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_BACKUP, now);
      const meta = await findBackupFile(t);
      if (meta) setBackupMeta(meta);
      return true;
    } catch (e) {
      console.error('Backup error:', e);
      if (String(e?.message || '').includes('expired')) {
        await clearSession();
      }
      return false;
    } finally {
      setIsBacking(false);
    }
  }, [accessToken, clearSession]);

  const performRestore = useCallback(async (token) => {
    const t = token || accessToken;
    if (!t) return false;
    try {
      setIsRestoring(true);
      const payload = await downloadBackup(t);
      if (!payload) {
        Alert.alert('No Backup', 'No backup file found on Google Drive.');
        return false;
      }
      const dbHandle = getDbHandle();
      const stats = restoreFromPayload(dbHandle, payload);
      const now = new Date().toISOString();
      setLastBackupTime(now);
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_BACKUP, now);
      return stats;
    } catch (e) {
      console.error('Restore error:', e);
      if (String(e?.message || '').includes('expired')) {
        await clearSession();
      }
      return false;
    } finally {
      setIsRestoring(false);
    }
  }, [accessToken, clearSession]);

  const handleSuccessfulAuth = useCallback(async (token) => {
    if (!token || handlingAuth.current) return;
    handlingAuth.current = true;
    try {
      setIsLoading(true);
      setAccessToken(token);
      await AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token);

      const profileRes = await fetch(
        'https://www.googleapis.com/oauth2/v3/userinfo',
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!profileRes.ok) throw new Error(`Profile fetch failed: ${profileRes.status}`);
      const profile = await profileRes.json();
      const userInfo = {
        id: profile.sub,
        name: profile.name || profile.email || 'Google User',
        email: profile.email || '',
        picture: profile.picture || null,
      };
      setUser(userInfo);
      await AsyncStorage.setItem(STORAGE_KEYS.USER_INFO, JSON.stringify(userInfo));

      const existing = await findBackupFile(token);
      if (existing) {
        setBackupMeta(existing);
        Alert.alert(
          'Backup Found',
          `We found a backup from ${new Date(existing.modifiedTime).toLocaleDateString()} on your Google Drive.\n\nWould you like to restore it?`,
          [
            { text: 'Restore Backup', onPress: () => performRestore(token) },
            {
              text: 'Keep Local Data',
              style: 'cancel',
              onPress: () => { performBackup(token); },
            },
          ]
        );
      } else {
        const backedUp = await performBackup(token);
        Alert.alert(
          backedUp ? 'Signed In' : 'Signed In, Backup Pending',
          backedUp
            ? `Welcome, ${userInfo.name}!\nYour data has been backed up to Google Drive.`
            : `Welcome, ${userInfo.name}! Google sign-in worked, but the first backup did not complete. Use Back Up Now to retry.`
        );
      }
    } catch (e) {
      console.error('Auth error:', e);
      Alert.alert('Sign-in Error', e?.message || 'Could not complete Google sign-in. Please try again.');
      await clearSession();
    } finally {
      setIsLoading(false);
      handlingAuth.current = false;
    }
  }, [performBackup, performRestore, clearSession]);

  useEffect(() => {
    if (response?.type === 'success') {
      const token = response.authentication?.accessToken;
      if (token) handleSuccessfulAuth(token);
    } else if (response?.type === 'error') {
      Alert.alert('Sign-in Error', response.error?.message || 'Google sign-in failed.');
    }
  }, [response, handleSuccessfulAuth]);

  const signIn = useCallback(async () => {
    if (!configuredClientId) {
      Alert.alert(
        'Configuration Needed',
        `Google OAuth is not configured for ${Platform.OS}.\n\nSet the matching EXPO_PUBLIC_GOOGLE_*_CLIENT_ID (see .env.example), then rebuild the app.`,
        [{ text: 'OK' }]
      );
      return;
    }
    if (!request) {
      Alert.alert('Please wait', 'Google sign-in is still initializing. Try again in a moment.');
      return;
    }
    try {
      await promptAsync({ showInRecents: true });
    } catch (e) {
      Alert.alert('Sign-in Error', e?.message || 'Could not open Google sign-in.');
    }
  }, [request, promptAsync]);

  const signOut = useCallback(async () => {
    Alert.alert(
      'Sign Out',
      'Sign out of Google? Your local data will remain on this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => { clearSession(); },
        },
      ]
    );
  }, [clearSession]);

  const backupNow = useCallback(async () => {
    if (!accessToken) {
      Alert.alert('Not Signed In', 'Please sign in to Google to back up your data.');
      return;
    }
    const ok = await performBackup(accessToken);
    if (ok) {
      Alert.alert('Backup Complete', 'Your data has been saved to Google Drive.');
    } else {
      Alert.alert('Backup Failed', 'Could not back up to Google Drive. Check your connection and try again.');
    }
  }, [accessToken, performBackup]);

  const restoreNow = useCallback(async () => {
    if (!accessToken) {
      Alert.alert('Not Signed In', 'Please sign in to Google first.');
      return;
    }
    Alert.alert(
      'Restore Backup',
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
                'Restore Complete',
                `Restored:\n• ${stats.bikes} bike(s)\n• ${stats.fuelLogs} fuel logs\n• ${stats.expenses} expenses\n• ${stats.reminders} reminders\n• ${stats.trips} trips\n\nPlease restart the app for changes to take effect.`
              );
            } else {
              Alert.alert('Restore Failed', 'Could not restore from Google Drive. Please try again.');
            }
          },
        },
      ]
    );
  }, [accessToken, performRestore]);

  const checkBackupExists = useCallback(async () => {
    if (!accessToken) return null;
    try {
      const meta = await findBackupFile(accessToken);
      setBackupMeta(meta);
      return meta;
    } catch (e) {
      if (String(e?.message || '').includes('expired')) {
        await clearSession();
      }
      return null;
    }
  }, [accessToken, clearSession]);

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
        isConfigured: !!configuredClientId,
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
