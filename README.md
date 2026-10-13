# 🏍️ Bike Expense Tracker

A React Native (Expo) app to track motorcycle fuel and maintenance expenses.
Built for Android. Works 100% offline with local SQLite storage.

---

## 📱 Features

- ✅ **Dashboard** — Monthly expense overview with stats
- ✅ **Add Fuel** — Two entry methods (amount or litres), live calculations
- ✅ **Add Expense** — 12 categories with icons
- ✅ **History** — View/delete all fuel logs and expenses
- ✅ **Analytics** — New-Architecture-safe monthly and category breakdowns
- ✅ **Settings** — Set fuel price, currency, manage bikes, service reminders
- ✅ **CSV import/export** — Round-trip-safe files, including the previous MotoLog export format
- ✅ **Google Drive backup** — Private app-data backup and transactional restore
- ✅ **SQLite Database** — Fully offline, data persists on device
- ✅ **Key calculations** — Mileage (km/L), Cost/km, Distance traveled

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- **Expo Go app** on your Android phone (from Play Store)

### Run the App

```bash
# Install dependencies
npm install

# Start Expo dev server
npx expo start

# Scan the QR code with Expo Go app on your phone
```

### Build APK (for distribution)

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Configure EAS (first time only)
eas build:configure

# Build APK for Android
eas build -p android --profile preview
```

### Configure Google Drive backup

Cloud backup requires your own Google OAuth client IDs. In Google Cloud Console, enable the Google Drive API and create an Android OAuth client for package `com.abirsupta.MotoLog` using the SHA-1 certificate fingerprint for the EAS build. Create a Web client too if you use the web build. Then add the IDs to a local `.env` file (never commit it) and to the corresponding EAS environment secrets:

```bash
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=...apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=...apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=...apps.googleusercontent.com
```

Rebuild after changing an `EXPO_PUBLIC_` value. The app remains usable without these values; it shows a configuration message instead of crashing when Backup is opened.

### Verify before an EAS build

```bash
npm run verify
npx expo export --platform android
```

---

## 📁 Project Structure

```
BikeExpenseTracker/
├── App.js                          # Root: Navigation setup
├── app.json                        # Expo config
├── src/
│   ├── constants/
│   │   └── index.js                # Colors, categories, formatters
│   ├── database/
│   │   └── db.js                   # SQLite: all DB operations
│   └── screens/
│       ├── DashboardScreen.js      # Home with monthly stats
│       ├── AddFuelScreen.js        # Add fuel entry
│       ├── AddExpenseScreen.js     # Add maintenance expense
│       ├── HistoryScreen.js        # View all entries
│       ├── AnalyticsScreen.js      # Charts and trends
│       └── SettingsScreen.js       # Fuel price, bikes, currency
```

---

## 🗄️ Database Schema

### `fuel_logs`
| Column | Type | Description |
|---|---|---|
| id | INTEGER PK | Auto increment |
| bike_id | INTEGER | Foreign key to bikes |
| date | TEXT | YYYY-MM-DD |
| litres | REAL | Fuel added |
| price_per_litre | REAL | Price at time of fill |
| total_cost | REAL | Total amount paid |
| odometer | REAL | Current odometer reading |
| station_name | TEXT | Optional |
| notes | TEXT | Optional |

### `expenses`
| Column | Type | Description |
|---|---|---|
| id | INTEGER PK | Auto increment |
| bike_id | INTEGER | Foreign key to bikes |
| date | TEXT | YYYY-MM-DD |
| category | TEXT | engine_oil, brake_pads, etc. |
| cost | REAL | Amount spent |
| notes | TEXT | Optional |

### `bikes`
| Column | Type | Description |
|---|---|---|
| id | INTEGER PK | Auto increment |
| bike_name | TEXT | e.g. Yamaha FZ V3 |
| tank_capacity | REAL | Litres |

### `settings`
| Column | Type | Description |
|---|---|---|
| fuel_price | REAL | Per litre (BDT) |
| currency | TEXT | BDT/USD/EUR/INR |
| default_bike_id | INTEGER | Active bike |

---

## 🔧 Key Calculations

```
Mileage (km/L) = Distance Traveled / Fuel Used
Distance       = Current Odometer - Previous Odometer
Cost per KM    = (Fuel Cost + Maintenance) / Distance
```

---

## 📦 Dependencies

| Package | Purpose |
|---|---|
| expo-sqlite | Local SQLite database |
| @react-navigation/native | Navigation framework |
| @react-navigation/bottom-tabs | Tab bar navigation |
| @react-navigation/stack | Stack screens |
| @expo/vector-icons | MaterialCommunityIcons |
| expo-auth-session | Google OAuth sign-in |
| expo-document-picker / expo-sharing | CSV import and file export |
| expo-notifications | Service-reminder notifications |
| react-native-screens | Native screen optimization |
| react-native-safe-area-context | Safe area handling |

---

## 🎨 Design

- **Theme**: Dark — deep navy/slate background with vibrant orange accent
- **Primary color**: `#FF6B35` (Vibrant Orange)
- **Background**: `#0A0E1A` (Deep dark navy)
- **Currency default**: BDT (Bangladesh Taka)
