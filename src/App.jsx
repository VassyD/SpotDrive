import React, { useState, useEffect, useCallback, useRef, memo, createContext, useContext } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  || "https://lhahofbryglxdxffxjbr.supabase.co";
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoYWhvZmJyeWdseGR4ZmZ4amJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3MzA5ODgsImV4cCI6MjA5ODMwNjk4OH0.5rmKCnWqROlefWII7QpHsbY8xUMJytL6CoJ8LYsaUGQ";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

const T = {
  bg:"#0A0A0C", surface:"#14141A", surfaceHi:"#1C1C24", card:"#18181F",
  border:"#252530", accent:"#E8430A", accentDk:"#BF360C", accentDm:"#2D1200",
  gold:"#C9A84C", green:"#22C55E", blue:"#3B82F6", danger:"#EF4444",
  text:"#F2EEE8", sub:"#AAA6A0", muted:"#6B6878", faint:"#3D3D4E",
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&family=Inter:wght@400;500;600;700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:#0A0A0C;font-family:'Inter',sans-serif;color:#F2EEE8;-webkit-font-smoothing:antialiased}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#0A0A0C}
::-webkit-scrollbar-thumb{background:#252530;border-radius:2px}
button{cursor:pointer;font-family:inherit}input,textarea{font-family:inherit;outline:none}
:focus-visible{outline:2px solid #E8430A;outline-offset:2px;border-radius:4px}
@keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes shimmer{from{background-position:-600px 0}to{background-position:600px 0}}
@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
@keyframes glow{0%,100%{box-shadow:0 0 0 0 #E8430A40}50%{box-shadow:0 0 20px 6px #E8430A25}}
@keyframes heartPop{0%{transform:scale(1)}50%{transform:scale(1.45)}100%{transform:scale(1)}}
.fade-up{animation:fadeUp .35s ease both}
.spin{animation:spin .7s linear infinite}
.shimmer{background:linear-gradient(90deg,#14141A 25%,#1C1C24 50%,#14141A 75%);background-size:600px 100%;animation:shimmer 1.4s ease-in-out infinite}
.heart-pop{animation:heartPop .3s ease}
.glow{animation:glow 3s ease-in-out infinite}
.spot-card{background:#18181F;border:1px solid #252530;border-radius:16px;overflow:hidden;transition:transform .2s,box-shadow .2s}
.spot-card:hover{transform:translateY(-2px);box-shadow:0 8px 32px rgba(232,67,10,.15)}
.nav-item{display:flex;flex-direction:column;align-items:center;gap:3px;padding:8px 12px;color:#6B6878;font-size:10px;font-weight:600;transition:color .15s;border:none;background:none;cursor:pointer}
.nav-item.active{color:#E8430A}
.story-ring{border-radius:50%;padding:2px;background:linear-gradient(135deg,#E8430A,#C9A84C)}
.sd-input{width:100%;background:#18181F;border:1.5px solid #252530;border-radius:12px;padding:13px 14px;color:#F2EEE8;font-size:14px;transition:border-color .15s,box-shadow .15s}
.sd-input:focus{border-color:#E8430A;box-shadow:0 0 0 3px #2D1200}
.sd-input::placeholder{color:#3D3D4E}
.sd-input.error{border-color:#EF4444}
.sd-btn{display:flex;align-items:center;justify-content:center;gap:8px;border:none;border-radius:12px;padding:13px 20px;font-size:15px;font-weight:700;cursor:pointer;width:100%}
.sd-btn-primary{background:linear-gradient(135deg,#E8430A,#BF360C);color:#fff}
.sd-btn-primary:disabled{opacity:.5;cursor:not-allowed}
.sd-btn-ghost{background:none;border:1.5px solid #252530;color:#AAA6A0}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`;

if (typeof document !== "undefined" && !document.getElementById("sd-styles")) {
  const el = document.createElement("style");
  el.id = "sd-styles"; el.textContent = CSS;
  document.head.appendChild(el);
}

// ─── AUTH CONTEXT ─────────────────────────────────────────────
const AuthContext = createContext(null);

function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId) => {
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
    setProfile(data);
    return data;
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) await fetchProfile(session.user.id);
      else setProfile(null);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signUp = useCallback(async ({ email, password, handle, displayName }) => {
    const { data: existing } = await supabase.from("profiles").select("handle").eq("handle", handle.toLowerCase()).single();
    if (existing) throw new Error("That handle is already taken.");
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { handle: handle.toLowerCase(), display_name: displayName } }
    });
    if (error) throw error;
    if (data.user) {
      await new Promise(r => setTimeout(r, 1500));
      await fetchProfile(data.user.id);
    }
    return data;
  }, [fetchProfile]);

  const signIn = useCallback(async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null); setProfile(null);
  }, []);

  const resetPassword = useCallback(async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    if (error) throw error;
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, signUp, signIn, signOut, resetPassword, fetchProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

const useAuth = () => useContext(AuthContext);

// ─── MOCK DATA ────────────────────────────────────────────────
const MOCK_SPOTS = [
  { id:"s1", make:"Lamborghini", model:"Huracán STO", year:2023, rarity:"Exotic", color:"Verde Mantis",
    location:"Rodeo Drive, Beverly Hills", image:"https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=600&q=75&fm=webp",
    likes:2841, comments:94, saves:312, time:"12m ago", tags:["Lamborghini","STO","TrackSpecial"],
    liked:false, saved:false, description:"Caught this STO parked outside Gucci. Verde Mantis in person is something else.",
    user:{ handle:"apex_hunter", initials:"AH", verified:true } },
  { id:"s2", make:"Ferrari", model:"SF90 Stradale", year:2022, rarity:"Hypercar", color:"Rosso Corsa",
    location:"Monaco, Monte Carlo", image:"https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=600&q=75&fm=webp",
    likes:5102, comments:218, saves:891, time:"1h ago", tags:["Ferrari","SF90","Hybrid"],
    liked:true, saved:false, description:"SF90 rolling out of Casino Square. Rosso Corsa with Assetto Fiorano pack.",
    user:{ handle:"euro_spotter", initials:"LM", verified:false } },
  { id:"s3", make:"Bugatti", model:"Chiron Super Sport", year:2023, rarity:"Hypercar", color:"Atlantic Blue",
    location:"Shibuya, Tokyo", image:"https://images.unsplash.com/photo-1525609004556-c46c7d6cf023?w=600&q=75&fm=webp",
    likes:9441, comments:507, saves:2103, time:"3h ago", tags:["Bugatti","Chiron","1500HP"],
    liked:false, saved:true, description:"Never thought I'd see a Chiron SS in Shibuya. The W16 sound was insane.",
    user:{ handle:"jdm_tokyo", initials:"KT", verified:true } },
];

const RARITY = {
  Hypercar: { bg:"#1a0a2e", text:"#b388ff", border:"#6a0dad" },
  Exotic:   { bg:"#2D1200", text:"#E8430A", border:"#E8430A" },
  Sports:   { bg:"#0a1a2e", text:"#60a5fa", border:"#60a5fa" },
};

const fmt = (n) => { const v = Number(n)||0; return v >= 1000 ? `${(v/1000).toFixed(1)}k` : String(v); };

// ─── ATOMS ────────────────────────────────────────────────────
const Avatar = memo(({ initials, src, size=36, ring=false }) => {
  const [err, setErr] = useState(false);
  const fs = Math.round(size * 0.36);
  return (
    <div style={{ width:size, height:size, borderRadius:"50%", flexShrink:0, overflow:"hidden",
      background:"linear-gradient(135deg,#E8430A,#7c1a02)",
      display:"flex", alignItems:"center", justifyContent:"center",
      fontSize:fs, fontWeight:700, color:"#fff",
      boxShadow: ring ? "0 0 0 2px #0A0A0C,0 0 0 4px #E8430A" : "none" }}>
      {src && !err
        ? <img src={src} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}
            onError={() => setErr(true)} />
        : (initials || "?").slice(0,2).toUpperCase()
      }
    </div>
  );
});

const RarityPill = memo(({ rarity }) => {
  const r = RARITY[rarity] || RARITY.Sports;
  return (
    <span style={{ background:r.bg, color:r.text, border:`1px solid ${r.border}`,
      borderRadius:6, padding:"3px 9px", fontSize:10, fontWeight:700,
      letterSpacing:"0.07em", textTransform:"uppercase" }}>{rarity}</span>
  );
});

const Spinner = ({ size=18, color="#E8430A" }) => (
  <div className="spin" style={{ width:size, height:size, border:`2px solid ${color}30`,
    borderTopColor:color, borderRadius:"50%", flexShrink:0 }} />
);

const ErrorMsg = ({ msg }) => msg ? (
  <div style={{ background:"rgba(239,68,68,.12)", border:"1px solid rgba(239,68,68,.3)",
    borderRadius:8, padding:"8px 12px", fontSize:12, color:"#EF4444", marginTop:8 }}>
    {msg}
  </div>
) : null;

// ─── AUTH SCREENS ─────────────────────────────────────────────
function AuthScreen() {
  const [view, setView] = useState("login");
  return (
    <div style={{ minHeight:"100vh", background:"#0A0A0C", display:"flex",
      alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ width:"100%", maxWidth:400 }} className="fade-up">
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div className="glow" style={{ width:64, height:64, borderRadius:16, margin:"0 auto 14px",
            background:"linear-gradient(135deg,#E8430A,#BF360C)",
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:32 }}>🏎</div>
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:32, fontWeight:900,
            color:"#F2EEE8", letterSpacing:"-.02em" }}>SpotDrive</div>
          <div style={{ fontSize:13, color:"#6B6878", marginTop:4 }}>
            {view==="login" ? "Sign in to your account" : view==="signup" ? "Create your spotter account" : "Reset your password"}
          </div>
        </div>
        {view==="login"  && <LoginForm  onSwitch={setView} />}
        {view==="signup" && <SignupForm onSwitch={setView} />}
        {view==="forgot" && <ForgotForm onSwitch={setView} />}
      </div>
    </div>
  );
}

function LoginForm({ onSwitch }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handle = async (e) => {
    e.preventDefault(); setLoading(true); setError("");
    try { await signIn({ email, password }); }
    catch (err) { setError(err.message === "Invalid login credentials" ? "Email or password is incorrect." : err.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ background:"#14141A", border:"1px solid #252530", borderRadius:20, padding:28 }}>
      <form onSubmit={handle}>
        <div style={{ display:"flex", flexDirection:"column", gap:14, marginBottom:16 }}>
          <div>
            <label style={{ fontSize:12, color:"#AAA6A0", fontWeight:600, display:"block", marginBottom:6 }}>Email</label>
            <input className="sd-input" type="email" placeholder="your@email.com" value={email} onChange={e=>setEmail(e.target.value)} required />
          </div>
          <div>
            <label style={{ fontSize:12, color:"#AAA6A0", fontWeight:600, display:"block", marginBottom:6 }}>Password</label>
            <input className="sd-input" type="password" placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} required />
          </div>
        </div>
        <ErrorMsg msg={error} />
        <button className="sd-btn sd-btn-primary" type="submit" disabled={loading} style={{ marginTop:16 }}>
          {loading ? <Spinner size={16} color="#fff" /> : "Sign In"}
        </button>
      </form>
      <div style={{ textAlign:"center", marginTop:12 }}>
        <button onClick={() => onSwitch("forgot")} style={{ fontSize:12, color:"#6B6878", background:"none", border:"none", textDecoration:"underline" }}>
          Forgot password?
        </button>
      </div>
      <div style={{ height:1, background:"#252530", margin:"20px 0" }} />
      <div style={{ textAlign:"center", fontSize:13, color:"#6B6878" }}>
        New to SpotDrive?{" "}
        <button onClick={() => onSwitch("signup")} style={{ color:"#E8430A", fontWeight:700, background:"none", border:"none" }}>Create account</button>
      </div>
    </div>
  );
}

function SignupForm({ onSwitch }) {
  const { signUp } = useAuth();
  const [form, setForm] = useState({ email:"", password:"", confirm:"", handle:"", name:"" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const update = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const handle = async (e) => {
    e.preventDefault(); setError("");
    if (form.password !== form.confirm) { setError("Passwords don't match."); return; }
    if (form.password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (form.handle.length < 3) { setError("Handle must be at least 3 characters."); return; }
    if (!/^[a-z0-9_]+$/i.test(form.handle)) { setError("Handle: letters, numbers, underscores only."); return; }
    setLoading(true);
    try {
      await signUp({ email:form.email, password:form.password, handle:form.handle, displayName:form.name||form.handle });
      setSuccess(true);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  if (success) return (
    <div style={{ background:"#14141A", border:"1px solid #252530", borderRadius:20, padding:28, textAlign:"center" }}>
      <div style={{ fontSize:48, marginBottom:12 }}>📧</div>
      <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:22, fontWeight:900, color:"#F2EEE8", marginBottom:8 }}>Check your email</div>
      <div style={{ fontSize:13, color:"#6B6878", marginBottom:20 }}>Confirmation sent to <strong style={{ color:"#F2EEE8" }}>{form.email}</strong></div>
      <button className="sd-btn sd-btn-ghost" onClick={() => onSwitch("login")} style={{ maxWidth:200, margin:"0 auto" }}>Back to sign in</button>
    </div>
  );

  return (
    <div style={{ background:"#14141A", border:"1px solid #252530", borderRadius:20, padding:28 }}>
      <form onSubmit={handle}>
        <div style={{ display:"flex", flexDirection:"column", gap:12, marginBottom:16 }}>
          {[
            { key:"name",     label:"Display Name",     type:"text",     placeholder:"Steve" },
            { key:"handle",   label:"Username",          type:"text",     placeholder:"apex_hunter" },
            { key:"email",    label:"Email",             type:"email",    placeholder:"your@email.com" },
            { key:"password", label:"Password",          type:"password", placeholder:"Min 6 characters" },
            { key:"confirm",  label:"Confirm Password",  type:"password", placeholder:"Repeat password" },
          ].map(({ key, label, type, placeholder }) => (
            <div key={key}>
              <label style={{ fontSize:12, color:"#AAA6A0", fontWeight:600, display:"block", marginBottom:5 }}>{label}</label>
              <input className="sd-input" type={type} placeholder={placeholder} value={form[key]} onChange={update(key)} required />
            </div>
          ))}
        </div>
        <ErrorMsg msg={error} />
        <button className="sd-btn sd-btn-primary" type="submit" disabled={loading} style={{ marginTop:12 }}>
          {loading ? <Spinner size={16} color="#fff" /> : "Create Account"}
        </button>
      </form>
      <div style={{ height:1, background:"#252530", margin:"20px 0" }} />
      <div style={{ textAlign:"center", fontSize:13, color:"#6B6878" }}>
        Already have an account?{" "}
        <button onClick={() => onSwitch("login")} style={{ color:"#E8430A", fontWeight:700, background:"none", border:"none" }}>Sign in</button>
      </div>
    </div>
  );
}

function ForgotForm({ onSwitch }) {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handle = async (e) => {
    e.preventDefault(); setLoading(true); setError("");
    try { await resetPassword(email); setSent(true); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  if (sent) return (
    <div style={{ background:"#14141A", border:"1px solid #252530", borderRadius:20, padding:28, textAlign:"center" }}>
      <div style={{ fontSize:40, marginBottom:12 }}>✅</div>
      <div style={{ fontSize:14, color:"#AAA6A0", marginBottom:20 }}>Reset link sent to <strong style={{ color:"#F2EEE8" }}>{email}</strong></div>
      <button className="sd-btn sd-btn-ghost" onClick={() => onSwitch("login")} style={{ maxWidth:200, margin:"0 auto" }}>Back to sign in</button>
    </div>
  );

  return (
    <div style={{ background:"#14141A", border:"1px solid #252530", borderRadius:20, padding:28 }}>
      <form onSubmit={handle}>
        <div style={{ marginBottom:16 }}>
          <label style={{ fontSize:12, color:"#AAA6A0", fontWeight:600, display:"block", marginBottom:6 }}>Email address</label>
          <input className="sd-input" type="email" placeholder="your@email.com" value={email} onChange={e=>setEmail(e.target.value)} required />
        </div>
        <ErrorMsg msg={error} />
        <button className="sd-btn sd-btn-primary" type="submit" disabled={loading} style={{ marginTop:12 }}>
          {loading ? <Spinner size={16} color="#fff" /> : "Send Reset Link"}
        </button>
      </form>
      <div style={{ textAlign:"center", marginTop:16 }}>
        <button onClick={() => onSwitch("login")} style={{ fontSize:12, color:"#6B6878", background:"none", border:"none", textDecoration:"underline" }}>Back to sign in</button>
      </div>
    </div>
  );
}

// ─── SPOT CARD ────────────────────────────────────────────────
function SpotCard({ spot, onTap }) {
  const [liked, setLiked] = useState(spot.liked);
  const [saved, setSaved] = useState(spot.saved);
  const [likes, setLikes] = useState(spot.likes);
  const [saves, setSaves] = useState(spot.saves);
  const [pop,   setPop]   = useState(false);
  const [imgErr, setImgErr] = useState(false);

  const handleLike = (e) => {
    e.stopPropagation();
    const next = !liked; setLiked(next); setLikes(n => next ? n+1 : n-1);
    if (next) { setPop(true); setTimeout(() => setPop(false), 350); }
  };
  const handleSave = (e) => {
    e.stopPropagation();
    const next = !saved; setSaved(next); setSaves(n => next ? n+1 : n-1);
  };

  return (
    <div className="spot-card fade-up" onClick={() => onTap?.(spot)} style={{ cursor:"pointer" }}>
      <div style={{ position:"relative", paddingTop:"62%", overflow:"hidden" }}>
        {!imgErr && spot.image
          ? <img src={spot.image} alt={`${spot.make} ${spot.model}`} loading="lazy"
              onError={() => setImgErr(true)}
              style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover" }} />
          : <div style={{ position:"absolute", inset:0, background:"linear-gradient(135deg,#2D1200,#1C1C24)",
              display:"flex", alignItems:"center", justifyContent:"center", fontSize:48 }}>🏎</div>
        }
        <div style={{ position:"absolute", inset:0, background:"linear-gradient(to bottom, transparent 50%, rgba(0,0,0,.6))" }} />
        <div style={{ position:"absolute", top:10, left:10 }}><RarityPill rarity={spot.rarity} /></div>
        <div style={{ position:"absolute", top:10, right:10, background:"rgba(0,0,0,.6)", borderRadius:6, padding:"3px 8px", fontSize:10, fontWeight:600, color:"#6B6878" }}>{spot.year}</div>
        <div style={{ position:"absolute", bottom:10, left:12 }}>
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:22, fontWeight:900, color:"#fff", lineHeight:1, textShadow:"0 2px 8px rgba(0,0,0,.7)" }}>{spot.make} {spot.model}</div>
        </div>
      </div>
      <div style={{ padding:"12px 14px 10px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
          <Avatar initials={spot.user?.initials} src={spot.user?.avatar_url} size={28} />
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:12, fontWeight:600, color:"#F2EEE8" }}>@{spot.user?.handle}</div>
            <div style={{ fontSize:10, color:"#6B6878" }}>{spot.location} · {spot.time}</div>
          </div>
        </div>
        <div style={{ display:"flex", gap:5, marginBottom:10, overflow:"hidden" }}>
          {spot.tags?.slice(0,3).map(t => (
            <span key={t} style={{ fontSize:10, color:"#6B6878", background:"#252530", borderRadius:5, padding:"2px 7px" }}>#{t}</span>
          ))}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:16, paddingTop:10, borderTop:"1px solid #252530" }}>
          <button onClick={handleLike} aria-pressed={liked}
            style={{ display:"flex", alignItems:"center", gap:5, color:liked?"#E8430A":"#6B6878", fontSize:12, fontWeight:600, border:"none", background:"none" }}>
            <span className={pop?"heart-pop":""}>{liked?"❤️":"🤍"}</span> {fmt(likes)}
          </button>
          <button style={{ display:"flex", alignItems:"center", gap:5, color:"#6B6878", fontSize:12, fontWeight:600, border:"none", background:"none" }}>
            💬 {fmt(spot.comments)}
          </button>
          <button onClick={handleSave} aria-pressed={saved}
            style={{ display:"flex", alignItems:"center", gap:5, color:saved?"#C9A84C":"#6B6878", fontSize:12, fontWeight:600, border:"none", background:"none" }}>
            {saved?"🔖":"📎"} {fmt(saves)}
          </button>
          <button style={{ marginLeft:"auto", color:"#6B6878", border:"none", background:"none" }}>↗</button>
        </div>
      </div>
    </div>
  );
}

// ─── UPLOAD MODAL ─────────────────────────────────────────────
// ─── CAR MAKES DATABASE ───────────────────────────────────────
const CAR_MAKES = [
  "Aston Martin","Audi","Bentley","BMW","Bugatti","Chevrolet","Ferrari",
  "Ford","Koenigsegg","Lamborghini","Lotus","Maserati","McLaren","Mercedes-Benz",
  "Nissan","Pagani","Porsche","Rolls-Royce","Tesla","Toyota","Volkswagen",
];
const CAR_MODELS = {
  "Ferrari":       ["296 GTB","488 Pista","812 Superfast","F8 Tributo","LaFerrari","Roma","SF90 Stradale"],
  "Lamborghini":   ["Aventador SVJ","Huracán STO","Huracán Tecnica","Reventón","Sián","Urus"],
  "Bugatti":       ["Chiron","Chiron Super Sport","Divo","Mistral","Veyron","Veyron Super Sport"],
  "McLaren":       ["600LT","720S","765LT","Artura","P1","Senna"],
  "Porsche":       ["911 GT2 RS","911 GT3","911 GT3 RS","918 Spyder","Cayenne Turbo","Taycan Turbo S"],
  "Aston Martin":  ["DB11","DBS Superleggera","DBX","Valkyrie","Vantage"],
  "Pagani":        ["Huayra","Huayra BC","Huayra R","Zonda"],
  "Koenigsegg":    ["Agera RS","CC850","Gemera","Jesko","One:1","Regera"],
  "Rolls-Royce":   ["Cullinan","Dawn","Ghost","Phantom","Spectre","Wraith"],
  "Bentley":       ["Bentayga","Continental GT","Flying Spur","Mulsanne"],
  "BMW":           ["M2","M3 CSL","M4 CSL","M5 CS","M8 Competition","XM"],
  "Mercedes-Benz": ["AMG GT Black Series","AMG ONE","C63 AMG","G63 AMG","GLE 63","SL 63"],
  "Nissan":        ["GT-R","GT-R Nismo","GT-R R34","GT-R R35 Track Edition"],
  "Audi":          ["R8 V10","R8 V10 Performance","RS3","RS6 Avant","RS7","TT RS"],
};

function MakeInput({ value, onChange, placeholder }) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);

  const handleChange = (v) => {
    onChange(v);
    if (v.length < 1) { setSuggestions([]); setOpen(false); return; }
    const matches = CAR_MAKES.filter(m => m.toLowerCase().startsWith(v.toLowerCase()));
    setSuggestions(matches);
    setOpen(matches.length > 0);
  };

  return (
    <div style={{ position:"relative" }}>
      <input className="sd-input" value={value} placeholder={placeholder}
        onChange={e => handleChange(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 150)} />
      {open && (
        <div style={{ position:"absolute", top:"calc(100% + 4px)", left:0, right:0,
          background:"#1C1C24", border:"1px solid #252530", borderRadius:10,
          zIndex:50, overflow:"hidden", boxShadow:"0 8px 24px rgba(0,0,0,.5)" }}>
          {suggestions.map(s => (
            <button key={s} onMouseDown={() => { onChange(s); setOpen(false); }}
              style={{ width:"100%", padding:"10px 14px", background:"none",
                border:"none", borderBottom:"1px solid #252530",
                color:"#F2EEE8", fontSize:14, textAlign:"left", cursor:"pointer" }}>
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ModelInput({ make, value, onChange, placeholder }) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const models = CAR_MODELS[make] || [];

  const handleChange = (v) => {
    onChange(v);
    if (v.length < 1) {
      setSuggestions(models); setOpen(models.length > 0); return;
    }
    const matches = models.filter(m => m.toLowerCase().includes(v.toLowerCase()));
    setSuggestions(matches); setOpen(matches.length > 0);
  };

  return (
    <div style={{ position:"relative" }}>
      <input className="sd-input" value={value} placeholder={placeholder}
        onChange={e => handleChange(e.target.value)}
        onFocus={() => { if (models.length > 0 && !value) { setSuggestions(models); setOpen(true); } }}
        onBlur={() => setTimeout(() => setOpen(false), 150)} />
      {open && (
        <div style={{ position:"absolute", top:"calc(100% + 4px)", left:0, right:0,
          background:"#1C1C24", border:"1px solid #252530", borderRadius:10,
          zIndex:50, overflow:"hidden", maxHeight:160, overflowY:"auto",
          boxShadow:"0 8px 24px rgba(0,0,0,.5)" }}>
          {suggestions.map(s => (
            <button key={s} onMouseDown={() => { onChange(s); setOpen(false); }}
              style={{ width:"100%", padding:"10px 14px", background:"none",
                border:"none", borderBottom:"1px solid #252530",
                color:"#F2EEE8", fontSize:13, textAlign:"left", cursor:"pointer" }}>
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── UPLOAD MODAL (with autocomplete) ─────────────────────────
function UploadModal({ onClose }) {
  const { user } = useAuth();
  const [step,    setStep]    = useState(1);
  const [file,    setFile]    = useState(null);
  const [preview, setPreview] = useState(null);
  const [form,    setForm]    = useState({ make:"", model:"", year:"", rarity:"Exotic", location:"", desc:"" });
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);
  const [error,   setError]   = useState("");
  const fileRef = useRef();
  const blobRef = useRef(null);
  useEffect(() => () => { if (blobRef.current) URL.revokeObjectURL(blobRef.current); }, []);

  const handleFile = (f) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) { setError("Please select an image file."); return; }
    if (f.size > 30*1024*1024) { setError("File must be under 30 MB."); return; }
    setError("");
    if (blobRef.current) URL.revokeObjectURL(blobRef.current);
    blobRef.current = URL.createObjectURL(f);
    setFile(f); setPreview(blobRef.current); setStep(2);
  };

  const handlePost = async () => {
    if (!form.make || !form.model) { setError("Make and model are required."); return; }
    setLoading(true); setError("");
    try {
      let imageUrl = null;
      if (file) {
        const ext  = file.name.split(".").pop();
        const path = `spots/${user.id}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from("spot-photos").upload(path, file, { contentType:file.type });
        if (uploadErr) throw uploadErr;
        const { data: { publicUrl } } = supabase.storage.from("spot-photos").getPublicUrl(path);
        imageUrl = publicUrl;
      }
      const { error: insertErr } = await supabase.from("spots").insert({
        user_id:user.id, make:form.make, model:form.model,
        year:parseInt(form.year)||new Date().getFullYear(),
        rarity:form.rarity, color:"", location_name:form.location,
        description:form.desc, image_url:imageUrl, status:"live",
      });
      if (insertErr) throw insertErr;
      setDone(true); setTimeout(onClose, 2000);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.88)", zIndex:600, backdropFilter:"blur(8px)",
      display:"flex", alignItems:"flex-end", justifyContent:"center" }}
      onClick={e => { if (e.target===e.currentTarget) onClose(); }}>
      <div style={{ background:"#14141A", width:"100%", maxWidth:480, borderRadius:"20px 20px 0 0",
        maxHeight:"92vh", overflowY:"auto", animation:"slideUp .25s ease" }}>
        <div style={{ padding:"16px 18px 12px", borderBottom:"1px solid #252530",
          display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <span style={{ fontSize:16, fontWeight:800, color:"#F2EEE8" }}>
            {done?"Posted! 🔥":step===1?"Post a Spot":"Add Details"}
          </span>
          <button onClick={onClose} style={{ color:"#6B6878", fontSize:20 }}>×</button>
        </div>
        <div style={{ padding:18 }}>
          {done ? (
            <div style={{ textAlign:"center", padding:"32px 0" }}>
              <div style={{ fontSize:56, marginBottom:12 }}>🏎</div>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:24, fontWeight:900, color:"#F2EEE8", marginBottom:6 }}>Your spot is live!</div>
              <div style={{ fontSize:13, color:"#6B6878" }}>The community can see it now.</div>
            </div>
          ) : step===1 ? (
            <div>
              <div onClick={() => fileRef.current?.click()}
                style={{ border:"2px dashed #252530", borderRadius:14, padding:"48px 20px", textAlign:"center", cursor:"pointer", background:"#0A0A0C" }}
                onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();handleFile(e.dataTransfer.files[0]);}}>
                <div style={{ fontSize:36, marginBottom:10 }}>📸</div>
                <div style={{ fontSize:15, fontWeight:700, color:"#F2EEE8", marginBottom:4 }}>Drop your photo here</div>
                <div style={{ fontSize:12, color:"#6B6878" }}>or tap to choose · JPG, PNG, HEIC · Max 30MB</div>
                <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }} onChange={e=>handleFile(e.target.files?.[0])} />
              </div>
              <ErrorMsg msg={error} />
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {preview && <img src={preview} alt="preview" style={{ width:"100%", height:180, objectFit:"cover", borderRadius:12 }} />}

              {/* Make — autocomplete */}
              <div>
                <label style={{ fontSize:11, color:"#6B6878", fontWeight:600, textTransform:"uppercase", letterSpacing:".05em", display:"block", marginBottom:5 }}>Make</label>
                <MakeInput value={form.make} onChange={v => setForm(p=>({...p, make:v, model:""}))} placeholder="Ferrari" />
              </div>

              {/* Model — autocomplete based on make */}
              <div>
                <label style={{ fontSize:11, color:"#6B6878", fontWeight:600, textTransform:"uppercase", letterSpacing:".05em", display:"block", marginBottom:5 }}>Model</label>
                <ModelInput make={form.make} value={form.model} onChange={v => setForm(p=>({...p, model:v}))} placeholder="SF90 Stradale" />
              </div>

              {/* Year + Location */}
              {[{key:"year",label:"Year",ph:"2023"},{key:"location",label:"Location",ph:"Monaco, Monte Carlo"}].map(({key,label,ph}) => (
                <div key={key}>
                  <label style={{ fontSize:11, color:"#6B6878", fontWeight:600, textTransform:"uppercase", letterSpacing:".05em", display:"block", marginBottom:5 }}>{label}</label>
                  <input className="sd-input" value={form[key]} placeholder={ph} onChange={e=>setForm(p=>({...p,[key]:e.target.value}))} />
                </div>
              ))}

              <div>
                <label style={{ fontSize:11, color:"#6B6878", fontWeight:600, textTransform:"uppercase", letterSpacing:".05em", display:"block", marginBottom:5 }}>Rarity</label>
                <div style={{ display:"flex", gap:8 }}>
                  {["Sports","Exotic","Hypercar"].map(r => {
                    const rc=RARITY[r]; const active=form.rarity===r;
                    return <button key={r} onClick={()=>setForm(p=>({...p,rarity:r}))} style={{ flex:1, padding:"9px", borderRadius:9, fontSize:12, fontWeight:700, background:active?rc.bg:"#0A0A0C", border:`1px solid ${active?rc.border:"#252530"}`, color:active?rc.text:"#6B6878", cursor:"pointer" }}>{r}</button>;
                  })}
                </div>
              </div>
              <div>
                <label style={{ fontSize:11, color:"#6B6878", fontWeight:600, textTransform:"uppercase", letterSpacing:".05em", display:"block", marginBottom:5 }}>Description</label>
                <textarea className="sd-input" rows={3} placeholder="Tell the story…" value={form.desc} onChange={e=>setForm(p=>({...p,desc:e.target.value}))} style={{ resize:"none", lineHeight:1.55 }} />
              </div>
              <ErrorMsg msg={error} />
              <button className="sd-btn sd-btn-primary" onClick={handlePost} disabled={loading||!form.make||!form.model}>
                {loading?<><Spinner size={16} color="#fff"/> Posting…</>:"Post Spot →"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


// ─── SETTINGS SHEET ───────────────────────────────────────────
function SettingsSheet({ onClose, onEditProfile, onChangePhoto, onPrivacy, onNotifications }) {
  const { user, profile, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.75)", zIndex:700,
      backdropFilter:"blur(6px)", display:"flex", alignItems:"flex-end", justifyContent:"center" }}
      onClick={e => { if (e.target===e.currentTarget) onClose(); }}>
      <div style={{ background:"#14141A", width:"100%", maxWidth:430,
        borderRadius:"20px 20px 0 0", padding:"20px 20px 40px", border:"1px solid #252530" }}>
        <div style={{ width:36, height:4, borderRadius:2, background:"#252530", margin:"0 auto 20px" }} />
        <div style={{ fontSize:18, fontWeight:800, color:"#F2EEE8", marginBottom:20 }}>Settings</div>
        <div style={{ background:"#18181F", borderRadius:12, padding:14, marginBottom:16,
          border:"1px solid #252530", display:"flex", alignItems:"center", gap:12 }}>
          <Avatar initials={profile?.handle?.slice(0,2).toUpperCase()||"?"} src={profile?.avatar_url} size={44} />
          <div>
            <div style={{ fontSize:14, fontWeight:700, color:"#F2EEE8" }}>{profile?.display_name||profile?.handle}</div>
            <div style={{ fontSize:12, color:"#6B6878" }}>{user?.email}</div>
          </div>
        </div>
        {[
          { icon:"👤", label:"Edit Profile",  action:() => { onClose(); onEditProfile(); } },
          { icon:"📸", label:"Change Photo",   action:() => { onClose(); onChangePhoto(); } },
          { icon:"🔔", label:"Notifications", action:() => { onClose(); onNotifications(); } },
          { icon:"🔒", label:"Privacy",        action:() => { onClose(); onPrivacy(); } },
        ].map(({ icon, label, action }) => (
          <button key={label} onClick={action}
            style={{ width:"100%", display:"flex", alignItems:"center", gap:12, padding:14,
              background:"#18181F", border:"1px solid #252530", borderRadius:12, marginBottom:8,
              color:"#F2EEE8", fontSize:14, fontWeight:600, cursor:"pointer", textAlign:"left" }}>
            <span style={{ fontSize:20 }}>{icon}</span>{label}
            <span style={{ marginLeft:"auto", color:"#6B6878", fontSize:18 }}>›</span>
          </button>
        ))}
        <button onClick={handleSignOut} disabled={signingOut}
          style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"center",
            gap:8, padding:14, background:"rgba(239,68,68,.12)", border:"1px solid rgba(239,68,68,.3)",
            borderRadius:12, color:"#EF4444", fontSize:14, fontWeight:700, cursor:"pointer", marginTop:4 }}>
          {signingOut ? <Spinner size={14} color="#EF4444" /> : "🚪 Sign Out"}
        </button>
      </div>
    </div>
  );
}

// ─── NOTIFICATION SETTINGS SHEET ─────────────────────────────
function NotificationSettingsSheet({ onClose }) {
  const { user, fetchProfile } = useAuth();

  const [settings, setSettings] = useState({
    muteAll:        false,
    likes:          true,
    comments:       true,
    follows:        true,
    saves:          true,
    mentions:       true,
    weeklyDigest:   true,
    newSpotNearby:  false,
    pushEnabled:    true,
    emailEnabled:   false,
    muteUntil:      null, // null = not muted, or ISO date string
  });
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [muteMenu, setMuteMenu] = useState(false);

  const toggle = (key) => {
    setSettings(p => ({ ...p, [key]: !p[key] }));
  };

  const muteDuration = (hours) => {
    const until = hours === null ? null : new Date(Date.now() + hours * 3600000).toISOString();
    setSettings(p => ({ ...p, muteAll: hours !== null, muteUntil: until }));
    setMuteMenu(false);
  };

  const muteLabel = () => {
    if (!settings.muteAll) return null;
    if (!settings.muteUntil) return "Muted indefinitely";
    const h = Math.round((new Date(settings.muteUntil) - Date.now()) / 3600000);
    if (h < 1) return "Muted (expiring soon)";
    if (h < 24) return `Muted for ${h}h`;
    return `Muted for ${Math.round(h/24)}d`;
  };

  const save = async () => {
    setSaving(true); setSaved(false);
    // In production: save to user preferences table
    // For now: persist in localStorage as fallback
    try {
      localStorage.setItem(`notif_prefs_${user?.id}`, JSON.stringify(settings));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch(e) { console.error(e); }
    finally { setSaving(false); }
  };

  const SECTIONS = [
    {
      title: "Mute",
      items: [], // handled separately below
      custom: true,
    },
    {
      title: "Activity",
      items: [
        { key:"likes",     icon:"❤️", color:"#E8430A", label:"Likes",          desc:"When someone likes your spot" },
        { key:"comments",  icon:"💬", color:"#9B59B6", label:"Comments",       desc:"When someone comments on your spot" },
        { key:"follows",   icon:"👤", color:"#3B82F6", label:"New Followers",  desc:"When someone starts following you" },
        { key:"saves",     icon:"🔖", color:"#C9A84C", label:"Saves",          desc:"When someone saves your spot" },
        { key:"mentions",  icon:"@",  color:"#22C55E", label:"Mentions",       desc:"When someone mentions you in a post" },
      ],
    },
    {
      title: "Discovery",
      items: [
        { key:"newSpotNearby", icon:"📍", color:"#E8430A", label:"Spots Near Me",   desc:"When a rare car is spotted in your area" },
        { key:"weeklyDigest",  icon:"📰", color:"#3B82F6", label:"Weekly Digest",   desc:"A weekly summary of top spots" },
      ],
    },
    {
      title: "Delivery",
      items: [
        { key:"pushEnabled",  icon:"📲", color:"#22C55E", label:"Push Notifications", desc:"Alerts on your phone" },
        { key:"emailEnabled", icon:"📧", color:"#3B82F6", label:"Email Notifications", desc:"Sent to your registered email" },
      ],
    },
  ];

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.8)", zIndex:800,
      backdropFilter:"blur(6px)", display:"flex", alignItems:"flex-end", justifyContent:"center" }}
      onClick={e => { if (e.target===e.currentTarget) onClose(); }}>
      <div style={{ background:"#14141A", width:"100%", maxWidth:430,
        borderRadius:"20px 20px 0 0", maxHeight:"88vh", overflowY:"auto",
        border:"1px solid #252530" }}>

        {/* Header */}
        <div style={{ position:"sticky", top:0, background:"#14141A", zIndex:1,
          padding:"20px 20px 12px", borderBottom:"1px solid #252530" }}>
          <div style={{ width:36, height:4, borderRadius:2, background:"#252530", margin:"0 auto 16px" }} />
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <button onClick={onClose}
                style={{ width:32, height:32, borderRadius:"50%", background:"#18181F",
                  border:"1px solid #252530", display:"flex", alignItems:"center",
                  justifyContent:"center", color:"#6B6878", fontSize:16, cursor:"pointer" }}>
                ‹
              </button>
              <div style={{ fontSize:18, fontWeight:800, color:"#F2EEE8" }}>Notifications</div>
            </div>
            {saved && <div style={{ fontSize:12, color:"#22C55E", fontWeight:700 }}>✓ Saved</div>}
          </div>
        </div>

        <div style={{ padding:"16px 20px 40px" }}>

          {/* Mute section */}
          <div style={{ marginBottom:24 }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#6B6878",
              textTransform:"uppercase", letterSpacing:".08em", marginBottom:10 }}>
              Mute
            </div>
            {/* Mute all toggle */}
            <div style={{ background: settings.muteAll ? "#2D1200" : "#18181F",
              border:`1px solid ${settings.muteAll ? "#E8430A50" : "#252530"}`,
              borderRadius:12, padding:"14px 16px", marginBottom:8, transition:"all .2s" }}>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <span style={{ fontSize:22, flexShrink:0 }}>🔕</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:600, color:"#F2EEE8", marginBottom:2 }}>
                    Mute All Notifications
                  </div>
                  <div style={{ fontSize:11, color: settings.muteAll ? "#E8430A" : "#6B6878" }}>
                    {settings.muteAll ? muteLabel() : "Pause all notifications temporarily"}
                  </div>
                </div>
                <button onClick={() => toggle("muteAll")}
                  role="switch" aria-checked={settings.muteAll}
                  style={{ flexShrink:0, width:44, height:24, borderRadius:99,
                    background: settings.muteAll ? "#E8430A" : "#252530",
                    border:"none", position:"relative", cursor:"pointer", transition:"background .2s" }}>
                  <div style={{ position:"absolute", top:2, left:settings.muteAll?22:2,
                    width:20, height:20, borderRadius:"50%", background:"#fff",
                    boxShadow:"0 1px 3px rgba(0,0,0,.4)", transition:"left .2s" }} />
                </button>
              </div>
            </div>

            {/* Mute duration picker */}
            <div style={{ position:"relative" }}>
              <button onClick={() => setMuteMenu(m => !m)}
                style={{ width:"100%", display:"flex", alignItems:"center", gap:12, padding:"12px 16px",
                  background:"#18181F", border:"1px solid #252530", borderRadius:12,
                  color:"#F2EEE8", fontSize:13, fontWeight:600, cursor:"pointer", textAlign:"left" }}>
                <span style={{ fontSize:18 }}>⏱️</span>
                <span style={{ flex:1 }}>Mute for a specific time</span>
                <span style={{ color:"#6B6878", fontSize:16 }}>{muteMenu?"∧":"∨"}</span>
              </button>
              {muteMenu && (
                <div style={{ position:"absolute", top:"calc(100% + 4px)", left:0, right:0, zIndex:10,
                  background:"#1C1C24", border:"1px solid #252530", borderRadius:12, overflow:"hidden",
                  boxShadow:"0 8px 24px rgba(0,0,0,.5)" }}>
                  {[
                    { label:"For 1 hour",    hours:1    },
                    { label:"For 4 hours",   hours:4    },
                    { label:"For 8 hours",   hours:8    },
                    { label:"For 24 hours",  hours:24   },
                    { label:"For 1 week",    hours:168  },
                    { label:"Until I turn it back on", hours:null },
                    { label:"Unmute",        hours:-1   },
                  ].map(({ label, hours }) => (
                    <button key={label}
                      onClick={() => hours === -1 ? muteDuration(null) : muteDuration(hours === null ? Infinity : hours)}
                      style={{ width:"100%", padding:"12px 16px", background:"none",
                        border:"none", borderBottom:"1px solid #252530",
                        color: hours === -1 ? "#22C55E" : "#F2EEE8",
                        fontSize:13, fontWeight:600, cursor:"pointer", textAlign:"left",
                        display:"flex", alignItems:"center", gap:8 }}>
                      {hours === -1 ? "🔔" : hours === null ? "🔕" : "⏱️"} {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Activity, Discovery, Delivery sections */}
          {SECTIONS.filter(s => !s.custom).map(section => (
            <div key={section.title} style={{ marginBottom:24 }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#6B6878",
                textTransform:"uppercase", letterSpacing:".08em", marginBottom:10 }}>
                {section.title}
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {section.items.map(({ key, icon, color, label, desc }) => {
                  const isOn = settings[key] && !settings.muteAll;
                  return (
                    <div key={key} style={{ background:"#18181F",
                      border:`1px solid ${isOn ? color+"30" : "#252530"}`,
                      borderRadius:12, padding:"13px 16px",
                      display:"flex", alignItems:"center", gap:12,
                      opacity: settings.muteAll ? 0.5 : 1, transition:"all .2s" }}>
                      <span style={{ fontSize:20, flexShrink:0 }}>{icon}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:14, fontWeight:600, color:"#F2EEE8", marginBottom:2 }}>{label}</div>
                        <div style={{ fontSize:11, color:"#6B6878" }}>{desc}</div>
                      </div>
                      <button onClick={() => !settings.muteAll && toggle(key)}
                        role="switch" aria-checked={isOn}
                        aria-label={label}
                        style={{ flexShrink:0, width:44, height:24, borderRadius:99,
                          background: isOn ? color : "#252530",
                          border:"none", position:"relative",
                          cursor: settings.muteAll ? "not-allowed" : "pointer",
                          transition:"background .2s" }}>
                        <div style={{ position:"absolute", top:2, left:isOn?22:2,
                          width:20, height:20, borderRadius:"50%", background:"#fff",
                          boxShadow:"0 1px 3px rgba(0,0,0,.4)", transition:"left .2s" }} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Save */}
          <button onClick={save} disabled={saving}
            style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"center",
              gap:8, padding:14, background:"linear-gradient(135deg,#E8430A,#BF360C)",
              border:"none", borderRadius:12, color:"#fff", fontSize:15, fontWeight:700, cursor:"pointer" }}>
            {saving ? <><Spinner size={16} color="#fff" /> Saving…</> : "Save Notification Settings"}
          </button>

          <div style={{ marginTop:12, padding:"10px 14px", background:"#0A0A0C",
            borderRadius:10, fontSize:11, color:"#6B6878", lineHeight:1.6, textAlign:"center" }}>
            🔔 You can mute all notifications at any time without losing your settings.
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── PRIVACY SHEET ────────────────────────────────────────────
function PrivacySheet({ onClose }) {
  const { user, profile, fetchProfile } = useAuth();

  // Load saved privacy settings from profile metadata
  const [settings, setSettings] = useState({
    privateAccount:     profile?.is_private       ?? false,
    showLocation:       profile?.show_location     ?? true,
    allowTagging:       profile?.allow_tagging     ?? true,
    showOnLeaderboard:  profile?.show_leaderboard  ?? true,
    allowMessages:      profile?.allow_messages    ?? true,
    dataAnalytics:      profile?.data_analytics    ?? true,
  });
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);

  const toggle = (key) => setSettings(p => ({ ...p, [key]: !p[key] }));

  const saveSettings = async () => {
    setSaving(true); setSaved(false);
    try {
      await supabase.from("profiles").update({
        is_private:       settings.privateAccount,
        show_location:    settings.showLocation,
        allow_tagging:    settings.allowTagging,
        show_leaderboard: settings.showOnLeaderboard,
        allow_messages:   settings.allowMessages,
        data_analytics:   settings.dataAnalytics,
      }).eq("id", user.id);
      await fetchProfile(user.id);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch(err) { console.error(err); }
    finally { setSaving(false); }
  };

  const SECTIONS = [
    {
      title: "Account",
      items: [
        { key:"privateAccount",    icon:"🔒", label:"Private Account",
          desc:"Only approved followers can see your spots and profile." },
        { key:"showOnLeaderboard", icon:"🏆", label:"Show on Leaderboard",
          desc:"Appear in city and global spotter leaderboards." },
      ],
    },
    {
      title: "Spots & Location",
      items: [
        { key:"showLocation",  icon:"📍", label:"Show Location on Spots",
          desc:"Display the location tag when you post a spot." },
        { key:"allowTagging",  icon:"🏷️", label:"Allow Others to Tag Me",
          desc:"Other spotters can mention you in their posts." },
      ],
    },
    {
      title: "Interactions",
      items: [
        { key:"allowMessages",  icon:"💬", label:"Allow Direct Messages",
          desc:"Other users can send you messages." },
        { key:"dataAnalytics",  icon:"📊", label:"Help Improve SpotDrive",
          desc:"Share anonymous usage data to improve the app." },
      ],
    },
  ];

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.8)", zIndex:800,
      backdropFilter:"blur(6px)", display:"flex", alignItems:"flex-end", justifyContent:"center" }}
      onClick={e => { if (e.target===e.currentTarget) onClose(); }}>
      <div style={{ background:"#14141A", width:"100%", maxWidth:430,
        borderRadius:"20px 20px 0 0", maxHeight:"88vh", overflowY:"auto",
        border:"1px solid #252530" }}>

        {/* Header */}
        <div style={{ position:"sticky", top:0, background:"#14141A", zIndex:1,
          padding:"20px 20px 12px", borderBottom:"1px solid #252530" }}>
          <div style={{ width:36, height:4, borderRadius:2, background:"#252530", margin:"0 auto 16px" }} />
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <button onClick={onClose}
                style={{ width:32, height:32, borderRadius:"50%", background:"#18181F",
                  border:"1px solid #252530", display:"flex", alignItems:"center",
                  justifyContent:"center", color:"#6B6878", fontSize:16, cursor:"pointer" }}>
                ‹
              </button>
              <div style={{ fontSize:18, fontWeight:800, color:"#F2EEE8" }}>Privacy</div>
            </div>
            {saved && (
              <div style={{ fontSize:12, color:"#22C55E", fontWeight:700,
                display:"flex", alignItems:"center", gap:5 }}>
                ✓ Saved
              </div>
            )}
          </div>
        </div>

        <div style={{ padding:"16px 20px 40px" }}>
          {SECTIONS.map(section => (
            <div key={section.title} style={{ marginBottom:24 }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#6B6878",
                textTransform:"uppercase", letterSpacing:".08em", marginBottom:10 }}>
                {section.title}
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {section.items.map(({ key, icon, label, desc }) => (
                  <div key={key} style={{ background:"#18181F", border:`1px solid ${settings[key] ? "#E8430A30" : "#252530"}`,
                    borderRadius:12, padding:"14px 16px",
                    display:"flex", alignItems:"center", gap:12,
                    transition:"border-color .2s" }}>
                    <span style={{ fontSize:22, flexShrink:0 }}>{icon}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:14, fontWeight:600, color:"#F2EEE8", marginBottom:2 }}>{label}</div>
                      <div style={{ fontSize:11, color:"#6B6878", lineHeight:1.5 }}>{desc}</div>
                    </div>
                    {/* Toggle switch */}
                    <button onClick={() => toggle(key)}
                      role="switch" aria-checked={settings[key]}
                      aria-label={label}
                      style={{ flexShrink:0, width:44, height:24, borderRadius:99,
                        background: settings[key] ? "#E8430A" : "#252530",
                        border:"none", position:"relative", cursor:"pointer",
                        transition:"background .2s" }}>
                      <div style={{ position:"absolute", top:2,
                        left: settings[key] ? 22 : 2,
                        width:20, height:20, borderRadius:"50%",
                        background:"#fff", boxShadow:"0 1px 3px rgba(0,0,0,.4)",
                        transition:"left .2s" }} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Data & Account section */}
          <div style={{ marginBottom:24 }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#6B6878",
              textTransform:"uppercase", letterSpacing:".08em", marginBottom:10 }}>
              Data & Account
            </div>
            {[
              { icon:"📥", label:"Download My Data",   desc:"Get a copy of all your spots and account data.", color:"#3B82F6",   action:() => alert("Your data export will be emailed to you within 24 hours.") },
              { icon:"🗑️", label:"Delete Account",      desc:"Permanently delete your account and all your spots.", color:"#EF4444", action:() => { if (window.confirm("Are you sure? This cannot be undone.")) alert("Account deletion requested. You will receive a confirmation email."); } },
            ].map(({ icon, label, desc, color, action }) => (
              <button key={label} onClick={action}
                style={{ width:"100%", display:"flex", alignItems:"center", gap:12,
                  padding:"14px 16px", background:"#18181F",
                  border:`1px solid ${color}30`, borderRadius:12, marginBottom:8,
                  cursor:"pointer", textAlign:"left" }}>
                <span style={{ fontSize:22, flexShrink:0 }}>{icon}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:600, color, marginBottom:2 }}>{label}</div>
                  <div style={{ fontSize:11, color:"#6B6878" }}>{desc}</div>
                </div>
                <span style={{ color:"#6B6878", fontSize:18 }}>›</span>
              </button>
            ))}
          </div>

          {/* Save button */}
          <button onClick={saveSettings} disabled={saving}
            style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"center",
              gap:8, padding:14, background:"linear-gradient(135deg,#E8430A,#BF360C)",
              border:"none", borderRadius:12, color:"#fff", fontSize:15, fontWeight:700,
              cursor:"pointer" }}>
            {saving ? <><Spinner size={16} color="#fff" /> Saving…</> : "Save Privacy Settings"}
          </button>

          <div style={{ marginTop:16, padding:"12px 14px", background:"#0A0A0C",
            borderRadius:10, fontSize:11, color:"#6B6878", lineHeight:1.6, textAlign:"center" }}>
            🔐 SpotDrive never sells your data. Location data is only used to show your spots on the map.
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── EDIT PROFILE SHEET ───────────────────────────────────────
function EditProfileSheet({ onClose }) {
  const { user, profile, fetchProfile } = useAuth();
  const [form, setForm] = useState({
    display_name: profile?.display_name||"",
    handle:       profile?.handle||"",
    bio:          profile?.bio||"",
  });
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");
  const [success, setSuccess] = useState(false);

  const save = async () => {
    if (!form.handle) { setError("Handle is required."); return; }
    if (!/^[a-z0-9_]+$/i.test(form.handle)) { setError("Handle: letters, numbers, underscores only."); return; }
    setSaving(true); setError("");
    try {
      const { error:err } = await supabase.from("profiles")
        .update({ display_name:form.display_name, handle:form.handle.toLowerCase(), bio:form.bio })
        .eq("id", user.id);
      if (err) throw err;
      await fetchProfile(user.id);
      setSuccess(true);
      setTimeout(onClose, 1000);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.8)", zIndex:800,
      backdropFilter:"blur(6px)", display:"flex", alignItems:"flex-end", justifyContent:"center" }}
      onClick={e => { if (e.target===e.currentTarget) onClose(); }}>
      <div style={{ background:"#14141A", width:"100%", maxWidth:430,
        borderRadius:"20px 20px 0 0", padding:"20px 20px 40px", border:"1px solid #252530" }}>
        <div style={{ width:36, height:4, borderRadius:2, background:"#252530", margin:"0 auto 20px" }} />
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
          <div style={{ fontSize:18, fontWeight:800, color:"#F2EEE8" }}>Edit Profile</div>
          <button onClick={onClose} style={{ fontSize:22, color:"#6B6878", background:"none", border:"none" }}>×</button>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {[
            { key:"display_name", label:"Display Name", placeholder:"Your name", textarea:false },
            { key:"handle",       label:"Username",     placeholder:"your_handle", textarea:false },
            { key:"bio",          label:"Bio",          placeholder:"Tell spotters about yourself…", textarea:true },
          ].map(({ key, label, placeholder, textarea }) => (
            <div key={key}>
              <label style={{ fontSize:11, color:"#6B6878", fontWeight:600, textTransform:"uppercase", letterSpacing:".05em", display:"block", marginBottom:5 }}>{label}</label>
              {textarea
                ? <textarea className="sd-input" rows={3} placeholder={placeholder} value={form[key]} onChange={e=>setForm(p=>({...p,[key]:e.target.value}))} style={{ resize:"none", lineHeight:1.55 }} />
                : <input className="sd-input" placeholder={placeholder} value={form[key]} onChange={e=>setForm(p=>({...p,[key]:e.target.value}))} />
              }
            </div>
          ))}
        </div>
        <ErrorMsg msg={error} />
        {success && <div style={{ color:"#22C55E", fontSize:13, textAlign:"center", marginTop:10 }}>✓ Saved!</div>}
        <button className="sd-btn sd-btn-primary" onClick={save} disabled={saving} style={{ marginTop:16 }}>
          {saving ? <Spinner size={16} color="#fff" /> : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

// ─── STORIES ──────────────────────────────────────────────────
const MOCK_STORIES = [
  { id:"st1", handle:"jdm_tokyo",    initials:"KT", image:"https://images.unsplash.com/photo-1525609004556-c46c7d6cf023?w=600&q=75&fm=webp", make:"Bugatti",     model:"Chiron SS",    rarity:"Hypercar", location:"Shibuya, Tokyo",       viewed:false, expiresAt: Date.now() + 18*3600000 },
  { id:"st2", handle:"euro_spotter", initials:"LM", image:"https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=600&q=75&fm=webp", make:"Ferrari",      model:"SF90",         rarity:"Hypercar", location:"Monaco",               viewed:false, expiresAt: Date.now() + 12*3600000 },
  { id:"st3", handle:"apex_hunter",  initials:"AH", image:"https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=600&q=75&fm=webp",  make:"Lamborghini",  model:"Huracán STO",  rarity:"Exotic",   location:"Beverly Hills",        viewed:true,  expiresAt: Date.now() + 6*3600000  },
  { id:"st4", handle:"gulf_spots",   initials:"OR", image:"https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=600&q=75&fm=webp",  make:"McLaren",      model:"765LT",        rarity:"Exotic",   location:"Dubai Marina",         viewed:false, expiresAt: Date.now() + 20*3600000 },
  { id:"st5", handle:"la_spotter",   initials:"MW", image:"https://images.unsplash.com/photo-1493238792000-8113da705763?w=600&q=75&fm=webp",make:"Porsche",      model:"GT3 RS",       rarity:"Sports",   location:"Santa Monica",         viewed:true,  expiresAt: Date.now() + 3*3600000  },
];

function StoriesRow({ profile, onAddStory }) {
  const [stories, setStories] = useState([]);
  const [viewing, setViewing] = useState(null); // index into stories

  useEffect(() => {
    // Load from Supabase, fall back to mock
    const load = async () => {
      const { data } = await supabase
        .from("stories")
        .select("*, profiles(handle, avatar_url)")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(20);

      if (data && data.length > 0) {
        setStories(data.map(s => ({
          id:        s.id,
          handle:    s.profiles?.handle || "spotter",
          initials:  (s.profiles?.handle || "SP").slice(0,2).toUpperCase(),
          avatar_url:s.profiles?.avatar_url,
          image:     s.image_url,
          make:      s.make,
          model:     s.model,
          rarity:    s.rarity || "Sports",
          location:  s.location_name || "",
          viewed:    false,
          expiresAt: new Date(s.expires_at).getTime(),
        })));
      } else {
        setStories(MOCK_STORIES);
      }
    };
    load();
  }, []);

  const openStory = (idx) => {
    setViewing(idx);
    setStories(ss => ss.map((s, i) => i === idx ? { ...s, viewed: true } : s));
  };

  const timeLeft = (expiresAt) => {
    const h = Math.floor((expiresAt - Date.now()) / 3600000);
    if (h < 1) return "<1h";
    if (h < 24) return `${h}h`;
    return "24h";
  };

  return (
    <>
      <div style={{ display:"flex", gap:12, overflowX:"auto", padding:"12px 14px",
        borderBottom:"1px solid #252530",
        scrollbarWidth:"none", msOverflowStyle:"none" }}>

        {/* Your story / Add */}
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center",
          gap:5, flexShrink:0, cursor:"pointer" }}
          onClick={onAddStory}>
          <div style={{ position:"relative" }}>
            <div style={{ width:60, height:60, borderRadius:"50%",
              background:"linear-gradient(135deg,#252530,#18181F)",
              border:"2px dashed #252530",
              display:"flex", alignItems:"center", justifyContent:"center" }}>
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt="" style={{ width:"100%", height:"100%", borderRadius:"50%", objectFit:"cover" }} />
                : <Avatar initials={profile?.handle?.slice(0,2).toUpperCase()||"ME"} size={56} />
              }
            </div>
            <div style={{ position:"absolute", bottom:0, right:0, width:20, height:20,
              borderRadius:"50%", background:"#E8430A", border:"2px solid #0A0A0C",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:14, fontWeight:700, color:"#fff", lineHeight:1 }}>
              +
            </div>
          </div>
          <span style={{ fontSize:10, color:"#6B6878", fontWeight:600,
            textAlign:"center", maxWidth:64, overflow:"hidden",
            textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
            Your Story
          </span>
        </div>

        {/* Other stories */}
        {stories.map((s, i) => (
          <div key={s.id} style={{ display:"flex", flexDirection:"column",
            alignItems:"center", gap:5, flexShrink:0, cursor:"pointer" }}
            onClick={() => openStory(i)}>
            <div style={{ width:60, height:60, borderRadius:"50%", padding:2,
              background: s.viewed
                ? "#252530"
                : "linear-gradient(135deg,#E8430A,#C9A84C)",
              flexShrink:0 }}>
              <div style={{ width:"100%", height:"100%", borderRadius:"50%",
                overflow:"hidden", border:"2px solid #0A0A0C" }}>
                {s.image
                  ? <img src={s.image} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                  : <div style={{ width:"100%", height:"100%",
                      background:"linear-gradient(135deg,#2D1200,#1C1C24)",
                      display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>🏎</div>
                }
              </div>
            </div>
            <span style={{ fontSize:10, fontWeight:600, textAlign:"center",
              maxWidth:64, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
              color: s.viewed ? "#6B6878" : "#F2EEE8" }}>
              @{s.handle}
            </span>
          </div>
        ))}
      </div>

      {/* Story viewer */}
      {viewing !== null && (
        <StoryViewer
          stories={stories}
          initialIndex={viewing}
          onClose={() => setViewing(null)}
          onViewed={(idx) => setStories(ss => ss.map((s, i) => i===idx ? {...s, viewed:true} : s))}
        />
      )}
    </>
  );
}

function StoryViewer({ stories, initialIndex, onClose, onViewed }) {
  const { profile } = useAuth();
  const [idx,        setIdx]        = useState(initialIndex);
  const [progress,   setProgress]   = useState(0);
  const [paused,     setPaused]     = useState(false);
  const [imgErr,     setImgErr]     = useState(false);
  const [reply,      setReply]      = useState("");
  const [showTray,   setShowTray]   = useState(false);
  const [swipeX,     setSwipeX]     = useState(null);
  const [dragOffset, setDragOffset] = useState(0);
  const intervalRef = useRef(null);
  const containerRef = useRef(null);
  const DURATION = 5000;

  const story = stories[idx];

  const goTo = useCallback((i) => {
    if (i < 0 || i >= stories.length) { onClose(); return; }
    setIdx(i); setProgress(0); setImgErr(false); setDragOffset(0);
    onViewed(i);
  }, [stories.length, onClose, onViewed]);

  const goNext = useCallback(() => goTo(idx + 1), [idx, goTo]);
  const goPrev = useCallback(() => goTo(idx - 1), [idx, goTo]);

  useEffect(() => { onViewed(idx); setProgress(0); }, [idx]);

  useEffect(() => {
    if (paused || showTray) { clearInterval(intervalRef.current); return; }
    intervalRef.current = setInterval(() => {
      setProgress(p => {
        if (p >= 100) { goNext(); return 0; }
        return p + (100 / (DURATION / 50));
      });
    }, 50);
    return () => clearInterval(intervalRef.current);
  }, [idx, paused, showTray, goNext]);

  // Swipe handlers
  const onTouchStart = (e) => {
    setSwipeX(e.touches[0].clientX);
    setPaused(true);
  };
  const onTouchMove = (e) => {
    if (swipeX === null) return;
    const dx = e.touches[0].clientX - swipeX;
    setDragOffset(dx);
  };
  const onTouchEnd = (e) => {
    const dx = dragOffset;
    setDragOffset(0);
    setPaused(false);
    setSwipeX(null);
    if (Math.abs(dx) > 60) {
      if (dx < 0) goNext(); // swipe left → next
      else        goPrev(); // swipe right → prev
    }
  };

  const timeLeft = (expiresAt) => {
    const h = Math.floor((expiresAt - Date.now()) / 3600000);
    if (h < 1) return "Expires soon";
    return `${h}h left`;
  };

  const RARITY_COLOR = { Hypercar:"#b388ff", Exotic:"#E8430A", Sports:"#60a5fa" };
  if (!story) return null;

  // Clamp drag for visual feedback
  const clampedOffset = Math.max(-80, Math.min(80, dragOffset));

  return (
    <div ref={containerRef}
      style={{ position:"fixed", inset:0, background:"#000", zIndex:900,
        display:"flex", flexDirection:"column", maxWidth:430, margin:"0 auto",
        touchAction:"pan-y",
        transform:`translateX(${clampedOffset}px)`,
        transition: swipeX === null ? "transform .2s ease" : "none" }}>

      {/* Progress bars */}
      <div style={{ position:"absolute", top:0, left:0, right:0, zIndex:10,
        display:"flex", gap:3, padding:"10px 10px 0" }}>
        {stories.map((_, i) => (
          <div key={i} onClick={() => { setPaused(false); goTo(i); }}
            style={{ flex:1, height:3, background:"rgba(255,255,255,.25)",
              borderRadius:2, overflow:"hidden", cursor:"pointer" }}>
            <div style={{ height:"100%", background:"#fff", borderRadius:2,
              width: i < idx ? "100%" : i === idx ? `${progress}%` : "0%" }} />
          </div>
        ))}
      </div>

      {/* Story image with swipe */}
      <div style={{ flex:1, position:"relative", overflow:"hidden" }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onPointerDown={e => { if (e.pointerType === "mouse") setPaused(true); }}
        onPointerUp={e => { if (e.pointerType === "mouse") setPaused(false); }}>

        {story.image && !imgErr
          ? <img src={story.image} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}
              onError={() => setImgErr(true)} />
          : <div style={{ width:"100%", height:"100%",
              background:"linear-gradient(135deg,#2D1200,#0A0A0C)",
              display:"flex", alignItems:"center", justifyContent:"center", fontSize:80 }}>🏎</div>
        }

        {/* Gradient overlays */}
        <div style={{ position:"absolute", inset:0,
          background:"linear-gradient(to bottom, rgba(0,0,0,.55) 0%, transparent 28%, transparent 62%, rgba(0,0,0,.85) 100%)",
          pointerEvents:"none" }} />

        {/* Tap zones (mouse/desktop) */}
        <div style={{ position:"absolute", inset:0, display:"flex", pointerEvents:"auto" }}>
          <div style={{ width:"35%", height:"100%" }} onClick={goPrev} />
          <div style={{ width:"30%", height:"100%" }} /> {/* centre - no tap */}
          <div style={{ width:"35%", height:"100%" }} onClick={goNext} />
        </div>

        {/* Header */}
        <div style={{ position:"absolute", top:24, left:0, right:0, padding:"0 14px",
          display:"flex", alignItems:"center", gap:10, pointerEvents:"auto" }}>
          <Avatar initials={story.initials} src={story.avatar_url} size={38} ring />
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14, fontWeight:700, color:"#fff" }}>@{story.handle}</div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,.65)" }}>{timeLeft(story.expiresAt)}</div>
          </div>
          {/* Story selector tray toggle */}
          <button onClick={() => { setPaused(true); setShowTray(t => !t); }}
            title="Browse all stories"
            style={{ background:"rgba(255,255,255,.15)", border:"1px solid rgba(255,255,255,.2)",
              borderRadius:20, padding:"5px 10px", color:"#fff", fontSize:11,
              fontWeight:700, cursor:"pointer", backdropFilter:"blur(6px)" }}>
            {idx+1}/{stories.length}
          </button>
          <button onClick={onClose}
            style={{ background:"none", border:"none", color:"rgba(255,255,255,.8)",
              fontSize:26, cursor:"pointer", lineHeight:1, marginLeft:4 }}>×</button>
        </div>

        {/* Swipe hint arrows */}
        {dragOffset < -20 && idx < stories.length - 1 && (
          <div style={{ position:"absolute", right:14, top:"50%", transform:"translateY(-50%)",
            color:"rgba(255,255,255,.6)", fontSize:28, pointerEvents:"none" }}>›</div>
        )}
        {dragOffset > 20 && idx > 0 && (
          <div style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)",
            color:"rgba(255,255,255,.6)", fontSize:28, pointerEvents:"none" }}>‹</div>
        )}

        {/* Car info */}
        <div style={{ position:"absolute", bottom:90, left:14, right:14, pointerEvents:"none" }}>
          <div style={{ marginBottom:8 }}>
            <span style={{ background:`${RARITY_COLOR[story.rarity]||"#60a5fa"}22`,
              color:RARITY_COLOR[story.rarity]||"#60a5fa",
              border:`1px solid ${RARITY_COLOR[story.rarity]||"#60a5fa"}`,
              borderRadius:6, padding:"3px 10px", fontSize:10, fontWeight:700,
              textTransform:"uppercase", letterSpacing:".06em" }}>
              {story.rarity}
            </span>
          </div>
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:32,
            fontWeight:900, color:"#fff", lineHeight:1, marginBottom:6,
            textShadow:"0 2px 12px rgba(0,0,0,.8)" }}>
            {story.make} {story.model}
          </div>
          {story.location && (
            <div style={{ fontSize:12, color:"rgba(255,255,255,.8)" }}>
              📍 {story.location}
            </div>
          )}
        </div>
      </div>

      {/* Story selector tray */}
      {showTray && (
        <div style={{ position:"absolute", bottom:80, left:0, right:0, zIndex:20,
          background:"rgba(10,10,12,.92)", backdropFilter:"blur(16px)",
          borderTop:"1px solid rgba(255,255,255,.1)", padding:"14px 14px 16px" }}>
          <div style={{ fontSize:11, color:"rgba(255,255,255,.5)", fontWeight:700,
            textTransform:"uppercase", letterSpacing:".08em", marginBottom:12 }}>
            All Stories — tap to jump
          </div>
          <div style={{ display:"flex", gap:10, overflowX:"auto",
            scrollbarWidth:"none", paddingBottom:4 }}>
            {stories.map((s, i) => (
              <div key={s.id} onClick={() => { setShowTray(false); setPaused(false); goTo(i); }}
                style={{ flexShrink:0, display:"flex", flexDirection:"column",
                  alignItems:"center", gap:6, cursor:"pointer" }}>
                {/* Thumbnail */}
                <div style={{ width:56, height:80, borderRadius:10, overflow:"hidden",
                  border:`2px solid ${i===idx?"#E8430A":"rgba(255,255,255,.15)"}`,
                  position:"relative", flexShrink:0 }}>
                  {s.image
                    ? <img src={s.image} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                    : <div style={{ width:"100%", height:"100%", background:"#2D1200",
                        display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>🏎</div>
                  }
                  {/* Viewed overlay */}
                  {s.viewed && i !== idx && (
                    <div style={{ position:"absolute", inset:0,
                      background:"rgba(0,0,0,.5)" }} />
                  )}
                  {/* Currently playing indicator */}
                  {i === idx && (
                    <div style={{ position:"absolute", bottom:4, left:"50%",
                      transform:"translateX(-50%)", width:16, height:3,
                      borderRadius:2, background:"#E8430A" }} />
                  )}
                </div>
                {/* Make */}
                <div style={{ fontSize:9, color: i===idx?"#E8430A":"rgba(255,255,255,.5)",
                  fontWeight:700, maxWidth:56, overflow:"hidden",
                  textOverflow:"ellipsis", whiteSpace:"nowrap", textAlign:"center" }}>
                  {s.make}
                </div>
                {/* Handle */}
                <div style={{ fontSize:9, color:"rgba(255,255,255,.4)",
                  maxWidth:56, overflow:"hidden",
                  textOverflow:"ellipsis", whiteSpace:"nowrap", textAlign:"center" }}>
                  @{s.handle}
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => { setShowTray(false); setPaused(false); }}
            style={{ marginTop:12, width:"100%", padding:"9px", background:"rgba(255,255,255,.08)",
              border:"1px solid rgba(255,255,255,.1)", borderRadius:10,
              color:"rgba(255,255,255,.6)", fontSize:13, fontWeight:600, cursor:"pointer" }}>
            Close
          </button>
        </div>
      )}

      {/* Reply input */}
      <div style={{ flexShrink:0, padding:"10px 14px 28px",
        background:"rgba(0,0,0,.6)", backdropFilter:"blur(10px)" }}>
        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          <input value={reply} onChange={e => setReply(e.target.value)}
            onFocus={() => setPaused(true)} onBlur={() => { if (!showTray) setPaused(false); }}
            placeholder={`Reply to @${story.handle}…`}
            style={{ flex:1, background:"rgba(255,255,255,.1)",
              border:"1px solid rgba(255,255,255,.2)", borderRadius:22,
              padding:"9px 14px", color:"#fff", fontSize:13, outline:"none" }} />
          <button style={{ background:"none", border:"none", fontSize:22, cursor:"pointer" }}>❤️</button>
          {reply.trim() && (
            <button onClick={() => setReply("")}
              style={{ background:"#E8430A", border:"none", borderRadius:99,
                padding:"7px 14px", color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer" }}>
              Send
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StoryUploadModal({ onClose }) {
  const { user, profile } = useAuth();
  const [file,    setFile]    = useState(null);
  const [preview, setPreview] = useState(null);
  const [form,    setForm]    = useState({ make:"", model:"", rarity:"Exotic", location:"" });
  const [posting, setPosting] = useState(false);
  const [done,    setDone]    = useState(false);
  const [error,   setError]   = useState("");
  const fileRef = useRef();
  const blobRef = useRef(null);
  useEffect(() => () => { if (blobRef.current) URL.revokeObjectURL(blobRef.current); }, []);

  const handleFile = (f) => {
    if (!f || !f.type.startsWith("image/")) { setError("Please pick an image."); return; }
    if (blobRef.current) URL.revokeObjectURL(blobRef.current);
    blobRef.current = URL.createObjectURL(f);
    setFile(f); setPreview(blobRef.current); setError("");
  };

  const post = async () => {
    if (!file || !form.make) { setError("Pick a photo and enter the car make."); return; }
    setPosting(true);
    try {
      const ext  = file.name.split(".").pop();
      const path = `stories/${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("spot-photos").upload(path, file, { contentType:file.type });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from("spot-photos").getPublicUrl(path);

      const expiresAt = new Date(Date.now() + 24*3600000).toISOString();
      const { error: insErr } = await supabase.from("stories").insert({
        user_id:      user.id,
        image_url:    publicUrl,
        make:         form.make,
        model:        form.model,
        rarity:       form.rarity,
        location_name:form.location,
        expires_at:   expiresAt,
      });
      if (insErr) throw insErr;
      setDone(true);
      setTimeout(onClose, 1800);
    } catch(err) { setError(err.message); }
    finally { setPosting(false); }
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.88)", zIndex:700,
      backdropFilter:"blur(8px)", display:"flex", alignItems:"flex-end", justifyContent:"center" }}
      onClick={e => { if (e.target===e.currentTarget) onClose(); }}>
      <div style={{ background:"#14141A", width:"100%", maxWidth:480,
        borderRadius:"20px 20px 0 0", border:"1px solid #252530",
        animation:"slideUp .25s ease" }}>
        <div style={{ padding:"16px 18px 12px", borderBottom:"1px solid #252530",
          display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <span style={{ fontSize:16, fontWeight:800, color:"#F2EEE8" }}>
            {done ? "Story Posted! 🔥" : "Add to Your Story"}
          </span>
          <button onClick={onClose} style={{ color:"#6B6878", fontSize:22, background:"none", border:"none" }}>×</button>
        </div>
        <div style={{ padding:18, paddingBottom:32 }}>
          {done ? (
            <div style={{ textAlign:"center", padding:"32px 0" }}>
              <div style={{ fontSize:52, marginBottom:12 }}>🏎</div>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:22, fontWeight:900, color:"#F2EEE8" }}>
                Live for 24 hours!
              </div>
              <div style={{ fontSize:13, color:"#6B6878", marginTop:6 }}>Your spotters can see it now.</div>
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {/* Photo picker */}
              {!preview ? (
                <div onClick={() => fileRef.current?.click()}
                  style={{ border:"2px dashed #252530", borderRadius:14, padding:"36px",
                    textAlign:"center", cursor:"pointer", background:"#0A0A0C" }}
                  onDragOver={e=>e.preventDefault()}
                  onDrop={e=>{e.preventDefault();handleFile(e.dataTransfer.files[0]);}}>
                  <div style={{ fontSize:32, marginBottom:8 }}>📸</div>
                  <div style={{ fontSize:14, fontWeight:700, color:"#F2EEE8", marginBottom:4 }}>
                    Pick a photo for your story
                  </div>
                  <div style={{ fontSize:12, color:"#6B6878" }}>Disappears in 24 hours</div>
                  <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }}
                    onChange={e=>handleFile(e.target.files?.[0])} />
                </div>
              ) : (
                <div style={{ position:"relative" }}>
                  <img src={preview} alt="" style={{ width:"100%", height:200, objectFit:"cover", borderRadius:12 }} />
                  <button onClick={() => { setFile(null); setPreview(null); }}
                    style={{ position:"absolute", top:8, right:8, background:"rgba(0,0,0,.6)",
                      border:"none", borderRadius:"50%", width:28, height:28,
                      color:"#fff", fontSize:16, cursor:"pointer",
                      display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
                </div>
              )}

              {/* Fields */}
              {[
                { key:"make",     label:"Make",     ph:"Ferrari"  },
                { key:"model",    label:"Model",    ph:"SF90"     },
                { key:"location", label:"Location", ph:"Monaco"   },
              ].map(({ key, label, ph }) => (
                <div key={key}>
                  <label style={{ fontSize:11, color:"#6B6878", fontWeight:600,
                    textTransform:"uppercase", letterSpacing:".05em", display:"block", marginBottom:5 }}>
                    {label}
                  </label>
                  <input className="sd-input" placeholder={ph} value={form[key]}
                    onChange={e => setForm(p => ({ ...p, [key]:e.target.value }))} />
                </div>
              ))}

              {/* Rarity */}
              <div>
                <label style={{ fontSize:11, color:"#6B6878", fontWeight:600,
                  textTransform:"uppercase", letterSpacing:".05em", display:"block", marginBottom:5 }}>
                  Rarity
                </label>
                <div style={{ display:"flex", gap:8 }}>
                  {["Sports","Exotic","Hypercar"].map(r => {
                    const rc = RARITY[r]; const active = form.rarity===r;
                    return (
                      <button key={r} onClick={() => setForm(p=>({...p,rarity:r}))}
                        style={{ flex:1, padding:"8px", borderRadius:9, fontSize:12, fontWeight:700,
                          background:active?rc.bg:"#0A0A0C", border:`1px solid ${active?rc.border:"#252530"}`,
                          color:active?rc.text:"#6B6878", cursor:"pointer" }}>{r}</button>
                    );
                  })}
                </div>
              </div>

              <ErrorMsg msg={error} />

              <button onClick={post} disabled={posting || !file}
                style={{ width:"100%", padding:13, borderRadius:12,
                  background:"linear-gradient(135deg,#E8430A,#BF360C)",
                  border:"none", color:"#fff", fontSize:15, fontWeight:700,
                  cursor: posting||!file ? "not-allowed" : "pointer",
                  opacity: posting||!file ? 0.6 : 1,
                  display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                {posting ? <><Spinner size={16} color="#fff" /> Posting…</> : "Share Story →"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── SCREENS ──────────────────────────────────────────────────
// ─── IMAGE OPTIMISATION HELPER ────────────────────────────────
// Adds width + quality params to Unsplash URLs, converts to WebP
const imgUrl = (url, w = 600) => {
  if (!url) return null;
  if (url.includes("unsplash.com")) {
    const base = url.split("?")[0];
    return `${base}?w=${w}&q=75&fm=webp&fit=crop`;
  }
  return url; // Supabase Storage or other CDN — return as-is
};

// ─── QUERY CACHE ──────────────────────────────────────────────
// Simple in-memory cache so switching tabs doesn't refetch
const queryCache = new Map();
const CACHE_TTL = 60000; // 1 minute

const cachedFetch = async (key, fetcher) => {
  const cached = queryCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;
  const data = await fetcher();
  queryCache.set(key, { data, ts: Date.now() });
  return data;
};

const PAGE_SIZE = 10;

function FeedScreen({ onSpotTap }) {
  const { profile } = useAuth();
  const [spots,         setSpots]         = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [loadingMore,   setLoadingMore]   = useState(false);
  const [hasMore,       setHasMore]       = useState(true);
  const [page,          setPage]          = useState(0);
  const [showStoryUpload, setShowStoryUpload] = useState(false);
  const [showPushBanner,  setShowPushBanner]  = useState(() =>
    typeof Notification !== "undefined" && Notification.permission === "default"
  );
  const bottomRef   = useRef(null);
  const channelRef  = useRef(null);

  const mapSpot = (s) => ({
    ...s,
    image:    imgUrl(s.image_url, 600),
    location: s.location_name,
    likes:    s.likes_count    || 0,
    saves:    s.saves_count    || 0,
    comments: s.comments_count || 0,
    time:     timeAgo(s.created_at),
    tags:     [],
    liked:    false,
    saved:    false,
    user: {
      handle:    s.profiles?.handle     || "spotter",
      avatar_url:s.profiles?.avatar_url,
      initials:  (s.profiles?.handle    || "SP").slice(0,2).toUpperCase(),
    },
  });

  const timeAgo = (ts) => {
    if (!ts) return "";
    const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
    if (m < 1)    return "just now";
    if (m < 60)   return `${m}m ago`;
    if (m < 1440) return `${Math.floor(m/60)}h ago`;
    return `${Math.floor(m/1440)}d ago`;
  };

  // Initial load with cache
  useEffect(() => {
    const load = async () => {
      const data = await cachedFetch("feed-page-0", async () => {
        const { data } = await supabase.from("spots")
          .select("*, profiles(handle, avatar_url)")
          .eq("status", "live")
          .order("created_at", { ascending: false })
          .range(0, PAGE_SIZE - 1);
        return data;
      });

      if (data && data.length > 0) {
        setSpots(data.map(mapSpot));
        setHasMore(data.length === PAGE_SIZE);
      } else {
        setSpots(MOCK_SPOTS.map(s => ({ ...s, image: imgUrl(s.image, 600) })));
        setHasMore(false);
      }
      setLoading(false);
    };
    load();
  }, []);

  // ── Real-time new spots ──────────────────────────────────────
  useEffect(() => {
    channelRef.current = supabase
      .channel("feed-realtime")
      .on("postgres_changes", {
        event:  "INSERT",
        schema: "public",
        table:  "spots",
        filter: "status=eq.live",
      }, async (payload) => {
        // Fetch full spot with profile
        const { data } = await supabase.from("spots")
          .select("*, profiles(handle, avatar_url)")
          .eq("id", payload.new.id)
          .single();
        if (data) {
          setSpots(prev => [mapSpot(data), ...prev]);
          // Invalidate cache
          queryCache.delete("feed-page-0");
        }
      })
      .subscribe();

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, []);

  // ── Infinite scroll observer ─────────────────────────────────
  useEffect(() => {
    if (!bottomRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(bottomRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, page]);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    const from = nextPage * PAGE_SIZE;
    const to   = from + PAGE_SIZE - 1;

    const { data } = await supabase.from("spots")
      .select("*, profiles(handle, avatar_url)")
      .eq("status", "live")
      .order("created_at", { ascending: false })
      .range(from, to);

    if (data && data.length > 0) {
      setSpots(prev => [...prev, ...data.map(mapSpot)]);
      setPage(nextPage);
      setHasMore(data.length === PAGE_SIZE);
    } else {
      setHasMore(false);
    }
    setLoadingMore(false);
  };

  return (
    <div>
      <StoriesRow profile={profile} onAddStory={() => setShowStoryUpload(true)} />

      {showPushBanner && <PushNotificationBanner onDismiss={() => setShowPushBanner(false)} />}

      <div style={{ margin:"10px 14px", padding:"10px 14px", background:"#2D1200",
        border:"1px solid rgba(232,67,10,.3)", borderRadius:12,
        display:"flex", alignItems:"center", gap:8, fontSize:13 }}>
        <span>🔥</span>
        <span style={{ color:"#F2EEE8", fontWeight:600 }}>Trending: </span>
        <span style={{ color:"#6B6878" }}>Bugatti Chiron SS in Tokyo · 9.4k likes</span>
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:14, padding:"0 14px 14px" }}>
        {loading
          ? Array(3).fill(0).map((_,i) => (
              <div key={i} style={{ background:"#18181F", border:"1px solid #252530", borderRadius:16, overflow:"hidden" }}>
                <div className="shimmer" style={{ height:220 }} />
                <div style={{ padding:14, display:"flex", flexDirection:"column", gap:10 }}>
                  <div style={{ display:"flex", gap:10 }}>
                    <div className="shimmer" style={{ width:32, height:32, borderRadius:"50%" }} />
                    <div style={{ flex:1, display:"flex", flexDirection:"column", gap:6 }}>
                      <div className="shimmer" style={{ height:11, width:"55%" }} />
                      <div className="shimmer" style={{ height:10, width:"35%" }} />
                    </div>
                  </div>
                  <div className="shimmer" style={{ height:20, width:"70%" }} />
                </div>
              </div>
            ))
          : spots.map(s => <SpotCard key={s.id} spot={s} onTap={onSpotTap} />)
        }

        {/* Infinite scroll trigger */}
        <div ref={bottomRef} style={{ height:20 }} />

        {/* Loading more indicator */}
        {loadingMore && (
          <div style={{ display:"flex", justifyContent:"center", padding:"16px 0" }}>
            <Spinner size={24} />
          </div>
        )}

        {/* End of feed */}
        {!hasMore && !loading && spots.length > 0 && (
          <div style={{ textAlign:"center", padding:"20px 0",
            fontSize:12, color:"#3D3D4E" }}>
            You've seen all the spots 🏎
          </div>
        )}
      </div>

      {showStoryUpload && <StoryUploadModal onClose={() => setShowStoryUpload(false)} />}
    </div>
  );
}

// ─── FOLLOW BUTTON ────────────────────────────────────────────
function FollowButton({ targetUserId, targetHandle, size="md" }) {
  const { user } = useAuth();
  const [following,  setFollowing]  = useState(null); // null = loading
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!user || !targetUserId || user.id === targetUserId) return;
    supabase.from("follows")
      .select("id").eq("follower_id", user.id).eq("following_id", targetUserId).single()
      .then(({ data }) => setFollowing(!!data));
  }, [user, targetUserId]);

  const toggle = async (e) => {
    e.stopPropagation();
    if (!user || processing || user.id === targetUserId) return;
    setProcessing(true);
    try {
      if (following) {
        await supabase.from("follows")
          .delete().eq("follower_id", user.id).eq("following_id", targetUserId);
        // Decrement counts
        await supabase.rpc("decrement_follow_counts", {
          follower: user.id, following: targetUserId
        }).catch(() => {
          // Fallback: manual update if RPC not set up
          supabase.from("profiles").select("followers_count").eq("id", targetUserId).single()
            .then(({ data }) => {
              if (data) supabase.from("profiles")
                .update({ followers_count: Math.max(0, (data.followers_count||1)-1) })
                .eq("id", targetUserId);
            });
        });
        setFollowing(false);
      } else {
        await supabase.from("follows")
          .insert({ follower_id: user.id, following_id: targetUserId });
        // Increment counts
        await supabase.from("profiles").select("followers_count").eq("id", targetUserId).single()
          .then(({ data }) => {
            if (data) supabase.from("profiles")
              .update({ followers_count: (data.followers_count||0)+1 })
              .eq("id", targetUserId);
          });
        setFollowing(true);
      }
    } catch(err) { console.error(err); }
    finally { setProcessing(false); }
  };

  // Don't show button for own profile
  if (!user || user.id === targetUserId) return null;
  // Still loading follow state
  if (following === null) return (
    <div style={{ width: size==="sm"?70:90, height:size==="sm"?28:34, borderRadius:99,
      background:"#252530", animation:"shimmer 1.4s ease-in-out infinite" }} />
  );

  const sm = size === "sm";
  return (
    <button onClick={toggle} disabled={processing}
      aria-label={following ? `Unfollow @${targetHandle}` : `Follow @${targetHandle}`}
      style={{ padding: sm?"5px 14px":"8px 20px",
        borderRadius:99, fontSize: sm?11:13, fontWeight:700,
        background: following ? "none" : "#E8430A",
        border: following ? "1px solid #252530" : "1px solid #E8430A",
        color: following ? "#6B6878" : "#fff",
        cursor: processing ? "not-allowed" : "pointer",
        opacity: processing ? 0.7 : 1,
        transition:"all .15s", display:"flex", alignItems:"center", gap:4 }}>
      {processing ? <Spinner size={10} color={following?"#6B6878":"#fff"} /> : null}
      {following ? "Following" : "Follow"}
    </button>
  );
}

// ─── SPOTTER PROFILE SHEET ────────────────────────────────────
function SpotterProfileSheet({ handle, onClose }) {
  const { user } = useAuth();
  const [spotter,  setSpotter]  = useState(null);
  const [spots,    setSpots]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState("spots");

  useEffect(() => {
    if (!handle) return;
    const load = async () => {
      const { data: profileData } = await supabase
        .from("profiles").select("*").eq("handle", handle).single();
      setSpotter(profileData);

      if (profileData) {
        const { data: spotData } = await supabase
          .from("spots").select("*")
          .eq("user_id", profileData.id).eq("status","live")
          .order("created_at",{ ascending:false }).limit(12);
        setSpots(spotData || []);
      }
      setLoading(false);
    };
    load();
  }, [handle]);

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.85)", zIndex:800,
      backdropFilter:"blur(6px)", display:"flex", alignItems:"flex-end", justifyContent:"center" }}
      onClick={e => { if (e.target===e.currentTarget) onClose(); }}>
      <div style={{ background:"#0A0A0C", width:"100%", maxWidth:430,
        height:"90vh", borderRadius:"20px 20px 0 0", border:"1px solid #252530",
        display:"flex", flexDirection:"column", animation:"slideUp .25s ease" }}>

        {/* Header */}
        <div style={{ padding:"14px 16px 0", flexShrink:0 }}>
          <div style={{ width:36, height:4, borderRadius:2, background:"#252530", margin:"0 auto 14px" }} />
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
            <button onClick={onClose}
              style={{ width:32, height:32, borderRadius:"50%", background:"#18181F",
                border:"1px solid #252530", display:"flex", alignItems:"center",
                justifyContent:"center", color:"#6B6878", fontSize:18, cursor:"pointer" }}>
              ‹
            </button>
            <span style={{ fontSize:15, fontWeight:700, color:"#F2EEE8" }}>@{handle}</span>
          </div>
        </div>

        <div style={{ flex:1, overflowY:"auto" }}>
          {loading ? (
            <div style={{ display:"flex", justifyContent:"center", padding:40 }}>
              <Spinner size={28} />
            </div>
          ) : !spotter ? (
            <div style={{ textAlign:"center", padding:"60px 20px" }}>
              <div style={{ fontSize:36, marginBottom:10 }}>👤</div>
              <div style={{ fontSize:15, color:"#6B6878" }}>Spotter not found</div>
            </div>
          ) : (
            <div>
              {/* Profile header */}
              <div style={{ background:"linear-gradient(180deg,#2D1200 0%,#0A0A0C 100%)", padding:"0 16px 0" }}>
                <div style={{ display:"flex", gap:14, alignItems:"flex-end", marginBottom:16 }}>
                  <Avatar initials={spotter.handle?.slice(0,2).toUpperCase()||"?"} src={spotter.avatar_url} size={64} ring />
                  <div style={{ flex:1 }}>
                    <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:20, fontWeight:900, color:"#F2EEE8" }}>
                      {spotter.display_name || spotter.handle}
                    </div>
                    <div style={{ fontSize:12, color:"#6B6878", marginBottom:8 }}>@{spotter.handle}</div>
                    {spotter.bio && <div style={{ fontSize:12, color:"#AAA6A0", lineHeight:1.4, marginBottom:8 }}>{spotter.bio}</div>}
                    <FollowButton targetUserId={spotter.id} targetHandle={spotter.handle} />
                  </div>
                </div>

                {/* Stats */}
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)",
                  borderTop:"1px solid #252530", paddingTop:12, marginBottom:0 }}>
                  {[
                    ["Spots",     spots.length],
                    ["Followers", spotter.followers_count||0],
                    ["Following", spotter.following_count||0],
                  ].map(([label, value]) => (
                    <div key={label} style={{ textAlign:"center" }}>
                      <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:20, fontWeight:900, color:"#F2EEE8" }}>{value}</div>
                      <div style={{ fontSize:10, color:"#6B6878", textTransform:"uppercase", letterSpacing:".05em" }}>{label}</div>
                    </div>
                  ))}
                </div>

                {/* Tabs */}
                <div style={{ display:"flex", marginTop:14, borderTop:"1px solid #252530" }}>
                  {["spots","about"].map(t => (
                    <button key={t} onClick={() => setTab(t)}
                      style={{ flex:1, padding:"10px", fontSize:12, fontWeight:600,
                        background:"none", border:"none", cursor:"pointer", textTransform:"capitalize",
                        color: tab===t ? "#E8430A" : "#6B6878",
                        borderBottom: tab===t ? "2px solid #E8430A" : "2px solid transparent" }}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Spots grid */}
              {tab === "spots" && (
                spots.length === 0 ? (
                  <div style={{ textAlign:"center", padding:"48px 20px" }}>
                    <div style={{ fontSize:32, marginBottom:8 }}>📸</div>
                    <div style={{ fontSize:14, color:"#6B6878" }}>No spots yet</div>
                  </div>
                ) : (
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:2, padding:2 }}>
                    {spots.map(s => (
                      <div key={s.id} style={{ aspectRatio:"1", overflow:"hidden", position:"relative" }}>
                        {s.image_url
                          ? <img src={s.image_url} alt="" loading="lazy"
                              style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                          : <div style={{ width:"100%", height:"100%", background:"#2D1200",
                              display:"flex", alignItems:"center", justifyContent:"center", fontSize:24 }}>🏎</div>
                        }
                        <div style={{ position:"absolute", inset:0, background:"linear-gradient(to bottom,transparent 60%,rgba(0,0,0,.7))" }} />
                        <div style={{ position:"absolute", bottom:4, left:4,
                          fontFamily:"'Barlow Condensed',sans-serif", fontSize:10, fontWeight:800, color:"#fff" }}>
                          {s.make}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}

              {/* About tab */}
              {tab === "about" && (
                <div style={{ padding:"16px 16px 40px" }}>
                  <div style={{ background:"#14141A", borderRadius:12, padding:16, border:"1px solid #252530" }}>
                    {[
                      { icon:"🏎", label:"Spots posted",   value: spots.length },
                      { icon:"👥", label:"Followers",       value: spotter.followers_count||0 },
                      { icon:"👤", label:"Following",       value: spotter.following_count||0 },
                      { icon:"📅", label:"Member since",    value: new Date(spotter.created_at).toLocaleDateString("en-GB",{month:"short",year:"numeric"}) },
                    ].map(({ icon, label, value }) => (
                      <div key={label} style={{ display:"flex", alignItems:"center", gap:12,
                        padding:"10px 0", borderBottom:"1px solid #252530" }}>
                        <span style={{ fontSize:18, width:24, textAlign:"center" }}>{icon}</span>
                        <span style={{ fontSize:13, color:"#6B6878", flex:1 }}>{label}</span>
                        <span style={{ fontSize:13, fontWeight:700, color:"#F2EEE8" }}>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ExploreScreen({ onSpotTap }) {
  const { user } = useAuth();
  const [tab,      setTab]      = useState("spots");  // spots | spotters
  const [query,    setQuery]    = useState("");
  const [filter,   setFilter]   = useState("All");
  const [spotters, setSpotters] = useState([]);
  const [loadingSpotters, setLoadingSpotters] = useState(false);
  const [viewProfile, setViewProfile] = useState(null);

  const TRENDING_SPOTTERS = [
    { id:"t1", handle:"jdm_tokyo",    display_name:"Kenji Tanaka",   followers_count:91000, spots_count:1204, initials:"KT", avatar_url:null, is_verified:true  },
    { id:"t2", handle:"euro_spotter", display_name:"Lena Müller",    followers_count:54200, spots_count:889,  initials:"LM", avatar_url:null, is_verified:false },
    { id:"t3", handle:"gulf_spots",   display_name:"Omar Al-Rashid", followers_count:38700, spots_count:567,  initials:"OR", avatar_url:null, is_verified:true  },
    { id:"t4", handle:"apex_hunter",  display_name:"Tyler Rhodes",   followers_count:18400, spots_count:412,  initials:"AH", avatar_url:null, is_verified:false },
    { id:"t5", handle:"la_spotter",   display_name:"Marcus Webb",    followers_count:12100, spots_count:203,  initials:"MW", avatar_url:null, is_verified:false },
    { id:"t6", handle:"nring_nut",    display_name:"Hans Fischer",   followers_count:8300,  spots_count:145,  initials:"HF", avatar_url:null, is_verified:false },
    { id:"t7", handle:"tokyo_drift",  display_name:"Yuki Tanaka",    followers_count:7200,  spots_count:98,   initials:"YT", avatar_url:null, is_verified:false },
    { id:"t8", handle:"monza_mike",   display_name:"Mike Rossetti",  followers_count:6100,  spots_count:87,   initials:"MR", avatar_url:null, is_verified:false },
    { id:"t9", handle:"hypercar_hq",  display_name:"The Hypercar HQ",followers_count:5400,  spots_count:312,  initials:"HH", avatar_url:null, is_verified:true  },
    { id:"t10",handle:"spotking_au",  display_name:"Blake Morrison", followers_count:4800,  spots_count:76,   initials:"BM", avatar_url:null, is_verified:false },
  ];

  // Load spotters — merge real users with trending mock list
  useEffect(() => {
    if (tab !== "spotters") return;
    setLoadingSpotters(true);
    supabase.from("profiles").select("*")
      .order("followers_count", { ascending:false }).limit(20)
      .then(({ data }) => {
        // Always show trending spotters, append any real users who aren't already in list
        const realHandles = new Set(TRENDING_SPOTTERS.map(s => s.handle));
        const realExtras = (data || [])
          .filter(p => !realHandles.has(p.handle))
          .map(p => ({
            ...p,
            initials: (p.handle||"SP").slice(0,2).toUpperCase(),
          }));
        // Shuffle trending slightly for freshness
        const shuffled = [...TRENDING_SPOTTERS].sort(() => Math.random() - 0.3);
        setSpotters([...shuffled, ...realExtras]);
        setLoadingSpotters(false);
      });
  }, [tab]);

  const filteredSpots = MOCK_SPOTS.filter(s => {
    const mq = !query || `${s.make} ${s.model} ${s.location}`.toLowerCase().includes(query.toLowerCase());
    return mq && (filter==="All" || s.rarity===filter);
  });

  const filteredSpotters = spotters.filter(s =>
    !query || s.handle?.toLowerCase().includes(query.toLowerCase()) ||
              s.display_name?.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div style={{ padding:14 }}>
      {/* Search bar */}
      <div style={{ position:"relative", marginBottom:12 }}>
        <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:"#6B6878", fontSize:14 }}>🔍</span>
        <input className="sd-input" value={query} onChange={e=>setQuery(e.target.value)}
          placeholder={tab==="spotters" ? "Search spotters by name or handle…" : "Search make, model, location…"}
          style={{ paddingLeft:36 }} />
      </div>

      {/* Tab selector */}
      <div style={{ display:"flex", gap:8, marginBottom:14 }}>
        {[["spots","🏎 Spots"],["spotters","👥 Spotters"]].map(([key,label]) => (
          <button key={key} onClick={()=>{ setTab(key); setQuery(""); }}
            style={{ flex:1, padding:"9px", borderRadius:10, fontSize:13, fontWeight:700,
              background: tab===key ? "#2D1200" : "#18181F",
              border:`1px solid ${tab===key?"#E8430A":"#252530"}`,
              color: tab===key?"#E8430A":"#6B6878", cursor:"pointer" }}>
            {label}
          </button>
        ))}
      </div>

      {/* SPOTS tab */}
      {tab === "spots" && (
        <>
          <div style={{ display:"flex", gap:6, marginBottom:14, overflowX:"auto" }}>
            {["All","Hypercar","Exotic","Sports"].map(f => (
              <button key={f} onClick={()=>setFilter(f)}
                style={{ padding:"6px 14px", borderRadius:20, fontSize:12, fontWeight:600,
                  background:filter===f?"#2D1200":"#18181F", border:`1px solid ${filter===f?"#E8430A":"#252530"}`,
                  color:filter===f?"#E8430A":"#6B6878", whiteSpace:"nowrap", cursor:"pointer" }}>{f}</button>
            ))}
          </div>
          {filteredSpots.length===0
            ? <div style={{ textAlign:"center", padding:"60px 0" }}>
                <div style={{ fontSize:40, marginBottom:12 }}>🔍</div>
                <div style={{ fontSize:16, fontWeight:700, color:"#F2EEE8" }}>No spots found</div>
              </div>
            : <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                {filteredSpots.map(s => (
                  <div key={s.id} onClick={()=>onSpotTap(s)} style={{ borderRadius:12, overflow:"hidden", position:"relative", aspectRatio:"1", cursor:"pointer" }}>
                    <img src={s.image} alt="" loading="lazy" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                    <div style={{ position:"absolute", inset:0, background:"linear-gradient(to bottom, transparent 40%, rgba(0,0,0,.75))" }} />
                    <div style={{ position:"absolute", top:6, left:6 }}><RarityPill rarity={s.rarity} /></div>
                    <div style={{ position:"absolute", bottom:8, left:8, right:8 }}>
                      <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:14, fontWeight:800, color:"#fff", lineHeight:1.1 }}>{s.make} {s.model}</div>
                    </div>
                  </div>
                ))}
              </div>
          }
        </>
      )}

      {/* SPOTTERS tab */}
      {tab === "spotters" && (
        loadingSpotters ? (
          Array(4).fill(0).map((_,i) => (
            <div key={i} style={{ display:"flex", gap:12, padding:"12px 0", borderBottom:"1px solid #252530", alignItems:"center" }}>
              <div className="shimmer" style={{ width:48, height:48, borderRadius:"50%", flexShrink:0 }} />
              <div style={{ flex:1, display:"flex", flexDirection:"column", gap:6 }}>
                <div className="shimmer" style={{ height:13, width:"50%" }} />
                <div className="shimmer" style={{ height:11, width:"30%" }} />
              </div>
            </div>
          ))
        ) : filteredSpotters.length === 0 ? (
          <div style={{ textAlign:"center", padding:"60px 0" }}>
            <div style={{ fontSize:40, marginBottom:12 }}>👥</div>
            <div style={{ fontSize:15, color:"#6B6878" }}>No spotters found</div>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
            {filteredSpotters.map((spotter, i) => (
              <div key={spotter.id}
                style={{ display:"flex", alignItems:"center", gap:12, padding:"13px 0",
                  borderBottom:"1px solid #252530", cursor:"pointer" }}
                onClick={() => setViewProfile(spotter.handle)}>
                <Avatar initials={spotter.initials || spotter.handle?.slice(0,2).toUpperCase() || "SP"}
                  src={spotter.avatar_url} size={48} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <span style={{ fontSize:14, fontWeight:700, color:"#F2EEE8",
                      overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {spotter.display_name || spotter.handle}
                    </span>
                    {spotter.is_verified && <span style={{ fontSize:13 }}>✅</span>}
                  </div>
                  <div style={{ fontSize:12, color:"#6B6878" }}>@{spotter.handle}</div>
                  <div style={{ display:"flex", gap:10, marginTop:3 }}>
                    <span style={{ fontSize:11, color:"#6B6878" }}>
                      <span style={{ color:"#F2EEE8", fontWeight:700 }}>{fmt(spotter.followers_count||0)}</span> followers
                    </span>
                    <span style={{ fontSize:11, color:"#6B6878" }}>
                      <span style={{ color:"#F2EEE8", fontWeight:700 }}>{spotter.spots_count||0}</span> spots
                    </span>
                  </div>
                </div>
                <FollowButton targetUserId={spotter.id} targetHandle={spotter.handle} size="sm" />
              </div>
            ))}
          </div>
        )
      )}

      {/* Spotter profile sheet */}
      {viewProfile && (
        <SpotterProfileSheet handle={viewProfile} onClose={() => setViewProfile(null)} />
      )}
    </div>
  );
}

function ProfileScreen() {
  const { user, profile, fetchProfile } = useAuth();
  const [spots,          setSpots]          = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [showSettings,      setShowSettings]      = useState(false);
  const [showEdit,          setShowEdit]          = useState(false);
  const [showPrivacy,       setShowPrivacy]       = useState(false);
  const [showNotifSettings, setShowNotifSettings] = useState(false);
  const [uploadingPhoto,    setUploadingPhoto]    = useState(false);
  const [editingSpot,       setEditingSpot]       = useState(null);
  const avatarRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("spots").select("*").eq("user_id",user.id).eq("status","live")
      .order("created_at",{ascending:false})
      .then(({data}) => { setSpots(data||[]); setLoading(false); });
  }, [user]);

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingPhoto(true);
    try {
      const ext  = file.name.split(".").pop();
      const path = `avatars/${user.id}.${ext}`;
      await supabase.storage.from("spot-photos").upload(path, file, { contentType:file.type, upsert:true });
      const { data:{ publicUrl } } = supabase.storage.from("spot-photos").getPublicUrl(path);
      await supabase.from("profiles").update({ avatar_url:publicUrl }).eq("id",user.id);
      await fetchProfile(user.id);
    } catch(err) { console.error(err); }
    finally { setUploadingPhoto(false); }
  };

  return (
    <div>
      <input ref={avatarRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handlePhotoChange} />

      {showSettings && (
        <SettingsSheet
          onClose={() => setShowSettings(false)}
          onEditProfile={() => setShowEdit(true)}
          onChangePhoto={() => avatarRef.current?.click()}
          onPrivacy={() => setShowPrivacy(true)}
          onNotifications={() => setShowNotifSettings(true)}
        />
      )}

      {showEdit          && <EditProfileSheet          onClose={() => setShowEdit(false)} />}
      {showPrivacy       && <PrivacySheet              onClose={() => setShowPrivacy(false)} />}
      {showNotifSettings && <NotificationSettingsSheet onClose={() => setShowNotifSettings(false)} />}

      <div style={{ background:"linear-gradient(180deg,#2D1200 0%,#14141A 100%)", padding:"24px 16px 0" }}>
        <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:12 }}>
          <button onClick={() => setShowSettings(true)}
            style={{ width:40, height:40, borderRadius:10, background:"#18181F",
              border:"1px solid #252530", display:"flex", alignItems:"center",
              justifyContent:"center", fontSize:20, cursor:"pointer" }}>
            ⚙️
          </button>
        </div>

        <div style={{ display:"flex", gap:14, alignItems:"flex-end", marginBottom:16 }}>
          <div style={{ position:"relative", cursor:"pointer" }} onClick={() => avatarRef.current?.click()}>
            <Avatar initials={profile?.handle?.slice(0,2).toUpperCase()||"?"} src={profile?.avatar_url} size={72} ring />
            <div style={{ position:"absolute", bottom:0, right:0, width:22, height:22, borderRadius:"50%",
              background:"#E8430A", border:"2px solid #0A0A0C",
              display:"flex", alignItems:"center", justifyContent:"center", fontSize:11 }}>
              {uploadingPhoto ? <Spinner size={10} color="#fff" /> : "📷"}
            </div>
          </div>
          <div>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:22, fontWeight:900, color:"#F2EEE8" }}>
              {profile?.display_name||profile?.handle||"Spotter"}
            </div>
            <div style={{ fontSize:13, color:"#6B6878" }}>@{profile?.handle}</div>
            {profile?.bio && <div style={{ fontSize:12, color:"#AAA6A0", marginTop:4, maxWidth:260, lineHeight:1.4 }}>{profile.bio}</div>}
            <div style={{ marginTop:6, display:"inline-flex", alignItems:"center", gap:5,
              background:"#2D1200", border:"1px solid #E8430A", borderRadius:6,
              padding:"3px 10px", fontSize:11, color:"#E8430A", fontWeight:700 }}>
              🏎 Spotter
            </div>
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", borderTop:"1px solid #252530", paddingTop:14 }}>
          {[["Spots",spots.length],["Followers",profile?.followers_count||0],["Following",profile?.following_count||0]].map(([label,value]) => (
            <div key={label} style={{ textAlign:"center" }}>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:22, fontWeight:900, color:"#F2EEE8" }}>{value}</div>
              <div style={{ fontSize:10, color:"#6B6878", textTransform:"uppercase", letterSpacing:".05em" }}>{label}</div>
            </div>
          ))}
        </div>
        <div style={{ paddingTop:14, borderTop:"1px solid #252530", marginTop:14 }}>
          <div style={{ fontSize:12, fontWeight:700, color:"#6B6878", paddingBottom:12 }}>My Spots</div>
        </div>
      </div>

      {loading ? (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:2, padding:2 }}>
          {Array(6).fill(0).map((_,i) => <div key={i} className="shimmer" style={{ aspectRatio:"1" }} />)}
        </div>
      ) : spots.length===0 ? (
        <div style={{ textAlign:"center", padding:"60px 20px" }}>
          <div style={{ fontSize:40, marginBottom:10 }}>📸</div>
          <div style={{ fontSize:16, fontWeight:700, color:"#F2EEE8", marginBottom:6 }}>No spots yet</div>
          <div style={{ fontSize:13, color:"#6B6878" }}>Hit the + button to post your first spot.</div>
        </div>
      ) : (
        <>
          {editingSpot && (
            <EditSpotModal
              spot={editingSpot}
              onClose={() => setEditingSpot(null)}
              onDeleted={() => { setSpots(ss => ss.filter(s => s.id !== editingSpot.id)); setEditingSpot(null); }}
            />
          )}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:2, padding:2 }}>
            {spots.map(s => (
              <div key={s.id} style={{ aspectRatio:"1", overflow:"hidden", position:"relative",
                cursor:"pointer" }} onClick={() => setEditingSpot(s)}>
                {s.image_url
                  ? <img src={s.image_url} alt="" loading="lazy" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                  : <div style={{ width:"100%", height:"100%", background:"#2D1200", display:"flex", alignItems:"center", justifyContent:"center", fontSize:28 }}>🏎</div>
                }
                <div style={{ position:"absolute", inset:0, background:"linear-gradient(to bottom, transparent 60%, rgba(0,0,0,.7))" }} />
                <div style={{ position:"absolute", bottom:4, left:4, fontFamily:"'Barlow Condensed',sans-serif", fontSize:11, fontWeight:800, color:"#fff" }}>{s.make}</div>
                <div style={{ position:"absolute", top:4, right:4, background:"rgba(0,0,0,.5)",
                  borderRadius:5, padding:"2px 4px", fontSize:9, color:"rgba(255,255,255,.6)" }}>✏️</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────
// ─── NOTIFICATIONS SCREEN ────────────────────────────────────
function NotificationsScreen() {
  const { user, profile } = useAuth();
  const [notifs,   setNotifs]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState("all"); // all | unread | likes | follows

  useEffect(() => {
    if (!user) return;
    // Load from Supabase if table exists, otherwise use mock data
    const load = async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (data && data.length > 0) {
        setNotifs(data);
      } else {
        // Rich mock notifications
        setNotifs([
          { id:"n1", type:"like",    read:false, created_at: new Date(Date.now()-2*60000).toISOString(),
            actor_handle:"euro_spotter", actor_initials:"LM",
            text:"liked your Lamborghini Huracán STO spot", spot_make:"Lamborghini", spot_model:"Huracán STO" },
          { id:"n2", type:"follow",  read:false, created_at: new Date(Date.now()-15*60000).toISOString(),
            actor_handle:"jdm_tokyo", actor_initials:"KT",
            text:"started following you", spot_make:null },
          { id:"n3", type:"comment", read:false, created_at: new Date(Date.now()-45*60000).toISOString(),
            actor_handle:"gulf_spots", actor_initials:"OR",
            text:"commented on your spot: \"Absolute legend catch 🔥\"", spot_make:"Lamborghini", spot_model:"Huracán STO" },
          { id:"n4", type:"like",    read:true,  created_at: new Date(Date.now()-2*3600000).toISOString(),
            actor_handle:"la_spotter", actor_initials:"MW",
            text:"liked your Ferrari SF90 spot", spot_make:"Ferrari", spot_model:"SF90" },
          { id:"n5", type:"save",    read:true,  created_at: new Date(Date.now()-3*3600000).toISOString(),
            actor_handle:"apex_hunter", actor_initials:"AH",
            text:"saved your Bugatti Chiron spot", spot_make:"Bugatti", spot_model:"Chiron" },
          { id:"n6", type:"follow",  read:true,  created_at: new Date(Date.now()-5*3600000).toISOString(),
            actor_handle:"nring_nut", actor_initials:"HF",
            text:"started following you", spot_make:null },
          { id:"n7", type:"like",    read:true,  created_at: new Date(Date.now()-24*3600000).toISOString(),
            actor_handle:"euro_spotter", actor_initials:"LM",
            text:"liked your McLaren P1 spot", spot_make:"McLaren", spot_model:"P1" },
          { id:"n8", type:"comment", read:true,  created_at: new Date(Date.now()-2*24*3600000).toISOString(),
            actor_handle:"jdm_tokyo", actor_initials:"KT",
            text:"commented: \"Never seen one in person, incredible\"", spot_make:"Pagani", spot_model:"Huayra" },
        ]);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const timeAgo = (ts) => {
    const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
    if (m < 1)    return "just now";
    if (m < 60)   return `${m}m`;
    if (m < 1440) return `${Math.floor(m/60)}h`;
    return `${Math.floor(m/1440)}d`;
  };

  const markAllRead = () => setNotifs(ns => ns.map(n => ({ ...n, read:true })));
  const markRead    = (id) => setNotifs(ns => ns.map(n => n.id===id ? {...n, read:true} : n));

  const TYPE_CONFIG = {
    like:    { icon:"❤️", color:"#E8430A", label:"Likes"    },
    follow:  { icon:"👤", color:"#3B82F6", label:"Follows"  },
    comment: { icon:"💬", color:"#9B59B6", label:"Comments" },
    save:    { icon:"🔖", color:"#C9A84C", label:"Saves"    },
    mention: { icon:"@",  color:"#22C55E", label:"Mentions" },
  };

  const filtered = notifs.filter(n => {
    if (filter === "unread")   return !n.read;
    if (filter === "likes")    return n.type === "like";
    if (filter === "follows")  return n.type === "follow";
    if (filter === "comments") return n.type === "comment";
    return true;
  });

  const unreadCount = notifs.filter(n => !n.read).length;

  return (
    <div>
      {/* Header row */}
      <div style={{ padding:"16px 16px 12px", borderBottom:"1px solid #252530",
        display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:20, fontWeight:900, color:"#F2EEE8" }}>
            Notifications
          </div>
          {unreadCount > 0 && (
            <div style={{ background:"#E8430A", borderRadius:99, padding:"2px 8px",
              fontSize:11, fontWeight:700, color:"#fff" }}>
              {unreadCount}
            </div>
          )}
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead}
            style={{ fontSize:12, color:"#E8430A", fontWeight:700, background:"none", border:"none", cursor:"pointer" }}>
            Mark all read
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div style={{ display:"flex", gap:0, borderBottom:"1px solid #252530", overflowX:"auto" }}>
        {[
          { key:"all",      label:"All"      },
          { key:"unread",   label:"Unread"   },
          { key:"likes",    label:"Likes"    },
          { key:"follows",  label:"Follows"  },
          { key:"comments", label:"Comments" },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            style={{ padding:"10px 14px", fontSize:12, fontWeight:600, whiteSpace:"nowrap",
              background:"none", border:"none", cursor:"pointer",
              color: filter===f.key ? "#E8430A" : "#6B6878",
              borderBottom: filter===f.key ? "2px solid #E8430A" : "2px solid transparent" }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div style={{ padding:"8px 14px" }}>
        {loading ? (
          Array(5).fill(0).map((_,i) => (
            <div key={i} style={{ display:"flex", gap:10, padding:"12px 0",
              borderBottom:"1px solid #252530" }}>
              <div className="shimmer" style={{ width:44, height:44, borderRadius:"50%", flexShrink:0 }} />
              <div style={{ flex:1, display:"flex", flexDirection:"column", gap:6 }}>
                <div className="shimmer" style={{ height:12, width:"70%" }} />
                <div className="shimmer" style={{ height:11, width:"45%" }} />
              </div>
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:"center", padding:"60px 0" }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🔔</div>
            <div style={{ fontSize:16, fontWeight:700, color:"#F2EEE8", marginBottom:6 }}>
              {filter === "unread" ? "All caught up!" : "No notifications yet"}
            </div>
            <div style={{ fontSize:13, color:"#6B6878" }}>
              {filter === "unread" ? "You've read everything." : "Post a spot to start getting likes and follows."}
            </div>
          </div>
        ) : (
          filtered.map(n => {
            const tc = TYPE_CONFIG[n.type] || TYPE_CONFIG.like;
            return (
              <div key={n.id} onClick={() => markRead(n.id)}
                style={{ display:"flex", alignItems:"flex-start", gap:12,
                  padding:"13px 0", borderBottom:"1px solid #252530",
                  background: n.read ? "none" : "transparent",
                  cursor:"pointer", position:"relative" }}>
                {/* Unread dot */}
                {!n.read && (
                  <div style={{ position:"absolute", left:-8, top:"50%", transform:"translateY(-50%)",
                    width:6, height:6, borderRadius:"50%", background:"#E8430A" }} />
                )}
                {/* Avatar with type badge */}
                <div style={{ position:"relative", flexShrink:0 }}>
                  <Avatar initials={n.actor_initials || "?"} size={44} />
                  <div style={{ position:"absolute", bottom:-2, right:-2, width:20, height:20,
                    borderRadius:"50%", background:tc.color,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:10, border:"2px solid #0A0A0C" }}>
                    {tc.icon}
                  </div>
                </div>
                {/* Content */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, color:"#F2EEE8", lineHeight:1.45, marginBottom:3 }}>
                    <span style={{ fontWeight:700 }}>@{n.actor_handle}</span>
                    {" "}<span style={{ color: n.read ? "#AAA6A0" : "#F2EEE8" }}>{n.text}</span>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <span style={{ fontSize:11, color:"#6B6878" }}>{timeAgo(n.created_at)}</span>
                    {n.spot_make && (
                      <>
                        <span style={{ fontSize:11, color:"#3D3D4E" }}>·</span>
                        <span style={{ fontSize:11, color:tc.color }}>{n.spot_make} {n.spot_model}</span>
                      </>
                    )}
                  </div>
                </div>
                {/* Spot thumbnail placeholder */}
                {n.spot_make && (
                  <div style={{ width:44, height:44, borderRadius:8, flexShrink:0,
                    background:"linear-gradient(135deg,#2D1200,#1C1C24)",
                    display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>
                    🏎
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── SEARCH SCREEN ────────────────────────────────────────────
function SearchScreen() {
  const { user } = useAuth();
  const [query,        setQuery]        = useState("");
  const [results,      setResults]      = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [searched,     setSearched]     = useState(false);
  const [viewProfile,  setViewProfile]  = useState(null);
  const [recentSearches, setRecentSearches] = useState(
    ["jdm_tokyo", "euro_spotter", "apex_hunter"]
  );
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  const TRENDING = [
    { handle:"jdm_tokyo",    display_name:"Kenji Tanaka",   followers_count:91000, initials:"KT", badge:"🏆" },
    { handle:"euro_spotter", display_name:"Lena Müller",    followers_count:54200, initials:"LM", badge:"⭐" },
    { handle:"gulf_spots",   display_name:"Omar Al-Rashid", followers_count:38700, initials:"OR", badge:"🔥" },
    { handle:"apex_hunter",  display_name:"Tyler Rhodes",   followers_count:18400, initials:"AH", badge:"" },
    { handle:"la_spotter",   display_name:"Marcus Webb",    followers_count:12100, initials:"MW", badge:"" },
    { handle:"nring_nut",    display_name:"Hans Fischer",   followers_count:8300,  initials:"HF", badge:"" },
  ];

  const search = async (q) => {
    if (!q.trim()) { setResults([]); setSearched(false); return; }
    setLoading(true); setSearched(true);
    try {
      const clean = q.trim().toLowerCase().replace(/^@/, "");
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .or(`handle.ilike.%${clean}%,display_name.ilike.%${clean}%`)
        .limit(20);

      if (data && data.length > 0) {
        setResults(data.map(p => ({
          ...p,
          initials: (p.handle || "SP").slice(0,2).toUpperCase(),
        })));
      } else {
        // Fall back to mock filtered data
        const mock = [
          { id:"m1", handle:"jdm_tokyo",    display_name:"Kenji Tanaka",   followers_count:91000, spots_count:1204, initials:"KT" },
          { id:"m2", handle:"euro_spotter", display_name:"Lena Müller",    followers_count:54200, spots_count:889,  initials:"LM" },
          { id:"m3", handle:"gulf_spots",   display_name:"Omar Al-Rashid", followers_count:38700, spots_count:567,  initials:"OR" },
          { id:"m4", handle:"apex_hunter",  display_name:"Tyler Rhodes",   followers_count:18400, spots_count:412,  initials:"AH" },
          { id:"m5", handle:"la_spotter",   display_name:"Marcus Webb",    followers_count:12100, spots_count:203,  initials:"MW" },
          { id:"m6", handle:"nring_nut",    display_name:"Hans Fischer",   followers_count:8300,  spots_count:145,  initials:"HF" },
        ];
        setResults(mock.filter(p =>
          p.handle.includes(clean) || p.display_name.toLowerCase().includes(clean)
        ));
      }
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleChange = (val) => {
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 300);
  };

  const handleSelect = (handle) => {
    setViewProfile(handle);
    setRecentSearches(r => [handle, ...r.filter(x => x !== handle)].slice(0, 5));
  };

  const clearSearch = () => { setQuery(""); setResults([]); setSearched(false); inputRef.current?.focus(); };

  // Focus input on mount
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 100); }, []);

  const SpotterRow = ({ spotter, badge }) => (
    <div onClick={() => handleSelect(spotter.handle)}
      style={{ display:"flex", alignItems:"center", gap:12,
        padding:"12px 16px", cursor:"pointer", borderBottom:"1px solid #252530" }}
      className="row-hover">
      <Avatar initials={spotter.initials || spotter.handle?.slice(0,2).toUpperCase() || "SP"}
        src={spotter.avatar_url} size={46} />
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <span style={{ fontSize:14, fontWeight:700, color:"#F2EEE8",
            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
            {spotter.display_name || spotter.handle}
          </span>
          {badge && <span style={{ fontSize:13 }}>{badge}</span>}
        </div>
        <div style={{ fontSize:12, color:"#6B6878" }}>@{spotter.handle}</div>
        <div style={{ display:"flex", gap:10, marginTop:2 }}>
          <span style={{ fontSize:11, color:"#6B6878" }}>
            <span style={{ color:"#F2EEE8", fontWeight:600 }}>{fmt(spotter.followers_count||0)}</span> followers
          </span>
          {spotter.spots_count > 0 && (
            <span style={{ fontSize:11, color:"#6B6878" }}>
              <span style={{ color:"#F2EEE8", fontWeight:600 }}>{spotter.spots_count}</span> spots
            </span>
          )}
        </div>
      </div>
      <FollowButton targetUserId={spotter.id} targetHandle={spotter.handle} size="sm" />
    </div>
  );

  return (
    <div>
      {/* Search bar */}
      <div style={{ padding:"12px 14px", borderBottom:"1px solid #252530",
        position:"sticky", top:0, background:"#0A0A0C", zIndex:10 }}>
        <div style={{ position:"relative" }}>
          <span style={{ position:"absolute", left:13, top:"50%",
            transform:"translateY(-50%)", fontSize:16, color:"#6B6878" }}>🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => handleChange(e.target.value)}
            placeholder="Search by name or @handle…"
            style={{ width:"100%", background:"#18181F", border:"1.5px solid #252530",
              borderRadius:14, padding:"11px 40px 11px 40px", color:"#F2EEE8",
              fontSize:14, outline:"none", transition:"border-color .15s",
              ...(query ? { borderColor:"#E8430A", boxShadow:"0 0 0 3px #2D1200" } : {}) }} />
          {query && (
            <button onClick={clearSearch}
              style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)",
                background:"#252530", border:"none", borderRadius:"50%",
                width:22, height:22, display:"flex", alignItems:"center",
                justifyContent:"center", color:"#AAA6A0", fontSize:13,
                cursor:"pointer", lineHeight:1 }}>×</button>
          )}
        </div>
      </div>

      {/* Results */}
      {query && (
        <div>
          {loading ? (
            Array(4).fill(0).map((_,i) => (
              <div key={i} style={{ display:"flex", gap:12, padding:"12px 16px",
                borderBottom:"1px solid #252530", alignItems:"center" }}>
                <div className="shimmer" style={{ width:46, height:46, borderRadius:"50%", flexShrink:0 }} />
                <div style={{ flex:1, display:"flex", flexDirection:"column", gap:6 }}>
                  <div className="shimmer" style={{ height:13, width:"45%" }} />
                  <div className="shimmer" style={{ height:11, width:"28%" }} />
                  <div className="shimmer" style={{ height:10, width:"35%" }} />
                </div>
              </div>
            ))
          ) : results.length === 0 ? (
            <div style={{ textAlign:"center", padding:"60px 20px" }}>
              <div style={{ fontSize:40, marginBottom:12 }}>🔍</div>
              <div style={{ fontSize:16, fontWeight:700, color:"#F2EEE8", marginBottom:6 }}>
                No spotters found
              </div>
              <div style={{ fontSize:13, color:"#6B6878" }}>
                Try searching by name or @handle
              </div>
            </div>
          ) : (
            <div>
              <div style={{ padding:"10px 16px 6px", fontSize:11, fontWeight:700,
                color:"#6B6878", textTransform:"uppercase", letterSpacing:".06em" }}>
                {results.length} result{results.length !== 1 ? "s" : ""}
              </div>
              {results.map(s => <SpotterRow key={s.id || s.handle} spotter={s} />)}
            </div>
          )}
        </div>
      )}

      {/* Empty state — recent + trending */}
      {!query && (
        <div>
          {/* Recent searches */}
          {recentSearches.length > 0 && (
            <div style={{ marginBottom:8 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                padding:"14px 16px 8px" }}>
                <div style={{ fontSize:13, fontWeight:700, color:"#F2EEE8" }}>Recent</div>
                <button onClick={() => setRecentSearches([])}
                  style={{ fontSize:12, color:"#E8430A", fontWeight:600,
                    background:"none", border:"none", cursor:"pointer" }}>
                  Clear all
                </button>
              </div>
              {recentSearches.map(h => (
                <div key={h} onClick={() => { setQuery(`@${h}`); search(h); }}
                  style={{ display:"flex", alignItems:"center", gap:12,
                    padding:"10px 16px", cursor:"pointer", borderBottom:"1px solid #252530" }}>
                  <div style={{ width:34, height:34, borderRadius:"50%", background:"#18181F",
                    border:"1px solid #252530", display:"flex", alignItems:"center",
                    justifyContent:"center", fontSize:16, flexShrink:0 }}>🕐</div>
                  <span style={{ fontSize:14, color:"#AAA6A0", flex:1 }}>@{h}</span>
                  <button onClick={e => { e.stopPropagation(); setRecentSearches(r => r.filter(x => x !== h)); }}
                    style={{ background:"none", border:"none", color:"#6B6878",
                      fontSize:18, cursor:"pointer", lineHeight:1 }}>×</button>
                </div>
              ))}
            </div>
          )}

          {/* Trending spotters */}
          <div>
            <div style={{ padding:"14px 16px 8px", display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:14 }}>🔥</span>
              <div style={{ fontSize:13, fontWeight:700, color:"#F2EEE8" }}>Top Spotters</div>
            </div>
            {TRENDING.map((s, i) => (
              <div key={s.handle} onClick={() => handleSelect(s.handle)}
                style={{ display:"flex", alignItems:"center", gap:12,
                  padding:"11px 16px", cursor:"pointer", borderBottom:"1px solid #252530" }}>
                {/* Rank */}
                <div style={{ width:22, textAlign:"center", flexShrink:0,
                  fontFamily:"'Barlow Condensed',sans-serif", fontSize:15, fontWeight:900,
                  color: i===0?"#C9A84C":i===1?"#AAA6A0":i===2?"#CD7F32":"#3D3D4E" }}>
                  {i+1}
                </div>
                <Avatar initials={s.initials} size={44} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                    <span style={{ fontSize:14, fontWeight:700, color:"#F2EEE8" }}>
                      {s.display_name}
                    </span>
                    {s.badge && <span style={{ fontSize:12 }}>{s.badge}</span>}
                  </div>
                  <div style={{ fontSize:12, color:"#6B6878" }}>
                    @{s.handle} · <span style={{ color:"#F2EEE8", fontWeight:600 }}>{fmt(s.followers_count)}</span> followers
                  </div>
                </div>
                <span style={{ fontSize:18, color:"#3D3D4E" }}>›</span>
              </div>
            ))}
          </div>

          {/* Search tips */}
          <div style={{ margin:"20px 16px", padding:"14px 16px",
            background:"#14141A", border:"1px solid #252530", borderRadius:12 }}>
            <div style={{ fontSize:12, fontWeight:700, color:"#6B6878",
              textTransform:"uppercase", letterSpacing:".06em", marginBottom:10 }}>
              Search Tips
            </div>
            {[
              { icon:"@",   tip:'Type @handle to find a specific spotter' },
              { icon:"🔤",  tip:'Search by first or last name' },
              { icon:"🏎",  tip:'Car makes and models coming soon' },
              { icon:"📍",  tip:'Location search coming soon' },
            ].map(({ icon, tip }) => (
              <div key={tip} style={{ display:"flex", gap:10, alignItems:"center",
                padding:"6px 0", borderBottom:"1px solid #252530" }}>
                <span style={{ fontSize:14, width:20, textAlign:"center" }}>{icon}</span>
                <span style={{ fontSize:12, color:"#6B6878" }}>{tip}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Spotter profile sheet */}
      {viewProfile && (
        <SpotterProfileSheet handle={viewProfile} onClose={() => setViewProfile(null)} />
      )}
    </div>
  );
}

function MainApp() {
  const [screen,      setScreen]      = useState("feed");
  const [showNotifs,  setShowNotifs]  = useState(false);
  const [unreadCount, setUnreadCount] = useState(3);
  const [spotDetail,  setSpotDetail]  = useState(null);
  const [showUpload,  setShowUpload]  = useState(false);

  const NAV = [
    { key:"feed",        label:"Feed",        icon:"🏠" },
    { key:"explore",     label:"Explore",     icon:"🧭" },
    { key:"upload",      label:"",            icon:null  },
    { key:"leaderboard", label:"Ranks",       icon:"🏆"  },
    { key:"profile",     label:"Profile",     icon:"👤"  },
  ];

  return (
    <div style={{ maxWidth:430, margin:"0 auto", minHeight:"100vh", background:"#0A0A0C", display:"flex", flexDirection:"column" }}>
      <header style={{ position:"sticky", top:0, zIndex:100, background:"rgba(10,10,12,.9)",
        backdropFilter:"blur(14px)", borderBottom:"1px solid #252530",
        padding:"12px 16px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:9 }}>
          <div style={{ width:32, height:32, borderRadius:9, background:"linear-gradient(135deg,#E8430A,#BF360C)",
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>🏎</div>
          <div>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:19, fontWeight:900, color:"#F2EEE8", lineHeight:1, letterSpacing:"-.02em" }}>SpotDrive</div>
            <div style={{ fontSize:9, color:"#E8430A", fontWeight:700, letterSpacing:".1em" }}>BETA</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          {/* Bell icon with unread badge */}
          <button onClick={() => { setShowNotifs(true); setUnreadCount(0); }}
            style={{ position:"relative", background:"none", border:"none",
              width:36, height:36, display:"flex", alignItems:"center",
              justifyContent:"center", cursor:"pointer", borderRadius:"50%" }}>
            <span style={{ fontSize:20 }}>🔔</span>
            {unreadCount > 0 && (
              <div style={{ position:"absolute", top:0, right:0, width:16, height:16,
                borderRadius:"50%", background:"#E8430A", border:"2px solid #0A0A0C",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:8, fontWeight:800, color:"#fff" }}>
                {unreadCount > 9 ? "9+" : unreadCount}
              </div>
            )}
          </button>
          <div style={{ fontSize:10, color:"#22C55E", fontWeight:700, display:"flex", alignItems:"center", gap:4 }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:"#22C55E" }} />
            LIVE
          </div>
        </div>
      </header>

      <main style={{ flex:1, overflowY:"auto", paddingBottom:80 }}>
        {screen==="feed"        && <FeedScreen    onSpotTap={setSpotDetail} />}
        {screen==="explore"     && <ExploreScreen onSpotTap={setSpotDetail} />}
        {screen==="leaderboard" && <LeaderboardScreen />}
        {screen==="profile"     && <ProfileScreen />}
      </main>

      <nav style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)",
        width:"100%", maxWidth:430, background:"rgba(20,20,26,.95)",
        backdropFilter:"blur(16px)", borderTop:"1px solid #252530",
        display:"flex", justifyContent:"space-around", alignItems:"center",
        padding:"8px 0 max(8px,env(safe-area-inset-bottom))", zIndex:90 }}>
        {NAV.map(({ key, label, icon }) => {
          if (key==="upload") return (
            <button key="upload" onClick={() => setShowUpload(true)}
              style={{ width:50, height:50, borderRadius:"50%", border:"none",
                background:"linear-gradient(135deg,#E8430A,#BF360C)",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:22, boxShadow:"0 4px 16px rgba(232,67,10,.5)", transform:"translateY(-6px)", cursor:"pointer" }}>
              ＋
            </button>
          );
          return (
            <button key={key} onClick={() => setScreen(key)} className={`nav-item${screen===key?" active":""}`}>
              <span style={{ fontSize:22 }}>{icon}</span>
              <span>{label}</span>
              {screen===key && <div style={{ width:4, height:4, borderRadius:"50%", background:"#E8430A", marginTop:2 }} />}
            </button>
          );
        })}
      </nav>

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} />}

      {/* Notifications panel */}
      {showNotifs && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.8)", zIndex:500,
          backdropFilter:"blur(6px)", display:"flex", alignItems:"flex-end", justifyContent:"center" }}
          onClick={e => { if (e.target===e.currentTarget) setShowNotifs(false); }}>
          <div style={{ background:"#0A0A0C", width:"100%", maxWidth:430,
            height:"88vh", borderRadius:"20px 20px 0 0",
            border:"1px solid #252530", display:"flex", flexDirection:"column",
            animation:"slideUp .25s ease" }}>
            {/* Sheet header */}
            <div style={{ padding:"14px 16px 0", flexShrink:0 }}>
              <div style={{ width:36, height:4, borderRadius:2, background:"#252530", margin:"0 auto 14px" }} />
            </div>
            <div style={{ flex:1, overflowY:"auto" }}>
              <NotificationsScreen />
            </div>
            <div style={{ padding:"12px 16px", borderTop:"1px solid #252530", flexShrink:0 }}>
              <button onClick={() => setShowNotifs(false)}
                style={{ width:"100%", padding:12, borderRadius:12, border:"1px solid #252530",
                  background:"none", color:"#6B6878", fontSize:14, fontWeight:600, cursor:"pointer" }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {spotDetail && (
        <CommentsSheet spot={spotDetail} onClose={() => setSpotDetail(null)} />
      )}
    </div>
  );
}

// ─── COMMENT ROW ─────────────────────────────────────────────
function CommentRow({ comment: c, user, profile, timeAgo, onReply }) {
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(c.likes_count || 0);

  const handleLike = () => {
    const next = !liked;
    setLiked(next);
    setLikes(n => next ? n+1 : n-1);
    if (!c.optimistic) {
      supabase.from("comments")
        .update({ likes_count: next ? likes+1 : likes-1 })
        .eq("id", c.id).catch(console.error);
    }
  };

  return (
    <div style={{ display:"flex", gap:10, padding:"10px 16px",
      opacity: c.optimistic ? 0.6 : 1, transition:"opacity .3s" }}>
      <Avatar initials={c.initials} src={c.avatar_url} size={34} />
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"baseline", gap:6, marginBottom:3 }}>
          <span style={{ fontSize:13, fontWeight:700, color:"#F2EEE8" }}>@{c.handle}</span>
          <span style={{ fontSize:10, color:"#6B6878" }}>{timeAgo(c.created_at)}</span>
          {c.optimistic && <span style={{ fontSize:10, color:"#6B6878" }}>sending…</span>}
        </div>
        <div style={{ fontSize:13, color:"#AAA6A0", lineHeight:1.5 }}>{c.text}</div>
        <div style={{ display:"flex", alignItems:"center", gap:14, marginTop:6 }}>
          <button onClick={handleLike}
            style={{ display:"flex", alignItems:"center", gap:4, background:"none",
              border:"none", cursor:"pointer", color: liked ? "#E8430A" : "#6B6878",
              fontSize:12, fontWeight:600, transition:"color .15s" }}>
            {liked ? "❤️" : "🤍"}{likes > 0 ? ` ${likes}` : ""}
          </button>
          {user && profile?.handle !== c.handle && (
            <button onClick={() => onReply(c.handle)}
              style={{ background:"none", border:"none", cursor:"pointer",
                color:"#6B6878", fontSize:11, fontWeight:600 }}>
              Reply
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── COMMENTS SHEET ───────────────────────────────────────────
function CommentsSheet({ spot, onClose }) {
  const { user, profile } = useAuth();
  const [comments,  setComments]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [text,      setText]      = useState("");
  const [posting,   setPosting]   = useState(false);
  const [liked,     setLiked]     = useState(spot.liked || false);
  const [likes,     setLikes]     = useState(spot.likes || 0);
  const [saved,     setSaved]     = useState(spot.saved || false);
  const [showShare, setShowShare] = useState(false);
  const [imgErr,    setImgErr]    = useState(false);
  const inputRef  = useRef(null);
  const bottomRef = useRef(null);

  const timeAgo = (ts) => {
    const m = Math.floor((Date.now()-new Date(ts).getTime())/60000);
    if (m<1) return "just now"; if (m<60) return `${m}m`;
    if (m<1440) return `${Math.floor(m/60)}h`; return `${Math.floor(m/1440)}d`;
  };

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("comments")
        .select("*, profiles(handle, avatar_url)")
        .eq("spot_id", spot.id)
        .order("created_at", { ascending: true })
        .limit(100);

      if (data && data.length > 0) {
        setComments(data.map(c => ({
          ...c,
          handle:     c.profiles?.handle || "spotter",
          avatar_url: c.profiles?.avatar_url,
          initials:   (c.profiles?.handle || "SP").slice(0,2).toUpperCase(),
        })));
      } else {
        // Mock comments for demo spots
        setComments([
          { id:"c1", text:"Absolute beast in person 🔥", handle:"euro_spotter", initials:"LM", created_at: new Date(Date.now()-30*60000).toISOString(), likes_count:12 },
          { id:"c2", text:"Verde Mantis is the best colour they make. No debate.", handle:"jdm_tokyo",    initials:"KT", created_at: new Date(Date.now()-20*60000).toISOString(), likes_count:8 },
          { id:"c3", text:"Track spec too? That cage in the back is unmistakable", handle:"apex_hunter",  initials:"AH", created_at: new Date(Date.now()-10*60000).toISOString(), likes_count:5 },
          { id:"c4", text:"Was this on Rodeo last Saturday? I think I saw this!", handle:"la_spotter",    initials:"MW", created_at: new Date(Date.now()-5*60000).toISOString(),  likes_count:3 },
        ]);
      }
      setLoading(false);
    };
    load();
  }, [spot.id]);

  // Scroll to bottom when comments load
  useEffect(() => {
    if (!loading) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior:"smooth" }), 100);
  }, [loading]);

  const postComment = async () => {
    if (!text.trim() || posting || !user) return;
    setPosting(true);
    const optimistic = {
      id: `temp-${Date.now()}`,
      text: text.trim(),
      handle: profile?.handle || "you",
      avatar_url: profile?.avatar_url,
      initials: (profile?.handle || "YO").slice(0,2).toUpperCase(),
      created_at: new Date().toISOString(),
      likes_count: 0,
      optimistic: true,
    };
    setComments(cs => [...cs, optimistic]);
    setText("");
    bottomRef.current?.scrollIntoView({ behavior:"smooth" });

    try {
      const { data, error } = await supabase.from("comments").insert({
        spot_id:    spot.id,
        user_id:    user.id,
        text:       optimistic.text,
      }).select("*, profiles(handle, avatar_url)").single();

      if (error) throw error;

      // Replace optimistic with real
      setComments(cs => cs.map(c => c.id === optimistic.id ? {
        ...data,
        handle:     data.profiles?.handle || profile?.handle || "spotter",
        avatar_url: data.profiles?.avatar_url || profile?.avatar_url,
        initials:   (data.profiles?.handle || profile?.handle || "SP").slice(0,2).toUpperCase(),
      } : c));

      // Update comment count on spot
      await supabase.from("spots")
        .update({ comments_count: (spot.comments || 0) + 1 })
        .eq("id", spot.id);

    } catch(err) {
      // Remove optimistic on failure
      setComments(cs => cs.filter(c => c.id !== optimistic.id));
      setText(optimistic.text);
      console.error(err);
    } finally {
      setPosting(false);
    }
  };

  const handleLike = () => {
    const next = !liked;
    setLiked(next); setLikes(n => next ? n+1 : n-1);
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.88)", zIndex:500,
      backdropFilter:"blur(8px)", display:"flex", alignItems:"flex-end", justifyContent:"center" }}
      onClick={e => { if (e.target===e.currentTarget) onClose(); }}>
      <div style={{ background:"#0A0A0C", width:"100%", maxWidth:480,
        height:"92vh", borderRadius:"20px 20px 0 0", border:"1px solid #252530",
        display:"flex", flexDirection:"column", animation:"slideUp .25s ease" }}>

        {/* Drag handle */}
        <div style={{ padding:"12px 16px 0", flexShrink:0 }}>
          <div style={{ width:36, height:4, borderRadius:2, background:"#252530", margin:"0 auto 12px" }} />
        </div>

        {/* Scrollable content */}
        <div style={{ flex:1, overflowY:"auto" }}>

          {/* Spot summary */}
          <div style={{ padding:"0 16px 14px", borderBottom:"1px solid #252530" }}>
            <div style={{ display:"flex", gap:12, alignItems:"center" }}>
              <div style={{ width:64, height:64, borderRadius:10, overflow:"hidden", flexShrink:0 }}>
                {spot.image && !imgErr
                  ? <img src={spot.image} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}
                      onError={() => setImgErr(true)} />
                  : <div style={{ width:"100%", height:"100%", background:"#2D1200",
                      display:"flex", alignItems:"center", justifyContent:"center", fontSize:24 }}>🏎</div>
                }
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:20,
                  fontWeight:900, color:"#F2EEE8", lineHeight:1, marginBottom:4 }}>
                  {spot.make} {spot.model}
                </div>
                <div style={{ display:"flex", gap:6, alignItems:"center", marginBottom:4 }}>
                  <RarityPill rarity={spot.rarity} />
                  <span style={{ fontSize:11, color:"#6B6878" }}>{spot.year}</span>
                </div>
                <div style={{ fontSize:11, color:"#6B6878" }}>📍 {spot.location}</div>
              </div>
            </div>

            {/* Action bar */}
            <div style={{ display:"flex", gap:16, marginTop:12, paddingTop:12,
              borderTop:"1px solid #252530" }}>
              <button onClick={handleLike}
                style={{ display:"flex", alignItems:"center", gap:5, color:liked?"#E8430A":"#6B6878",
                  fontSize:13, fontWeight:600, border:"none", background:"none", cursor:"pointer" }}>
                {liked?"❤️":"🤍"} {fmt(likes)}
              </button>
              <button onClick={() => inputRef.current?.focus()}
                style={{ display:"flex", alignItems:"center", gap:5, color:"#E8430A",
                  fontSize:13, fontWeight:600, border:"none", background:"none", cursor:"pointer" }}>
                💬 {comments.length}
              </button>
              <button onClick={() => setSaved(s => !s)}
                style={{ display:"flex", alignItems:"center", gap:5,
                  color:saved?"#C9A84C":"#6B6878",
                  fontSize:13, fontWeight:600, border:"none", background:"none", cursor:"pointer" }}>
                {saved?"🔖":"📎"} {fmt(spot.saves)}
              </button>
              <button onClick={() => setShowShare(true)}
                style={{ marginLeft:"auto", color:"#6B6878", border:"none",
                  background:"none", fontSize:14, cursor:"pointer" }}>
                ↗
              </button>
            </div>
            {showShare && <ShareSheet spot={spot} onClose={() => setShowShare(false)} />}

            {/* Description */}
            {spot.description && (
              <p style={{ fontSize:13, color:"#AAA6A0", lineHeight:1.6, marginTop:10 }}>
                <span style={{ color:"#F2EEE8", fontWeight:700 }}>@{spot.user?.handle} </span>
                {spot.description}
              </p>
            )}
          </div>

          {/* Comments header */}
          <div style={{ padding:"12px 16px 6px" }}>
            <div style={{ fontSize:12, fontWeight:700, color:"#6B6878",
              textTransform:"uppercase", letterSpacing:".06em" }}>
              {loading ? "Loading…" : `${comments.length} comment${comments.length!==1?"s":""}`}
            </div>
          </div>

          {/* Comments list */}
          {loading ? (
            Array(3).fill(0).map((_,i) => (
              <div key={i} style={{ display:"flex", gap:10, padding:"10px 16px" }}>
                <div className="shimmer" style={{ width:34, height:34, borderRadius:"50%", flexShrink:0 }} />
                <div style={{ flex:1, display:"flex", flexDirection:"column", gap:5 }}>
                  <div className="shimmer" style={{ height:11, width:"30%" }} />
                  <div className="shimmer" style={{ height:13, width:"75%" }} />
                </div>
              </div>
            ))
          ) : comments.length === 0 ? (
            <div style={{ textAlign:"center", padding:"32px 20px" }}>
              <div style={{ fontSize:32, marginBottom:8 }}>💬</div>
              <div style={{ fontSize:14, fontWeight:700, color:"#F2EEE8", marginBottom:4 }}>No comments yet</div>
              <div style={{ fontSize:12, color:"#6B6878" }}>Be the first to comment on this spot.</div>
            </div>
          ) : (
          comments.map(c => (
              <CommentRow key={c.id} comment={c} user={user}
                profile={profile} timeAgo={timeAgo}
                onReply={(handle) => { setText(`@${handle} `); inputRef.current?.focus(); }} />
            ))
          )}
          <div ref={bottomRef} style={{ height:8 }} />
        </div>

        {/* Comment input */}
        <div style={{ flexShrink:0, padding:"10px 14px",
          borderTop:"1px solid #252530", background:"#0A0A0C",
          paddingBottom:"max(10px,env(safe-area-inset-bottom))" }}>
          <div style={{ display:"flex", gap:10, alignItems:"flex-end" }}>
            <Avatar initials={profile?.handle?.slice(0,2).toUpperCase()||"ME"}
              src={profile?.avatar_url} size={34} />
            <div style={{ flex:1, background:"#14141A", border:"1.5px solid #252530",
              borderRadius:22, padding:"8px 14px", display:"flex", alignItems:"center", gap:8,
              transition:"border-color .15s",
              ...(text ? { borderColor:"#E8430A", boxShadow:"0 0 0 3px #2D1200" } : {}) }}>
              <input
                ref={inputRef}
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key==="Enter" && !e.shiftKey) { e.preventDefault(); postComment(); } }}
                placeholder="Add a comment…"
                style={{ flex:1, background:"none", border:"none", color:"#F2EEE8",
                  fontSize:14, outline:"none", minWidth:0 }} />
              {text.trim() && (
                <button onClick={postComment} disabled={posting}
                  style={{ background:"none", border:"none", color:"#E8430A",
                    fontWeight:700, fontSize:13, cursor:"pointer", flexShrink:0,
                    display:"flex", alignItems:"center", gap:4 }}>
                  {posting ? <Spinner size={14} color="#E8430A" /> : "Post"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────
// ─── LEADERBOARD SCREEN ───────────────────────────────────────
function LeaderboardScreen() {
  const { user } = useAuth();
  const [tab,     setTab]     = useState("global"); // global | city | hypercar | exotic | sports
  const [spotters,setSpotters]= useState([]);
  const [loading, setLoading] = useState(true);
  const [viewProfile, setViewProfile] = useState(null);

  const MOCK_LEADERS = {
    global: [
      { rank:1,  handle:"jdm_tokyo",    display_name:"Kenji Tanaka",   spots:1204, followers:91000,  score:48200, streak:23, badge:"🏆", initials:"KT" },
      { rank:2,  handle:"euro_spotter", display_name:"Lena Müller",    spots:889,  followers:54200,  score:41800, streak:15, badge:"🥈", initials:"LM" },
      { rank:3,  handle:"gulf_spots",   display_name:"Omar Al-Rashid", spots:567,  followers:38700,  score:36100, streak:8,  badge:"🥉", initials:"OR" },
      { rank:4,  handle:"apex_hunter",  display_name:"Tyler Rhodes",   spots:412,  followers:18400,  score:28400, streak:12, badge:"",   initials:"AH" },
      { rank:5,  handle:"la_spotter",   display_name:"Marcus Webb",    spots:203,  followers:12100,  score:19200, streak:5,  badge:"",   initials:"MW" },
      { rank:6,  handle:"nring_nut",    display_name:"Hans Fischer",   spots:145,  followers:8300,   score:12800, streak:3,  badge:"",   initials:"HF" },
    ],
    city: [
      { rank:1,  handle:"jdm_tokyo",    display_name:"Kenji Tanaka",   city:"Tokyo",        spots:412, score:18200, badge:"🏆", initials:"KT" },
      { rank:2,  handle:"gulf_spots",   display_name:"Omar Al-Rashid", city:"Dubai",        spots:287, score:14100, badge:"🥈", initials:"OR" },
      { rank:3,  handle:"euro_spotter", display_name:"Lena Müller",    city:"Monaco",       spots:234, score:12800, badge:"🥉", initials:"LM" },
      { rank:4,  handle:"apex_hunter",  display_name:"Tyler Rhodes",   city:"Beverly Hills",spots:198, score:10200, badge:"",   initials:"AH" },
      { rank:5,  handle:"la_spotter",   display_name:"Marcus Webb",    city:"Los Angeles",  spots:167, score:8900,  badge:"",   initials:"MW" },
    ],
    hypercar: [
      { rank:1,  handle:"euro_spotter", display_name:"Lena Müller",    spots:234, score:46800, badge:"🏆", initials:"LM", rarity:"Hypercar" },
      { rank:2,  handle:"jdm_tokyo",    display_name:"Kenji Tanaka",   spots:198, score:39600, badge:"🥈", initials:"KT", rarity:"Hypercar" },
      { rank:3,  handle:"gulf_spots",   display_name:"Omar Al-Rashid", spots:156, score:31200, badge:"🥉", initials:"OR", rarity:"Hypercar" },
    ],
    exotic: [
      { rank:1,  handle:"apex_hunter",  display_name:"Tyler Rhodes",   spots:312, score:28100, badge:"🏆", initials:"AH", rarity:"Exotic" },
      { rank:2,  handle:"gulf_spots",   display_name:"Omar Al-Rashid", spots:289, score:26000, badge:"🥈", initials:"OR", rarity:"Exotic" },
      { rank:3,  handle:"la_spotter",   display_name:"Marcus Webb",    spots:201, score:18100, badge:"🥉", initials:"MW", rarity:"Exotic" },
    ],
    sports: [
      { rank:1,  handle:"nring_nut",    display_name:"Hans Fischer",   spots:445, score:22300, badge:"🏆", initials:"HF", rarity:"Sports" },
      { rank:2,  handle:"jdm_tokyo",    display_name:"Kenji Tanaka",   spots:389, score:19500, badge:"🥈", initials:"KT", rarity:"Sports" },
      { rank:3,  handle:"apex_hunter",  display_name:"Tyler Rhodes",   spots:301, score:15100, badge:"🥉", initials:"AH", rarity:"Sports" },
    ],
  };

  useEffect(() => {
    setLoading(true);
    const load = async () => {
      // Try Supabase first
      const { data } = await supabase.from("profiles")
        .select("*").order("followers_count", { ascending:false }).limit(10);
      if (data && data.length > 0) {
        setSpotters(data.map((p, i) => ({
          rank: i+1, handle:p.handle, display_name:p.display_name||p.handle,
          spots:p.spots_count||0, followers:p.followers_count||0,
          score: (p.followers_count||0)*2 + (p.spots_count||0)*10,
          badge: i===0?"🏆":i===1?"🥈":i===2?"🥉":"",
          initials:(p.handle||"SP").slice(0,2).toUpperCase(),
          streak:0,
        })));
      } else {
        setSpotters(MOCK_LEADERS[tab] || MOCK_LEADERS.global);
      }
      setLoading(false);
    };
    load();
  }, [tab]);

  const leaders = spotters.length > 0 ? spotters : (MOCK_LEADERS[tab] || []);

  const TABS = [
    { key:"global",   label:"🌍 Global"   },
    { key:"city",     label:"🏙️ City"     },
    { key:"hypercar", label:"👑 Hypercar" },
    { key:"exotic",   label:"🔥 Exotic"   },
    { key:"sports",   label:"🏁 Sports"   },
  ];

  const RC = { Hypercar:"#b388ff", Exotic:"#E8430A", Sports:"#60a5fa" };

  return (
    <div>
      {/* Header */}
      <div style={{ padding:"16px 16px 12px", borderBottom:"1px solid #252530" }}>
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:22,
          fontWeight:900, color:"#F2EEE8", marginBottom:4 }}>
          🏆 Leaderboard
        </div>
        <div style={{ fontSize:12, color:"#6B6878" }}>
          Resets every Monday · Based on spots, likes & followers
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display:"flex", overflowX:"auto", borderBottom:"1px solid #252530",
        scrollbarWidth:"none" }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding:"10px 14px", fontSize:12, fontWeight:700,
              whiteSpace:"nowrap", background:"none", border:"none", cursor:"pointer",
              color: tab===t.key ? "#E8430A" : "#6B6878",
              borderBottom: tab===t.key ? "2px solid #E8430A" : "2px solid transparent" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Top 3 podium */}
      {!loading && leaders.length >= 3 && (
        <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"center",
          gap:12, padding:"24px 16px 16px",
          background:"linear-gradient(180deg,#1C0800 0%,#0A0A0C 100%)" }}>
          {/* 2nd */}
          <div style={{ flex:1, textAlign:"center" }}>
            <Avatar initials={leaders[1].initials} src={leaders[1].avatar_url} size={52} />
            <div style={{ height:60, background:"#AAA6A030",
              border:"1px solid #AAA6A040", borderRadius:"8px 8px 0 0",
              marginTop:8, display:"flex", alignItems:"center",
              justifyContent:"center", fontSize:20 }}>🥈</div>
            <div style={{ fontSize:11, fontWeight:700, color:"#F2EEE8",
              marginTop:4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {leaders[1].display_name?.split(" ")[0]}
            </div>
            <div style={{ fontSize:10, color:"#AAA6A0" }}>{leaders[1].score?.toLocaleString()} pts</div>
          </div>
          {/* 1st */}
          <div style={{ flex:1, textAlign:"center" }}>
            <div style={{ position:"relative", display:"inline-block" }}>
              <Avatar initials={leaders[0].initials} src={leaders[0].avatar_url} size={64} ring />
              <div style={{ position:"absolute", top:-10, left:"50%",
                transform:"translateX(-50%)", fontSize:22 }}>👑</div>
            </div>
            <div style={{ height:80, background:"#C9A84C20",
              border:"1px solid #C9A84C50", borderRadius:"8px 8px 0 0",
              marginTop:8, display:"flex", alignItems:"center",
              justifyContent:"center", fontSize:24 }}>🏆</div>
            <div style={{ fontSize:12, fontWeight:800, color:"#C9A84C",
              marginTop:4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {leaders[0].display_name?.split(" ")[0]}
            </div>
            <div style={{ fontSize:11, color:"#C9A84C" }}>{leaders[0].score?.toLocaleString()} pts</div>
          </div>
          {/* 3rd */}
          <div style={{ flex:1, textAlign:"center" }}>
            <Avatar initials={leaders[2].initials} src={leaders[2].avatar_url} size={44} />
            <div style={{ height:44, background:"#CD7F3220",
              border:"1px solid #CD7F3240", borderRadius:"8px 8px 0 0",
              marginTop:8, display:"flex", alignItems:"center",
              justifyContent:"center", fontSize:18 }}>🥉</div>
            <div style={{ fontSize:11, fontWeight:700, color:"#F2EEE8",
              marginTop:4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {leaders[2].display_name?.split(" ")[0]}
            </div>
            <div style={{ fontSize:10, color:"#CD7F32" }}>{leaders[2].score?.toLocaleString()} pts</div>
          </div>
        </div>
      )}

      {/* Full list */}
      <div style={{ padding:"0 14px 80px" }}>
        {loading ? (
          Array(5).fill(0).map((_,i) => (
            <div key={i} style={{ display:"flex", gap:12, padding:"12px 0",
              borderBottom:"1px solid #252530", alignItems:"center" }}>
              <div className="shimmer" style={{ width:36, height:36, borderRadius:"50%" }} />
              <div style={{ flex:1, display:"flex", flexDirection:"column", gap:6 }}>
                <div className="shimmer" style={{ height:12, width:"45%" }} />
                <div className="shimmer" style={{ height:10, width:"30%" }} />
              </div>
            </div>
          ))
        ) : leaders.map((s, i) => (
          <div key={s.handle} onClick={() => setViewProfile(s.handle)}
            style={{ display:"flex", alignItems:"center", gap:12,
              padding:"12px 0", borderBottom:"1px solid #252530", cursor:"pointer" }}>
            <div style={{ width:28, textAlign:"center", flexShrink:0,
              fontFamily:"'Barlow Condensed',sans-serif", fontSize:16, fontWeight:900,
              color: i===0?"#C9A84C":i===1?"#AAA6A0":i===2?"#CD7F32":"#3D3D4E" }}>
              {s.badge || s.rank}
            </div>
            <Avatar initials={s.initials} src={s.avatar_url} size={44} />
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:14, fontWeight:700, color:"#F2EEE8",
                overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {s.display_name}
              </div>
              <div style={{ fontSize:11, color:"#6B6878" }}>
                @{s.handle}
                {s.streak > 0 && <span style={{ color:"#E8430A", marginLeft:8 }}>🔥 {s.streak} day streak</span>}
                {s.city && <span style={{ marginLeft:8 }}>📍 {s.city}</span>}
              </div>
            </div>
            <div style={{ textAlign:"right", flexShrink:0 }}>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:16,
                fontWeight:900, color: i===0?"#C9A84C":i===1?"#AAA6A0":i===2?"#CD7F32":"#F2EEE8" }}>
                {s.score?.toLocaleString()}
              </div>
              <div style={{ fontSize:10, color:"#6B6878" }}>pts · {s.spots} spots</div>
            </div>
          </div>
        ))}
      </div>

      {viewProfile && <SpotterProfileSheet handle={viewProfile} onClose={() => setViewProfile(null)} />}
    </div>
  );
}

// ─── SHARE SHEET ──────────────────────────────────────────────
function ShareSheet({ spot, onClose }) {
  const [copied, setCopied] = useState(false);
  const shareUrl = `https://spot-drive.vercel.app/?spot=${spot.id}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const el = document.createElement("input");
      el.value = shareUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${spot.make} ${spot.model} spotted on SpotDrive`,
          text: `Check out this ${spot.rarity} spotted in ${spot.location || "the wild"}! 🏎`,
          url: shareUrl,
        });
      } catch(e) { if (e.name !== "AbortError") copyLink(); }
    } else { copyLink(); }
  };

  const SHARE_OPTIONS = [
    { icon:"📋", label:"Copy Link",      action: copyLink,  color:"#F2EEE8" },
    { icon:"📱", label:"Share via App",  action: shareNative, color:"#22C55E" },
    { icon:"💬", label:"Share to WhatsApp", action: () => window.open(`https://wa.me/?text=${encodeURIComponent(`🏎 ${spot.make} ${spot.model} spotted! ${shareUrl}`)}`), color:"#25D366" },
    { icon:"🐦", label:"Share to X",     action: () => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Just spotted a ${spot.rarity} ${spot.make} ${spot.model} on @SpotDrive 🏎🔥`)}&url=${encodeURIComponent(shareUrl)}`), color:"#1DA1F2" },
  ];

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.8)", zIndex:900,
      backdropFilter:"blur(8px)", display:"flex", alignItems:"flex-end", justifyContent:"center" }}
      onClick={e => { if (e.target===e.currentTarget) onClose(); }}>
      <div style={{ background:"#14141A", width:"100%", maxWidth:430,
        borderRadius:"20px 20px 0 0", padding:"20px 20px 40px",
        border:"1px solid #252530", animation:"slideUp .25s ease" }}>
        <div style={{ width:36, height:4, borderRadius:2, background:"#252530",
          margin:"0 auto 20px" }} />
        <div style={{ fontSize:16, fontWeight:800, color:"#F2EEE8", marginBottom:16 }}>Share this spot</div>

        {/* Spot preview */}
        <div style={{ display:"flex", gap:12, padding:"12px 14px",
          background:"#18181F", border:"1px solid #252530", borderRadius:12, marginBottom:20 }}>
          <div style={{ width:56, height:56, borderRadius:10, overflow:"hidden", flexShrink:0 }}>
            {spot.image
              ? <img src={spot.image} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
              : <div style={{ width:"100%", height:"100%", background:"#2D1200",
                  display:"flex", alignItems:"center", justifyContent:"center", fontSize:24 }}>🏎</div>
            }
          </div>
          <div>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:16,
              fontWeight:900, color:"#F2EEE8" }}>{spot.make} {spot.model}</div>
            <div style={{ fontSize:12, color:"#6B6878" }}>📍 {spot.location || "Unknown location"}</div>
            <div style={{ fontSize:11, color:"#6B6878", marginTop:2, fontFamily:"monospace",
              background:"#252530", borderRadius:4, padding:"2px 6px", display:"inline-block",
              overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:180 }}>
              {shareUrl}
            </div>
          </div>
        </div>

        {/* Share options */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          {SHARE_OPTIONS.map(({ icon, label, action, color }) => (
            <button key={label} onClick={action}
              style={{ padding:"14px 12px", background:"#18181F",
                border:`1px solid ${color}30`, borderRadius:12,
                display:"flex", flexDirection:"column", alignItems:"center", gap:6,
                cursor:"pointer", transition:"all .15s" }}>
              <span style={{ fontSize:24 }}>{icon}</span>
              <span style={{ fontSize:12, fontWeight:600,
                color: label === "Copy Link" && copied ? "#22C55E" : "#F2EEE8" }}>
                {label === "Copy Link" && copied ? "Copied! ✓" : label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── EDIT SPOT MODAL ──────────────────────────────────────────
function EditSpotModal({ spot, onClose, onDeleted }) {
  const { user } = useAuth();
  const [form,    setForm]    = useState({
    make:     spot.make     || "",
    model:    spot.model    || "",
    location: spot.location_name || spot.location || "",
    desc:     spot.description   || spot.desc     || "",
    rarity:   spot.rarity   || "Exotic",
  });
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirm,  setConfirm]  = useState(false);
  const [error,    setError]    = useState("");
  const [saved,    setSaved]    = useState(false);

  const save = async () => {
    setSaving(true); setError("");
    try {
      const { error:err } = await supabase.from("spots")
        .update({ make:form.make, model:form.model,
          location_name:form.location, description:form.desc, rarity:form.rarity })
        .eq("id", spot.id).eq("user_id", user.id);
      if (err) throw err;
      setSaved(true);
      setTimeout(onClose, 1200);
    } catch(e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const del = async () => {
    setDeleting(true);
    try {
      const { error:err } = await supabase.from("spots")
        .delete().eq("id", spot.id).eq("user_id", user.id);
      if (err) throw err;
      onDeleted?.();
      onClose();
    } catch(e) { setError(e.message); setDeleting(false); }
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.85)", zIndex:900,
      backdropFilter:"blur(8px)", display:"flex", alignItems:"flex-end", justifyContent:"center" }}
      onClick={e => { if (e.target===e.currentTarget) onClose(); }}>
      <div style={{ background:"#14141A", width:"100%", maxWidth:430,
        borderRadius:"20px 20px 0 0", maxHeight:"88vh", overflowY:"auto",
        border:"1px solid #252530", animation:"slideUp .25s ease" }}>
        <div style={{ padding:"16px 18px 12px", borderBottom:"1px solid #252530",
          display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <span style={{ fontSize:16, fontWeight:800, color:"#F2EEE8" }}>Edit Spot</span>
          <button onClick={onClose} style={{ color:"#6B6878", fontSize:20, background:"none", border:"none" }}>×</button>
        </div>
        <div style={{ padding:18, display:"flex", flexDirection:"column", gap:14 }}>
          {/* Preview */}
          {(spot.image_url || spot.image) && (
            <img src={spot.image_url || spot.image} alt=""
              style={{ width:"100%", height:160, objectFit:"cover", borderRadius:12 }} />
          )}
          {[
            { key:"make",     label:"Make",     ph:spot.make     },
            { key:"model",    label:"Model",    ph:spot.model    },
            { key:"location", label:"Location", ph:spot.location },
          ].map(({ key, label, ph }) => (
            <div key={key}>
              <label style={{ fontSize:11, color:"#6B6878", fontWeight:600,
                textTransform:"uppercase", letterSpacing:".05em", display:"block", marginBottom:5 }}>
                {label}
              </label>
              <input className="sd-input" value={form[key]} placeholder={ph}
                onChange={e => setForm(p => ({ ...p, [key]:e.target.value }))} />
            </div>
          ))}
          <div>
            <label style={{ fontSize:11, color:"#6B6878", fontWeight:600,
              textTransform:"uppercase", letterSpacing:".05em", display:"block", marginBottom:5 }}>
              Rarity
            </label>
            <div style={{ display:"flex", gap:8 }}>
              {["Sports","Exotic","Hypercar"].map(r => {
                const rc = RARITY[r]; const active = form.rarity===r;
                return (
                  <button key={r} onClick={() => setForm(p=>({...p,rarity:r}))}
                    style={{ flex:1, padding:"8px", borderRadius:9, fontSize:12, fontWeight:700,
                      background:active?rc.bg:"#0A0A0C", border:`1px solid ${active?rc.border:"#252530"}`,
                      color:active?rc.text:"#6B6878", cursor:"pointer" }}>{r}</button>
                );
              })}
            </div>
          </div>
          <div>
            <label style={{ fontSize:11, color:"#6B6878", fontWeight:600,
              textTransform:"uppercase", letterSpacing:".05em", display:"block", marginBottom:5 }}>
              Description
            </label>
            <textarea className="sd-input" rows={3} value={form.desc}
              placeholder="Tell the story…"
              onChange={e => setForm(p=>({...p,desc:e.target.value}))}
              style={{ resize:"none", lineHeight:1.55 }} />
          </div>
          <ErrorMsg msg={error} />
          {saved && <div style={{ color:"#22C55E", fontSize:13, textAlign:"center" }}>✓ Saved!</div>}

          <button onClick={save} disabled={saving}
            style={{ width:"100%", padding:13, borderRadius:12,
              background:"linear-gradient(135deg,#E8430A,#BF360C)",
              border:"none", color:"#fff", fontSize:15, fontWeight:700,
              cursor:saving?"not-allowed":"pointer", display:"flex",
              alignItems:"center", justifyContent:"center", gap:8 }}>
            {saving ? <><Spinner size={16} color="#fff"/> Saving…</> : "Save Changes"}
          </button>

          {/* Delete */}
          {!confirm ? (
            <button onClick={() => setConfirm(true)}
              style={{ width:"100%", padding:12, borderRadius:12,
                background:"rgba(239,68,68,.1)", border:"1px solid rgba(239,68,68,.3)",
                color:"#EF4444", fontSize:14, fontWeight:700, cursor:"pointer" }}>
              🗑️ Delete Spot
            </button>
          ) : (
            <div style={{ background:"rgba(239,68,68,.1)", border:"1px solid rgba(239,68,68,.3)",
              borderRadius:12, padding:14 }}>
              <div style={{ fontSize:13, color:"#EF4444", fontWeight:700,
                marginBottom:10, textAlign:"center" }}>
                Delete this spot permanently?
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={() => setConfirm(false)}
                  style={{ flex:1, padding:10, borderRadius:10, background:"#252530",
                    border:"none", color:"#F2EEE8", fontSize:13, fontWeight:600, cursor:"pointer" }}>
                  Cancel
                </button>
                <button onClick={del} disabled={deleting}
                  style={{ flex:1, padding:10, borderRadius:10,
                    background:"#EF4444", border:"none", color:"#fff",
                    fontSize:13, fontWeight:700, cursor:"pointer",
                    display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                  {deleting ? <Spinner size={12} color="#fff" /> : "Yes, Delete"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ONBOARDING FLOW ──────────────────────────────────────────
const ONBOARDING_KEY = "sd_onboarded_v1";

function OnboardingFlow({ onDone }) {
  const [slide, setSlide] = useState(0);

  const SLIDES = [
    {
      emoji:"🏎",
      title:"Welcome to SpotDrive",
      sub:"The world's first social network built for car spotters.",
      detail:"Capture rare cars in the wild. Share your sightings. Build your reputation.",
      color:"#E8430A",
      bg:"linear-gradient(135deg,#2D1200,#0A0A0C)",
    },
    {
      emoji:"📸",
      title:"Spot. Post. Get Clout.",
      sub:"Every rare car you spot earns you points and followers.",
      detail:"Hypercars score the highest. Sports cars are your gateway in. The leaderboard resets every Monday.",
      color:"#b388ff",
      bg:"linear-gradient(135deg,#12071A,#0A0A0C)",
    },
    {
      emoji:"🏆",
      title:"Climb the Leaderboard",
      sub:"The top spotters get verified badges and featured in the feed.",
      detail:"Compete by city, globally, or by rarity tier. Your streak rewards daily posting.",
      color:"#C9A84C",
      bg:"linear-gradient(135deg,#160F00,#0A0A0C)",
    },
  ];

  const s = SLIDES[slide];

  const finish = () => {
    localStorage.setItem(ONBOARDING_KEY, "1");
    onDone();
  };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:1000,
      background:s.bg, display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center", padding:32,
      transition:"background .4s ease" }}>

      {/* Progress dots */}
      <div style={{ position:"absolute", top:48, display:"flex", gap:8 }}>
        {SLIDES.map((_, i) => (
          <div key={i} style={{ width: i===slide ? 24 : 8, height:8, borderRadius:99,
            background: i===slide ? s.color : "#252530",
            transition:"all .3s ease" }} />
        ))}
      </div>

      {/* Content */}
      <div style={{ textAlign:"center", maxWidth:320 }} key={slide} className="fade-up">
        <div style={{ fontSize:80, marginBottom:24,
          filter:`drop-shadow(0 0 30px ${s.color}60)` }}>{s.emoji}</div>
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:36,
          fontWeight:900, color:"#F2EEE8", lineHeight:1.1, marginBottom:12 }}>
          {s.title}
        </div>
        <div style={{ fontSize:16, color:s.color, fontWeight:600, marginBottom:12 }}>
          {s.sub}
        </div>
        <div style={{ fontSize:14, color:"#6B6878", lineHeight:1.6 }}>
          {s.detail}
        </div>
      </div>

      {/* Buttons */}
      <div style={{ position:"absolute", bottom:48, left:32, right:32 }}>
        {slide < SLIDES.length - 1 ? (
          <div style={{ display:"flex", gap:12 }}>
            <button onClick={finish}
              style={{ flex:1, padding:14, borderRadius:12, background:"none",
                border:"1px solid #252530", color:"#6B6878", fontSize:14,
                fontWeight:600, cursor:"pointer" }}>
              Skip
            </button>
            <button onClick={() => setSlide(s => s + 1)}
              style={{ flex:2, padding:14, borderRadius:12,
                background:`linear-gradient(135deg,${s.color},${s.color}AA)`,
                border:"none", color:"#fff", fontSize:15, fontWeight:700, cursor:"pointer" }}>
              Next →
            </button>
          </div>
        ) : (
          <button onClick={finish}
            style={{ width:"100%", padding:16, borderRadius:14,
              background:`linear-gradient(135deg,${s.color},${s.color}AA)`,
              border:"none", color:"#fff", fontSize:16, fontWeight:800, cursor:"pointer" }}>
            Start Spotting 🏎
          </button>
        )}
      </div>
    </div>
  );
}

// ─── PUSH NOTIFICATIONS SETUP ─────────────────────────────────
function usePushNotifications() {
  const { user } = useAuth();
  const [permission, setPermission] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );

  const request = useCallback(async () => {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted" && user) {
      // Save push token to Supabase (Web Push would use service worker in prod)
      // For now we register the intent
      await supabase.from("profiles")
        .update({ push_enabled: true })
        .eq("id", user.id)
        .catch(() => {});
    }
    return result;
  }, [user]);

  const send = useCallback((title, body, icon = "🏎") => {
    if (permission !== "granted") return;
    try {
      new Notification(title, { body, icon:"/favicon.ico", badge:"/favicon.ico",
        tag:"spotdrive", renotify:true });
    } catch(e) { console.log("Notification:", title, body); }
  }, [permission]);

  return { permission, request, send };
}

function PushNotificationBanner({ onDismiss }) {
  const { request } = usePushNotifications();
  const [requesting, setRequesting] = useState(false);
  const [done, setDone] = useState(false);

  const handle = async () => {
    setRequesting(true);
    const result = await request();
    setRequesting(false);
    setDone(true);
    setTimeout(onDismiss, 1500);
  };

  return (
    <div style={{ margin:"10px 14px 0", padding:"12px 14px",
      background:"linear-gradient(135deg,#2D1200,#14141A)",
      border:"1px solid #E8430A30", borderRadius:12,
      display:"flex", alignItems:"center", gap:12 }}>
      <span style={{ fontSize:22, flexShrink:0 }}>🔔</span>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:13, fontWeight:700, color:"#F2EEE8", marginBottom:2 }}>
          {done ? "Notifications enabled! ✓" : "Enable notifications"}
        </div>
        <div style={{ fontSize:11, color:"#6B6878" }}>
          {done ? "You'll be notified for likes, follows & comments."
                : "Get alerted when someone likes or follows you."}
        </div>
      </div>
      {!done && (
        <div style={{ display:"flex", gap:6, flexShrink:0 }}>
          <button onClick={onDismiss}
            style={{ padding:"5px 10px", borderRadius:8, background:"none",
              border:"1px solid #252530", color:"#6B6878", fontSize:11,
              fontWeight:600, cursor:"pointer" }}>
            Later
          </button>
          <button onClick={handle} disabled={requesting}
            style={{ padding:"5px 12px", borderRadius:8,
              background:"#E8430A", border:"none",
              color:"#fff", fontSize:11, fontWeight:700, cursor:"pointer" }}>
            {requesting ? "…" : "Enable"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── ERROR BOUNDARY ───────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError:false, error:null }; }
  static getDerivedStateFromError(e) { return { hasError:true, error:e }; }
  componentDidCatch(e, info) { console.error("SpotDrive crash:", e, info); }
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{ minHeight:"100vh", background:"#0A0A0C", display:"flex",
        alignItems:"center", justifyContent:"center", flexDirection:"column",
        gap:16, padding:24, textAlign:"center" }}>
        <div style={{ fontSize:48 }}>⚠️</div>
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:24,
          fontWeight:900, color:"#F2EEE8" }}>Something went wrong</div>
        <div style={{ fontSize:13, color:"#6B6878", maxWidth:280, lineHeight:1.6 }}>
          {this.state.error?.message || "An unexpected error occurred."}
        </div>
        <button onClick={() => window.location.reload()}
          style={{ padding:"12px 24px", borderRadius:12,
            background:"linear-gradient(135deg,#E8430A,#BF360C)",
            border:"none", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer" }}>
          Reload App
        </button>
      </div>
    );
  }
}

function AppContent() {
  const { user, loading } = useAuth();
  const [timedOut,  setTimedOut]  = useState(false);
  const [onboarded, setOnboarded] = useState(() =>
    typeof localStorage !== "undefined" && !!localStorage.getItem(ONBOARDING_KEY)
  );

  // 10-second auth timeout
  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => setTimedOut(true), 10000);
    return () => clearTimeout(t);
  }, [loading]);

  if (timedOut && loading) return (
    <div style={{ minHeight:"100vh", background:"#0A0A0C", display:"flex",
      alignItems:"center", justifyContent:"center", flexDirection:"column",
      gap:16, padding:24, textAlign:"center" }}>
      <div style={{ fontSize:48 }}>🌐</div>
      <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:22,
        fontWeight:900, color:"#F2EEE8" }}>Connection slow</div>
      <div style={{ fontSize:13, color:"#6B6878" }}>Check your connection and try again.</div>
      <button onClick={() => window.location.reload()}
        style={{ padding:"12px 24px", borderRadius:12,
          background:"linear-gradient(135deg,#E8430A,#BF360C)",
          border:"none", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer" }}>
        Retry
      </button>
    </div>
  );

  if (loading) return (
    <div style={{ minHeight:"100vh", background:"#0A0A0C", display:"flex",
      alignItems:"center", justifyContent:"center", flexDirection:"column", gap:16 }}>
      <div style={{ width:56, height:56, borderRadius:14,
        background:"linear-gradient(135deg,#E8430A,#BF360C)",
        display:"flex", alignItems:"center", justifyContent:"center", fontSize:28 }}>🏎</div>
      <Spinner size={24} />
      <div style={{ fontSize:12, color:"#6B6878" }}>Loading SpotDrive…</div>
    </div>
  );

  if (!user)      return <AuthScreen />;
  if (!onboarded) return <OnboardingFlow onDone={() => setOnboarded(true)} />;
  return <MainApp />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}

