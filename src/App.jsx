import { useState, useEffect, useCallback } from "react";

const BINANCE_API_KEY = import.meta.env.VITE_BINANCE_API_KEY || "";
const BINANCE_BASE = "https://api.binance.com";
const LICENSE_KEY = "Hamidi2026@#AK";

const SYMBOLS = [
  { id: "XAUUSD", binanceSymbol: "PAXGUSDT", label: "XAUUSD.m",  name: "GOLD vs USD",    emoji: "🥇", decimals: 2 },
  { id: "JP225",  binanceSymbol: null,        label: "JP225.std", name: "Japan 225 Index", emoji: "🎌", decimals: 1 },
  { id: "BTCUSD", binanceSymbol: "BTCUSDT",   label: "BTCUSD.m",  name: "Bitcoin vs USD",  emoji: "₿",  decimals: 2 },
];

const calcEMA = (data, period) => {
  if (data.length < period) return [];
  const k = 2 / (period + 1);
  let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const result = new Array(period - 1).fill(null);
  result.push(ema);
  for (let i = period; i < data.length; i++) { ema = data[i] * k + ema * (1 - k); result.push(ema); }
  return result;
};

const calcSMA = (data, period) => {
  const result = new Array(period - 1).fill(null);
  for (let i = period - 1; i < data.length; i++)
    result.push(data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period);
  return result;
};

const calcRSI = (closes, period = 14) => {
  if (closes.length < period + 1) return [];
  const result = new Array(period).fill(null);
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gains += d; else losses -= d;
  }
  let avgG = gains / period, avgL = losses / period;
  result.push(avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL));
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgG = (avgG * (period - 1) + Math.max(d, 0)) / period;
    avgL = (avgL * (period - 1) + Math.max(-d, 0)) / period;
    result.push(avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL));
  }
  return result;
};

const calcMACD = (closes, fast = 12, slow = 26, signal = 9) => {
  const emaF = calcEMA(closes, fast);
  const emaS = calcEMA(closes, slow);
  const macdLine = closes.map((_, i) =>
    emaF[i] != null && emaS[i] != null ? emaF[i] - emaS[i] : null);
  const macdVals = macdLine.filter(v => v != null);
  const sigEMA = calcEMA(macdVals, signal);
  const sigFull = new Array(macdLine.length).fill(null);
  let si = 0;
  for (let i = 0; i < macdLine.length; i++)
    if (macdLine[i] != null) { sigFull[i] = sigEMA[si] ?? null; si++; }
  const histogram = closes.map((_, i) =>
    macdLine[i] != null && sigFull[i] != null ? macdLine[i] - sigFull[i] : null);
  return { macdLine, signalLine: sigFull, histogram };
};

const calcStochastic = (highs, lows, closes, kPeriod = 14, dPeriod = 3) => {
  const k = new Array(kPeriod - 1).fill(null);
  for (let i = kPeriod - 1; i < closes.length; i++) {
    const hh = Math.max(...highs.slice(i - kPeriod + 1, i + 1));
    const ll = Math.min(...lows.slice(i - kPeriod + 1, i + 1));
    k.push(hh === ll ? 50 : ((closes[i] - ll) / (hh - ll)) * 100);
  }
  const kValid = k.filter(v => v != null);
  const d = calcSMA(kValid, dPeriod);
  return { kLast: kValid[kValid.length - 1], dLast: d[d.length - 1] };
};

const calcBB = (closes, period = 20, mult = 2) => {
  const sma = calcSMA(closes, period);
  return closes.map((_, i) => {
    if (sma[i] == null) return null;
    const sl = closes.slice(i - period + 1, i + 1);
    const std = Math.sqrt(sl.reduce((s, v) => s + Math.pow(v - sma[i], 2), 0) / period);
    return { upper: sma[i] + mult * std, middle: sma[i], lower: sma[i] - mult * std };
  });
};

const calcATR = (highs, lows, closes, period = 14) => {
  const tr = [null];
  for (let i = 1; i < closes.length; i++)
    tr.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i-1]), Math.abs(lows[i] - closes[i-1])));
  const trV = tr.filter(v => v != null);
  const a = calcSMA(trV, period);
  return a[a.length - 1];
};

