import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Plus, Minus, X, Lock, LayoutGrid, ClipboardList, Settings, Trash2, Pencil,
  ChevronLeft, Check, ImagePlus, LogOut, Eye, EyeOff, ChevronRight, Instagram, Phone, Clock
} from "lucide-react";

/* ---------------------------------------------------------
   Açaí Mix Delícia — Cardápio digital estilo iFood
   Dados no window.storage (compartilhado) = qualquer alteração
   no admin aparece pros clientes em poucos segundos.
--------------------------------------------------------- */

const ADMIN_PASSWORD = "CeuAzul12@";

const DEFAULT_CATALOG = {
  sizes: [
    { id: "s250", label: "250ML", ml: 250, price: 10, maxFrutas: 1, maxComplementos: 3, maxAdicionais: 1 },
    { id: "s350", label: "350ML", ml: 350, price: 14, maxFrutas: 2, maxComplementos: 3, maxAdicionais: 1 },
    { id: "s400", label: "400ML", ml: 400, price: 16, maxFrutas: 2, maxComplementos: 3, maxAdicionais: 1 },
  ],
  complementos: ["Leite em pó", "Leite condensado", "Amendoim em Pó", "Amendoim Triturado", "Granola", "Gotas de chocolate", "Choco Ball", "M&M"],
  adicionais: ["Canudinho", "Bis", "Marshmallow", "Paçoca"],
  frutas: ["Morango", "Banana"],
  extraAdicionalPrice: 1,
  montados: [
    { id: "m1", name: "Milk Splash", recipe: "Leite condensado + Leite em pó + Cereal + Canudinho", image: "", active: true },
    { id: "m2", name: "Choco Lovers", recipe: "Gotas de chocolate + Leite condensado + Leite em pó + Bis", image: "", active: true },
    { id: "m3", name: "Premium Amendoim", recipe: "Amendoim em pó + Granola + Leite condensado + 1 Paçoca", image: "", active: true },
    { id: "m4", name: "Color Mix", recipe: "M&M + Leite condensado + Leite em pó + Marshmallow", image: "", active: true },
  ],
};

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const DEFAULT_HORARIOS = WEEKDAYS.map((label, day) => ({ day, label, enabled: true, from: "14:00", to: "22:00" }));

const DEFAULT_SETTINGS = {
  storeName: "Açaí Mix Delícia",
  tagline: "Sabor que encanta, momento que fica! 💜",
  whatsappNumber: "5583986188380",
  instagram: "@mixdelicia.cg",
  isOpen: true,
  logo: "",
  horario: "",
  localizacao: "",
  minOrder: 20,
  deliveryText: "Entrega grátis",
  useAutoHorario: false,
  horariosSemana: DEFAULT_HORARIOS,
};

/* Calcula se a loja está aberta agora, combinando o botão manual "Loja aberta"
   com os horários automáticos definidos por dia da semana (se ativados). */
function isStoreOpenNow(settings) {
  if (!settings.isOpen) return { open: false, label: "Fechado" };
  if (!settings.useAutoHorario) return { open: true, label: "Aberto agora" };

  const list = settings.horariosSemana && settings.horariosSemana.length ? settings.horariosSemana : DEFAULT_HORARIOS;
  const now = new Date();
  const sched = list.find((h) => h.day === now.getDay());
  if (!sched || !sched.enabled || !sched.from || !sched.to) {
    return { open: false, label: "Fechado hoje" };
  }
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const [fh, fm] = sched.from.split(":").map(Number);
  const [th, tm] = sched.to.split(":").map(Number);
  const minutesFrom = fh * 60 + fm;
  const minutesTo = th * 60 + tm;
  const open = minutesTo > minutesFrom
    ? (minutesNow >= minutesFrom && minutesNow < minutesTo)
    : (minutesNow >= minutesFrom || minutesNow < minutesTo); // horário que vira a noite

  return open ? { open: true, label: "Aberto agora" } : { open: false, label: `Fechado • Abre às ${sched.from}` };
}

const ORDER_STATUSES = ["Novo", "Em preparo", "Saiu para entrega", "Entregue", "Cancelado"];
const STATUS_COLOR = { "Novo": "#E85DA0", "Em preparo": "#F5A623", "Saiu para entrega": "#6C2B7F", "Entregue": "#4CAF50", "Cancelado": "#9CA3AF" };

const PURPLE_DEEP = "#2B0A45";
const PURPLE_MID = "#4B1467";
const LIME = "#AEEA00";
const PINK = "#E85DA0";
const CREAM = "#FBF7F2";

