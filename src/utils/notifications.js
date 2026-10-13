import { Platform } from 'react-native';

let Notifications = null;
let handlerConfigured = false;

const loadNotifications = () => {
  if (Notifications) return Notifications;
  try {
    // Lazy-require so headless/startup runtimes never touch the native module
    // until the UI runtime is ready (avoids Hermes microtask crash).
    Notifications = require('expo-notifications');
  } catch (_) {
    Notifications = null;
  }
  return Notifications;
};

export const configureNotifications = () => {
  const N = loadNotifications();
  if (!N || handlerConfigured) return;
  try {
    N.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    handlerConfigured = true;
  } catch (_) {}
};

export const requestNotificationPermission = async () => {
  try {
    configureNotifications();
    const N = loadNotifications();
    if (!N) return false;

    if (Platform.OS === 'android') {
      await N.setNotificationChannelAsync('service-reminders', {
        name: 'Service Reminders',
        importance: N.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF6B35',
      });
    }
    const { status: existing } = await N.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await N.requestPermissionsAsync();
    return status === 'granted';
  } catch (_) {
    return false;
  }
};

export const checkAndNotifyReminders = async (reminders, currentOdometer) => {
  try {
    if (!Array.isArray(reminders) || reminders.length === 0) return;

    const granted = await requestNotificationPermission();
    if (!granted) return;

    const N = loadNotifications();
    if (!N) return;

    // Cancel previous local reminders to avoid stacking / headless storms
    try {
      await N.cancelAllScheduledNotificationsAsync();
    } catch (_) {}

    for (const reminder of reminders) {
      const lastKm = Number(reminder.last_service_km) || 0;
      const interval = Number(reminder.interval_km) || 0;
      if (interval <= 0) continue;

      const nextDue = lastKm + interval;
      const kmLeft = nextDue - (Number(currentOdometer) || 0);
      if (kmLeft > 500) continue;

      const urgency = kmLeft <= 0 ? 'OVERDUE' : kmLeft <= 200 ? 'Due very soon' : 'Due soon';
      const body = kmLeft <= 0
        ? `${reminder.title} is overdue by ${Math.abs(kmLeft).toFixed(0)} km!`
        : `${reminder.title} due in ${kmLeft.toFixed(0)} km`;

      await N.scheduleNotificationAsync({
        content: {
          title: `Service ${urgency}`,
          body,
          data: { reminderId: reminder.id },
          ...(Platform.OS === 'android' && { channelId: 'service-reminders' }),
        },
        // Immediate local notification (no background task / headless JS)
        trigger: null,
      });
    }
  } catch (_) {}
};
