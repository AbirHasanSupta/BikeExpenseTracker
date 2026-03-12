import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const requestNotificationPermission = async () => {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('service-reminders', {
        name: 'Service Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF6B35',
      });
    }
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch (_) {
    return false;
  }
};

export const checkAndNotifyReminders = async (reminders, currentOdometer) => {
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return;

    for (const reminder of reminders) {
      const nextDue = reminder.last_service_km + reminder.interval_km;
      const kmLeft = nextDue - currentOdometer;
      if (kmLeft > 500) continue;

      const urgency = kmLeft <= 0 ? 'OVERDUE' : kmLeft <= 200 ? 'Due very soon' : 'Due soon';
      const body = kmLeft <= 0
        ? `${reminder.title} is overdue by ${Math.abs(kmLeft).toFixed(0)} km!`
        : `${reminder.title} due in ${kmLeft.toFixed(0)} km`;

      await Notifications.scheduleNotificationAsync({
        content: {
          title: `🔧 Service ${urgency}`,
          body,
          data: { reminderId: reminder.id },
          ...(Platform.OS === 'android' && { channelId: 'service-reminders' }),
        },
        trigger: null,
      });
    }
  } catch (_) {}
};