function formatBRL(v) { return (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

function compressImage(file, maxWidth = 480, quality = 0.65) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Falha ao ler arquivo"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Falha ao carregar imagem"));
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function useGoogleFonts() {
  useEffect(() => {
    const id = "acai-mix-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id; link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&family=Quicksand:wght@400;500;600;700&display=swap";
    document.head.appendChild(link);
  }, []);
}

/* ---------------- Shared storage hook (merges objects with defaults) ---------------- */
function useSharedState(key, seedValue, pollMs, merge = false) {
  const [value, setValue] = useState(seedValue);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await window.storage.get(key, true);
      if (res && res.value) {
        const parsed = JSON.parse(res.value);
        setValue(merge && !Array.isArray(seedValue) ? { ...seedValue, ...parsed } : parsed);
      } else {
        await window.storage.set(key, JSON.stringify(seedValue), true);
        setValue(seedValue);
      }
    } catch (e) {
      try {
        await window.storage.set(key, JSON.stringify(seedValue), true);
        setValue(seedValue);
      } catch (e2) { console.error("storage init failed", key, e2); }
    } finally { setLoaded(true); }
  }, [key]);

  useEffect(() => {
    load();
    if (!pollMs) return;
    const t = setInterval(load, pollMs);
    return () => clearInterval(t);
  }, [load, pollMs]);

  const save = useCallback(async (next) => {
    setValue(next);
    try { await window.storage.set(key, JSON.stringify(next), true); }
    catch (e) { console.error("storage save failed", key, e); }
  }, [key]);

  return [value, save, loaded];
}

/* ---------------- Small shared UI bits ---------------- */
function Field({ label, children, hint }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 12.5, fontWeight: 700, color: PURPLE_MID, display: "block", marginBottom: 5 }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 11, color: "#A796AD", marginTop: 4 }}>{hint}</div>}
    </div>
  );
}
const inputStyle = { width: "100%", border: "1px solid #E0D2E3", borderRadius: 10, padding: "10px 12px", fontSize: 14, fontFamily: "'Quicksand', sans-serif", boxSizing: "border-box", color: PURPLE_DEEP };

function Toggle({ on, onClick }) {
  return (
    <button onClick={onClick} style={{ width: 44, height: 24, borderRadius: 999, border: "none", background: on ? LIME : "#DDD0E0", position: "relative", cursor: "pointer", flexShrink: 0 }}>
      <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: on ? 23 : 3, transition: "left 0.15s" }} />
    </button>
  );
}

function ZigzagBand() {
  return (
    <div style={{ height: 14, background: `repeating-linear-gradient(115deg, ${PURPLE_MID} 0 6px, transparent 6px 12px)`, opacity: 0.5 }} />
  );
}

function WaveDivider() {
  return (
    <svg viewBox="0 0 1200 44" preserveAspectRatio="none" style={{ width: "100%", height: 28, display: "block" }}>
      <path d="M0,22 C150,44 300,0 450,22 C600,44 750,0 900,22 C1050,44 1150,10 1200,18 L1200,44 L0,44 Z" fill={LIME} />
    </svg>
  );
}

