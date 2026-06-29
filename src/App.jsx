import { useState, useEffect, useCallback, useRef, memo, createContext, useContext } from "react";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── SUPABASE ─────────────────────────────────────────────────
const SUPABASE_URL  = "https://lhahofbryglxdxffxjbr.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoYWhvZmJyeWdseGR4ZmZ4amJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3MzA5ODgsImV4cCI6MjA5ODMwNjk4OH0.5rmKCnWqROlefWII7QpHsbY8xUMJytL6CoJ8LYsaUGQ";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

// ─── TOKENS ───────────────────────────────────────────────────
const T = {
  bg:"#0A0A0C", surface:"#14141A", surfaceHi:"#1C1C24", card:"#18181F",
  border:"#252530", borderHi:"#323240",
  accent:"#E8430A", accentDk:"#BF360C", accentDm:"#2D1200",
  gold:"#C9A84C", goldDm:"#1E1600",
  green:"#22C55E", greenDm:"#0A1F0F",
  blue:"#3B82F6", danger:"#EF4444",
  text:"#F2EEE8", sub:"#AAA6A0", muted:"#6B6878", faint:"#3D3D4E",
};

// ─── CSS ──────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&family=Inter:wght@400;500;600;700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:${T.bg};font-family:'Inter',sans-serif;color:${T.text};-webkit-font-smoothing:antialiased}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:${T.bg}}
::-webkit-scrollbar-thumb{background:${T.border};border-radius:2px}
button{cursor:pointer;font-family:inherit}
input,textarea{font-family:inherit}
:focus-visible{outline:2px solid ${T.accent};outline-offset:2px;border-radius:4px}

@keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes shimmer{from{background-position:-600px 0}to{background-position:600px 0}}
@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
@keyframes glow{0%,100%{box-shadow:0 0 0 0 ${T.accent}40}50%{box-shadow:0 0 20px 6px ${T.accent}25}}
@keyframes heartPop{0%{transform:scale(1)}50%{transform:scale(1.45)}100%{transform:scale(1)}}

.fade-up{animation:fadeUp .35s ease both}
.spin{animation:spin .7s linear infinite}
.shimmer{background:linear-gradient(90deg,${T.surface} 25%,${T.surfaceHi} 50%,${T.surface} 75%);background-size:600px 100%;animation:shimmer 1.4s ease-in-out infinite}
.heart-pop{animation:heartPop .3s ease}
.glow{animation:glow 3s ease-in-out infinite}

.spot-card{background:${T.card};border:1px solid ${T.border};border-radius:16px;overflow:hidden;transition:transform .2s,box-shadow .2s}
.spot-card:hover{transform:translateY(-2px);box-shadow:0 8px 32px rgba(232,67,10,.15)}

.nav-item{display:flex;flex-direction:column;align-items:center;gap:3px;padding:8px 12px;color:${T.muted};font-size:10px;font-weight:600;transition:color .15s;border:none;background:none;cursor:pointer}
.nav-item.active{color:${T.accent}}

.story-ring{border-radius:50%;padding:2px;background:linear-gradient(135deg,${T.accent},${T.gold})}

.sd-input{width:100%;background:${T.card};border:1.5px solid ${T.border};border-radius:12px;padding:13px 14px;color:${T.text};font-size:14px;transition:border-color .15s,box-shadow .15s;outline:none}
.sd-input:focus{border-color:${T.accent};box-shadow:0 0 0 3px ${T.accentDm}}
.sd-input::placeholder{color:${T.faint}}
.sd-input.error{border-color:${T.danger};box-shadow:0 0 0 3px rgba(239,68,68,.15)}

