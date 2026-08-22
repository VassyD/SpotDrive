import React from "react";

export default function ErrorMsg({ msg }) {
  return msg ? (
    <div style={{ background:"rgba(239,68,68,.12)", border:"1px solid rgba(239,68,68,.3)",
      borderRadius:8, padding:"8px 12px", fontSize:12, color:"#EF4444", marginTop:8 }}>
      {msg}
    </div>
  ) : null;
}