import { useState, useEffect, useCallback, useRef, memo } from "react";

// ─────────────────────────────────────────────────────────────
// TOKENS
// ─────────────────────────────────────────────────────────────
const T = {
  bg:"#0A0A0C", surface:"#14141A", surfaceHi:"#1C1C24", card:"#18181F",
  border:"#252530", borderHi:"#323240",
  accent:"#E8430A", accentDk:"#BF360C", accentDm:"#2D1200",
  gold:"#C9A84C", goldDm:"#1E1600",
  purple:"#9B59B6", blue:"#3B82F6", green:"#22C55E",
  cyan:"#06B6D4", danger:"#EF4444",
  text:"#F2EEE8", sub:"#AAA6A0", muted:"#6B6878", faint:"#3D3D4E",
  hyperBg:"#1a0a2e", hyperTx:"#b388ff", hyperBd:"#6a0dad",
  exoticTx:"#E8430A", sportsBg:"#0a1a2e", sportsTx:"#60a5fa",
};

// ─────────────────────────────────────────────────────────────
// STYLES — injected once
// ─────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800;900&family=Inter:wght@400;500;600;700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:${T.bg};font-family:'Inter',sans-serif;color:${T.text};-webkit-font-smoothing:antialiased}
::-webkit-scrollbar{width:4px;height:4px}
::-webkit-scrollbar-track{background:${T.bg}}
::-webkit-scrollbar-thumb{background:${T.border};border-radius:2px}
button{cursor:pointer;font-family:inherit;border:none;background:none;color:inherit}
input,textarea{font-family:inherit;outline:none}
img{display:block}
:focus-visible{outline:2px solid ${T.accent};outline-offset:2px}

/* Animations */
@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@keyframes shimmer{0%{background-position:-600px 0}100%{background-position:600px 0}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes heartPop{0%{transform:scale(1)}50%{transform:scale(1.4)}100%{transform:scale(1)}}
@keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}
@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
@keyframes glow{0%,100%{box-shadow:0 0 0 0 ${T.accent}40}50%{box-shadow:0 0 20px 4px ${T.accent}30}}

.fade-up{animation:fadeUp .3s ease forwards}
.shimmer{background:linear-gradient(90deg,${T.surface} 25%,${T.surfaceHi} 50%,${T.surface} 75%);background-size:600px 100%;animation:shimmer 1.4s ease-in-out infinite}
.heart-pop{animation:heartPop .3s ease}

/* Cards */
.spot-card{background:${T.card};border:1px solid ${T.border};border-radius:16px;overflow:hidden;transition:transform .2s,box-shadow .2s}
.spot-card:hover{transform:translateY(-2px);box-shadow:0 8px 32px rgba(232,67,10,.18)}