.sd-btn{display:flex;align-items:center;justify-content:center;gap:8px;border:none;border-radius:12px;padding:13px 20px;font-size:15px;font-weight:700;cursor:pointer;transition:all .15s;width:100%}
.sd-btn-primary{background:linear-gradient(135deg,${T.accent},${T.accentDk});color:#fff}
.sd-btn-primary:hover{filter:brightness(1.1)}
.sd-btn-primary:active{transform:scale(.98)}
.sd-btn-primary:disabled{opacity:.5;cursor:not-allowed}
.sd-btn-ghost{background:none;border:1.5px solid ${T.border};color:${T.sub}}
.sd-btn-ghost:hover{border-color:${T.accent};color:${T.accent}}

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
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    setProfile(data);
    return data;
  }, []);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) await fetchProfile(session.user.id);
      else setProfile(null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signUp = useCallback(async ({ email, password, handle, displayName }) => {
    // Check handle is unique
    const { data: existing } = await supabase
      .from("profiles")
      .select("handle")
      .eq("handle", handle)
      .single();
    if (existing) throw new Error("That handle is already taken.");

    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { handle, display_name: displayName } }
    });
    if (error) throw error;

    // Create profile row
    if (data.user) {
      const { error: profileError } = await supabase.from("profiles").insert({
        id:           data.user.id,
        handle:       handle.toLowerCase().replace(/\s/g, "_"),
        display_name: displayName,
        avatar_url:   null,
        bio:          "",
      });
      if (profileError) throw profileError;
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
    setUser(null);
    setProfile(null);
  }, []);

  const resetPassword = useCallback(async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (error) throw error;
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, signUp, signIn, signOut, resetPassword, fetchProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

const useAuth = () => useContext(AuthContext);

// ─── MOCK SPOT DATA ───────────────────────────────────────────
const MOCK_SPOTS = [
  { id:"s1", userId:"apex_hunter", make:"Lamborghini", model:"Huracán STO", year:2023, rarity:"Exotic",
    color:"Verde Mantis", location:"Rodeo Drive, Beverly Hills",
    image:"https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=900&q=85",
    likes:2841, comments:94, saves:312, time:"12m ago",
    tags:["Lamborghini","STO","TrackSpecial"], liked:false, saved:false,
    description:"Caught this STO parked outside Gucci. Verde Mantis in person is something else.",
    user:{ handle:"apex_hunter", initials:"AH", verified:true } },
  { id:"s2", userId:"euro_spotter", make:"Ferrari", model:"SF90 Stradale", year:2022, rarity:"Hypercar",
    color:"Rosso Corsa", location:"Monaco, Monte Carlo",
    image:"https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=900&q=85",
    likes:5102, comments:218, saves:891, time:"1h ago",
    tags:["Ferrari","SF90","Hybrid"], liked:true, saved:false,
    description:"SF90 rolling out of Casino Square. The hybrid whine at low speed is unlike anything.",
    user:{ handle:"euro_spotter", initials:"LM", verified:false } },
  { id:"s3", userId:"jdm_tokyo", make:"Bugatti", model:"Chiron Super Sport", year:2023, rarity:"Hypercar",
    color:"Atlantic Blue", location:"Shibuya, Tokyo",
    image:"https://images.unsplash.com/photo-1525609004556-c46c7d6cf023?w=900&q=85",
    likes:9441, comments:507, saves:2103, time:"3h ago",
    tags:["Bugatti","Chiron","1500HP"], liked:false, saved:true,
    description:"Never thought I'd see a Chiron SS in Shibuya. The W16 sound was insane.",
    user:{ handle:"jdm_tokyo", initials:"KT", verified:true } },
];

const RARITY = {
  Hypercar: { bg:"#1a0a2e", text:"#b388ff", border:"#6a0dad" },
  Exotic:   { bg:T.accentDm, text:T.accent, border:T.accent },
  Sports:   { bg:"#0a1a2e", text:"#60a5fa", border:"#60a5fa" },
};

const fmt = (n) => { const v = Number(n)||0; return v >= 1000 ? `${(v/1000).toFixed(1)}k` : String(v); };

// ─── ATOMS ────────────────────────────────────────────────────
const Avatar = memo(({ initials, src, size=36, ring=false }) => {
  const [err, setErr] = useState(false);
  const fs = Math.round(size * 0.36);
  return (
    <div style={{ width:size, height:size, borderRadius:"50%", flexShrink:0, overflow:"hidden",
      background:`linear-gradient(135deg,${T.accent},#7c1a02)`,
      display:"flex", alignItems:"center", justifyContent:"center",
      fontSize:fs, fontWeight:700, color:"#fff",
      boxShadow: ring ? `0 0 0 2px ${T.bg},0 0 0 4px ${T.accent}` : "none" }}>
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

const Spinner = ({ size=18, color=T.accent }) => (
  <div className="spin" style={{ width:size, height:size, border:`2px solid ${color}30`,
    borderTopColor:color, borderRadius:"50%" }} />
);

const ErrorMsg = ({ msg }) => msg ? (
  <div style={{ background:"rgba(239,68,68,.12)", border:"1px solid rgba(239,68,68,.3)",
    borderRadius:8, padding:"8px 12px", fontSize:12, color:T.danger, marginTop:4 }}>
    {msg}
  </div>
) : null;

// ─── AUTH SCREENS ─────────────────────────────────────────────
function AuthScreen() {
  const [view, setView] = useState("login"); // login | signup | forgot

  return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex",
      alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ width:"100%", maxWidth:400 }} className="fade-up">
        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div className="glow" style={{ width:64, height:64, borderRadius:16, margin:"0 auto 14px",
            background:`linear-gradient(135deg,${T.accent},${T.accentDk})`,
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:32 }}>🏎</div>
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:32, fontWeight:900,
            color:T.text, letterSpacing:"-.02em" }}>SpotDrive</div>
          <div style={{ fontSize:13, color:T.muted, marginTop:4 }}>
            {view === "login"  ? "Sign in to your account"     :
             view === "signup" ? "Create your spotter account" :
             "Reset your password"}
          </div>
        </div>

        {view === "login"  && <LoginForm  onSwitch={setView} />}
        {view === "signup" && <SignupForm onSwitch={setView} />}
        {view === "forgot" && <ForgotForm onSwitch={setView} />}
      </div>
    </div>
  );
}

