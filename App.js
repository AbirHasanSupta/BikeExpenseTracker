import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar, View } from 'react-native';
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
import { COLORS } from './src/constants';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function DashboardStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DashboardMain" component={DashboardScreen} />
      <Stack.Screen name="AddFuel" component={AddFuelScreen} />
      <Stack.Screen name="AddExpense" component={AddExpenseScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
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

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
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
          tabBarIcon: ({ color, size, focused }) => {
            const icons = {
              Dashboard: focused ? 'view-dashboard' : 'view-dashboard-outline',
              History: focused ? 'history' : 'history',
              Analytics: focused ? 'chart-line' : 'chart-line-variant',
            };
            return <MaterialCommunityIcons name={icons[route.name] || 'circle'} size={24} color={color} />;
          },
        })}
      >
        <Tab.Screen name="Dashboard" component={DashboardStack} />
        <Tab.Screen name="History" component={HistoryStack} />
        <Tab.Screen name="Analytics" component={AnalyticsStack} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
