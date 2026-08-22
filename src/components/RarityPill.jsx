import React, { memo } from "react";

export const RARITY = {
  Hypercar: { bg:"#1a0a2e", text:"#b388ff", border:"#6a0dad" },
  Exotic:   { bg:"#0A2626", text:"#00A19C", border:"#00A19C" },
  Sports:   { bg:"#0a1a2e", text:"#60a5fa", border:"#60a5fa" },
};

const RarityPill = memo(({ rarity }) => {
  const r = RARITY[rarity] || RARITY.Sports;
  return (
    <span style={{ background:r.bg, color:r.text, border:`1px solid ${r.border}`,
      borderRadius:6, padding:"3px 9px", fontSize:10, fontWeight:700,
      letterSpacing:"0.07em", textTransform:"uppercase" }}>{rarity}</span>
  );
});

export default RarityPill;