function LoginForm({ onSwitch }) {
  const { signIn } = useAuth();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  const handle = async (e) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      await signIn({ email, password });
    } catch (err) {
      setError(err.message === "Invalid login credentials"
        ? "Email or password is incorrect."
        : err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background:T.surface, border:`1px solid ${T.border}`,
      borderRadius:20, padding:28 }}>
      <form onSubmit={handle}>
        <div style={{ display:"flex", flexDirection:"column", gap:14, marginBottom:20 }}>
          <div>
            <label style={{ fontSize:12, color:T.sub, fontWeight:600,
              display:"block", marginBottom:6 }}>Email</label>
            <input className="sd-input" type="email" placeholder="your@email.com"
              value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div>
            <label style={{ fontSize:12, color:T.sub, fontWeight:600,
              display:"block", marginBottom:6 }}>Password</label>
            <input className="sd-input" type="password" placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
        </div>
        <ErrorMsg msg={error} />
        <button className="sd-btn sd-btn-primary" type="submit"
          disabled={loading} style={{ marginTop:16 }}>
          {loading ? <Spinner size={16} color="#fff" /> : "Sign In"}
        </button>
      </form>
      <div style={{ textAlign:"center", marginTop:16 }}>
        <button onClick={() => onSwitch("forgot")}
          style={{ fontSize:12, color:T.muted, background:"none", border:"none",
            textDecoration:"underline", cursor:"pointer" }}>
          Forgot password?
        </button>
      </div>
      <div style={{ height:1, background:T.border, margin:"20px 0" }} />
      <div style={{ textAlign:"center", fontSize:13, color:T.muted }}>
        New to SpotDrive?{" "}
        <button onClick={() => onSwitch("signup")}
          style={{ color:T.accent, fontWeight:700, background:"none",
            border:"none", cursor:"pointer" }}>
          Create account
        </button>
      </div>
    </div>
  );
}

function SignupForm({ onSwitch }) {
  const { signUp } = useAuth();
  const [form,    setForm]    = useState({ email:"", password:"", confirm:"", handle:"", name:"" });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [success, setSuccess] = useState(false);

  const update = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  const handle = async (e) => {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirm) { setError("Passwords don't match."); return; }
    if (form.password.length < 6)       { setError("Password must be at least 6 characters."); return; }
    if (form.handle.length < 3)         { setError("Handle must be at least 3 characters."); return; }
    if (!/^[a-z0-9_]+$/i.test(form.handle)) { setError("Handle can only contain letters, numbers, and underscores."); return; }

    setLoading(true);
    try {
      await signUp({ email:form.email, password:form.password,
        handle:form.handle, displayName:form.name || form.handle });
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) return (
    <div style={{ background:T.surface, border:`1px solid ${T.green}40`,
      borderRadius:20, padding:28, textAlign:"center" }}>
      <div style={{ fontSize:48, marginBottom:12 }}>📧</div>
      <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:22,
        fontWeight:900, color:T.text, marginBottom:8 }}>Check your email</div>
      <div style={{ fontSize:13, color:T.muted, lineHeight:1.6, marginBottom:20 }}>
        We sent a confirmation link to <strong style={{ color:T.text }}>{form.email}</strong>.
        Click it to activate your account.
      </div>
      <button className="sd-btn sd-btn-ghost" onClick={() => onSwitch("login")}
        style={{ maxWidth:200, margin:"0 auto" }}>
        Back to sign in
      </button>
    </div>
  );

  return (
    <div style={{ background:T.surface, border:`1px solid ${T.border}`,
      borderRadius:20, padding:28 }}>
      <form onSubmit={handle}>
        <div style={{ display:"flex", flexDirection:"column", gap:12, marginBottom:16 }}>
          {[
            { key:"name",     label:"Display Name",  type:"text",     placeholder:"Tyler Rhodes",        hint:"" },
            { key:"handle",   label:"Username",       type:"text",     placeholder:"apex_hunter",         hint:"Letters, numbers, underscores only" },
            { key:"email",    label:"Email",          type:"email",    placeholder:"your@email.com",      hint:"" },
            { key:"password", label:"Password",       type:"password", placeholder:"Min 6 characters",   hint:"" },
            { key:"confirm",  label:"Confirm Password",type:"password",placeholder:"Repeat password",     hint:"" },
          ].map(({ key, label, type, placeholder, hint }) => (
            <div key={key}>
              <label style={{ fontSize:12, color:T.sub, fontWeight:600,
                display:"block", marginBottom:5 }}>{label}</label>
              <input className={`sd-input${error && key==="handle" && error.includes("handle") ? " error" : ""}`}
                type={type} placeholder={placeholder}
                value={form[key]} onChange={update(key)} required />
              {hint && <div style={{ fontSize:11, color:T.muted, marginTop:3 }}>{hint}</div>}
            </div>
          ))}
        </div>
        <ErrorMsg msg={error} />
        <button className="sd-btn sd-btn-primary" type="submit"
          disabled={loading} style={{ marginTop:12 }}>
          {loading ? <Spinner size={16} color="#fff" /> : "Create Account"}
        </button>
      </form>
      <div style={{ height:1, background:T.border, margin:"20px 0" }} />
      <div style={{ textAlign:"center", fontSize:13, color:T.muted }}>
        Already have an account?{" "}
        <button onClick={() => onSwitch("login")}
          style={{ color:T.accent, fontWeight:700, background:"none",
            border:"none", cursor:"pointer" }}>
          Sign in
        </button>
      </div>
    </div>
  );
}