const calcOBV = (closes, volumes) => {
  let last = 0, prev = 0;
  for (let i = 1; i < closes.length - 1; i++) {
    if (closes[i] > closes[i-1]) prev += volumes[i];
    else if (closes[i] < closes[i-1]) prev -= volumes[i];
  }
  last = prev;
  const n = closes.length - 1;
  if (closes[n] > closes[n-1]) last += volumes[n];
  else if (closes[n] < closes[n-1]) last -= volumes[n];
  return { last, prev };
};

const generateSignal = (candles) => {
  if (!candles || candles.length < 210) return null;
  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const volumes = candles.map(c => c.volume);

  const ema9 = calcEMA(closes, 9);
  const ema21 = calcEMA(closes, 21);
  const ema50 = calcEMA(closes, 50);
  const ema200 = calcEMA(closes, 200);
  const sma200 = calcSMA(closes, 200);
  const rsi = calcRSI(closes, 14);
  const macd = calcMACD(closes, 12, 26, 9);
  const stoch = calcStochastic(highs, lows, closes, 14, 3);
  const bb = calcBB(closes, 20, 2);
  const atr = calcATR(highs, lows, closes, 14);
  const obv = calcOBV(closes, volumes);
  const volMA = calcSMA(volumes, 20);

  const n = closes.length - 1;
  const e9c = ema9[n], e9p = ema9[n-1];
  const e21c = ema21[n], e21p = ema21[n-1];
  const e50 = ema50[n], e200 = ema200[n];
  const s200 = sma200[n];
  const rsiC = rsi[n], rsiP = rsi[n-1];
  const macdC = macd.macdLine[n], macdP = macd.macdLine[n-1];
  const sigC = macd.signalLine[n], sigP = macd.signalLine[n-1];
  const histC = macd.histogram[n], histP = macd.histogram[n-1];
  const bbC = bb[n];
  const close = closes[n], prevClose = closes[n-1];
  const volLast = volumes[n], volMALast = volMA[n];

  let buy = 0, sell = 0;

  if (e9p != null && e21p != null) {
    if (e9p <= e21p && e9c > e21c) buy += 2;
    else if (e9p >= e21p && e9c < e21c) sell += 2;
    else if (e9c > e21c) buy += 1; else sell += 1;
  }
  if (e50 != null && e200 != null) { if (e50 > e200) buy += 1; else sell += 1; }
  if (s200 != null) { if (close > s200) buy += 1; else sell += 1; }
  if (rsiC != null && rsiP != null) {
    if (rsiC < 30 && rsiC > rsiP) buy += 2;
    else if (rsiC > 70 && rsiC < rsiP) sell += 2;
    else if (rsiC >= 50 && rsiC <= 70) buy += 1;
    else if (rsiC < 50 && rsiC >= 30) sell += 1;
  }
  if (macdC != null && sigC != null && macdP != null && sigP != null) {
    if (macdP <= sigP && macdC > sigC) buy += 2;
    else if (macdP >= sigP && macdC < sigC) sell += 2;
    if (histC != null && histP != null) {
      if (histC > 0 && histC > histP) buy += 1;
      else if (histC < 0 && histC < histP) sell += 1;
    }
  }
  if (stoch.kLast != null) {
    if (stoch.kLast < 20 && stoch.kLast > stoch.dLast) buy += 1;
    else if (stoch.kLast > 80 && stoch.kLast < stoch.dLast) sell += 1;
  }
  if (bbC != null) {
    if (close <= bbC.lower) buy += 2;
    else if (close >= bbC.upper) sell += 2;
  }
  if (obv.last > obv.prev) buy += 1; else sell += 1;
  if (volMALast != null && volLast > volMALast) {
    if (close > prevClose) buy += 1; else sell += 1;
  }

  const threshold = 7;
  let direction = "NEUTRAL";
  if (buy >= threshold && buy > sell * 1.4) direction = "BUY";
  else if (sell >= threshold && sell > buy * 1.4) direction = "SELL";

  if (direction === "NEUTRAL")
    return { direction: "NEUTRAL", macd: macdC, signal: sigC, rsi: rsiC };

  const entry = close;
  const stopLoss = direction === "BUY" ? entry - 1.0 * atr : entry + 1.0 * atr;
  const takeProfit = direction === "BUY" ? entry + 1.4 * atr : entry - 1.4 * atr;
  return { direction, entry, stopLoss, takeProfit, macd: macdC, signal: sigC, rsi: rsiC, atr, scores: { buy, sell } };
};