/* Buttons */
.btn-primary{background:${T.accent};color:#fff;border-radius:12px;padding:12px 20px;font-weight:700;font-size:14px;transition:background .15s,transform .1s}
.btn-primary:hover{background:${T.accentDk}}
.btn-primary:active{transform:scale(.97)}
.btn-ghost{border:1px solid ${T.border};color:${T.sub};border-radius:10px;padding:8px 16px;font-size:13px;font-weight:600;transition:border-color .15s,color .15s}
.btn-ghost:hover{border-color:${T.accent};color:${T.accent}}

/* Tabs */
.tab-btn{padding:10px 14px;font-size:12px;font-weight:600;color:${T.muted};border-bottom:2px solid transparent;white-space:nowrap;transition:color .15s,border-color .15s}
.tab-btn.active{color:${T.accent};border-bottom-color:${T.accent}}

/* Nav */
.nav-item{display:flex;flex-direction:column;align-items:center;gap:3px;padding:8px 12px;color:${T.muted};font-size:10px;font-weight:600;transition:color .15s;border:none;background:none;cursor:pointer}
.nav-item.active{color:${T.accent}}
.nav-dot{width:4px;height:4px;border-radius:50%;background:${T.accent};margin-top:2px}

/* Story ring */
.story-ring{border-radius:50%;padding:2px;background:linear-gradient(135deg,${T.accent},${T.gold})}

@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`;

if (typeof document !== "undefined" && !document.getElementById("sd-app-styles")) {
  const el = document.createElement("style");
  el.id = "sd-app-styles";
  el.textContent = CSS;
  document.head.appendChild(el);
}

// ─────────────────────────────────────────────────────────────
// MOCK DATA
// ─────────────────────────────────────────────────────────────
const USERS = {
  apex_hunter:     { handle:"apex_hunter",     name:"Tyler Rhodes",   initials:"TR", verified:true,  followers:"18.4k", spots:412 },
  euro_spotter:    { handle:"euro_spotter",     name:"Lena Müller",    initials:"LM", verified:false, followers:"54.2k", spots:889 },
  jdm_tokyo:       { handle:"jdm_tokyo",        name:"Kenji Tanaka",   initials:"KT", verified:true,  followers:"91k",   spots:1204 },
  la_spotter:      { handle:"la_spotter",       name:"Marcus Webb",    initials:"MW", verified:false, followers:"12.1k", spots:203 },
  gulf_spots:      { handle:"gulf_spots",       name:"Omar Al-Rashid", initials:"OR", verified:true,  followers:"38.7k", spots:567 },
  nurburgring_nut: { handle:"nurburgring_nut",  name:"Hans Fischer",   initials:"HF", verified:false, followers:"8.3k",  spots:145 },
};

const SPOTS = [
  {
    id:"s1", userId:"apex_hunter",
    make:"Lamborghini", model:"Huracán STO", year:2023, rarity:"Exotic",
    color:"Verde Mantis", location:"Rodeo Drive, Beverly Hills",
    image:"https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=900&q=85",
    likes:2841, comments:94, saves:312, time:"12m ago",
    tags:["Lamborghini","STO","TrackSpecial"],
    description:"Caught this STO parked outside Gucci. Owner mentioned it's track-prepped for Laguna Seca next weekend. Verde Mantis in person is something else.",
    liked:false, saved:false,
  },
  {
    id:"s2", userId:"euro_spotter",
    make:"Ferrari", model:"SF90 Stradale", year:2022, rarity:"Hypercar",
    color:"Rosso Corsa", location:"Monaco, Monte Carlo",
    image:"https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=900&q=85",
    likes:5102, comments:218, saves:891, time:"1h ago",
    tags:["Ferrari","SF90","Hybrid"],
    description:"SF90 rolling out of Casino Square. The hybrid whine at low speed is completely unlike any combustion car I've heard. Rosso Corsa with Assetto Fiorano pack.",
    liked:true, saved:false,
  },
  {
    id:"s3", userId:"jdm_tokyo",
    make:"Bugatti", model:"Chiron Super Sport", year:2023, rarity:"Hypercar",
    color:"Atlantic Blue", location:"Shibuya, Tokyo",
    image:"https://images.unsplash.com/photo-1525609004556-c46c7d6cf023?w=900&q=85",
    likes:9441, comments:507, saves:2103, time:"3h ago",
    tags:["Bugatti","Chiron","1500HP"],
    description:"Never thought I'd see a Chiron SS in Shibuya. The W16 sound echoing off the buildings was insane. Owner said it was brought over specifically for a photo shoot.",
    liked:false, saved:true,
  },
  {
    id:"s4", userId:"la_spotter",
    make:"McLaren", model:"P1", year:2015, rarity:"Hypercar",
    color:"Volcano Orange", location:"Pacific Coast Highway, Malibu",
    image:"https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=900&q=85",
    likes:7230, comments:389, saves:1450, time:"5h ago",
    tags:["McLaren","P1","HybridHypercar"],
    description:"PCH morning cruise with this P1. Pulled over and let me get a clean shot — legends exist. The carbon aero is fully deployed and the rear diffuser is enormous in person.",
    liked:true, saved:true,
  },
  {
    id:"s5", userId:"gulf_spots",
    make:"Pagani", model:"Huayra Roadster BC", year:2021, rarity:"Exotic",
    color:"Argento Liquido", location:"Dubai Marina, UAE",
    image:"https://images.unsplash.com/photo-1493238792000-8113da705763?w=900&q=85",
    likes:11800, comments:623, saves:3201, time:"8h ago",
    tags:["Pagani","Huayra","HandBuilt"],
    description:"One of 40 worldwide. The barchetta bodywork in this silver is something else entirely. AMG V12 bi-turbo. The exhausts exit right behind the headrests.",
    liked:false, saved:false,
  },
  {
    id:"s6", userId:"nurburgring_nut",
    make:"Porsche", model:"918 Spyder", year:2015, rarity:"Hypercar",
    color:"Acid Green", location:"Nürburgring, Germany",
    image:"https://images.unsplash.com/photo-1614200187524-dc4b892acf16?w=900&q=85",
    likes:4980, comments:271, saves:870, time:"Yesterday",
    tags:["Porsche","918","Weissach"],
    description:"918 with Weissach package doing a tourist lap. The magnesium wheels are the giveaway. Acid Green on the Nürburgring backdrop is genuinely stunning.",
    liked:false, saved:false,
  },
];

const NOTIFICATIONS = [
  { id:"n1", type:"like",    user:"euro_spotter",    msg:"liked your Lamborghini spot",   time:"2m ago",  read:false },
  { id:"n2", type:"follow",  user:"jdm_tokyo",       msg:"started following you",          time:"14m ago", read:false },
  { id:"n3", type:"comment", user:"gulf_spots",      msg:"commented: \"Absolute legend\"", time:"1h ago",  read:false },
  { id:"n4", type:"like",    user:"la_spotter",      msg:"liked your Ferrari spot",        time:"2h ago",  read:true  },
  { id:"n5", type:"save",    user:"nurburgring_nut", msg:"saved your Bugatti spot",        time:"3h ago",  read:true  },
  { id:"n6", type:"like",    user:"apex_hunter",     msg:"liked your McLaren spot",        time:"5h ago",  read:true  },
];

// ─────────────────────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────────────────────
const fmt = (n) => {
  const v = Number(n) || 0;
  return v >= 1000 ? `${(v/1000).toFixed(1)}k` : String(v);
};

const RARITY = {
  Hypercar: { bg:T.hyperBg, text:T.hyperTx, border:T.hyperBd },
  Exotic:   { bg:T.accentDm, text:T.accent, border:T.accent },
  Sports:   { bg:T.sportsBg, text:T.sportsTx, border:T.sportsTx },
};

// ─────────────────────────────────────────────────────────────
// ICONS
// ─────────────────────────────────────────────────────────────
const Ic = {
  Home:     (a) => <svg {...a} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  Compass:  (a) => <svg {...a} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>,
  Map:      (a) => <svg {...a} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>,
  Bell:     (a) => <svg {...a} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  User:     (a) => <svg {...a} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  Plus:     (a) => <svg {...a} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Heart:    ({filled,...a}) => <svg {...a} viewBox="0 0 24 24" fill={filled?"#E8430A":"none"} stroke={filled?"#E8430A":"currentColor"} strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
  Bookmark: ({filled,...a}) => <svg {...a} viewBox="0 0 24 24" fill={filled?"#C9A84C":"none"} stroke={filled?"#C9A84C":"currentColor"} strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>,
  Share2:   (a) => <svg {...a} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>,
  MessageC: (a) => <svg {...a} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  Pin:      (a) => <svg {...a} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  Camera:   (a) => <svg {...a} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  X:        (a) => <svg {...a} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Check:    (a) => <svg {...a} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>,
  Grid:     (a) => <svg {...a} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  List:     (a) => <svg {...a} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  Search:   (a) => <svg {...a} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  Fire:     (a) => <svg {...a} viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12.6 2.4C9.5 5.2 8 8.3 8 11c0 2.2 1.8 4 4 4s4-1.8 4-4c0-1.1-.4-2.1-1.1-2.9C15.6 9.6 16 11 16 12c0 2.2-1.8 4-4 4-3.3 0-6-2.7-6-6 0-4.8 4-8 6.6-7.6z"/></svg>,
  Verified: (a) => <svg {...a} viewBox="0 0 24 24" fill={T.accent} stroke="none"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>,
  ChevronL: (a) => <svg {...a} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>,
  Settings: (a) => <svg {...a} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
};

const I = (C) => (props) => <C width={props.size||20} height={props.size||20} aria-hidden="true" {...props} />;
Object.keys(Ic).forEach(k => { Ic[k] = I(Ic[k]); });

// ─────────────────────────────────────────────────────────────
// ATOMS
// ─────────────────────────────────────────────────────────────
const Avatar = memo(({ initials, size=36, ring=false, online=false }) => {
  const fs = Math.round(size * 0.36);
  const content = (
    <div style={{ width:size, height:size, borderRadius:"50%", flexShrink:0, position:"relative",
      background:`linear-gradient(135deg, ${T.accent}, #7c1a02)`,
      display:"flex", alignItems:"center", justifyContent:"center",
      fontSize:fs, fontWeight:700, color:"#fff",
      boxShadow: ring ? `0 0 0 2px ${T.bg}, 0 0 0 4px ${T.accent}` : "none" }}>
      {initials}
      {online && <span style={{ position:"absolute", bottom:1, right:1, width:Math.max(8,size*.22),
        height:Math.max(8,size*.22), borderRadius:"50%", background:T.green,
        border:`2px solid ${T.bg}` }} />}
    </div>
  );
  return content;
});

