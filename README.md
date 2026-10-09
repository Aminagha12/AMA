# Forex Robot Signal Bot
**By Amin Agha Hamidi — 07/10/2026**

---

## د APK د جوړولو لپاره مکمل لارښود

### ✅ مرحله ۱ — د چاپیریال تیارول (یو ځل)

لاندې Software نصب کړئ که چیرې نه وي:

| Software | Download |
|---|---|
| Node.js (v18 یا لوړ) | https://nodejs.org |
| Android Studio | https://developer.android.com/studio |
| Git | https://git-scm.com |

Android Studio نصبولو وروسته:
- `SDK Tools` کې `Android SDK`, `Android SDK Platform`, `Android Virtual Device` چیک کړئ
- **د Environment Variable ضرور دي:**
  ```
  ANDROID_HOME = C:\Users\YourName\AppData\Local\Android\Sdk
  ```
  او د `Path` کې دا اضافه کړئ:
  ```
  %ANDROID_HOME%\platform-tools
  %ANDROID_HOME%\tools
  ```

---

### ✅ مرحله ۲ — پروجیکت Clone کړئ

```bash
git clone https://github.com/your-username/forex-robot-signal-bot.git
cd forex-robot-signal-bot
```

---

### ✅ مرحله ۳ — د Binance API Key اضافه کړئ

```bash
# د .env.example نه یو نوی .env جوړ کړئ
cp .env.example .env
```

اوس `.env` فایل خلاص کړئ او خپل کیلي واچوئ:

```env
VITE_BINANCE_API_KEY=دلته_خپل_API_Key_واچوئ
VITE_BINANCE_SECRET_KEY=دلته_خپل_Secret_Key_واچوئ
```

> ⚠️ `.env` فایل هیڅکله GitHub ته Upload مه کوئ — `.gitignore` کې لیست دی

---

### ✅ مرحله ۴ — د Robot تصویر اضافه کړئ

```
src/
└── assets/
    └── robot.jpg   ← دلته خپل تصویر واچوئ (همدغه نوم وساتئ)
```

---

### ✅ مرحله ۵ — د Package نصبول

```bash
npm install
```

---

### ✅ مرحله ۶ — Test کړئ (Browser کې)

```bash
npm run dev
```
Browser کې `http://localhost:5173` خلاص کړئ

---

### ✅ مرحله ۷ — د Android لپاره Build

```bash
# وب اپ Build کړئ
npm run build

# د Capacitor Android Platform اضافه کړئ (یو ځل)
npx cap add android

# Sync کړئ
npx cap sync android
```

---

### ✅ مرحله ۸ — د APK جوړول

**Option A — Android Studio کې:**
```bash
npx cap open android
```
Android Studio خلاصیږي → `Build` → `Build APK(s)` کلیک کړئ

APK به دلته وي:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

**Option B — Command Line کې:**
```bash
cd android
./gradlew assembleDebug
```

---

### ✅ مرحله ۹ — APK د تلیفون ته لیږل

```bash
# USB سره وصل کړئ
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

یا APK فایل مستقیم د Phone ته Copy کړئ

---

## د API Key بارهٔ مهم معلومات

| | API Key | Secret Key |
|---|---|---|
| د Market Data لپاره (Klines, Prices) | ✅ کافي | ❌ نه ضروري |
| د Account Info لپاره | ✅ | ✅ |
| د Order Place کولو لپاره | ✅ | ✅ |

**Binance API Key جوړولو لارښود:**
1. `https://www.binance.com` → Login
2. Account → API Management
3. "Create API" کلیک کړئ
4. یوازې `Enable Reading` چیک کړئ
5. API Key او Secret Key Copy کړئ → `.env` کې واچوئ

---

## د JP225 بارهٔ یادونه

JP225.std د Binance کې شتون نه لري — دا د MT4/MT5 broker symbol دی.
د دغه symbol د data لپاره د خپل Broker API کارولو ضرورت دی.

---

## Project Structure

```
forex-robot-signal-bot/
├── src/
│   ├── App.jsx          ← اصلي App (ټول logic دلته دی)
│   ├── main.jsx         ← Entry point
│   └── assets/
│       └── robot.jpg    ← ← ← دلته خپل تصویر واچوئ
├── .env                 ← ← ← دلته API Keys واچوئ (GitHub ته مه Upload کوئ)
├── .env.example         ← د .env template
├── .gitignore
├── capacitor.config.json
├── package.json
├── vite.config.js
└── index.html
```