const S = {
  input: { width:"100%", padding:"13px 14px", background:"rgba(0,200,255,0.04)", border:"1px solid rgba(0,200,255,0.18)", borderRadius:10, color:"#e8f4ff", fontSize:14, marginBottom:12, boxSizing:"border-box", outline:"none" },
  btnPrimary: { width:"100%", padding:"14px", background:"linear-gradient(135deg,#0077aa,#004d75)", border:"1px solid rgba(0,180,255,0.3)", borderRadius:10, color:"#e8f8ff", fontWeight:800, fontSize:14, cursor:"pointer", letterSpacing:1.5, marginTop:4 },
  btnDanger: { width:"100%", padding:"14px", background:"linear-gradient(135deg,#9b1c1c,#7b1010)", border:"1px solid rgba(255,80,80,0.3)", borderRadius:10, color:"#ffe0e0", fontWeight:800, fontSize:14, cursor:"pointer", letterSpacing:1.5, marginTop:4 },
  card: { background:"linear-gradient(160deg,#0d1e30,#091624)", border:"1px solid rgba(0,200,255,0.12)", borderRadius:14, padding:16, marginBottom:12 },
  label: { color:"#5bc8e8", fontSize:12, fontWeight:700, letterSpacing:1, marginBottom:8, display:"block" },
  errorBox: { color:"#ff6b80", background:"rgba(255,80,90,0.08)", border:"1px solid rgba(255,80,90,0.2)", padding:"10px 14px", borderRadius:8, marginBottom:12, fontSize:13 },
  successBox: { color:"#00e676", background:"rgba(0,230,118,0.07)", border:"1px solid rgba(0,230,118,0.2)", padding:"10px 14px", borderRadius:8, marginBottom:12, fontSize:13 },
};

