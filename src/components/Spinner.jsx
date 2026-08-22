import React from "react";

export default function Spinner({ size = 18, color = "#00A19C" }) {
  return (
    <div className="spin" style={{ width:size, height:size, border:`2px solid ${color}30`,
      borderTopColor:color, borderRadius:"50%", flexShrink:0 }} />
  );
}