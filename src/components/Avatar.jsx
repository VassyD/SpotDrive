import React, { memo, useState } from "react";

const Avatar = memo(({ initials, src, size=36, ring=false }) => {
  const [err, setErr] = useState(false);
  const fs = Math.round(size * 0.36);
  return (
    <div style={{ width:size, height:size, borderRadius:"50%", flexShrink:0, overflow:"hidden",
      background:"linear-gradient(135deg,#00A19C,#7c1a02)",
      display:"flex", alignItems:"center", justifyContent:"center",
      fontSize:fs, fontWeight:700, color:"#fff",
      boxShadow: ring ? "0 0 0 2px #0A0A0C,0 0 0 4px #00A19C" : "none" }}>
      {src && !err
        ? <img src={src} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}
            onError={() => setErr(true)} />
        : (initials || "?").slice(0,2).toUpperCase()
      }
    </div>
  );
});

export default Avatar;