const AuthWrapper = ({ children }) => (
  <div style={{ minHeight:"100vh", background:"radial-gradient(ellipse at 30% 20%,#071828,#030d16,#010810)", display:"flex", flexDirection:"column", alignItems:"center", padding:"24px 20px 40px", fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
    <div style={{ textAlign:"center", marginBottom:28, marginTop:12 }}>
      <div style={{ width:96, height:96, borderRadius:"50%", background:"linear-gradient(135deg,#071828,#003d5c)", border:"2.5px solid #00c8ff", margin:"0 auto 14px", display:"flex", alignItems:"center", justifyContent:"center", fontSize:44, boxShadow:"0 0 30px rgba(0,200,255,0.25)" }}>🤖</div>
      <div style={{ fontSize:24, fontWeight:900, color:"#3de8ff", letterSpacing:3, textShadow:"0 0 24px rgba(0,200,255,0.6)" }}>FOREX ROBOT</div>
      <div style={{ fontSize:11, color:"#60e8cc", letterSpacing:4, marginTop:4, fontWeight:600 }}>◆ SIGNAL BOT ◆</div>
    </div>
    {children}
  </div>
);

export default function App() {
  const [screen, setScreen] = useState("login");
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [signupForm, setSignupForm] = useState({ email:"", password:"", confirm:"" });
  const [loginForm, setLoginForm] = useState({ email:"", password:"" });
  const [licenseVal, setLicenseVal] = useState("");
  const [authErr, setAuthErr] = useState("");
  const [licenseErr, setLicenseErr] = useState("");
  const [signals, setSignals] = useState({});
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [profile, setProfile] = useState({ name:"", photo:null });
  const [profileDraft, setProfileDraft] = useState({ name:"", photo:null });
  const [changePw, setChangePw] = useState({ current:"", next:"", confirm:"" });
  const [pwErr, setPwErr] = useState("");
  const [pwOk, setPwOk] = useState("");

  const fetchSignals = useCallback(async () => {
    setLoading(true);
    const result = {};
    for (const sym of SYMBOLS) {
      if (!sym.binanceSymbol) {
        result[sym.label] = { noData:true, reason:"JP225 not on Binance" };
        continue;
      }
      try {
        const headers = BINANCE_API_KEY ? { "X-MBX-APIKEY": BINANCE_API_KEY } : {};
        const res = await fetch(`${BINANCE_BASE}/api/v3/klines?symbol=${sym.binanceSymbol}&interval=15m&limit=300`, { headers });
        const data = await res.json();
        if (!Array.isArray(data) || data.length < 210) throw new Error("Insufficient data");
        const candles = data.map(k => ({ open:parseFloat(k[1]), high:parseFloat(k[2]), low:parseFloat(k[3]), close:parseFloat(k[4]), volume:parseFloat(k[5]) }));
        result[sym.label] = generateSignal(candles) || { noData:true, reason:"Calculation error" };
      } catch {
        result[sym.label] = { noData:true, reason:"Fetch failed" };
      }
    }
    setSignals(result);
    setLastUpdated(new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit", second:"2-digit" }));
    setLoading(false);
  }, []);

  useEffect(() => {
    if (screen === "home") {
      fetchSignals();
      const t = setInterval(fetchSignals, 60000);
      return () => clearInterval(t);
    }
  }, [screen, fetchSignals]);

  const fmt = (price, decimals = 2) =>
    price == null ? "—" : price.toLocaleString("en-US", { minimumFractionDigits:decimals, maximumFractionDigits:decimals });

  if (screen === "signup") {
    const handle = () => {
      if (!signupForm.email || !signupForm.password) return setAuthErr("Please fill all fields.");
      if (signupForm.password !== signupForm.confirm) return setAuthErr("Passwords do not match.");
      if (users.find(u => u.email === signupForm.email)) return setAuthErr("Email already registered.");
      setUsers(p => [...p, { email:signupForm.email, password:signupForm.password }]);
      setAuthErr(""); setSignupForm({ email:"", password:"", confirm:"" }); setScreen("login");
    };
    return (
      <AuthWrapper>
        <div style={{ width:"100%", maxWidth:360, ...S.card, padding:24 }}>
          <div style={{ color:"#3de8ff", fontWeight:800, fontSize:16, textAlign:"center", letterSpacing:1, marginBottom:20 }}>CREATE ACCOUNT</div>
          {authErr && <div style={S.errorBox}>{authErr}</div>}
          <input placeholder="Email" value={signupForm.email} onChange={e => setSignupForm(p => ({ ...p, email:e.target.value }))} style={S.input} />
          <input type="password" placeholder="Password" value={signupForm.password} onChange={e => setSignupForm(p => ({ ...p, password:e.target.value }))} style={S.input} />
          <input type="password" placeholder="Confirm Password" value={signupForm.confirm} onChange={e => setSignupForm(p => ({ ...p, confirm:e.target.value }))} style={S.input} />
          <button onClick={handle} style={S.btnPrimary}>SIGN UP</button>
          <div style={{ textAlign:"center", marginTop:14, color:"#4a7080", fontSize:13 }}>
            Already have an account?{" "}
            <span onClick={() => { setAuthErr(""); setScreen("login"); }} style={{ color:"#3de8ff", cursor:"pointer", fontWeight:600 }}>Login</span>
          </div>
        </div>
      </AuthWrapper>
    );
  }

  if (screen === "login") {
    const handle = () => {
      if (!loginForm.email || !loginForm.password) return setAuthErr("Please fill all fields.");
      const user = users.find(u => u.email === loginForm.email && u.password === loginForm.password);
      if (!user) return setAuthErr("Invalid email or password.");
      setCurrentUser(user); setAuthErr(""); setScreen("license");
    };
    return (
      <AuthWrapper>
        <div style={{ width:"100%", maxWidth:360, ...S.card, padding:24 }}>
          <div style={{ color:"#3de8ff", fontWeight:800, fontSize:16, textAlign:"center", letterSpacing:1, marginBottom:20 }}>LOGIN</div>
          {authErr && <div style={S.errorBox}>{authErr}</div>}
          <input placeholder="Email" value={loginForm.email} onChange={e => setLoginForm(p => ({ ...p, email:e.target.value }))} style={S.input} />
          <input type="password" placeholder="Password" value={loginForm.password} onChange={e => setLoginForm(p => ({ ...p, password:e.target.value }))} style={S.input} />
          <button onClick={handle} style={S.btnPrimary}>LOGIN</button>
          <div style={{ textAlign:"center", marginTop:14, color:"#4a7080", fontSize:13 }}>
            No account?{" "}
            <span onClick={() => { setAuthErr(""); setScreen("signup"); }} style={{ color:"#3de8ff", cursor:"pointer", fontWeight:600 }}>Sign Up</span>
          </div>
        </div>
      </AuthWrapper>
    );
  }

  if (screen === "license") {
    const handle = () => {
      if (licenseVal === LICENSE_KEY) { setLicenseErr(""); setScreen("home"); }
      else setLicenseErr("Invalid License Key. Access denied.");
    };
    return (
      <AuthWrapper>
        <div style={{ width:"100%", maxWidth:360, ...S.card, padding:24 }}>
          <div style={{ color:"#3de8ff", fontWeight:800, fontSize:16, textAlign:"center", letterSpacing:1, marginBottom:4 }}>LICENSE KEY</div>
          <div style={{ color:"#4a8090", fontSize:12, textAlign:"center", marginBottom:20 }}>Enter your license key to access Signal Bot</div>
          {licenseErr && <div style={S.errorBox}>{licenseErr}</div>}
          <input placeholder="Enter License Key" value={licenseVal} onChange={e => setLicenseVal(e.target.value)} onKeyDown={e => e.key === "Enter" && handle()} style={{ ...S.input, letterSpacing:2, fontFamily:"monospace" }} />
          <button onClick={handle} style={S.btnPrimary}>ACTIVATE</button>
        </div>
      </AuthWrapper>
    );
  }

  if (screen === "profile") {
    const saveProfile = () => { setProfile({ ...profileDraft }); alert("Profile saved!"); };
    const handlePwChange = () => {
      setPwErr(""); setPwOk("");
      if (changePw.current !== currentUser.password) return setPwErr("Current password incorrect.");
      if (changePw.next.length < 4) return setPwErr("New password too short.");
      if (changePw.next !== changePw.confirm) return setPwErr("Passwords do not match.");
      const updated = users.map(u => u.email === currentUser.email ? { ...u, password:changePw.next } : u);
      setUsers(updated); setCurrentUser({ ...currentUser, password:changePw.next });
      setChangePw({ current:"", next:"", confirm:"" }); setPwOk("Password changed successfully.");
    };
    const logout = () => { setCurrentUser(null); setLicenseVal(""); setLoginForm({ email:"", password:"" }); setScreen("login"); };
    return (
      <div style={{ minHeight:"100vh", background:"radial-gradient(ellipse at 30% 20%,#071828,#030d16)", fontFamily:"'Segoe UI',system-ui,sans-serif", color:"#e0f0ff" }}>
        <div style={{ background:"#071828", padding:"14px 18px", display:"flex", alignItems:"center", gap:12, borderBottom:"1px solid rgba(0,200,255,0.15)" }}>
          <button onClick={() => setScreen("home")} style={{ background:"none", border:"none", color:"#3de8ff", fontSize:22, cursor:"pointer" }}>←</button>
          <span style={{ color:"#3de8ff", fontWeight:800, fontSize:16, letterSpacing:1 }}>PROFILE</span>
        </div>
        <div style={{ padding:"20px 16px 60px" }}>
          <div style={{ textAlign:"center", marginBottom:24 }}>
            <div style={{ width:90, height:90, borderRadius:"50%", border:"3px solid #00c8ff", margin:"0 auto 12px", overflow:"hidden", background:"#071828", display:"flex", alignItems:"center", justifyContent:"center" }}>
              {profileDraft.photo ? <img src={profileDraft.photo} alt="Profile" style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : <span style={{ fontSize:40, color:"#00c8ff" }}>👤</span>}
            </div>
            <label style={{ display:"inline-block", padding:"8px 16px", background:"rgba(0,200,255,0.08)", border:"1px solid rgba(0,200,255,0.2)", borderRadius:8, color:"#3de8ff", fontSize:12, fontWeight:700, cursor:"pointer" }}>
              UPLOAD PHOTO
              <input type="file" accept="image/*" style={{ display:"none" }} onChange={e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = ev => setProfileDraft(p => ({ ...p, photo:ev.target.result })); r.readAsDataURL(f); }} />
            </label>
          </div>
          <div style={S.card}>
            <span style={S.label}>FULL NAME</span>
            <input placeholder="Enter your name" value={profileDraft.name} onChange={e => setProfileDraft(p => ({ ...p, name:e.target.value }))} style={S.input} />
            <button onClick={saveProfile} style={S.btnPrimary}>SAVE PROFILE</button>
          </div>
          <div style={S.card}>
            <span style={S.label}>CHANGE PASSWORD</span>
            {pwErr && <div style={S.errorBox}>{pwErr}</div>}
            {pwOk && <div style={S.successBox}>{pwOk}</div>}
            <input type="password" placeholder="Current Password" value={changePw.current} onChange={e => setChangePw(p => ({ ...p, current:e.target.value }))} style={S.input} />
            <input type="password" placeholder="New Password" value={changePw.next} onChange={e => setChangePw(p => ({ ...p, next:e.target.value }))} style={S.input} />
            <input type="password" placeholder="Confirm New Password" value={changePw.confirm} onChange={e => setChangePw(p => ({ ...p, confirm:e.target.value }))} style={S.input} />
            <button onClick={handlePwChange} style={S.btnPrimary}>CHANGE PASSWORD</button>
          </div>
          <button onClick={logout} style={S.btnDanger}>🚪 LOG OUT</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight:"100vh", background:"radial-gradient(ellipse at 20% 10%,#071828,#030c14)", fontFamily:"'Segoe UI',system-ui,sans-serif", color:"#e0f0ff" }}>
      <div style={{ background:"#07182a", padding:"12px 14px", display:"flex", alignItems:"center", justifyContent:"space-between", borderBottom:"1px solid rgba(0,200,255,0.12)", position:"sticky", top:0, zIndex:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:42, height:42, borderRadius:"50%", background:"linear-gradient(135deg,#071828,#003d5c)", border:"2px solid #00c8ff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>🤖</div>
          <div>
            <div style={{ fontSize:17, fontWeight:900, color:"#3de8ff", letterSpacing:1.5 }}>FOREX ROBOT</div>
            <div style={{ fontSize:9, color:"#3a8090" }}>Build Forex Robot Signal Bot By Amin Agha Hamidi in 07/10/2026</div>
            <div style={{ fontSize:11, color:"#40ffcc", fontWeight:600 }}>● Signal Bot</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ background:"rgba(0,255,80,0.08)", border:"1px solid rgba(0,255,80,0.35)", borderRadius:20, padding:"4px 10px", fontSize:11, color:"#00ff64", fontWeight:800 }}>● LIVE</div>
          <button onClick={() => { setProfileDraft({ ...profile }); setScreen("profile"); }} style={{ width:36, height:36, borderRadius:"50%", background:"rgba(0,200,255,0.08)", border:"1px solid rgba(0,200,255,0.2)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
            {profile.photo ? <img src={profile.photo} style={{ width:36, height:36, borderRadius:"50%", objectFit:"cover" }} alt="P" /> : <span style={{ fontSize:18 }}>👤</span>}
          </button>
        </div>
      </div>

      <div style={{ padding:"12px 12px 100px" }}>
        {SYMBOLS.map(sym => {
          const sig = signals[sym.label];
          const isNoData = !sig || sig.noData;
          const isNeutral = sig && !sig.noData && sig.direction === "NEUTRAL";
          const isBuy = sig && !sig.noData && sig.direction === "BUY";
          const isSell = sig && !sig.noData && sig.direction === "SELL";
          return (
            <div key={sym.label} style={{ background:"linear-gradient(160deg,#0d1e32,#08131e)", border:"1px solid rgba(0,200,255,0.13)", borderRadius:16, padding:16, marginBottom:14, boxShadow:"0 4px 20px rgba(0,0,0,0.3)" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
                <span style={{ fontSize:18 }}>{sym.emoji}</span>
                <span style={{ color:"#3de8ff", fontWeight:800, fontSize:14 }}>{sym.label}</span>
                <span style={{ color:"#2a4050" }}>—</span>
                <span style={{ color:"#8ab8cc", fontSize:12 }}>{sym.name}</span>
              </div>
              {isNoData && <div style={{ background:"rgba(255,170,0,0.06)", border:"1px solid rgba(255,170,0,0.2)", borderRadius:10, padding:"13px 14px", textAlign:"center", color:"#ffa726", fontSize:13, marginBottom:10 }}>⚠ {sig?.reason || "Loading…"}</div>}
              {isNeutral && <div style={{ background:"rgba(80,120,200,0.07)", border:"1px solid rgba(80,120,200,0.2)", borderRadius:10, padding:"13px 14px", textAlign:"center", color:"#7090d0", fontSize:14, marginBottom:10 }}>⏳ WAIT — Signals not aligned</div>}
              {(isBuy || isSell) && (
                <>
                  <div style={{ background:isBuy ? "linear-gradient(135deg,#0a3d1e,#0d5228)" : "linear-gradient(135deg,#3d0a0e,#521010)", border:`2px solid ${isBuy ? "#00c853" : "#f44336"}`, borderRadius:12, padding:"15px 12px", textAlign:"center", marginBottom:12 }}>
                    <div style={{ fontSize:22, fontWeight:900, color:isBuy ? "#00e676" : "#ff5252", letterSpacing:4, display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
                      <span>{isBuy ? "▲" : "▼"}</span><span>{sig.direction}</span>
                    </div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:10 }}>
                    <div style={{ display:"flex", justifyContent:"space-between" }}><span style={{ color:"#f59e0b", fontSize:13 }}>📍 Entry:</span><span style={{ color:"#fff", fontWeight:700, fontSize:13, fontFamily:"monospace" }}>{fmt(sig.entry, sym.decimals)}</span></div>
                    <div style={{ display:"flex", justifyContent:"space-between" }}><span style={{ color:"#f44336", fontSize:13 }}>🔴 Stop Loss (1.0×ATR):</span><span style={{ color:"#ff6b6b", fontWeight:700, fontSize:13, fontFamily:"monospace" }}>{fmt(sig.stopLoss, sym.decimals)}</span></div>
                    <div style={{ display:"flex", justifyContent:"space-between" }}><span style={{ color:"#00c853", fontSize:13 }}>🟢 Take Profit (1.4×ATR):</span><span style={{ color:"#69f0ae", fontWeight:700, fontSize:13, fontFamily:"monospace" }}>{fmt(sig.takeProfit, sym.decimals)}</span></div>
                  </div>
                  <div style={{ borderTop:"1px solid rgba(0,200,255,0.08)", paddingTop:8, fontSize:11, color:"#304a58", display:"flex", gap:10, flexWrap:"wrap" }}>
                    {sig.macd != null && <span>MACD: {sig.macd.toFixed(4)}</span>}
                    {sig.signal != null && <span>Signal: {sig.signal.toFixed(4)}</span>}
                    {sig.rsi != null && <span>RSI: {sig.rsi.toFixed(1)}</span>}
                    {sig.atr != null && <span>ATR: {sig.atr.toFixed(sym.decimals)}</span>}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {lastUpdated && <div style={{ position:"fixed", bottom:74, left:0, right:0, textAlign:"center", color:"#2a4a58", fontSize:11 }}>✅ Updated at {lastUpdated}</div>}

      <div style={{ position:"fixed", bottom:0, left:0, right:0, padding:"10px 14px 14px", background:"#060e18", borderTop:"1px solid rgba(0,200,255,0.1)" }}>
        <button onClick={fetchSignals} disabled={loading} style={{ width:"100%", padding:"15px", background:loading ? "#2a3a3a" : "linear-gradient(90deg,#f9a825,#e65100)", border:"none", borderRadius:12, color:loading ? "#666" : "#000", fontWeight:900, fontSize:15, cursor:loading ? "not-allowed" : "pointer", letterSpacing:1.5, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
          <span style={{ fontSize:17 }}>{loading ? "⟳" : "🔄"}</span>
          {loading ? "LOADING…" : "REFRESH SIGNALS"}
        </button>
      </div>
    </div>
  );
}
