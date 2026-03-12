import React, { createContext, useContext, useState, useEffect } from 'react';
import { getTheme, setTheme } from '../database/db';

const DARK = {
  primary: '#FF6B35',
  primaryDark: '#E85A24',
  primaryLight: '#FF8C5A',
  secondary: '#1A1A2E',
  secondaryLight: '#16213E',
  surface: '#0F3460',
  surfaceLight: '#1A4A7A',
  card: '#1E2A45',
  cardLight: '#253550',
  accent: '#FFD700',
  accentGreen: '#4CAF50',
  accentRed: '#FF4757',
  accentBlue: '#2196F3',
  accentPurple: '#9C27B0',
  text: '#FFFFFF',
  textSecondary: '#A8B2C4',
  textMuted: '#6B7A8D',
  border: '#2A3F5F',
  background: '#0A0E1A',
  white: '#FFFFFF',
  black: '#000000',
};

const LIGHT = {
  primary: '#FF6B35',
  primaryDark: '#E85A24',
  primaryLight: '#FF8C5A',
  secondary: '#F0F4FF',
  secondaryLight: '#E8EDF8',
  surface: '#FFFFFF',
  surfaceLight: '#F5F8FF',
  card: '#FFFFFF',
  cardLight: '#F5F8FF',
  accent: '#E09000',
  accentGreen: '#2E7D32',
  accentRed: '#C62828',
  accentBlue: '#1565C0',
  accentPurple: '#6A1B9A',
  text: '#111827',
  textSecondary: '#374151',
  textMuted: '#6B7280',
  border: '#D1D5DB',
  background: '#F3F6FC',
  white: '#FFFFFF',
  black: '#000000',
};

const ThemeContext = createContext({
  theme: 'dark',
  COLORS: DARK,
  toggleTheme: () => {},
});

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState('dark');

  useEffect(() => {
    try {
      const saved = getTheme();
      setThemeState(saved || 'dark');
    } catch (_) {}
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setThemeState(next);
    setTheme(next);
  };

  const COLORS = theme === 'dark' ? DARK : LIGHT;

  return (
    <ThemeContext.Provider value={{ theme, COLORS, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

// Keep legacy COLORS export for files that haven't migrated yet
export { DARK as COLORS };