function ForgotForm({ onSwitch }) {
  const { resetPassword } = useAuth();
  const [email,   setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState("");

  const handle = async (e) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      await resetPassword(email);
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (sent) return (
    <div style={{ background:T.surface, border:`1px solid ${T.border}`,
      borderRadius:20, padding:28, textAlign:"center" }}>
      <div style={{ fontSize:40, marginBottom:12 }}>✅</div>
      <div style={{ fontSize:14, color:T.sub, marginBottom:20 }}>
        Reset link sent to <strong style={{ color:T.text }}>{email}</strong>
      </div>
      <button className="sd-btn sd-btn-ghost" onClick={() => onSwitch("login")}
        style={{ maxWidth:200, margin:"0 auto" }}>
        Back to sign in
      </button>
    </div>
  );

  return (
    <div style={{ background:T.surface, border:`1px solid ${T.border}`,
      borderRadius:20, padding:28 }}>
      <form onSubmit={handle}>
        <div style={{ marginBottom:16 }}>
          <label style={{ fontSize:12, color:T.sub, fontWeight:600,
            display:"block", marginBottom:6 }}>Email address</label>
          <input className="sd-input" type="email" placeholder="your@email.com"
            value={email} onChange={e => setEmail(e.target.value)} required />
        </div>
        <ErrorMsg msg={error} />
        <button className="sd-btn sd-btn-primary" type="submit"
          disabled={loading} style={{ marginTop:12 }}>
          {loading ? <Spinner size={16} color="#fff" /> : "Send Reset Link"}
        </button>
      </form>
      <div style={{ textAlign:"center", marginTop:16 }}>
        <button onClick={() => onSwitch("login")}
          style={{ fontSize:12, color:T.muted, background:"none",
            border:"none", cursor:"pointer", textDecoration:"underline" }}>
          Back to sign in
        </button>
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
  const [imgErr,setImgErr]= useState(false);

  const handleLike = (e) => {
    e.stopPropagation();
    const next = !liked;
    setLiked(next); setLikes(n => next ? n+1 : n-1);
    if (next) { setPop(true); setTimeout(() => setPop(false), 350); }
  };
  const handleSave = (e) => {
    e.stopPropagation();
    const next = !saved;
    setSaved(next); setSaves(n => next ? n+1 : n-1);
  };

  return (
    <div className="spot-card fade-up" onClick={() => onTap?.(spot)} style={{ cursor:"pointer" }}>
      {/* Image */}
      <div style={{ position:"relative", paddingTop:"62%", overflow:"hidden" }}>
        {!imgErr && spot.image
          ? <img src={spot.image} alt={`${spot.make} ${spot.model}`} loading="lazy"
              onError={() => setImgErr(true)}
              style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover" }} />
          : <div style={{ position:"absolute", inset:0, background:`linear-gradient(135deg,${T.accentDm},${T.surfaceHi})`,
              display:"flex", alignItems:"center", justifyContent:"center", fontSize:48 }}>🏎</div>
        }
        <div style={{ position:"absolute", inset:0,
          background:"linear-gradient(to bottom, transparent 50%, rgba(0,0,0,.6))" }} />
        <div style={{ position:"absolute", top:10, left:10 }}>
          <RarityPill rarity={spot.rarity} />
        </div>
        <div style={{ position:"absolute", top:10, right:10, background:"rgba(0,0,0,.6)",
          borderRadius:6, padding:"3px 8px", fontSize:10, fontWeight:600, color:T.muted }}>
          {spot.year}
        </div>
        <div style={{ position:"absolute", bottom:10, left:12 }}>
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:22, fontWeight:900,
            color:"#fff", lineHeight:1, textShadow:"0 2px 8px rgba(0,0,0,.7)" }}>
            {spot.make} {spot.model}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding:"12px 14px 10px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
          <Avatar initials={spot.user?.initials} src={spot.user?.avatar_url} size={28} />
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:12, fontWeight:600, color:T.text }}>@{spot.user?.handle}</div>
            <div style={{ fontSize:10, color:T.muted }}>{spot.location} · {spot.time}</div>
          </div>
        </div>
        <div style={{ display:"flex", gap:5, marginBottom:10, overflow:"hidden" }}>
          {spot.tags?.slice(0,3).map(t => (
            <span key={t} style={{ fontSize:10, color:T.muted, background:T.border,
              borderRadius:5, padding:"2px 7px" }}>#{t}</span>
          ))}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:16,
          paddingTop:10, borderTop:`1px solid ${T.border}` }}>
          <button onClick={handleLike} aria-pressed={liked}
            style={{ display:"flex", alignItems:"center", gap:5, color:liked?T.accent:T.muted,
              fontSize:12, fontWeight:600, border:"none", background:"none", transition:"color .15s" }}>
            <span className={pop?"heart-pop":""} style={{ fontSize:16 }}>
              {liked ? "❤️" : "🤍"}
            </span> {fmt(likes)}
          </button>
          <button style={{ display:"flex", alignItems:"center", gap:5, color:T.muted,
            fontSize:12, fontWeight:600, border:"none", background:"none" }}>
            💬 {fmt(spot.comments)}
          </button>
          <button onClick={handleSave} aria-pressed={saved}
            style={{ display:"flex", alignItems:"center", gap:5,
              color:saved?T.gold:T.muted, fontSize:12, fontWeight:600,
              border:"none", background:"none", transition:"color .15s" }}>
            {saved ? "🔖" : "📎"} {fmt(saves)}
          </button>
          <button style={{ marginLeft:"auto", color:T.muted, border:"none", background:"none" }}>
            ↗
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── UPLOAD MODAL ─────────────────────────────────────────────
function UploadModal({ onClose }) {
  const { user, profile } = useAuth();
  const [step,     setStep]     = useState(1);
  const [file,     setFile]     = useState(null);
  const [preview,  setPreview]  = useState(null);
  const [form,     setForm]     = useState({ make:"", model:"", year:"", rarity:"Exotic", location:"", desc:"" });
  const [loading,  setLoading]  = useState(false);
  const [done,     setDone]     = useState(false);
  const [error,    setError]    = useState("");
  const fileRef = useRef();
  const blobRef = useRef(null);

  useEffect(() => () => { if (blobRef.current) URL.revokeObjectURL(blobRef.current); }, []);

  const handleFile = (f) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) { setError("Please select an image file."); return; }
    if (f.size > 30 * 1024 * 1024)   { setError("File must be under 30 MB."); return; }
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

      // Upload photo to Supabase Storage
      if (file) {
        const ext  = file.name.split(".").pop();
        const path = `spots/${user.id}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("spot-photos")
          .upload(path, file, { contentType: file.type });
        if (uploadErr) throw uploadErr;
        const { data: { publicUrl } } = supabase.storage
          .from("spot-photos")
          .getPublicUrl(path);
        imageUrl = publicUrl;
      }

      // Insert spot to database
      const { error: insertErr } = await supabase.from("spots").insert({
        user_id:       user.id,
        make:          form.make,
        model:         form.model,
        year:          parseInt(form.year) || new Date().getFullYear(),
        rarity:        form.rarity,
        color:         "",
        location_name: form.location,
        description:   form.desc,
        image_url:     imageUrl,
        status:        "live",
      });
      if (insertErr) throw insertErr;

      setDone(true);
      setTimeout(onClose, 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.88)", zIndex:600,
      backdropFilter:"blur(8px)", display:"flex", alignItems:"flex-end", justifyContent:"center" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background:T.surface, width:"100%", maxWidth:480,
        borderRadius:"20px 20px 0 0", maxHeight:"92vh", overflowY:"auto",
        animation:"slideUp .25s ease" }}>
        <div style={{ padding:"16px 18px 12px", borderBottom:`1px solid ${T.border}`,
          display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <span style={{ fontSize:16, fontWeight:800, color:T.text }}>
            {done ? "Posted! 🔥" : step===1 ? "Post a Spot" : "Add Details"}
          </span>
          <button onClick={onClose} style={{ color:T.muted, fontSize:20, lineHeight:1 }}>×</button>
        </div>

        <div style={{ padding:18 }}>
          {done ? (
            <div style={{ textAlign:"center", padding:"32px 0" }}>
              <div style={{ fontSize:56, marginBottom:12 }}>🏎</div>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:24,
                fontWeight:900, color:T.text, marginBottom:6 }}>Your spot is live!</div>
              <div style={{ fontSize:13, color:T.muted }}>The community can see it now.</div>
            </div>
          ) : step === 1 ? (
            <div>
              <div onClick={() => fileRef.current?.click()}
                style={{ border:`2px dashed ${T.border}`, borderRadius:14, padding:"48px 20px",
                  textAlign:"center", cursor:"pointer", background:T.bg }}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}>
                <div style={{ fontSize:36, marginBottom:10 }}>📸</div>
                <div style={{ fontSize:15, fontWeight:700, color:T.text, marginBottom:4 }}>
                  Drop your photo here
                </div>
                <div style={{ fontSize:12, color:T.muted }}>or tap to choose · JPG, PNG, HEIC · Max 30MB</div>
                <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }}
                  onChange={e => handleFile(e.target.files?.[0])} />
              </div>
              <ErrorMsg msg={error} />
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {preview && (
                <img src={preview} alt="preview"
                  style={{ width:"100%", height:180, objectFit:"cover", borderRadius:12 }} />
              )}
              {[
                { key:"make",     label:"Make",     placeholder:"Ferrari"         },
                { key:"model",    label:"Model",    placeholder:"SF90 Stradale"   },
                { key:"year",     label:"Year",     placeholder:"2023"            },
                { key:"location", label:"Location", placeholder:"Monaco, Monte Carlo" },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label style={{ fontSize:11, color:T.muted, fontWeight:600,
                    textTransform:"uppercase", letterSpacing:".05em", display:"block", marginBottom:5 }}>
                    {label}
                  </label>
                  <input className="sd-input" value={form[key]} placeholder={placeholder}
                    onChange={e => setForm(p => ({ ...p, [key]:e.target.value }))} />
                </div>
              ))}
              <div>
                <label style={{ fontSize:11, color:T.muted, fontWeight:600,
                  textTransform:"uppercase", letterSpacing:".05em", display:"block", marginBottom:5 }}>
                  Rarity
                </label>
                <div style={{ display:"flex", gap:8 }}>
                  {["Sports","Exotic","Hypercar"].map(r => {
                    const rc = RARITY[r];
                    const active = form.rarity === r;
                    return (
                      <button key={r} onClick={() => setForm(p => ({ ...p, rarity:r }))}
                        style={{ flex:1, padding:"9px", borderRadius:9, fontSize:12, fontWeight:700,
                          background:active?rc.bg:T.bg, border:`1px solid ${active?rc.border:T.border}`,
                          color:active?rc.text:T.muted, cursor:"pointer", transition:"all .15s" }}>
                        {r}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label style={{ fontSize:11, color:T.muted, fontWeight:600,
                  textTransform:"uppercase", letterSpacing:".05em", display:"block", marginBottom:5 }}>
                  Description
                </label>
                <textarea className="sd-input" rows={3} placeholder="Tell the story behind this spot…"
                  value={form.desc} onChange={e => setForm(p => ({ ...p, desc:e.target.value }))}
                  style={{ resize:"none", lineHeight:1.55 }} />
              </div>
              <ErrorMsg msg={error} />
              <button className="sd-btn sd-btn-primary" onClick={handlePost}
                disabled={loading || !form.make || !form.model}>
                {loading ? <><Spinner size={16} color="#fff" /> Posting…</> : "Post Spot →"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── SCREENS ──────────────────────────────────────────────────
function FeedScreen({ onSpotTap }) {
  const { profile } = useAuth();
  const [spots,   setSpots]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSpots = async () => {
      // Try to load from Supabase first
      const { data } = await supabase
        .from("spots")
        .select(`*, profiles(handle, avatar_url)`)
        .eq("status", "live")
        .order("created_at", { ascending: false })
        .limit(20);

      if (data && data.length > 0) {
        setSpots(data.map(s => ({
          ...s,
          image:    s.image_url,
          location: s.location_name,
          likes:    s.likes_count || 0,
          saves:    s.saves_count || 0,
          comments: s.comments_count || 0,
          time:     timeAgo(s.created_at),
          tags:     [],
          liked:    false,
          saved:    false,
          user:     { handle: s.profiles?.handle || "spotter",
                      avatar_url: s.profiles?.avatar_url,
                      initials: (s.profiles?.handle || "SP").slice(0,2).toUpperCase() }
        })));
      } else {
        // Fall back to mock data
        setSpots(MOCK_SPOTS);
      }
      setLoading(false);
    };
    loadSpots();
  }, []);

  const timeAgo = (ts) => {
    if (!ts) return "";
    const diff = Date.now() - new Date(ts).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)   return "just now";
    if (m < 60)  return `${m}m ago`;
    if (m < 1440) return `${Math.floor(m/60)}h ago`;
    return `${Math.floor(m/1440)}d ago`;
  };

  return (
    <div>
      {/* Welcome banner */}
      {profile && (
        <div style={{ padding:"14px 16px", borderBottom:`1px solid ${T.border}`,
          display:"flex", alignItems:"center", gap:10 }}>
          <Avatar initials={profile.handle?.slice(0,2).toUpperCase()}
            src={profile.avatar_url} size={36} ring />
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:T.text }}>
              Welcome back, @{profile.handle} 👋
            </div>
            <div style={{ fontSize:11, color:T.muted }}>What will you spot today?</div>
          </div>
        </div>
      )}

      {/* Hot banner */}
      <div style={{ margin:"12px 14px", padding:"10px 14px",
        background:T.accentDm, border:`1px solid ${T.accent}30`,
        borderRadius:12, display:"flex", alignItems:"center", gap:8, fontSize:13 }}>
        <span>🔥</span>
        <span style={{ color:T.text, fontWeight:600 }}>Trending: </span>
        <span style={{ color:T.muted }}>Bugatti Chiron SS in Tokyo · 9.4k likes</span>
      </div>

      {/* Cards */}
      <div style={{ display:"flex", flexDirection:"column", gap:14, padding:"0 14px 14px" }}>
        {loading
          ? Array(3).fill(0).map((_, i) => (
              <div key={i} style={{ background:T.card, border:`1px solid ${T.border}`,
                borderRadius:16, overflow:"hidden" }}>
                <div className="shimmer" style={{ height:220 }} />
                <div style={{ padding:14, display:"flex", flexDirection:"column", gap:10 }}>
                  <div style={{ display:"flex", gap:10 }}>
                    <div className="shimmer" style={{ width:32, height:32, borderRadius:"50%" }} />
                    <div style={{ flex:1 }}>
                      <div className="shimmer" style={{ height:11, width:"55%", marginBottom:6 }} />
                      <div className="shimmer" style={{ height:10, width:"35%" }} />
                    </div>
                  </div>
                  <div className="shimmer" style={{ height:20, width:"70%" }} />
                </div>
              </div>
            ))
          : spots.map(s => <SpotCard key={s.id} spot={s} onTap={onSpotTap} />)
        }
      </div>
    </div>
  );
}

function ProfileScreen() {
  const { user, profile, signOut, fetchProfile } = useAuth();
  const [spots,    setSpots]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("spots").select("*").eq("user_id", user.id).eq("status","live")
      .order("created_at", { ascending:false })
      .then(({ data }) => { setSpots(data || []); setLoading(false); });
  }, [user]);

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
  };

  return (
    <div>
      {/* Header */}
      <div style={{ background:`linear-gradient(180deg,${T.accentDm} 0%,${T.surface} 100%)`,
        padding:"24px 16px 0" }}>
        <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:12 }}>
          <button onClick={handleSignOut} disabled={signingOut}
            style={{ fontSize:12, color:T.muted, border:`1px solid ${T.border}`,
              borderRadius:8, padding:"6px 12px", background:"none",
              display:"flex", alignItems:"center", gap:6 }}>
            {signingOut ? <Spinner size={12} /> : "Sign Out"}
          </button>
        </div>

        <div style={{ display:"flex", gap:14, alignItems:"flex-end", marginBottom:16 }}>
          <Avatar initials={profile?.handle?.slice(0,2).toUpperCase() || "?"}
            src={profile?.avatar_url} size={72} ring />
          <div>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:22,
              fontWeight:900, color:T.text }}>
              {profile?.display_name || profile?.handle || "Spotter"}
            </div>
            <div style={{ fontSize:13, color:T.muted }}>@{profile?.handle}</div>
            {profile?.bio && (
              <div style={{ fontSize:12, color:T.sub, marginTop:4, maxWidth:260 }}>{profile.bio}</div>
            )}
            <div style={{ marginTop:6, display:"inline-flex", alignItems:"center", gap:5,
              background:T.accentDm, border:`1px solid ${T.accent}`, borderRadius:6,
              padding:"3px 10px", fontSize:11, color:T.accent, fontWeight:700 }}>
              🏎 Spotter
            </div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)",
          borderTop:`1px solid ${T.border}`, paddingTop:14, marginBottom:0 }}>
          {[
            ["Spots",     spots.length],
            ["Followers", profile?.followers_count || 0],
            ["Following", profile?.following_count || 0],
          ].map(([label, value]) => (
            <div key={label} style={{ textAlign:"center" }}>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:22,
                fontWeight:900, color:T.text }}>{value}</div>
              <div style={{ fontSize:10, color:T.muted, textTransform:"uppercase",
                letterSpacing:".05em" }}>{label}</div>
            </div>
          ))}
        </div>

        <div style={{ paddingTop:14, borderTop:`1px solid ${T.border}`, marginTop:14 }}>
          <div style={{ fontSize:12, fontWeight:700, color:T.muted, paddingBottom:12 }}>
            My Spots
          </div>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:2, padding:2 }}>
          {Array(6).fill(0).map((_, i) => (
            <div key={i} className="shimmer" style={{ aspectRatio:"1" }} />
          ))}
        </div>
      ) : spots.length === 0 ? (
        <div style={{ textAlign:"center", padding:"60px 20px" }}>
          <div style={{ fontSize:40, marginBottom:10 }}>📸</div>
          <div style={{ fontSize:16, fontWeight:700, color:T.text, marginBottom:6 }}>
            No spots yet
          </div>
          <div style={{ fontSize:13, color:T.muted }}>
            Hit the + button to post your first spot.
          </div>
        </div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:2, padding:2 }}>
          {spots.map(s => (
            <div key={s.id} style={{ aspectRatio:"1", overflow:"hidden", position:"relative" }}>
              {s.image_url
                ? <img src={s.image_url} alt="" loading="lazy"
                    style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                : <div style={{ width:"100%", height:"100%", background:T.accentDm,
                    display:"flex", alignItems:"center", justifyContent:"center", fontSize:28 }}>🏎</div>
              }
              <div style={{ position:"absolute", inset:0,
                background:"linear-gradient(to bottom, transparent 60%, rgba(0,0,0,.7))" }} />
              <div style={{ position:"absolute", bottom:6, left:6,
                fontFamily:"'Barlow Condensed',sans-serif",
                fontSize:11, fontWeight:800, color:"#fff", lineHeight:1 }}>
                {s.make}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ExploreScreen({ onSpotTap }) {
  const [query,  setQuery]  = useState("");
  const [filter, setFilter] = useState("All");
  const filtered = MOCK_SPOTS.filter(s => {
    const mq = !query || `${s.make} ${s.model} ${s.location}`.toLowerCase().includes(query.toLowerCase());
    const mf = filter === "All" || s.rarity === filter;
    return mq && mf;
  });

  return (
    <div style={{ padding:14 }}>
      <div style={{ position:"relative", marginBottom:12 }}>
        <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)",
          color:T.muted, fontSize:14 }}>🔍</span>
        <input className="sd-input" placeholder="Search make, model, location…"
          value={query} onChange={e => setQuery(e.target.value)}
          style={{ paddingLeft:36 }} />
      </div>
      <div style={{ display:"flex", gap:6, marginBottom:14, overflowX:"auto" }}>
        {["All","Hypercar","Exotic","Sports"].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding:"6px 14px", borderRadius:20, fontSize:12, fontWeight:600,
              background:filter===f ? T.accentDm : T.card,
              border:`1px solid ${filter===f ? T.accent : T.border}`,
              color:filter===f ? T.accent : T.muted, whiteSpace:"nowrap" }}>
            {f}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <div style={{ textAlign:"center", padding:"60px 0" }}>
          <div style={{ fontSize:40, marginBottom:12 }}>🔍</div>
          <div style={{ fontSize:16, fontWeight:700, color:T.text }}>No spots found</div>
        </div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          {filtered.map(s => (
            <div key={s.id} onClick={() => onSpotTap(s)}
              style={{ borderRadius:12, overflow:"hidden", position:"relative",
                aspectRatio:"1", cursor:"pointer" }}>
              <img src={s.image} alt="" loading="lazy"
                style={{ width:"100%", height:"100%", objectFit:"cover" }} />
              <div style={{ position:"absolute", inset:0,
                background:"linear-gradient(to bottom, transparent 40%, rgba(0,0,0,.75))" }} />
              <div style={{ position:"absolute", top:6, left:6 }}>
                <RarityPill rarity={s.rarity} />
              </div>
              <div style={{ position:"absolute", bottom:8, left:8, right:8 }}>
                <div style={{ fontFamily:"'Barlow Condensed',sans-serif",
                  fontSize:14, fontWeight:800, color:"#fff", lineHeight:1.1 }}>
                  {s.make} {s.model}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── MAIN APP (authenticated) ─────────────────────────────────
const NAV = [
  { key:"feed",    label:"Feed",    icon:"🏠" },
  { key:"explore", label:"Explore", icon:"🧭" },
  { key:"upload",  label:"",        icon:null  },
  { key:"profile", label:"Profile", icon:"👤"  },
];

function MainApp() {
  const [screen,     setScreen]     = useState("feed");
  const [spotDetail, setSpotDetail] = useState(null);
  const [showUpload, setShowUpload] = useState(false);

  return (
    <div style={{ maxWidth:430, margin:"0 auto", minHeight:"100vh",
      background:T.bg, display:"flex", flexDirection:"column" }}>
      {/* Header */}
      <header style={{ position:"sticky", top:0, zIndex:100, background:`${T.bg}ee`,
        backdropFilter:"blur(14px)", borderBottom:`1px solid ${T.border}`,
        padding:"12px 16px", display:"flex", alignItems:"center",
        justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:9 }}>
          <div style={{ width:32, height:32, borderRadius:9,
            background:`linear-gradient(135deg,${T.accent},${T.accentDk})`,
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>🏎</div>
          <div>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:19, fontWeight:900,
              color:T.text, lineHeight:1, letterSpacing:"-.02em" }}>SpotDrive</div>
            <div style={{ fontSize:9, color:T.accent, fontWeight:700, letterSpacing:".1em" }}>BETA</div>
          </div>
        </div>
        <div style={{ fontSize:10, color:T.green, fontWeight:700, display:"flex",
          alignItems:"center", gap:4 }}>
          <div style={{ width:6, height:6, borderRadius:"50%", background:T.green }} />
          LIVE
        </div>
      </header>

      {/* Screen */}
      <main style={{ flex:1, overflowY:"auto", paddingBottom:80 }}>
        {screen === "feed"    && <FeedScreen    onSpotTap={setSpotDetail} />}
        {screen === "explore" && <ExploreScreen onSpotTap={setSpotDetail} />}
        {screen === "profile" && <ProfileScreen />}
      </main>

      {/* Bottom nav */}
      <nav style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)",
        width:"100%", maxWidth:430, background:`${T.surface}f5`,
        backdropFilter:"blur(16px)", borderTop:`1px solid ${T.border}`,
        display:"flex", justifyContent:"space-around", alignItems:"center",
        padding:"8px 0 max(8px,env(safe-area-inset-bottom))", zIndex:90 }}>
        {NAV.map(({ key, label, icon }) => {
          if (key === "upload") return (
            <button key="upload" onClick={() => setShowUpload(true)}
              style={{ width:50, height:50, borderRadius:"50%", border:"none",
                background:`linear-gradient(135deg,${T.accent},${T.accentDk})`,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:22, boxShadow:`0 4px 16px ${T.accent}50`,
                transform:"translateY(-6px)" }}>
              ＋
            </button>
          );
          return (
            <button key={key} onClick={() => setScreen(key)}
              className={`nav-item${screen===key?" active":""}`}>
              <span style={{ fontSize:22 }}>{icon}</span>
              <span>{label}</span>
              {screen===key && <div style={{ width:4, height:4, borderRadius:"50%",
                background:T.accent, marginTop:2 }} />}
            </button>
          );
        })}
      </nav>

      {/* Overlays */}
      {showUpload && <UploadModal onClose={() => setShowUpload(false)} />}
      {spotDetail && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.85)", zIndex:500,
          backdropFilter:"blur(6px)", display:"flex", alignItems:"flex-end",
          justifyContent:"center" }}
          onClick={e => { if (e.target===e.currentTarget) setSpotDetail(null); }}>
          <div style={{ background:T.surface, width:"100%", maxWidth:480, maxHeight:"90vh",
            overflowY:"auto", borderRadius:"20px 20px 0 0", animation:"slideUp .25s ease",
            padding:20 }}>
            <img src={spotDetail.image} alt="" style={{ width:"100%", height:200,
              objectFit:"cover", borderRadius:14, marginBottom:14 }} />
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
              marginBottom:10 }}>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:26,
                fontWeight:900, color:T.text }}>
                {spotDetail.make} {spotDetail.model}
              </div>
              <RarityPill rarity={spotDetail.rarity} />
            </div>
            <div style={{ fontSize:12, color:T.muted, marginBottom:12 }}>
              📍 {spotDetail.location} · {spotDetail.time}
            </div>
            <p style={{ fontSize:13, color:T.sub, lineHeight:1.65, marginBottom:16 }}>
              {spotDetail.description}
            </p>
            <button onClick={() => setSpotDetail(null)}
              style={{ width:"100%", padding:12, borderRadius:12,
                border:`1px solid ${T.border}`, background:"none",
                color:T.muted, fontSize:14, fontWeight:600 }}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────
function AppContent() {
  const { user, loading } = useAuth();

  if (loading) return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex",
      alignItems:"center", justifyContent:"center", flexDirection:"column", gap:16 }}>
      <div style={{ width:56, height:56, borderRadius:14,
        background:`linear-gradient(135deg,${T.accent},${T.accentDk})`,
        display:"flex", alignItems:"center", justifyContent:"center", fontSize:28 }}>🏎</div>
      <Spinner size={24} />
    </div>
  );

  return user ? <MainApp /> : <AuthScreen />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

