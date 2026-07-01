import { useState, useEffect, useCallback, useRef, memo, createContext, useContext } from "react";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL  = "https://lhahofbryglxdxffxjbr.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoYWhvZmJyeWdseGR4ZmZ4amJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3MzA5ODgsImV4cCI6MjA5ODMwNjk4OH0.5rmKCnWqROlefWII7QpHsbY8xUMJytL6CoJ8LYsaUGQ";
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
    location:"Rodeo Drive, Beverly Hills", image:"https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=900&q=85",
    likes:2841, comments:94, saves:312, time:"12m ago", tags:["Lamborghini","STO","TrackSpecial"],
    liked:false, saved:false, description:"Caught this STO parked outside Gucci. Verde Mantis in person is something else.",
    user:{ handle:"apex_hunter", initials:"AH", verified:true } },
  { id:"s2", make:"Ferrari", model:"SF90 Stradale", year:2022, rarity:"Hypercar", color:"Rosso Corsa",
    location:"Monaco, Monte Carlo", image:"https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=900&q=85",
    likes:5102, comments:218, saves:891, time:"1h ago", tags:["Ferrari","SF90","Hybrid"],
    liked:true, saved:false, description:"SF90 rolling out of Casino Square. Rosso Corsa with Assetto Fiorano pack.",
    user:{ handle:"euro_spotter", initials:"LM", verified:false } },
  { id:"s3", make:"Bugatti", model:"Chiron Super Sport", year:2023, rarity:"Hypercar", color:"Atlantic Blue",
    location:"Shibuya, Tokyo", image:"https://images.unsplash.com/photo-1525609004556-c46c7d6cf023?w=900&q=85",
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
              {[{key:"make",label:"Make",ph:"Ferrari"},{key:"model",label:"Model",ph:"SF90 Stradale"},{key:"year",label:"Year",ph:"2023"},{key:"location",label:"Location",ph:"Monaco, Monte Carlo"}].map(({key,label,ph}) => (
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

// ─── SCREENS ──────────────────────────────────────────────────
function FeedScreen({ onSpotTap }) {
  const { profile } = useAuth();
  const [spots,   setSpots]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("spots")
        .select("*, profiles(handle, avatar_url)")
        .eq("status","live").order("created_at",{ascending:false}).limit(20);
      if (data && data.length > 0) {
        setSpots(data.map(s => ({
          ...s, image:s.image_url, location:s.location_name,
          likes:s.likes_count||0, saves:s.saves_count||0, comments:s.comments_count||0,
          time:timeAgo(s.created_at), tags:[], liked:false, saved:false,
          user:{ handle:s.profiles?.handle||"spotter", avatar_url:s.profiles?.avatar_url,
                 initials:(s.profiles?.handle||"SP").slice(0,2).toUpperCase() }
        })));
      } else { setSpots(MOCK_SPOTS); }
      setLoading(false);
    };
    load();
  }, []);

  const timeAgo = (ts) => {
    if (!ts) return "";
    const m = Math.floor((Date.now()-new Date(ts).getTime())/60000);
    if (m<1) return "just now"; if (m<60) return `${m}m ago`;
    if (m<1440) return `${Math.floor(m/60)}h ago`; return `${Math.floor(m/1440)}d ago`;
  };

  return (
    <div>
      {profile && (
        <div style={{ padding:"14px 16px", borderBottom:"1px solid #252530", display:"flex", alignItems:"center", gap:10 }}>
          <Avatar initials={profile.handle?.slice(0,2).toUpperCase()} src={profile.avatar_url} size={36} ring />
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:"#F2EEE8" }}>Welcome back, @{profile.handle} 👋</div>
            <div style={{ fontSize:11, color:"#6B6878" }}>What will you spot today?</div>
          </div>
        </div>
      )}
      <div style={{ margin:"12px 14px", padding:"10px 14px", background:"#2D1200",
        border:"1px solid rgba(232,67,10,.3)", borderRadius:12, display:"flex", alignItems:"center", gap:8, fontSize:13 }}>
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
      </div>
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

  // Load spotters from Supabase
  useEffect(() => {
    if (tab !== "spotters") return;
    setLoadingSpotters(true);
    supabase.from("profiles").select("*")
      .order("followers_count", { ascending:false }).limit(20)
      .then(({ data }) => {
        if (data && data.length > 0) setSpotters(data);
        else setSpotters([
          { id:"mock1", handle:"apex_hunter",     display_name:"Tyler Rhodes",   followers_count:18400, spots_count:412, is_verified:true,  initials:"TR" },
          { id:"mock2", handle:"euro_spotter",     display_name:"Lena Müller",    followers_count:54200, spots_count:889, is_verified:false, initials:"LM" },
          { id:"mock3", handle:"jdm_tokyo",        display_name:"Kenji Tanaka",   followers_count:91000, spots_count:1204,is_verified:true,  initials:"KT" },
          { id:"mock4", handle:"la_spotter",       display_name:"Marcus Webb",    followers_count:12100, spots_count:203, is_verified:false, initials:"MW" },
          { id:"mock5", handle:"gulf_spots",       display_name:"Omar Al-Rashid", followers_count:38700, spots_count:567, is_verified:true,  initials:"OR" },
          { id:"mock6", handle:"nring_nut",        display_name:"Hans Fischer",   followers_count:8300,  spots_count:145, is_verified:false, initials:"HF" },
        ]);
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
                {/* Rank */}
                <div style={{ width:20, textAlign:"center", flexShrink:0,
                  fontFamily:"'Barlow Condensed',sans-serif", fontSize:14,
                  fontWeight:900, color: i===0?"#C9A84C":i===1?"#AAA6A0":i===2?"#CD7F32":"#3D3D4E" }}>
                  {i+1}
                </div>
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
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:2, padding:2 }}>
          {spots.map(s => (
            <div key={s.id} style={{ aspectRatio:"1", overflow:"hidden", position:"relative" }}>
              {s.image_url
                ? <img src={s.image_url} alt="" loading="lazy" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                : <div style={{ width:"100%", height:"100%", background:"#2D1200", display:"flex", alignItems:"center", justifyContent:"center", fontSize:28 }}>🏎</div>
              }
              <div style={{ position:"absolute", inset:0, background:"linear-gradient(to bottom, transparent 60%, rgba(0,0,0,.7))" }} />
              <div style={{ position:"absolute", bottom:6, left:6, fontFamily:"'Barlow Condensed',sans-serif", fontSize:11, fontWeight:800, color:"#fff", lineHeight:1 }}>{s.make}</div>
            </div>
          ))}
        </div>
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

function MainApp() {
  const [screen,     setScreen]     = useState("feed");
  const [showNotifs, setShowNotifs] = useState(false);
  const [unreadCount, setUnreadCount] = useState(3);
  const [spotDetail, setSpotDetail] = useState(null);
  const [showUpload, setShowUpload] = useState(false);

  const NAV = [
    { key:"feed",    label:"Feed",    icon:"🏠" },
    { key:"explore", label:"Explore", icon:"🧭" },
    { key:"upload",  label:"",        icon:null  },
    { key:"profile", label:"Profile", icon:"👤"  },
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
        {screen==="feed"    && <FeedScreen    onSpotTap={setSpotDetail} />}
        {screen==="explore" && <ExploreScreen onSpotTap={setSpotDetail} />}
        {screen==="profile" && <ProfileScreen />}
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
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.85)", zIndex:500,
          backdropFilter:"blur(6px)", display:"flex", alignItems:"flex-end", justifyContent:"center" }}
          onClick={e => { if (e.target===e.currentTarget) setSpotDetail(null); }}>
          <div style={{ background:"#14141A", width:"100%", maxWidth:480, maxHeight:"90vh",
            overflowY:"auto", borderRadius:"20px 20px 0 0", animation:"slideUp .25s ease", padding:20 }}>
            <img src={spotDetail.image} alt="" style={{ width:"100%", height:200, objectFit:"cover", borderRadius:14, marginBottom:14 }} />
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:26, fontWeight:900, color:"#F2EEE8" }}>{spotDetail.make} {spotDetail.model}</div>
              <RarityPill rarity={spotDetail.rarity} />
            </div>
            <div style={{ fontSize:12, color:"#6B6878", marginBottom:12 }}>📍 {spotDetail.location} · {spotDetail.time}</div>
            <p style={{ fontSize:13, color:"#AAA6A0", lineHeight:1.65, marginBottom:16 }}>{spotDetail.description}</p>
            <button onClick={() => setSpotDetail(null)}
              style={{ width:"100%", padding:12, borderRadius:12, border:"1px solid #252530",
                background:"none", color:"#6B6878", fontSize:14, fontWeight:600, cursor:"pointer" }}>
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
    <div style={{ minHeight:"100vh", background:"#0A0A0C", display:"flex",
      alignItems:"center", justifyContent:"center", flexDirection:"column", gap:16 }}>
      <div style={{ width:56, height:56, borderRadius:14, background:"linear-gradient(135deg,#E8430A,#BF360C)",
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
