import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import DashboardScreen from './src/screens/DashboardScreen';
import AddFuelScreen from './src/screens/AddFuelScreen';
import AddExpenseScreen from './src/screens/AddExpenseScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import AnalyticsScreen from './src/screens/AnalyticsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import TripScreen from './src/screens/TripScreen';
import BackupScreen from './src/screens/BackupScreen';

import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { BackupProvider } from './src/context/BackupContext';
import { requestNotificationPermission } from './src/utils/notifications';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function DashboardStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DashboardMain" component={DashboardScreen} />
      <Stack.Screen name="AddFuel" component={AddFuelScreen} />
      <Stack.Screen name="AddExpense" component={AddExpenseScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Backup" component={BackupScreen} />
    </Stack.Navigator>
  );
}

function HistoryStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HistoryMain" component={HistoryScreen} />
      <Stack.Screen name="AddFuel" component={AddFuelScreen} />
      <Stack.Screen name="AddExpense" component={AddExpenseScreen} />
    </Stack.Navigator>
  );
}

function AnalyticsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AnalyticsMain" component={AnalyticsScreen} />
      <Stack.Screen name="AddFuel" component={AddFuelScreen} />
      <Stack.Screen name="AddExpense" component={AddExpenseScreen} />
    </Stack.Navigator>
  );
}

function TripStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="TripMain" component={TripScreen} />
      <Stack.Screen name="AddFuel" component={AddFuelScreen} />
      <Stack.Screen name="AddExpense" component={AddExpenseScreen} />
    </Stack.Navigator>
  );
}

function AppTabs() {
  const { COLORS, theme } = useTheme();

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  return (
    <>
      <StatusBar
        barStyle={theme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={COLORS.background}
      />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: {
            backgroundColor: COLORS.secondary,
            borderTopColor: COLORS.border,
            borderTopWidth: 1,
            paddingBottom: 8,
            paddingTop: 8,
            height: 64,
          },
          tabBarActiveTintColor: COLORS.primary,
          tabBarInactiveTintColor: COLORS.textMuted,
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
          tabBarIcon: ({ color, focused }) => {
            const icons = {
              Dashboard: focused ? 'view-dashboard' : 'view-dashboard-outline',
              History: 'history',
              Analytics: focused ? 'chart-line' : 'chart-line-variant',
              Trips: 'map-marker-path',
            };
            return <MaterialCommunityIcons name={icons[route.name] || 'circle'} size={24} color={color} />;
          },
        })}
      >
        <Tab.Screen name="Dashboard" component={DashboardStack} options={{ unmountOnBlur: true }} />
        <Tab.Screen name="History" component={HistoryStack} />
        <Tab.Screen name="Trips" component={TripStack} />
        <Tab.Screen name="Analytics" component={AnalyticsStack} />
      </Tab.Navigator>
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <BackupProvider>
        <NavigationContainer>
          <AppTabs />
        </NavigationContainer>
      </BackupProvider>
    </ThemeProvider>
  );
}