const RarityPill = memo(({ rarity }) => {
  const r = RARITY[rarity] || RARITY.Sports;
  return (
    <span style={{ background:r.bg, color:r.text, border:`1px solid ${r.border}`,
      borderRadius:6, padding:"3px 9px", fontSize:10, fontWeight:700,
      letterSpacing:"0.07em", textTransform:"uppercase" }}>
      {rarity}
    </span>
  );
});

const Tag = ({ label }) => (
  <span style={{ fontSize:10, color:T.muted, background:T.border,
    borderRadius:5, padding:"2px 7px" }}>#{label}</span>
);

// ─────────────────────────────────────────────────────────────
// SKELETON
// ─────────────────────────────────────────────────────────────
const Sk = ({ w="100%", h=14, r=6 }) => (
  <div className="shimmer" style={{ width:w, height:h, borderRadius:r }} />
);
const SkeletonCard = () => (
  <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:16, overflow:"hidden" }}>
    <Sk h={220} r={0} />
    <div style={{ padding:14, display:"flex", flexDirection:"column", gap:10 }}>
      <div style={{ display:"flex", gap:10 }}>
        <Sk w={32} h={32} r={99} />
        <div style={{ flex:1, display:"flex", flexDirection:"column", gap:6 }}>
          <Sk w="55%" h={11} />
          <Sk w="35%" h={10} />
        </div>
      </div>
      <Sk w="70%" h={20} />
      <Sk h={11} />
      <Sk w="60%" h={11} />
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────
// SPOT CARD  (feed card)
// ─────────────────────────────────────────────────────────────
function SpotCard({ spot, onTap, onLike, onSave, compact=false }) {
  const [liked, setLiked] = useState(spot.liked);
  const [saved, setSaved] = useState(spot.saved);
  const [likes, setLikes] = useState(spot.likes);
  const [saves, setSaves] = useState(spot.saves);
  const [imgErr, setImgErr] = useState(false);
  const [pop, setPop] = useState(false);
  const user = USERS[spot.userId];
  const r    = RARITY[spot.rarity] || RARITY.Sports;

  const handleLike = (e) => {
    e.stopPropagation();
    const next = !liked;
    setLiked(next);
    setLikes(n => next ? n+1 : n-1);
    if (next) { setPop(true); setTimeout(() => setPop(false), 350); }
    onLike?.(spot.id, next);
  };
  const handleSave = (e) => {
    e.stopPropagation();
    const next = !saved;
    setSaved(next);
    setSaves(n => next ? n+1 : n-1);
    onSave?.(spot.id, next);
  };

  return (
    <div className="spot-card" onClick={() => onTap?.(spot)} style={{ cursor:"pointer" }}>
      {/* Image */}
      <div style={{ position:"relative", paddingTop: compact ? "55%" : "62%", overflow:"hidden" }}>
        {!imgErr && spot.image
          ? <img src={spot.image} alt={`${spot.make} ${spot.model}`} loading="lazy"
              onError={() => setImgErr(true)}
              style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover" }} />
          : <div style={{ position:"absolute", inset:0, background:`linear-gradient(135deg,${T.accentDm},${T.surfaceHi})`,
              display:"flex", alignItems:"center", justifyContent:"center", fontSize:48 }}>🏎</div>
        }
        {/* Gradient overlay */}
        <div style={{ position:"absolute", inset:0,
          background:"linear-gradient(to bottom, transparent 50%, rgba(0,0,0,.6) 100%)" }} />
        {/* Badges */}
        <div style={{ position:"absolute", top:10, left:10 }}>
          <RarityPill rarity={spot.rarity} />
        </div>
        <div style={{ position:"absolute", top:10, right:10, background:"rgba(0,0,0,.6)",
          borderRadius:6, padding:"3px 8px", fontSize:10, fontWeight:600, color:T.muted }}>
          {spot.year}
        </div>
        {/* Make/model on image */}
        <div style={{ position:"absolute", bottom:10, left:12, right:12 }}>
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:22, fontWeight:900,
            color:"#fff", lineHeight:1, textShadow:"0 2px 8px rgba(0,0,0,.7)", letterSpacing:"-.01em" }}>
            {spot.make} {spot.model}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding:"12px 14px 10px" }}>
        {/* Spotter */}
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
          <Avatar initials={user?.initials} size={28} />
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:4 }}>
              <span style={{ fontSize:12, fontWeight:600, color:T.text }}>{user?.handle}</span>
              {user?.verified && <Ic.Verified size={12} />}
            </div>
            <div style={{ fontSize:10, color:T.muted, display:"flex", alignItems:"center", gap:3 }}>
              <Ic.Pin size={10} style={{ flexShrink:0 }} />
              <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{spot.location}</span>
            </div>
          </div>
          <span style={{ fontSize:10, color:T.faint }}>{spot.time}</span>
        </div>

        {!compact && (
          <p style={{ fontSize:12, color:T.muted, lineHeight:1.55, marginBottom:10,
            display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden" }}>
            {spot.description}
          </p>
        )}

        {/* Tags */}
        <div style={{ display:"flex", gap:5, marginBottom:10, overflow:"hidden" }}>
          {spot.tags.slice(0,3).map(t => <Tag key={t} label={t} />)}
        </div>

        {/* Actions */}
        <div style={{ display:"flex", alignItems:"center", gap:16,
          paddingTop:10, borderTop:`1px solid ${T.border}` }}>
          <button onClick={handleLike} aria-label={`${liked?"Unlike":"Like"} — ${fmt(likes)} likes`}
            aria-pressed={liked}
            style={{ display:"flex", alignItems:"center", gap:5, color:liked?T.accent:T.muted,
              fontSize:12, fontWeight:600, border:"none", background:"none",
              transition:"color .15s" }}>
            <span className={pop ? "heart-pop" : ""}><Ic.Heart filled={liked} size={17} /></span>
            {fmt(likes)}
          </button>
          <button style={{ display:"flex", alignItems:"center", gap:5, color:T.muted,
            fontSize:12, fontWeight:600, border:"none", background:"none" }}>
            <Ic.MessageC size={17} /> {fmt(spot.comments)}
          </button>
          <button onClick={handleSave} aria-label={`${saved?"Unsave":"Save"}`} aria-pressed={saved}
            style={{ display:"flex", alignItems:"center", gap:5, color:saved?T.gold:T.muted,
              fontSize:12, fontWeight:600, border:"none", background:"none", transition:"color .15s" }}>
            <Ic.Bookmark filled={saved} size={17} /> {fmt(saves)}
          </button>
          <button style={{ marginLeft:"auto", color:T.muted, border:"none", background:"none" }}
            aria-label="Share"><Ic.Share2 size={17} /></button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SPOT DETAIL  (full screen modal)
// ─────────────────────────────────────────────────────────────
function SpotDetail({ spot, onClose }) {
  const [liked, setLiked] = useState(spot.liked);
  const [saved, setSaved] = useState(spot.saved);
  const [likes, setLikes] = useState(spot.likes);
  const [saves, setSaves] = useState(spot.saves);
  const [comment, setComment] = useState("");
  const user = USERS[spot.userId];

  useEffect(() => {
    const fn = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [onClose]);

  const COMMENTS_MOCK = [
    { user:"jdm_tokyo",  text:"This is insane. The Weissach spec too 🔥", time:"2m" },
    { user:"gulf_spots", text:"Only 918 ever made. Finding one is like finding a unicorn.", time:"15m" },
    { user:"la_spotter", text:"Acid Green is the only correct colour for this car.", time:"1h" },
  ];

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.88)", zIndex:500,
      backdropFilter:"blur(6px)", display:"flex", alignItems:"flex-end", justifyContent:"center" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background:T.surface, width:"100%", maxWidth:480, maxHeight:"92vh",
        overflowY:"auto", borderRadius:"20px 20px 0 0", animation:"slideUp .3s ease" }}>
        {/* Hero image */}
        <div style={{ position:"relative", aspectRatio:"16/9" }}>
          <img src={spot.image} alt={`${spot.make} ${spot.model}`}
            style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
          <button onClick={onClose} aria-label="Close"
            style={{ position:"absolute", top:12, right:12, background:"rgba(0,0,0,.6)",
              border:"none", borderRadius:"50%", width:32, height:32, color:"#fff",
              display:"flex", alignItems:"center", justifyContent:"center" }}>
            <Ic.X size={15} />
          </button>
          <div style={{ position:"absolute", top:12, left:12 }}>
            <RarityPill rarity={spot.rarity} />
          </div>
        </div>

        <div style={{ padding:"16px 18px" }}>
          {/* Title */}
          <div style={{ marginBottom:12 }}>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:28, fontWeight:900,
              color:T.text, lineHeight:1, letterSpacing:"-.02em" }}>
              {spot.make} {spot.model}
            </div>
            <div style={{ fontSize:12, color:T.muted, marginTop:4, display:"flex", gap:10 }}>
              <span>{spot.year}</span>
              <span>·</span>
              <span>{spot.color}</span>
              <span>·</span>
              <span style={{ display:"flex", alignItems:"center", gap:3 }}>
                <Ic.Pin size={11} />{spot.location}
              </span>
            </div>
          </div>

          {/* Spotter card */}
          <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px",
            background:T.bg, borderRadius:12, border:`1px solid ${T.border}`, marginBottom:14 }}>
            <Avatar initials={user?.initials} size={40} />
            <div style={{ flex:1 }}>
              <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                <span style={{ fontSize:14, fontWeight:700, color:T.text }}>@{user?.handle}</span>
                {user?.verified && <Ic.Verified size={13} />}
              </div>
              <span style={{ fontSize:11, color:T.muted }}>Spotted {spot.time}</span>
            </div>
            <button className="btn-ghost" style={{ fontSize:12, padding:"6px 14px" }}>Follow</button>
          </div>

          {/* Description */}
          <p style={{ fontSize:13, color:T.sub, lineHeight:1.65, marginBottom:14 }}>
            {spot.description}
          </p>

          {/* Tags */}
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:14 }}>
            {spot.tags.map(t => <Tag key={t} label={t} />)}
          </div>

          {/* Stats */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)",
            borderTop:`1px solid ${T.border}`, borderBottom:`1px solid ${T.border}`,
            padding:"12px 0", marginBottom:14 }}>
            {[["Likes", fmt(likes)], ["Comments", fmt(spot.comments)], ["Saves", fmt(saves)]].map(([l,v]) => (
              <div key={l} style={{ textAlign:"center" }}>
                <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:22,
                  fontWeight:900, color:T.text }}>{v}</div>
                <div style={{ fontSize:10, color:T.muted, textTransform:"uppercase",
                  letterSpacing:".05em" }}>{l}</div>
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div style={{ display:"flex", gap:8, marginBottom:18 }}>
            <button onClick={() => { const n=!liked; setLiked(n); setLikes(x=>n?x+1:x-1); }}
              style={{ flex:1, padding:"11px", borderRadius:10, border:`1px solid ${liked?T.accent:T.border}`,
                background:liked?T.accentDm:T.bg, color:liked?T.accent:T.muted,
                display:"flex", alignItems:"center", justifyContent:"center", gap:7,
                fontSize:13, fontWeight:600, transition:"all .15s" }}>
              <Ic.Heart filled={liked} size={16} /> {liked?"Liked":"Like"}
            </button>
            <button onClick={() => { const n=!saved; setSaved(n); setSaves(x=>n?x+1:x-1); }}
              style={{ flex:1, padding:"11px", borderRadius:10, border:`1px solid ${saved?T.gold:T.border}`,
                background:saved?T.goldDm:T.bg, color:saved?T.gold:T.muted,
                display:"flex", alignItems:"center", justifyContent:"center", gap:7,
                fontSize:13, fontWeight:600, transition:"all .15s" }}>
              <Ic.Bookmark filled={saved} size={16} /> {saved?"Saved":"Save"}
            </button>
            <button style={{ padding:"11px 14px", borderRadius:10, border:`1px solid ${T.border}`,
              background:T.bg, color:T.muted, display:"flex", alignItems:"center" }}>
              <Ic.Share2 size={16} />
            </button>
          </div>

          {/* Comments */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:12, fontWeight:700, color:T.text, marginBottom:12 }}>
              Comments ({fmt(spot.comments)})
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {COMMENTS_MOCK.map((c,i) => {
                const cu = USERS[c.user];
                return (
                  <div key={i} style={{ display:"flex", gap:9 }}>
                    <Avatar initials={cu?.initials} size={28} />
                    <div style={{ flex:1, background:T.bg, borderRadius:10, padding:"8px 10px" }}>
                      <div style={{ fontSize:11, fontWeight:700, color:T.text, marginBottom:2 }}>
                        @{c.user}
                      </div>
                      <div style={{ fontSize:12, color:T.sub }}>{c.text}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Comment input */}
          <div style={{ display:"flex", gap:8 }}>
            <Avatar initials="YO" size={32} />
            <div style={{ flex:1, display:"flex", gap:8 }}>
              <input value={comment} onChange={e=>setComment(e.target.value)}
                placeholder="Add a comment…"
                style={{ flex:1, background:T.bg, border:`1px solid ${T.border}`, borderRadius:20,
                  padding:"8px 14px", color:T.text, fontSize:13 }} />
              {comment && (
                <button style={{ background:T.accent, border:"none", borderRadius:20,
                  padding:"8px 14px", color:"#fff", fontSize:12, fontWeight:700 }}>
                  Post
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// UPLOAD MODAL
// ─────────────────────────────────────────────────────────────
function UploadModal({ onClose }) {
  const [step, setStep] = useState(1);
  const [preview, setPreview] = useState(null);
  const [form, setForm] = useState({ make:"", model:"", year:"", rarity:"Exotic", location:"", desc:"" });
  const [posting, setPosting] = useState(false);
  const [done, setDone] = useState(false);
  const fileRef = useRef();

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPreview(URL.createObjectURL(f));
    setStep(2);
  };

  const handlePost = () => {
    setPosting(true);
    setTimeout(() => { setPosting(false); setDone(true);
      setTimeout(onClose, 2000); }, 1800);
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.9)", zIndex:600,
      backdropFilter:"blur(8px)", display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
      <div style={{ background:T.surface, width:"100%", maxWidth:480,
        borderRadius:"20px 20px 0 0", maxHeight:"90vh", overflowY:"auto",
        animation:"slideUp .25s ease" }}>
        {/* Header */}
        <div style={{ padding:"16px 18px 12px", borderBottom:`1px solid ${T.border}`,
          display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <span style={{ fontSize:16, fontWeight:800, color:T.text }}>
            {done ? "Posted! 🎉" : step===1 ? "Post a Spot" : "Add Details"}
          </span>
          <button onClick={onClose} style={{ color:T.muted, border:"none", background:"none" }}>
            <Ic.X size={18} />
          </button>
        </div>

        <div style={{ padding:"18px" }}>
          {done ? (
            <div style={{ textAlign:"center", padding:"32px 0" }}>
              <div style={{ fontSize:56, marginBottom:12 }}>🔥</div>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:24, fontWeight:900,
                color:T.text, marginBottom:6 }}>Spot is Live!</div>
              <div style={{ fontSize:13, color:T.muted }}>Your community can see it now.</div>
            </div>
          ) : step === 1 ? (
            <div onClick={() => fileRef.current?.click()}
              style={{ border:`2px dashed ${T.border}`, borderRadius:14, padding:"48px 20px",
                textAlign:"center", cursor:"pointer", transition:"border-color .15s",
                background:T.bg }}
              onMouseEnter={e=>e.currentTarget.style.borderColor=T.accent}
              onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
              <div style={{ fontSize:36, marginBottom:10 }}>📸</div>
              <div style={{ fontSize:15, fontWeight:700, color:T.text, marginBottom:4 }}>
                Drop your photo here
              </div>
              <div style={{ fontSize:12, color:T.muted }}>JPG, PNG, HEIC · Max 30 MB</div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }}
                onChange={handleFile} />
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              {preview && (
                <img src={preview} alt="preview" style={{ width:"100%", height:180,
                  objectFit:"cover", borderRadius:12 }} />
              )}
              {/* Form fields */}
              {[
                { key:"make",     label:"Make",        placeholder:"e.g. Ferrari"       },
                { key:"model",    label:"Model",       placeholder:"e.g. SF90 Stradale" },
                { key:"year",     label:"Year",        placeholder:"e.g. 2023"          },
                { key:"location", label:"Location",    placeholder:"City, Country"      },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label style={{ fontSize:11, color:T.muted, fontWeight:600,
                    textTransform:"uppercase", letterSpacing:".05em", display:"block", marginBottom:5 }}>
                    {label}
                  </label>
                  <input value={form[key]} onChange={e=>setForm(p=>({...p,[key]:e.target.value}))}
                    placeholder={placeholder}
                    style={{ width:"100%", background:T.bg, border:`1px solid ${T.border}`,
                      borderRadius:10, padding:"10px 12px", color:T.text, fontSize:13 }} />
                </div>
              ))}
              {/* Rarity picker */}
              <div>
                <label style={{ fontSize:11, color:T.muted, fontWeight:600, textTransform:"uppercase",
                  letterSpacing:".05em", display:"block", marginBottom:5 }}>Rarity</label>
                <div style={{ display:"flex", gap:8 }}>
                  {["Sports","Exotic","Hypercar"].map(r => {
                    const rc = RARITY[r];
                    const active = form.rarity === r;
                    return (
                      <button key={r} onClick={()=>setForm(p=>({...p,rarity:r}))}
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
                <label style={{ fontSize:11, color:T.muted, fontWeight:600, textTransform:"uppercase",
                  letterSpacing:".05em", display:"block", marginBottom:5 }}>Description</label>
                <textarea value={form.desc} onChange={e=>setForm(p=>({...p,desc:e.target.value}))}
                  placeholder="Tell the story behind this spot…" rows={3}
                  style={{ width:"100%", background:T.bg, border:`1px solid ${T.border}`,
                    borderRadius:10, padding:"10px 12px", color:T.text, fontSize:13,
                    resize:"vertical", lineHeight:1.55 }} />
              </div>
              <button onClick={handlePost} disabled={posting||!form.make||!form.model}
                style={{ width:"100%", padding:"14px",
                  background:`linear-gradient(135deg,${T.accent},${T.accentDk})`,
                  border:"none", borderRadius:12, color:"#fff", fontSize:15, fontWeight:800,
                  opacity:(!form.make||!form.model) ? .5 : 1, cursor:"pointer",
                  display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                {posting ? <><span style={{ animation:"spin .8s linear infinite", display:"inline-block" }}>⟳</span> Posting…</> : "Post Spot →"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SCREENS
// ─────────────────────────────────────────────────────────────

// ── FEED ──────────────────────────────────────────────────────
function FeedScreen({ onSpotTap }) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 1200);
    return () => clearTimeout(t);
  }, []);

  const stories = Object.values(USERS).slice(0,5);

  return (
    <div>
      {/* Stories */}
      <div style={{ padding:"14px 16px 10px", borderBottom:`1px solid ${T.border}` }}>
        <div style={{ display:"flex", gap:12, overflowX:"auto", paddingBottom:2 }}>
          {/* Your story */}
          <div style={{ flexShrink:0, textAlign:"center" }}>
            <div style={{ width:54, height:54, borderRadius:"50%", background:T.surfaceHi,
              border:`2px dashed ${T.border}`, display:"flex", alignItems:"center",
              justifyContent:"center", marginBottom:4 }}>
              <Ic.Plus size={20} style={{ color:T.accent }} />
            </div>
            <div style={{ fontSize:10, color:T.muted }}>Your Story</div>
          </div>
          {/* Other stories */}
          {stories.map(u => (
            <div key={u.handle} style={{ flexShrink:0, textAlign:"center" }}>
              <div className="story-ring" style={{ width:58, height:58, marginBottom:4, display:"inline-block" }}>
                <div style={{ margin:2, borderRadius:"50%", overflow:"hidden" }}>
                  <Avatar initials={u.initials} size={50} />
                </div>
              </div>
              <div style={{ fontSize:10, color:T.muted, maxWidth:54, overflow:"hidden",
                textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{u.handle}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Hot banner */}
      <div style={{ margin:"12px 14px", padding:"10px 14px",
        background:T.accentDm, border:`1px solid ${T.accent}30`,
        borderRadius:12, display:"flex", alignItems:"center", gap:8, fontSize:13 }}>
        <Ic.Fire size={15} style={{ color:T.accent, flexShrink:0 }} />
        <span style={{ color:T.text, fontWeight:600 }}>Trending: </span>
        <span style={{ color:T.muted, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
          Bugatti Chiron SS in Tokyo · 9.4k likes
        </span>
      </div>

      {/* Cards */}
      <div style={{ display:"flex", flexDirection:"column", gap:14, padding:"0 14px 14px" }}>
        {loading
          ? Array(3).fill(0).map((_,i) => <SkeletonCard key={i} />)
          : SPOTS.map(s => (
              <div key={s.id} className="fade-up">
                <SpotCard spot={s} onTap={onSpotTap} />
              </div>
            ))
        }
      </div>
    </div>
  );
}

// ── EXPLORE ────────────────────────────────────────────────────
function ExploreScreen({ onSpotTap }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [view, setView] = useState("grid");
  const filters = ["All","Hypercar","Exotic","Sports"];

  const filtered = SPOTS.filter(s => {
    const mq = !query || `${s.make} ${s.model} ${s.location}`.toLowerCase().includes(query.toLowerCase());
    const mf = filter === "All" || s.rarity === filter;
    return mq && mf;
  });

  return (
    <div style={{ padding:"14px" }}>
      {/* Search */}
      <div style={{ position:"relative", marginBottom:12 }}>
        <Ic.Search size={15} style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)",
          color:T.muted, pointerEvents:"none" }} />
        <input value={query} onChange={e=>setQuery(e.target.value)}
          placeholder="Search make, model, location…"
          style={{ width:"100%", background:T.card, border:`1px solid ${T.border}`, borderRadius:12,
            padding:"11px 14px 11px 36px", color:T.text, fontSize:14 }} />
      </div>

      {/* Filters + view toggle */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
        <div style={{ display:"flex", gap:6, overflowX:"auto" }}>
          {filters.map(f => (
            <button key={f} onClick={()=>setFilter(f)}
              style={{ padding:"6px 14px", borderRadius:20, fontSize:12, fontWeight:600,
                background: filter===f ? T.accentDm : T.card,
                border: `1px solid ${filter===f ? T.accent : T.border}`,
                color: filter===f ? T.accent : T.muted,
                transition:"all .15s", whiteSpace:"nowrap" }}>
              {f}
            </button>
          ))}
        </div>
        <div style={{ display:"flex", gap:4, marginLeft:8 }}>
          {[["grid",<Ic.Grid size={15} />],["list",<Ic.List size={15} />]].map(([v,icon]) => (
            <button key={v} onClick={()=>setView(v)}
              style={{ padding:"6px", borderRadius:8, color:view===v?T.accent:T.muted,
                background:view===v?T.accentDm:"none", border:"none" }}>
              {icon}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div style={{ textAlign:"center", padding:"60px 0" }}>
          <div style={{ fontSize:40, marginBottom:12 }}>🔍</div>
          <div style={{ fontSize:16, fontWeight:700, color:T.text, marginBottom:6 }}>No spots found</div>
          <div style={{ fontSize:13, color:T.muted }}>Try a different make or location</div>
        </div>
      ) : view === "grid" ? (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          {filtered.map(s => (
            <div key={s.id} style={{ cursor:"pointer" }} onClick={()=>onSpotTap(s)}>
              <div style={{ borderRadius:12, overflow:"hidden", position:"relative", aspectRatio:"1" }}>
                <img src={s.image} alt={`${s.make} ${s.model}`} loading="lazy"
                  style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                <div style={{ position:"absolute", inset:0,
                  background:"linear-gradient(to bottom, transparent 40%, rgba(0,0,0,.75))" }} />
                <div style={{ position:"absolute", top:6, left:6 }}>
                  <RarityPill rarity={s.rarity} />
                </div>
                <div style={{ position:"absolute", bottom:8, left:8, right:8 }}>
                  <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:14,
                    fontWeight:800, color:"#fff", lineHeight:1.1 }}>{s.make} {s.model}</div>
                  <div style={{ fontSize:10, color:"rgba(255,255,255,.6)" }}>{s.location}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {filtered.map(s => (
            <div key={s.id} onClick={()=>onSpotTap(s)}
              style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12,
                padding:"10px 12px", display:"flex", gap:12, cursor:"pointer",
                transition:"border-color .15s" }}
              onMouseEnter={e=>e.currentTarget.style.borderColor=T.accent}
              onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
              <img src={s.image} alt={`${s.make} ${s.model}`} loading="lazy"
                style={{ width:70, height:52, objectFit:"cover", borderRadius:8, flexShrink:0 }} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:16,
                  fontWeight:800, color:T.text }}>{s.make} {s.model}</div>
                <div style={{ fontSize:11, color:T.muted, display:"flex", alignItems:"center", gap:3 }}>
                  <Ic.Pin size={10} />{s.location}
                </div>
                <div style={{ display:"flex", gap:8, marginTop:4 }}>
                  <RarityPill rarity={s.rarity} />
                  <span style={{ fontSize:10, color:T.muted, display:"flex", alignItems:"center", gap:3 }}>
                    <Ic.Heart size={10} filled={false} />{fmt(s.likes)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── MAP ────────────────────────────────────────────────────────
function MapScreen({ onSpotTap }) {
  const [hovered, setHovered] = useState(null);
  const pins = SPOTS.map((s,i) => ({
    ...s,
    px: 8 + ((i*139+17)%82),
    py: 10 + ((i*97+31)%72),
  }));

  return (
    <div>
      {/* Map canvas */}
      <div style={{ position:"relative", height:320, background:"#0d0f14", overflow:"hidden" }}>
        {/* Grid lines */}
        <div style={{ position:"absolute", inset:0, opacity:.15,
          backgroundImage:`linear-gradient(${T.border} 1px,transparent 1px),linear-gradient(90deg,${T.border} 1px,transparent 1px)`,
          backgroundSize:"44px 44px" }} />
        {/* Warm glow */}
        <div style={{ position:"absolute", inset:0,
          background:`radial-gradient(ellipse at 40% 55%, ${T.accentDm} 0%, transparent 65%)` }} />
        {/* Map label */}
        <div style={{ position:"absolute", top:12, left:12,
          background:"rgba(0,0,0,.7)", borderRadius:8, padding:"5px 10px",
          fontSize:10, color:T.muted, border:`1px solid ${T.border}` }}>
          🗺 Mapbox GL JS · Live in production
        </div>

        {/* Pins */}
        {pins.map(s => {
          const rc = RARITY[s.rarity] || RARITY.Sports;
          const isHov = hovered?.id === s.id;
          return (
            <div key={s.id}
              onMouseEnter={()=>setHovered(s)} onMouseLeave={()=>setHovered(null)}
              onClick={()=>onSpotTap(s)}
              style={{ position:"absolute", left:`${s.px}%`, top:`${s.py}%`,
                transform:"translate(-50%,-100%)", cursor:"pointer", zIndex:isHov?10:1 }}>
              {/* Pin body */}
              <div style={{ width:12, height:12, borderRadius:"50%", background:rc.text,
                boxShadow:`0 0 0 3px ${T.bg}, 0 0 0 5px ${rc.text},${isHov?` 0 0 20px 4px ${rc.text}40`:""}`,
                transform:`scale(${isHov?1.4:1})`, transition:"transform .15s, box-shadow .15s" }} />
              {/* Tooltip */}
              {isHov && (
                <div style={{ position:"absolute", bottom:18, left:"50%", transform:"translateX(-50%)",
                  background:T.surface, border:`1px solid ${T.border}`, borderRadius:10,
                  padding:"8px 10px", whiteSpace:"nowrap", fontSize:11,
                  boxShadow:"0 4px 16px rgba(0,0,0,.5)", pointerEvents:"none" }}>
                  <div style={{ fontWeight:700, color:T.text }}>{s.make} {s.model}</div>
                  <div style={{ color:T.muted, fontSize:10, marginTop:2 }}>{s.location}</div>
                  <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:3 }}>
                    <RarityPill rarity={s.rarity} />
                    <span style={{ fontSize:10, color:T.muted }}>{fmt(s.likes)} likes</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* List below map */}
      <div style={{ padding:"12px 14px", display:"flex", flexDirection:"column", gap:8 }}>
        <div style={{ fontSize:12, fontWeight:700, color:T.muted, marginBottom:4 }}>
          {SPOTS.length} spots in view
        </div>
        {SPOTS.map(s => (
          <div key={s.id} onClick={()=>onSpotTap(s)}
            style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12,
              padding:"10px 12px", display:"flex", alignItems:"center", gap:12, cursor:"pointer",
              transition:"border-color .15s" }}
            onMouseEnter={e=>e.currentTarget.style.borderColor=T.accent}
            onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
            <img src={s.image} alt="" loading="lazy"
              style={{ width:58, height:44, objectFit:"cover", borderRadius:8, flexShrink:0 }} />
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:15,
                fontWeight:800, color:T.text }}>{s.make} {s.model}</div>
              <div style={{ fontSize:11, color:T.muted, display:"flex", alignItems:"center", gap:3 }}>
                <Ic.Pin size={10} />{s.location}
              </div>
            </div>
            <RarityPill rarity={s.rarity} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── NOTIFICATIONS ──────────────────────────────────────────────
function NotificationsScreen() {
  const [notifs, setNotifs] = useState(NOTIFICATIONS);
  const unread = notifs.filter(n=>!n.read).length;

  const markAll = () => setNotifs(ns => ns.map(n=>({...n,read:true})));

  const typeIcon = (type) => ({
    like:    <span style={{ fontSize:14 }}>❤️</span>,
    follow:  <span style={{ fontSize:14 }}>👤</span>,
    comment: <span style={{ fontSize:14 }}>💬</span>,
    save:    <span style={{ fontSize:14 }}>🔖</span>,
  }[type] || <span>🔔</span>);

  return (
    <div style={{ padding:"14px" }}>
      {/* Header row */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <div style={{ fontSize:13, color:T.muted }}>
          {unread > 0 ? <><span style={{ color:T.accent, fontWeight:700 }}>{unread}</span> unread</> : "All caught up"}
        </div>
        {unread > 0 && (
          <button onClick={markAll} style={{ fontSize:12, color:T.accent,
            border:"none", background:"none", fontWeight:600 }}>
            Mark all read
          </button>
        )}
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {notifs.map(n => {
          const u = USERS[n.user];
          return (
            <div key={n.id} onClick={()=>setNotifs(ns=>ns.map(x=>x.id===n.id?{...x,read:true}:x))}
              style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 14px",
                background:n.read ? T.card : `${T.accentDm}`,
                border:`1px solid ${n.read ? T.border : T.accent+"40"}`,
                borderRadius:12, cursor:"pointer", transition:"background .15s" }}>
              <div style={{ position:"relative", flexShrink:0 }}>
                <Avatar initials={u?.initials || "?"} size={40} />
                <div style={{ position:"absolute", bottom:-2, right:-2, fontSize:12 }}>
                  {typeIcon(n.type)}
                </div>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, color:T.text }}>
                  <span style={{ fontWeight:700 }}>@{n.user}</span>
                  {" "}<span style={{ color:T.sub }}>{n.msg}</span>
                </div>
                <div style={{ fontSize:11, color:T.muted, marginTop:2 }}>{n.time}</div>
              </div>
              {!n.read && (
                <div style={{ width:8, height:8, borderRadius:"50%", background:T.accent, flexShrink:0 }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── PROFILE ────────────────────────────────────────────────────
function ProfileScreen({ onSpotTap }) {
  const me = USERS["apex_hunter"];
  const mySpots = SPOTS.filter(s => s.userId === "apex_hunter");
  const saved   = SPOTS.filter(s => s.saved);
  const [tab, setTab] = useState("spots");

  const stats = [
    { label:"Spots",     value:me.spots },
    { label:"Followers", value:me.followers },
    { label:"Following", value:"203" },
  ];

  const list = tab === "spots" ? mySpots : saved;

  return (
    <div>
      {/* Profile header */}
      <div style={{ background:`linear-gradient(180deg, ${T.accentDm} 0%, ${T.surface} 100%)`,
        padding:"24px 16px 0" }}>
        {/* Top row */}
        <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:12 }}>
          <button style={{ color:T.muted, border:"none", background:"none" }}>
            <Ic.Settings size={20} />
          </button>
        </div>
        {/* Avatar + name */}
        <div style={{ display:"flex", gap:14, alignItems:"flex-end", marginBottom:16 }}>
          <Avatar initials={me.initials} size={72} ring />
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:22,
                fontWeight:900, color:T.text }}>{me.name}</span>
              <Ic.Verified size={16} />
            </div>
            <div style={{ fontSize:13, color:T.muted }}>@{me.handle}</div>
            <div style={{ marginTop:6, display:"inline-flex", alignItems:"center", gap:5,
              background:T.accentDm, border:`1px solid ${T.accent}`, borderRadius:6,
              padding:"3px 10px", fontSize:11, color:T.accent, fontWeight:700 }}>
              <Ic.Fire size={11} style={{ color:T.accent }} /> Top Spotter
            </div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)",
          borderTop:`1px solid ${T.border}`, paddingTop:14, marginBottom:0 }}>
          {stats.map(({ label, value }) => (
            <div key={label} style={{ textAlign:"center" }}>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:22,
                fontWeight:900, color:T.text }}>{value}</div>
              <div style={{ fontSize:10, color:T.muted, textTransform:"uppercase",
                letterSpacing:".05em" }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", marginTop:14, borderTop:`1px solid ${T.border}` }}>
          {[["spots","My Spots"],["saved","Saved"]].map(([k,l]) => (
            <button key={k} onClick={()=>setTab(k)} className={`tab-btn${tab===k?" active":""}`}
              style={{ flex:1, textAlign:"center", paddingTop:12 }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {list.length === 0 ? (
        <div style={{ textAlign:"center", padding:"60px 0" }}>
          <div style={{ fontSize:36, marginBottom:10 }}>📸</div>
          <div style={{ fontSize:15, fontWeight:700, color:T.text, marginBottom:6 }}>Nothing here yet</div>
          <div style={{ fontSize:13, color:T.muted }}>
            {tab==="spots" ? "Post your first spot to get started." : "Save spots to find them later."}
          </div>
        </div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:2, padding:"2px" }}>
          {list.map(s => (
            <div key={s.id} onClick={()=>onSpotTap(s)}
              style={{ aspectRatio:"1", overflow:"hidden", cursor:"pointer", position:"relative" }}>
              <img src={s.image} alt={`${s.make} ${s.model}`} loading="lazy"
                style={{ width:"100%", height:"100%", objectFit:"cover",
                  transition:"transform .2s" }}
                onMouseEnter={e=>e.target.style.transform="scale(1.05)"}
                onMouseLeave={e=>e.target.style.transform="scale(1)"} />
              <div style={{ position:"absolute", inset:0,
                background:"linear-gradient(to bottom, transparent 60%, rgba(0,0,0,.7))" }} />
              <div style={{ position:"absolute", bottom:6, left:6 }}>
                <div style={{ fontFamily:"'Barlow Condensed',sans-serif",
                  fontSize:12, fontWeight:800, color:"#fff", lineHeight:1 }}>
                  {s.make}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────────────────────
const NAV = [
  { key:"feed",    label:"Feed",    Icon: Ic.Home    },
  { key:"explore", label:"Explore", Icon: Ic.Compass },
  { key:"upload",  label:"",        Icon: null       }, // centre post button
  { key:"map",     label:"Map",     Icon: Ic.Map     },
  { key:"profile", label:"Profile", Icon: Ic.User    },
];

export default function SpotDrive() {
  const [screen, setScreen]       = useState("feed");
  const [selectedSpot, setSpot]   = useState(null);
  const [showUpload, setUpload]    = useState(false);
  const [notifCount]              = useState(3);

  const handleNav = (key) => {
    if (key === "upload") { setUpload(true); return; }
    setScreen(key);
  };

  const screenProps = { onSpotTap: setSpot };

  return (
    <div style={{ maxWidth:430, margin:"0 auto", minHeight:"100vh",
      background:T.bg, position:"relative", display:"flex", flexDirection:"column" }}>

      {/* ── TOP BAR ── */}
      <header style={{ position:"sticky", top:0, zIndex:100, background:`${T.bg}ee`,
        backdropFilter:"blur(14px)", borderBottom:`1px solid ${T.border}`,
        padding:"12px 16px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
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
        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          {/* Notification bell */}
          <button onClick={()=>setScreen("notif")}
            style={{ position:"relative", color:screen==="notif"?T.accent:T.muted,
              border:"none", background:"none" }}>
            <Ic.Bell size={20} />
            {notifCount > 0 && (
              <span style={{ position:"absolute", top:-3, right:-3, width:14, height:14,
                borderRadius:"50%", background:T.accent, border:`2px solid ${T.bg}`,
                fontSize:8, fontWeight:700, color:"#fff",
                display:"flex", alignItems:"center", justifyContent:"center" }}>
                {notifCount}
              </span>
            )}
          </button>
          <Avatar initials="TR" size={30} ring />
        </div>
      </header>

      {/* ── SCREEN ── */}
      <main style={{ flex:1, overflowY:"auto", paddingBottom:80 }}>
        {screen === "feed"    && <FeedScreen         {...screenProps} />}
        {screen === "explore" && <ExploreScreen       {...screenProps} />}
        {screen === "map"     && <MapScreen           {...screenProps} />}
        {screen === "notif"   && <NotificationsScreen />}
        {screen === "profile" && <ProfileScreen       {...screenProps} />}
      </main>

      {/* ── BOTTOM NAV ── */}
      <nav style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)",
        width:"100%", maxWidth:430, background:`${T.surface}f5`,
        backdropFilter:"blur(16px)", borderTop:`1px solid ${T.border}`,
        display:"flex", justifyContent:"space-around", alignItems:"center",
        padding:"8px 0 max(8px,env(safe-area-inset-bottom))", zIndex:90 }}>
        {NAV.map(({ key, label, Icon }) => {
          if (key === "upload") return (
            <button key="upload" onClick={()=>handleNav("upload")}
              style={{ width:50, height:50, borderRadius:"50%", border:"none",
                background:`linear-gradient(135deg,${T.accent},${T.accentDk})`,
                display:"flex", alignItems:"center", justifyContent:"center",
                boxShadow:`0 4px 16px ${T.accent}50`, transform:"translateY(-6px)",
                animation:"glow 3s ease-in-out infinite" }}>
              <Ic.Plus size={22} style={{ color:"#fff" }} />
            </button>
          );
          const active = screen === key || (key==="notif" && screen==="notif");
          return (
            <button key={key} onClick={()=>handleNav(key)}
              className={`nav-item${screen===key?" active":""}`}>
              <Icon size={22} style={{ color: screen===key ? T.accent : T.muted }} />
              <span>{label}</span>
              {screen===key && <div className="nav-dot" />}
            </button>
          );
        })}
      </nav>

      {/* ── OVERLAYS ── */}
      {selectedSpot && <SpotDetail spot={selectedSpot} onClose={()=>setSpot(null)} />}
      {showUpload   && <UploadModal onClose={()=>setUpload(false)} />}
    </div>
  );
}