/* ---------------- Multi-select chip group with a max limit ---------------- */
function LimitedChecklist({ options, selected, onToggle, max, columns = 2 }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: selected.length >= max ? PINK : "#A796AD" }}>{selected.length}/{max} escolhidos</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 8 }}>
        {options.map((opt) => {
          const isSel = selected.includes(opt);
          const disabled = !isSel && selected.length >= max;
          return (
            <button
              key={opt}
              disabled={disabled}
              onClick={() => onToggle(opt)}
              style={{
                display: "flex", alignItems: "center", gap: 7, textAlign: "left",
                padding: "9px 10px", borderRadius: 10, cursor: disabled ? "not-allowed" : "pointer",
                border: isSel ? `2px solid ${PURPLE_MID}` : "1px solid #E0D2E3",
                background: isSel ? "#F3E9F5" : "#fff", opacity: disabled ? 0.45 : 1,
              }}
            >
              <span style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, border: isSel ? "none" : "1.5px solid #C9B7CE", background: isSel ? LIME : "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {isSel && <Check size={11} color={PURPLE_DEEP} strokeWidth={3.5} />}
              </span>
              <span style={{ fontSize: 12.5, color: PURPLE_DEEP, fontWeight: 600 }}>{opt}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Extras avulsos (sem limite), cada um soma um valor fixo ao preço ---------------- */
function ExtrasChecklist({ options, selected, onToggle, unitPrice, columns = 2 }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: selected.length > 0 ? PINK : "#A796AD" }}>
          {selected.length > 0 ? `+${formatBRL(selected.length * unitPrice)} no total` : `${formatBRL(unitPrice)} cada`}
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 8 }}>
        {options.map((opt) => {
          const isSel = selected.includes(opt);
          return (
            <button
              key={opt}
              onClick={() => onToggle(opt)}
              style={{
                display: "flex", alignItems: "center", gap: 7, textAlign: "left",
                padding: "9px 10px", borderRadius: 10, cursor: "pointer",
                border: isSel ? `2px solid ${PURPLE_MID}` : "1px solid #E0D2E3",
                background: isSel ? "#F3E9F5" : "#fff",
              }}
            >
              <span style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, border: isSel ? "none" : "1.5px solid #C9B7CE", background: isSel ? LIME : "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {isSel && <Check size={11} color={PURPLE_DEEP} strokeWidth={3.5} />}
              </span>
              <span style={{ fontSize: 12.5, color: PURPLE_DEEP, fontWeight: 600, flex: 1 }}>{opt}</span>
              <span style={{ fontSize: 11, color: PINK, fontWeight: 800, flexShrink: 0 }}>+{formatBRL(unitPrice)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SizePicker({ sizes, sizeId, onChange }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {sizes.map((s) => {
        const isSel = sizeId === s.id;
        return (
          <button key={s.id} onClick={() => onChange(s.id)} style={{
            flex: 1, borderRadius: 12, padding: "10px 6px", cursor: "pointer", textAlign: "center",
            border: isSel ? `2px solid ${PURPLE_MID}` : "1px solid #E0D2E3", background: isSel ? "#F3E9F5" : "#fff",
          }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: PURPLE_DEEP }}>{s.label}</div>
            <div style={{ fontSize: 12.5, color: PINK, fontWeight: 700, marginTop: 2 }}>{formatBRL(s.price)}</div>
          </button>
        );
      })}
    </div>
  );
}

/* =========================================================
   BUILDER SHEETS
========================================================= */
function BottomSheet({ onClose, children, footer }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(43,10,69,0.5)", zIndex: 50, display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: CREAM, width: "100%", maxWidth: 480, margin: "0 auto", borderRadius: "22px 22px 0 0", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
        <div style={{ overflowY: "auto", padding: 20, flex: 1 }}>{children}</div>
        {footer && <div style={{ padding: 16, borderTop: "1px solid #EDE1EF", background: "#fff", borderRadius: "0 0 0 0" }}>{footer}</div>}
      </div>
    </div>
  );
}

function QtyStepper({ qty, setQty }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center" }}>
      <button onClick={() => setQty(Math.max(1, qty - 1))} style={{ width: 32, height: 32, borderRadius: "50%", border: `1.5px solid ${PURPLE_MID}`, background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Minus size={15} color={PURPLE_MID} /></button>
      <span style={{ fontWeight: 800, fontSize: 16, minWidth: 18, textAlign: "center", color: PURPLE_DEEP }}>{qty}</span>
      <button onClick={() => setQty(qty + 1)} style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: LIME, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Plus size={15} color={PURPLE_DEEP} /></button>
    </div>
  );
}

function MonteSeuCopoSheet({ catalog, onClose, onAdd }) {
  const [sizeId, setSizeId] = useState(catalog.sizes[0]?.id);
  const [complementos, setComplementos] = useState([]);
  const [adicionais, setAdicionais] = useState([]);
  const [frutas, setFrutas] = useState([]);
  const [extras, setExtras] = useState([]);
  const [qty, setQty] = useState(1);
  const size = catalog.sizes.find((s) => s.id === sizeId) || catalog.sizes[0];
  const extraUnit = Number(catalog.extraAdicionalPrice) || 0;
  const unitPrice = size.price + extras.length * extraUnit;

  useEffect(() => {
    setComplementos((c) => c.slice(0, size.maxComplementos));
    setAdicionais((a) => a.slice(0, size.maxAdicionais));
    setFrutas((f) => f.slice(0, size.maxFrutas));
  }, [sizeId]);

  function toggle(list, setList, item, max) {
    setList((cur) => cur.includes(item) ? cur.filter((x) => x !== item) : (cur.length < max ? [...cur, item] : cur));
  }
  function toggleExtra(item) {
    setExtras((cur) => cur.includes(item) ? cur.filter((x) => x !== item) : [...cur, item]);
  }

  return (
    <BottomSheet
      onClose={onClose}
      footer={
        <div>
          <div style={{ marginBottom: 12 }}><QtyStepper qty={qty} setQty={setQty} /></div>
          <button onClick={() => onAdd({ id: uid(), type: "monte", name: "Monte seu Copo", size, complementos, adicionais, frutas, extras, extrasUnitPrice: extraUnit, qty, price: unitPrice })}
            style={{ width: "100%", background: PURPLE_DEEP, color: "#fff", border: "none", borderRadius: 14, padding: "14px 0", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
            Adicionar • {formatBRL(unitPrice * qty)}
          </button>
        </div>
      }
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <h2 style={{ fontFamily: "'Baloo 2', cursive", fontSize: 20, color: PURPLE_DEEP, margin: 0 }}>Monte o seu Copo 🍇</h2>
          <p style={{ fontSize: 12.5, color: "#8A7796", marginTop: 4 }}>Escolha o tamanho, os complementos e as frutas do seu jeito.</p>
        </div>
        <button onClick={onClose} style={{ background: "#F0E4F2", border: "none", borderRadius: "50%", width: 30, height: 30, flexShrink: 0, cursor: "pointer" }}><X size={16} color={PURPLE_MID} /></button>
      </div>

      <SectionTitle>Tamanho</SectionTitle>
      <div style={{ marginBottom: 18 }}><SizePicker sizes={catalog.sizes} sizeId={sizeId} onChange={setSizeId} /></div>

      <SectionTitle>Complementos</SectionTitle>
      <div style={{ marginBottom: 18 }}><LimitedChecklist options={catalog.complementos} selected={complementos} max={size.maxComplementos} onToggle={(o) => toggle(complementos, setComplementos, o, size.maxComplementos)} /></div>

      <SectionTitle>Adicionais ({size.maxAdicionais} grátis)</SectionTitle>
      <div style={{ marginBottom: 18 }}><LimitedChecklist options={catalog.adicionais} selected={adicionais} max={size.maxAdicionais} onToggle={(o) => toggle(adicionais, setAdicionais, o, size.maxAdicionais)} /></div>

      <SectionTitle>{`Escolha suas frutas (Morango e/ou Banana)`}</SectionTitle>
      <div style={{ marginBottom: 18 }}><LimitedChecklist options={catalog.frutas} selected={frutas} max={size.maxFrutas} onToggle={(o) => toggle(frutas, setFrutas, o, size.maxFrutas)} columns={2} /></div>

      {catalog.adicionais?.length > 0 && extraUnit > 0 && (
        <>
          <SectionTitle>Adicionais extras (opcional, pago à parte)</SectionTitle>
          <ExtrasChecklist options={catalog.adicionais} selected={extras} onToggle={toggleExtra} unitPrice={extraUnit} />
        </>
      )}
    </BottomSheet>
  );
}

function MontadoSheet({ product, catalog, onClose, onAdd }) {
  const [sizeId, setSizeId] = useState(catalog.sizes[0]?.id);
  const [frutas, setFrutas] = useState([]);
  const [extras, setExtras] = useState([]);
  const [qty, setQty] = useState(1);
  const size = catalog.sizes.find((s) => s.id === sizeId) || catalog.sizes[0];
  const extraUnit = Number(catalog.extraAdicionalPrice) || 0;
  const unitPrice = size.price + extras.length * extraUnit;

  useEffect(() => { setFrutas((f) => f.slice(0, size.maxFrutas)); }, [sizeId]);

  function toggleFruta(item) {
    setFrutas((cur) => cur.includes(item) ? cur.filter((x) => x !== item) : (cur.length < size.maxFrutas ? [...cur, item] : cur));
  }
  function toggleExtra(item) {
    setExtras((cur) => cur.includes(item) ? cur.filter((x) => x !== item) : [...cur, item]);
  }

  return (
    <BottomSheet
      onClose={onClose}
      footer={
        <div>
          <div style={{ marginBottom: 12 }}><QtyStepper qty={qty} setQty={setQty} /></div>
          <button onClick={() => onAdd({ id: uid(), type: "montado", name: product.name, recipe: product.recipe, size, frutas, extras, extrasUnitPrice: extraUnit, qty, price: unitPrice })}
            style={{ width: "100%", background: PURPLE_DEEP, color: "#fff", border: "none", borderRadius: 14, padding: "14px 0", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
            Adicionar • {formatBRL(unitPrice * qty)}
          </button>
        </div>
      }
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <h2 style={{ fontFamily: "'Baloo 2', cursive", fontSize: 20, color: PURPLE_DEEP, margin: 0 }}>{product.name}</h2>
          <p style={{ fontSize: 12.5, color: "#8A7796", marginTop: 4 }}>{product.recipe}</p>
        </div>
        <button onClick={onClose} style={{ background: "#F0E4F2", border: "none", borderRadius: "50%", width: 30, height: 30, flexShrink: 0, cursor: "pointer" }}><X size={16} color={PURPLE_MID} /></button>
      </div>

      <SectionTitle>Tamanho</SectionTitle>
      <div style={{ mar
