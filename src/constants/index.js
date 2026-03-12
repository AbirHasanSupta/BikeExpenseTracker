export const COLORS = {
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

export const EXPENSE_CATEGORIES = [
  { label: 'Engine Oil', value: 'engine_oil', icon: 'oil-can', color: '#FF9800' },
  { label: 'Oil Filter', value: 'oil_filter', icon: 'filter', color: '#FF5722' },
  { label: 'Air Filter', value: 'air_filter', icon: 'air', color: '#2196F3' },
  { label: 'Brake Pads', value: 'brake_pads', icon: 'car-brake-hold', color: '#F44336' },
  { label: 'Chain', value: 'chain', icon: 'link', color: '#9C27B0' },
  { label: 'Tire', value: 'tire', icon: 'tire', color: '#607D8B' },
  { label: 'Service/Labor', value: 'service', icon: 'wrench', color: '#4CAF50' },
  { label: 'Parking', value: 'parking', icon: 'parking', color: '#00BCD4' },
  { label: 'Toll', value: 'toll', icon: 'road', color: '#795548' },
  { label: 'Insurance', value: 'insurance', icon: 'shield-check', color: '#3F51B5' },
  { label: 'Registration', value: 'registration', icon: 'card-account-details', color: '#009688' },
  { label: 'Others', value: 'others', icon: 'dots-horizontal', color: '#9E9E9E' },
];

export const RIDE_TAGS = [
  { label: 'Personal', value: 'personal', icon: 'account', color: '#2196F3' },
  { label: 'Office', value: 'office', icon: 'briefcase', color: '#FF9800' },
  { label: 'Travel', value: 'travel', icon: 'map-marker-radius', color: '#4CAF50' },
  { label: 'Other', value: 'other', icon: 'dots-horizontal', color: '#9E9E9E' },
];

export const getCategoryInfo = (value) => {
  return EXPENSE_CATEGORIES.find(c => c.value === value) || EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1];
};

export const getRideTagInfo = (value) => {
  return RIDE_TAGS.find(t => t.value === value) || RIDE_TAGS[0];
};

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const formatCurrency = (amount, currency = 'BDT') => {
  const num = parseFloat(amount) || 0;
  return `${currency} ${num.toFixed(0)}`;
};

export const formatDate = (dateString) => {
  if (!dateString) return '';
  const d = new Date(dateString);
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
};

export const getTodayString = () => {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};
