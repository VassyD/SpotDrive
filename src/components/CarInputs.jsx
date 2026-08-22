import React, { useState } from "react";

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

export function MakeInput({ value, onChange, placeholder }) {
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

export function ModelInput({ make, value, onChange, placeholder }) {
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