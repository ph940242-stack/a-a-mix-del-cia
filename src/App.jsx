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
      <div style={{ marginBottom: 18 }}><SizePicker sizes={catalog.sizes} sizeId={sizeId} onChange={setSizeId} /></div>

      <SectionTitle>Escolha suas frutas (Morango e/ou Banana)</SectionTitle>
      <div style={{ marginBottom: 18 }}><LimitedChecklist options={catalog.frutas} selected={frutas} max={size.maxFrutas} onToggle={toggleFruta} /></div>

      {catalog.adicionais?.length > 0 && extraUnit > 0 && (
        <>
          <SectionTitle>Adicionais extras (opcional)</SectionTitle>
          <ExtrasChecklist options={catalog.adicionais} selected={extras} onToggle={toggleExtra} unitPrice={extraUnit} />
        </>
      )}
    </BottomSheet>
  );
}

function SectionTitle({ children }) {
  return <div style={{ fontWeight: 800, fontSize: 13.5, color: PURPLE_DEEP, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>{children}</div>;
}

/* =========================================================
   PUBLIC MENU (iFood style)
========================================================= */
function PublicMenu({ catalog, settings, cart, setCart, onGoAdmin }) {
  const [tab, setTab] = useState("monte");
  const [sheet, setSheet] = useState(null); // {kind:'monte'} | {kind:'montado', product}
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [, setClockTick] = useState(0);

  // Recalcula o status aberto/fechado a cada minuto (para o banner reagir sozinho)
  useEffect(() => {
    const t = setInterval(() => setClockTick((n) => n + 1), 60000);
    return () => clearInterval(t);
  }, []);
  const status = isStoreOpenNow(settings);

  const activeMontados = catalog.montados.filter((m) => m.active !== false);
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);
  const cartTotal = cart.reduce((s, i) => s + i.qty * i.price, 0);
  const minPrice = Math.min(...catalog.sizes.map((s) => s.price));

  function addToCart(item) {
    setCart((prev) => [...prev, item]);
  }
  function removeFromCart(id) {
    setCart((prev) => prev.filter((i) => i.id !== id));
  }
  function changeQty(id, delta) {
    setCart((prev) => prev.map((i) => (i.id === id ? { ...i, qty: i.qty + delta } : i)).filter((i) => i.qty > 0));
  }

  const belowMin = settings.minOrder > 0 && cartTotal > 0 && cartTotal < settings.minOrder;

  return (
    <div style={{ minHeight: "100vh", background: CREAM, fontFamily: "'Quicksand', sans-serif", color: PURPLE_DEEP, paddingBottom: 100 }}>
      {/* BANNER / INFO CARD */}
      <div style={{ background: `linear-gradient(150deg, ${PURPLE_DEEP} 0%, ${PURPLE_MID} 60%, #6B2A85 100%)`, position: "relative", overflow: "hidden" }}>
        <ZigzagBand />
        <div style={{ position: "absolute", top: -30, right: -20, width: 140, height: 140, borderRadius: "50%", background: `radial-gradient(circle, ${LIME}44, transparent 70%)` }} />
        <div style={{ position: "absolute", bottom: 30, left: -30, width: 100, height: 100, borderRadius: "50%", background: `radial-gradient(circle, ${PINK}33, transparent 70%)` }} />
        <div style={{ position: "relative", padding: "22px 20px 20px", maxWidth: 480, margin: "0 auto", textAlign: "center" }}>
          {settings.logo ? (
            <img src={settings.logo} alt="" style={{ width: 68, height: 68, borderRadius: "50%", objectFit: "cover", border: `3px solid ${LIME}`, margin: "0 auto 10px" }} />
          ) : (
            <div style={{ width: 68, height: 68, borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: `3px solid ${LIME}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, margin: "0 auto 10px" }}>🍇</div>
          )}
          <h1 style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 800, fontSize: 26, color: "#fff", margin: 0 }}>{settings.storeName}</h1>
          <p style={{ color: PINK, fontSize: 13.5, fontWeight: 700, marginTop: 5, marginBottom: 14 }}>{settings.tagline}</p>

          {/* info chips: horário + localização */}
          {(settings.horario || settings.localizacao) && (
            <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              {settings.horario && (
                <span style={{ background: "#fff", color: PURPLE_DEEP, fontSize: 12, fontWeight: 700, padding: "7px 13px", borderRadius: 999, display: "flex", alignItems: "center", gap: 5 }}>⏰ {settings.horario}</span>
              )}
              {settings.localizacao && (
                <span style={{ background: "#fff", color: PURPLE_DEEP, fontSize: 12, fontWeight: 700, padding: "7px 13px", borderRadius: 999, display: "flex", alignItems: "center", gap: 5 }}>📍 {settings.localizacao}</span>
              )}
            </div>
          )}

          {/* socials */}
          {(settings.instagram || settings.whatsappNumber) && (
            <div style={{ display: "flex", justifyContent: "center", gap: 18, marginBottom: 12 }}>
              {settings.instagram && <span style={{ display: "flex", alignItems: "center", gap: 5, color: "#fff", fontSize: 12.5, fontWeight: 700 }}><Instagram size={14} /> {settings.instagram}</span>}
              {settings.whatsappNumber && (
                <a href={`https://wa.me/${settings.whatsappNumber.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 5, color: LIME, fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>
                  <Phone size={14} /> WhatsApp
                </a>
              )}
            </div>
          )}

          <span style={{ background: status.open ? LIME : PINK, color: status.open ? PURPLE_DEEP : "#fff", fontSize: 11.5, fontWeight: 800, padding: "6px 14px", borderRadius: 999 }}>
            ● {status.label}
          </span>
        </div>
      </div>

      {/* BANNER DE LOJA FECHADA */}
      {!status.open && (
        <div style={{ background: "#FBE4EA", padding: "10px 20px", textAlign: "center" }}>
          <div style={{ maxWidth: 480, margin: "0 auto", color: "#B0316B", fontSize: 12.5, fontWeight: 700 }}>
            Estamos fechados no momento — você pode ver o cardápio, mas não é possível fazer pedidos agora.
          </div>
        </div>
      )}

      {/* MIN ORDER / DELIVERY BAR */}
      <div style={{ background: PINK, padding: "10px 20px" }}>
        <div style={{ maxWidth: 480, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <span style={{ color: "#fff", fontSize: 12.5, fontWeight: 700 }}>
            Pedido mínimo: {formatBRL(settings.minOrder)} • {settings.deliveryText}
          </span>
          <button onClick={onGoAdmin} style={{ background: "rgba(255,255,255,0.22)", border: "none", color: "#fff", fontSize: 11.5, fontWeight: 700, padding: "6px 12px", borderRadius: 999, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
            <Lock size={12} /> Painel
          </button>
        </div>
      </div>

      {/* CATEGORY TABS (underline style) */}
      <div style={{ position: "sticky", top: 0, zIndex: 10, background: "#fff", boxShadow: "0 2px 8px rgba(43,10,69,0.06)" }}>
        <div style={{ display: "flex", gap: 26, padding: "14px 20px 0", maxWidth: 480, margin: "0 auto" }}>
          {[{ id: "monte", label: "Monte seu Copo" }, { id: "montados", label: "Copos Montados" }].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              background: "none", border: "none", cursor: "pointer", paddingBottom: 12,
              fontFamily: "'Quicksand', sans-serif", fontWeight: 800, fontSize: 14.5,
              color: tab === t.id ? PURPLE_DEEP : "#B5A6BA",
              borderBottom: tab === t.id ? `3px solid ${PINK}` : "3px solid transparent",
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "6px 16px 20px" }}>
        {tab === "monte" && (
          <div onClick={() => status.open && setSheet({ kind: "monte" })} style={{
            background: `linear-gradient(135deg, ${PURPLE_MID}, #7A3596)`, borderRadius: 20, padding: 20, color: "#fff",
            cursor: status.open ? "pointer" : "not-allowed", opacity: status.open ? 1 : 0.6, position: "relative", overflow: "hidden",
          }}>
            <div style={{ position: "absolute", right: -10, top: -10, fontSize: 70, opacity: 0.18 }}>🍓</div>
            <div style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 800, fontSize: 19 }}>Monte o seu Copo</div>
            <p style={{ fontSize: 12.5, color: "#EBD9F0", marginTop: 6, marginBottom: 14, maxWidth: 260 }}>
              Escolha o tamanho, até 3 complementos, 1 adicional e suas frutas favoritas.
            </p>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: LIME, color: PURPLE_DEEP, fontWeight: 800, fontSize: 12.5, padding: "9px 16px", borderRadius: 999 }}>
              A partir de {formatBRL(minPrice)} <ChevronRight size={14} strokeWidth={3} />
            </div>
          </div>
        )}

        {tab === "montados" && (
          <div>
            {activeMontados.length === 0 && <p style={{ textAlign: "center", color: "#8A7796", fontSize: 14, marginTop: 20 }}>Nenhum copo montado cadastrado ainda.</p>}
            {activeMontados.map((m) => (
              <div key={m.id} onClick={() => status.open && setSheet({ kind: "montado", product: m })} style={{
                display: "flex", gap: 12, background: "#fff", borderRadius: 16, padding: 12, marginBottom: 10,
                cursor: status.open ? "pointer" : "not-allowed", opacity: status.open ? 1 : 0.55, alignItems: "center",
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 700, fontSize: 15, color: PURPLE_DEEP }}>{m.name}</div>
                  <div style={{ fontSize: 12, color: "#8A7796", marginTop: 3, lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{m.recipe}</div>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: PINK, marginTop: 6 }}>A partir de {formatBRL(minPrice)}</div>
                </div>
                <div style={{ position: "relative", flexShrink: 0 }}>
                  {m.image ? (
                    <img src={m.image} alt={m.name} style={{ width: 78, height: 78, borderRadius: 14, objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: 78, height: 78, borderRadius: 14, background: `radial-gradient(circle at 30% 25%, #8E44AD, ${PURPLE_DEEP} 70%)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30 }}>🥣</div>
                  )}
                  <div style={{ position: "absolute", bottom: -6, right: -6, width: 26, height: 26, borderRadius: "50%", background: LIME, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff" }}>
                    <Plus size={14} color={PURPLE_DEEP} strokeWidth={3.5} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FOOTER CONTACT */}
      <div style={{ maxWidth: 480, margin: "14px auto 0", padding: "0 16px", textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", gap: 14, flexWrap: "wrap", fontSize: 12, color: "#8A7796" }}>
          {settings.whatsappNumber && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Phone size={13} /> {settings.whatsappNumber}</span>}
          {settings.instagram && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Instagram size={13} /> {settings.instagram}</span>}
        </div>
      </div>

      {/* FLOATING CART */}
      {cartCount > 0 && (
        <button onClick={() => setCartOpen(true)} style={{
          position: "fixed", bottom: 18, left: "50%", transform: "translateX(-50%)", width: "calc(100% - 32px)", maxWidth: 448,
          background: PURPLE_DEEP, color: "#fff", border: "none", borderRadius: 999, padding: "14px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 8px 24px rgba(43,10,69,0.35)", cursor: "pointer", zIndex: 20,
        }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 14.5 }}>
            <span style={{ background: LIME, color: PURPLE_DEEP, borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>{cartCount}</span>
            Ver sacola
          </span>
          <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <span style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 700, fontSize: 15.5 }}>{formatBRL(cartTotal)}</span>
            {belowMin && <span style={{ fontSize: 10.5, color: LIME }}>faltam {formatBRL(settings.minOrder - cartTotal)} p/ mínimo</span>}
          </span>
        </button>
      )}

      {sheet?.kind === "monte" && <MonteSeuCopoSheet catalog={catalog} onClose={() => setSheet(null)} onAdd={(item) => { addToCart(item); setSheet(null); }} />}
      {sheet?.kind === "montado" && <MontadoSheet product={sheet.product} catalog={catalog} onClose={() => setSheet(null)} onAdd={(item) => { addToCart(item); setSheet(null); }} />}

      {cartOpen && <CartDrawer cart={cart} onClose={() => setCartOpen(false)} onChangeQty={changeQty} onRemove={removeFromCart} total={cartTotal} minOrder={settings.minOrder} onCheckout={() => { setCartOpen(false); setCheckoutOpen(true); }} />}
      {checkoutOpen && <CheckoutModal cart={cart} total={cartTotal} settings={settings} onClose={() => setCheckoutOpen(false)} onDone={() => { setCart([]); setCheckoutOpen(false); }} />}
    </div>
  );
}

function itemDetailLine(i) {
  const parts = [];
  if (i.type === "montado" && i.recipe) parts.push(i.recipe);
  if (i.complementos?.length) parts.push("Complementos: " + i.complementos.join(", "));
  if (i.adicionais?.length) parts.push("Adicional: " + i.adicionais.join(", "));
  if (i.frutas?.length) parts.push("Frutas: " + i.frutas.join(", "));
  if (i.extras?.length) parts.push(`Extras: ${i.extras.join(", ")} (+${formatBRL(i.extras.length * (i.extrasUnitPrice || 0))})`);
  return parts.join(" • ");
}

function CartDrawer({ cart, onClose, onChangeQty, onRemove, total, minOrder, onCheckout }) {
  const belowMin = minOrder > 0 && total < minOrder;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(43,10,69,0.5)", zIndex: 40, display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", width: "100%", maxWidth: 480, margin: "0 auto", borderRadius: "22px 22px 0 0", padding: 20, maxHeight: "82vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h2 style={{ fontFamily: "'Baloo 2', cursive", fontSize: 19, color: PURPLE_DEEP, margin: 0 }}>Sua sacola</h2>
          <button onClick={onClose} style={{ background: "#F0E4F2", border: "none", borderRadius: "50%", width: 30, height: 30, cursor: "pointer" }}><X size={16} color={PURPLE_MID} /></button>
        </div>
        {cart.length === 0 ? <p style={{ color: "#8A7796", fontSize: 14 }}>Sua sacola está vazia.</p> : (
          <>
            {cart.map((i) => (
              <div key={i.id} style={{ padding: "10px 0", borderBottom: "1px solid #F2EAF3" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: PURPLE_DEEP }}>{i.name} <span style={{ color: "#8A7796", fontWeight: 600 }}>({i.size.label})</span></div>
                    {itemDetailLine(i) && <div style={{ fontSize: 11.5, color: "#8A7796", marginTop: 2, lineHeight: 1.4 }}>{itemDetailLine(i)}</div>}
                    <div style={{ fontSize: 12.5, color: PINK, fontWeight: 700, marginTop: 4 }}>{formatBRL(i.price)}</div>
                  </div>
                  <button onClick={() => onRemove(i.id)} style={{ background: "none", border: "none", cursor: "pointer", flexShrink: 0 }}><Trash2 size={15} color="#C3B4C7" /></button>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button onClick={() => onChangeQty(i.id, -1)} style={{ width: 26, height: 26, borderRadius: "50%", border: "1px solid #D8C4DB", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Minus size={13} color={PURPLE_MID} /></button>
                    <span style={{ minWidth: 16, textAlign: "center", fontWeight: 700 }}>{i.qty}</span>
                    <button onClick={() => onChangeQty(i.id, 1)} style={{ width: 26, height: 26, borderRadius: "50%", border: "none", background: LIME, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Plus size={13} color={PURPLE_DEEP} /></button>
                  </div>
                </div>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "16px 0 4px", fontWeight: 700, fontSize: 15.5 }}>
              <span>Total</span><span style={{ color: PINK }}>{formatBRL(total)}</span>
            </div>
            {belowMin && <p style={{ fontSize: 12, color: PINK, fontWeight: 700, marginBottom: 4 }}>Faltam {formatBRL(minOrder - total)} para atingir o pedido mínimo de {formatBRL(minOrder)}.</p>}
            <button onClick={onCheckout} disabled={belowMin} style={{ width: "100%", background: belowMin ? "#DDD3E0" : PURPLE_DEEP, color: "#fff", border: "none", borderRadius: 14, padding: "14px 0", fontWeight: 700, fontSize: 15, marginTop: 10, cursor: belowMin ? "not-allowed" : "pointer" }}>Finalizar pedido</button>
          </>
        )}
      </div>
    </div>
  );
}

function CheckoutModal({ cart, total, settings, onClose, onDone }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [payment, setPayment] = useState("Pix");
  const [notes, setNotes] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [waLink, setWaLink] = useState("");
  const belowMin = settings.minOrder > 0 && total < settings.minOrder;
  const valid = name.trim() && phone.trim() && address.trim() && !belowMin;

  async function submit() {
    if (!valid || sending) return;
    setSending(true);

    // Abre a aba/janela do WhatsApp IMEDIATAMENTE (ainda dentro do clique do usuário),
    // senão o navegador bloqueia o pop-up depois que passamos por um await.
    let waWindow = null;
    if (settings.whatsappNumber) {
      waWindow = window.open("", "_blank");
    }

    const order = { id: uid(), createdAt: new Date().toISOString(), customerName: name.trim(), phone: phone.trim(), address: address.trim(), payment, notes: notes.trim(), items: cart, total, status: "Novo" };
    try {
      const res = await window.storage.get("orders", true).catch(() => null);
      const list = res && res.value ? JSON.parse(res.value) : [];
      list.unshift(order);
      await window.storage.set("orders", JSON.stringify(list), true);
    } catch (e) { console.error("failed to save order", e); }

    const lines = cart.map((i) => {
      const detail = itemDetailLine(i);
      return `• ${i.qty}x ${i.name} (${i.size.label}) — ${formatBRL(i.price * i.qty)}` + (detail ? `\n   ${detail}` : "");
    }).join("\n");
    const msg = `*Novo pedido — ${settings.storeName}*\n\nCliente: ${order.customerName}\nTelefone: ${order.phone}\nEndereço: ${order.address}\n\n${lines}\n\n*Total: ${formatBRL(total)}*\nPagamento: ${payment}` + (order.notes ? `\nObs: ${order.notes}` : "");

    if (settings.whatsappNumber) {
      const waUrl = `https://wa.me/${settings.whatsappNumber.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`;
      setWaLink(waUrl);
      if (waWindow) {
        waWindow.location.href = waUrl;
      } else {
        // Pop-up foi bloqueado mesmo assim — mostra um link pro cliente abrir manualmente
        window.location.href = waUrl;
      }
    }
    setSending(false);
    setDone(true);
  }

  if (done) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(43,10,69,0.5)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ background: "#fff", borderRadius: 20, padding: 28, textAlign: "center", maxWidth: 340 }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: LIME, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}><Check size={28} color={PURPLE_DEEP} strokeWidth={3} /></div>
          <h3 style={{ fontFamily: "'Baloo 2', cursive", color: PURPLE_DEEP, marginBottom: 6 }}>Pedido enviado!</h3>
          <p style={{ color: "#8A7796", fontSize: 13.5, marginBottom: 18 }}>{settings.whatsappNumber ? "Confirme o envio no WhatsApp que abrimos pra você." : "Recebemos seu pedido por aqui."}</p>
          {waLink && (
            <a href={waLink} target="_blank" rel="noreferrer" style={{ display: "inline-block", background: "#25D366", color: "#fff", textDecoration: "none", borderRadius: 12, padding: "10px 18px", fontWeight: 700, fontSize: 13.5, marginBottom: 12 }}>
              Não abriu? Toque aqui para abrir o WhatsApp
            </a>
          )}
          <div>
            <button onClick={onDone} style={{ background: PURPLE_DEEP, color: "#fff", border: "none", borderRadius: 12, padding: "11px 22px", fontWeight: 700, cursor: "pointer" }}>Fechar</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(43,10,69,0.5)", zIndex: 50, display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", width: "100%", maxWidth: 480, margin: "0 auto", borderRadius: "22px 22px 0 0", padding: 20, maxHeight: "88vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h2 style={{ fontFamily: "'Baloo 2', cursive", fontSize: 19, color: PURPLE_DEEP, margin: 0 }}>Finalizar pedido</h2>
          <button onClick={onClose} style={{ background: "#F0E4F2", border: "none", borderRadius: "50%", width: 30, height: 30, cursor: "pointer" }}><X size={16} color={PURPLE_MID} /></button>
        </div>
        <Field label="Seu nome"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Como podemos te chamar" style={inputStyle} /></Field>
        <Field label="Telefone / WhatsApp"><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(00) 00000-0000" style={inputStyle} /></Field>
        <Field label="Endereço de entrega"><textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Rua, número, bairro, complemento" style={{ ...inputStyle, resize: "none", height: 60 }} /></Field>
        <Field label="Pagamento">
          <div style={{ display: "flex", gap: 8 }}>
            {["Pix", "Dinheiro", "Cartão"].map((p) => (
              <button key={p} onClick={() => setPayment(p)} style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: payment === p ? `2px solid ${PURPLE_MID}` : "1px solid #D8C4DB", background: payment === p ? "#F0E4F2" : "#fff", fontWeight: 700, fontSize: 13, color: PURPLE_DEEP, cursor: "pointer" }}>{p}</button>
            ))}
          </div>
        </Field>
        <Field label="Observações (opcional)"><input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Sem açúcar, trocar granola..." style={inputStyle} /></Field>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", fontWeight: 700 }}><span>Total</span><span style={{ color: PINK }}>{formatBRL(total)}</span></div>
        <button onClick={submit} disabled={!valid || sending} style={{ width: "100%", background: valid ? PURPLE_DEEP : "#DDD3E0", color: "#fff", border: "none", borderRadius: 14, padding: "14px 0", fontWeight: 700, fontSize: 15, cursor: valid ? "pointer" : "not-allowed" }}>
          {sending ? "Enviando..." : settings.whatsappNumber ? "Enviar pedido e abrir WhatsApp" : "Enviar pedido"}
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   ADMIN
========================================================= */
function AdminLogin({ onSuccess, onBack }) {
  const [pw, setPw] = useState(""); const [show, setShow] = useState(false); const [error, setError] = useState("");
  function submit() { if (pw === ADMIN_PASSWORD) onSuccess(); else setError("Senha incorreta."); }
  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(160deg, ${PURPLE_DEEP}, ${PURPLE_MID})`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Quicksand', sans-serif", padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: 28, width: "100%", maxWidth: 340 }}>
        <button type="button" onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#8A7796", fontSize: 13, cursor: "pointer", marginBottom: 14, padding: 0 }}><ChevronLeft size={15} /> Voltar ao cardápio</button>
        <div style={{ width: 46, height: 46, borderRadius: "50%", background: "#F0E4F2", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}><Lock size={20} color={PURPLE_MID} /></div>
        <h2 style={{ fontFamily: "'Baloo 2', cursive", color: PURPLE_DEEP, margin: "0 0 4px" }}>Painel administrativo</h2>
        <p style={{ fontSize: 12.5, color: "#8A7796", marginBottom: 18 }}>Só você tem acesso aqui.</p>
        <div style={{ position: "relative", marginBottom: 10 }}>
          <input type={show ? "text" : "password"} value={pw} onChange={(e) => { setPw(e.target.value); setError(""); }} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="Senha" style={{ ...inputStyle, paddingRight: 38 }} autoFocus />
          <button type="button" onClick={() => setShow((s) => !s)} style={{ position: "absolute", right: 10, top: 9, background: "none", border: "none", cursor: "pointer" }}>{show ? <EyeOff size={17} color="#8A7796" /> : <Eye size={17} color="#8A7796" />}</button>
        </div>
        {error && <p style={{ color: PINK, fontSize: 12.5, marginBottom: 10 }}>{error}</p>}
        <button type="button" onClick={submit} style={{ width: "100%", background: PURPLE_DEEP, color: "#fff", border: "none", borderRadius: 12, padding: "12px 0", fontWeight: 700, cursor: "pointer" }}>Entrar</button>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, icon, label }) {
  return (
    <button onClick={onClick} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "10px 4px", borderRadius: 12, border: "none", cursor: "pointer", background: active ? PURPLE_MID : "#fff", color: active ? "#fff" : PURPLE_MID, fontWeight: 700, fontSize: 11.5, boxShadow: active ? "none" : "0 1px 4px rgba(0,0,0,0.06)" }}>
      {icon} {label}
    </button>
  );
}

function AdminPanel({ catalog, saveCatalog, orders, saveOrders, settings, saveSettings, onLogout, onBack }) {
  const [tab, setTab] = useState("montados");
  return (
    <div style={{ minHeight: "100vh", background: "#F7F2F8", fontFamily: "'Quicksand', sans-serif" }}>
      <div style={{ background: PURPLE_DEEP, padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onBack} style={{ background: "rgba(255,255,255,0.12)", border: "none", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><ChevronLeft size={17} color="#fff" /></button>
          <span style={{ fontFamily: "'Baloo 2', cursive", color: "#fff", fontSize: 15.5 }}>Painel — {settings.storeName}</span>
        </div>
        <button onClick={onLogout} style={{ background: "none", border: "none", color: "#EBD9F0", display: "flex", alignItems: "center", gap: 5, fontSize: 13, cursor: "pointer" }}><LogOut size={15} /> Sair</button>
      </div>

      <div style={{ display: "flex", gap: 6, padding: "14px 16px 0", maxWidth: 680, margin: "0 auto", flexWrap: "wrap" }}>
        <TabBtn active={tab === "montados"} onClick={() => setTab("montados")} icon={<LayoutGrid size={14} />} label="Copos Montados" />
        <TabBtn active={tab === "horarios"} onClick={() => setTab("horarios")} icon={<Clock size={14} />} label="Horários" />
        <TabBtn active={tab === "opcoes"} onClick={() => setTab("opcoes")} icon={<Settings size={14} />} label="Opções" />
        <TabBtn active={tab === "pedidos"} onClick={() => setTab("pedidos")} icon={<ClipboardList size={14} />} label={`Pedidos${orders.length ? ` (${orders.length})` : ""}`} />
        <TabBtn active={tab === "config"} onClick={() => setTab("config")} icon={<Settings size={14} />} label="Config" />
      </div>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: 16 }}>
        {tab === "montados" && <MontadosTab catalog={catalog} saveCatalog={saveCatalog} />}
        {tab === "horarios" && <HorariosTab settings={settings} saveSettings={saveSettings} />}
        {tab === "opcoes" && <OpcoesTab catalog={catalog} saveCatalog={saveCatalog} />}
        {tab === "pedidos" && <OrdersTab orders={orders} saveOrders={saveOrders} />}
        {tab === "config" && <SettingsTab settings={settings} saveSettings={saveSettings} />}
      </div>
    </div>
  );
}

/* ---- Copos Montados CRUD ---- */
function MontadosTab({ catalog, saveCatalog }) {
  const [editing, setEditing] = useState(null);
  const montados = catalog.montados;

  function setMontados(next) { saveCatalog({ ...catalog, montados: next }); }

  if (editing) {
    return (
      <MontadoForm
        product={editing === "new" ? null : editing}
        onCancel={() => setEditing(null)}
        onSave={(p) => {
          if (editing === "new") setMontados([...montados, { ...p, id: uid() }]);
          else setMontados(montados.map((x) => (x.id === p.id ? p : x)));
          setEditing(null);
        }}
      />
    );
  }

  return (
    <div>
      <button onClick={() => setEditing("new")} style={{ width: "100%", background: LIME, color: PURPLE_DEEP, border: "none", borderRadius: 14, padding: "13px 0", fontWeight: 700, marginBottom: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
        <Plus size={16} strokeWidth={3} /> Novo copo montado
      </button>
      {montados.length === 0 && <p style={{ color: "#8A7796", fontSize: 14, textAlign: "center" }}>Nenhum copo montado cadastrado.</p>}
      {montados.map((m) => (
        <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", borderRadius: 16, padding: 10, marginBottom: 10, opacity: m.active === false ? 0.55 : 1 }}>
          {m.image ? <img src={m.image} style={{ width: 54, height: 54, borderRadius: 12, objectFit: "cover" }} /> : <div style={{ width: 54, height: 54, borderRadius: 12, background: `radial-gradient(circle at 30% 25%, #8E44AD, ${PURPLE_DEEP} 70%)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🥣</div>}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: PURPLE_DEEP }}>{m.name}</div>
            <div style={{ fontSize: 11.5, color: "#8A7796", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.recipe}{m.active === false ? " • inativo" : ""}</div>
          </div>
          <button onClick={() => setEditing(m)} style={{ background: "#F0E4F2", border: "none", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Pencil size={14} color={PURPLE_MID} /></button>
          <button onClick={() => { if (confirm(`Excluir "${m.name}"?`)) setMontados(montados.filter((x) => x.id !== m.id)); }} style={{ background: "#FBE4EA", border: "none", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Trash2 size={14} color={PINK} /></button>
        </div>
      ))}
    </div>
  );
}

function MontadoForm({ product, onCancel, onSave }) {
  const [name, setName] = useState(product?.name || "");
  const [recipe, setRecipe] = useState(product?.recipe || "");
  const [image, setImage] = useState(product?.image || "");
  const [active, setActive] = useState(product?.active !== false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const valid = name.trim();

  async function handleFile(e) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    try { setImage(await compressImage(file)); } catch (err) { console.error(err); alert("Não foi possível processar essa imagem."); }
    finally { setUploading(false); }
  }

  function submit() {
    if (!valid) return;
    onSave({ id: product?.id, name: name.trim(), recipe: recipe.trim(), image, active });
  }

  return (
    <div style={{ background: "#fff", borderRadius: 18, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <button onClick={onCancel} style={{ background: "#F0E4F2", border: "none", borderRadius: "50%", width: 30, height: 30, cursor: "pointer" }}><ChevronLeft size={16} color={PURPLE_MID} /></button>
        <h3 style={{ fontFamily: "'Baloo 2', cursive", color: PURPLE_DEEP, margin: 0 }}>{product ? "Editar copo montado" : "Novo copo montado"}</h3>
      </div>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
        <div onClick={() => fileRef.current?.click()} style={{ position: "relative", cursor: "pointer" }}>
          {image ? <img src={image} alt="" style={{ width: 96, height: 96, borderRadius: 20, objectFit: "cover" }} /> : <div style={{ width: 96, height: 96, borderRadius: 20, background: "#F0E4F2", display: "flex", alignItems: "center", justifyContent: "center" }}><ImagePlus size={26} color={PURPLE_MID} /></div>}
          <div style={{ position: "absolute", bottom: -4, right: -4, background: LIME, borderRadius: "50%", width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff" }}><Pencil size={12} color={PURPLE_DEEP} /></div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
      </div>
      {uploading && <p style={{ textAlign: "center", fontSize: 12, color: "#8A7796", marginTop: -8, marginBottom: 10 }}>Processando imagem...</p>}
      <Field label="Nome"><input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} placeholder="Ex: Milk Splash" /></Field>
      <Field label="Receita (o que leva)" hint="Aparece como descrição pro cliente"><textarea value={recipe} onChange={(e) => setRecipe(e.target.value)} style={{ ...inputStyle, resize: "none", height: 56 }} placeholder="Leite condensado + Leite em pó + Cereal + Canudinho" /></Field>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#F7F2F8", borderRadius: 12, padding: "10px 14px", marginBottom: 16 }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: PURPLE_DEEP }}>Visível no cardápio</span>
        <Toggle on={active} onClick={() => setActive((a) => !a)} />
      </div>
      <button onClick={submit} disabled={!valid} style={{ width: "100%", background: valid ? PURPLE_DEEP : "#DDD3E0", color: "#fff", border: "none", borderRadius: 14, padding: "13px 0", fontWeight: 700, cursor: valid ? "pointer" : "not-allowed" }}>Salvar</button>
    </div>
  );
}

/* ---- Opções: tamanhos, complementos, adicionais, frutas ---- */
function OpcoesTab({ catalog, saveCatalog }) {
  function updateSizes(sizes) { saveCatalog({ ...catalog, sizes }); }
  function updateSize(id, field, value) {
    updateSizes(catalog.sizes.map((s) => (s.id === id ? { ...s, [field]: field === "label" ? value : Number(value) } : s)));
  }
  function addSize() {
    updateSizes([...catalog.sizes, { id: uid(), label: "NOVO", price: 0, maxFrutas: 1, maxComplementos: 3, maxAdicionais: 1 }]);
  }
  function removeSize(id) {
    if (catalog.sizes.length <= 1) return alert("Precisa ter pelo menos 1 tamanho.");
    if (confirm("Remover esse tamanho?")) updateSizes(catalog.sizes.filter((s) => s.id !== id));
  }

  return (
    <div>
      <SectionCard title="Tamanhos e preços">
        {catalog.sizes.map((s) => (
          <div key={s.id} style={{ border: "1px solid #EDE1EF", borderRadius: 14, padding: 12, marginBottom: 10 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input value={s.label} onChange={(e) => updateSize(s.id, "label", e.target.value)} style={{ ...inputStyle, flex: 1 }} placeholder="Ex: 250ML" />
              <input value={s.price} onChange={(e) => updateSize(s.id, "price", e.target.value)} type="number" step="0.01" style={{ ...inputStyle, flex: 1 }} placeholder="Preço" />
              <button onClick={() => removeSize(s.id)} style={{ background: "#FBE4EA", border: "none", borderRadius: 10, width: 40, cursor: "pointer" }}><Trash2 size={14} color={PINK} style={{ margin: "0 auto" }} /></button>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <MiniNum label="Máx. frutas" value={s.maxFrutas} onChange={(v) => updateSize(s.id, "maxFrutas", v)} />
              <MiniNum label="Máx. complementos" value={s.maxComplementos} onChange={(v) => updateSize(s.id, "maxComplementos", v)} />
              <MiniNum label="Máx. adicionais" value={s.maxAdicionais} onChange={(v) => updateSize(s.id, "maxAdicionais", v)} />
            </div>
          </div>
        ))}
        <button onClick={addSize} style={{ width: "100%", background: "#F0E4F2", color: PURPLE_MID, border: "none", borderRadius: 12, padding: "10px 0", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>+ Adicionar tamanho</button>
      </SectionCard>

      <TagListEditor title="Complementos" items={catalog.complementos} onChange={(v) => saveCatalog({ ...catalog, complementos: v })} placeholder="Ex: Paçoca" />
      <TagListEditor title="Adicionais" items={catalog.adicionais} onChange={(v) => saveCatalog({ ...catalog, adicionais: v })} placeholder="Ex: Bis" />
      <SectionCard title="Adicionais extras nos Copos Montados">
        <Field label="Preço por adicional extra (R$)" hint="No 'Monte seu Copo' os adicionais continuam grátis (dentro do limite). Nos Copos Montados prontos, o cliente pode adicionar itens da lista acima pagando esse valor por unidade.">
          <input type="number" min="0" step="0.01" value={catalog.extraAdicionalPrice ?? 1} onChange={(e) => saveCatalog({ ...catalog, extraAdicionalPrice: Number(e.target.value) })} style={inputStyle} />
        </Field>
      </SectionCard>
      <TagListEditor title="Frutas" items={catalog.frutas} onChange={(v) => saveCatalog({ ...catalog, frutas: v })} placeholder="Ex: Kiwi" />
    </div>
  );
}

function MiniNum({ label, value, onChange }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 10.5, color: "#A796AD", fontWeight: 700, marginBottom: 3 }}>{label}</div>
      <input type="number" min="0" value={value} onChange={(e) => onChange(e.target.value)} style={{ ...inputStyle, padding: "7px 8px", fontSize: 13 }} />
    </div>
  );
}

function SectionCard({ title, children }) {
  return (
    <div style={{ background: "#fff", borderRadius: 18, padding: 16, marginBottom: 14 }}>
      <div style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 700, fontSize: 15, color: PURPLE_DEEP, marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  );
}

function TagListEditor({ title, items, onChange, placeholder }) {
  const [draft, setDraft] = useState("");
  function add() {
    const v = draft.trim();
    if (!v || items.includes(v)) return;
    onChange([...items, v]); setDraft("");
  }
  function remove(item) { onChange(items.filter((x) => x !== item)); }
  return (
    <SectionCard title={title}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 12 }}>
        {items.map((it) => (
          <span key={it} style={{ display: "flex", alignItems: "center", gap: 5, background: "#F3E9F5", color: PURPLE_DEEP, fontSize: 12.5, fontWeight: 700, padding: "6px 6px 6px 12px", borderRadius: 999 }}>
            {it}
            <button onClick={() => remove(it)} style={{ background: "rgba(0,0,0,0.08)", border: "none", borderRadius: "50%", width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><X size={11} color={PURPLE_MID} /></button>
          </span>
        ))}
        {items.length === 0 && <span style={{ fontSize: 12.5, color: "#A796AD" }}>Nenhum item ainda.</span>}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder={placeholder} style={{ ...inputStyle, flex: 1 }} />
        <button onClick={add} style={{ background: LIME, color: PURPLE_DEEP, border: "none", borderRadius: 10, padding: "0 16px", fontWeight: 700, cursor: "pointer" }}>+</button>
      </div>
    </SectionCard>
  );
}

/* ---- Pedidos ---- */
function OrdersTab({ orders, saveOrders }) {
  function updateStatus(id, status) { saveOrders(orders.map((o) => (o.id === id ? { ...o, status } : o))); }
  function removeOrder(id) { if (confirm("Remover este pedido do histórico?")) saveOrders(orders.filter((o) => o.id !== id)); }
  if (orders.length === 0) return <p style={{ color: "#8A7796", fontSize: 14, textAlign: "center", marginTop: 20 }}>Nenhum pedido recebido ainda.</p>;
  return (
    <div>
      {orders.map((o) => (
        <div key={o.id} style={{ background: "#fff", borderRadius: 16, padding: 14, marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14.5, color: PURPLE_DEEP }}>{o.customerName}</div>
              <div style={{ fontSize: 12, color: "#8A7796" }}>{o.phone} • {new Date(o.createdAt).toLocaleString("pt-BR")}</div>
            </div>
            <button onClick={() => removeOrder(o.id)} style={{ background: "none", border: "none", cursor: "pointer" }}><Trash2 size={15} color="#C3B4C7" /></button>
          </div>
          <div style={{ fontSize: 12.5, color: "#6B5876", marginTop: 6 }}>{o.address}</div>
          <div style={{ marginTop: 8, borderTop: "1px dashed #EEE1F0", paddingTop: 8 }}>
            {o.items.map((i, idx) => (
              <div key={idx} style={{ marginBottom: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: PURPLE_DEEP, fontWeight: 700 }}>
                  <span>{i.qty}x {i.name} ({i.size?.label})</span><span>{formatBRL(i.price * i.qty)}</span>
                </div>
                {itemDetailLine(i) && <div style={{ fontSize: 11.5, color: "#8A7796" }}>{itemDetailLine(i)}</div>}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, marginTop: 6, fontSize: 14 }}><span>Total ({o.payment})</span><span style={{ color: PINK }}>{formatBRL(o.total)}</span></div>
          {o.notes && <div style={{ fontSize: 12, color: "#8A7796", marginTop: 4, fontStyle: "italic" }}>Obs: {o.notes}</div>}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
            {ORDER_STATUSES.map((s) => (
              <button key={s} onClick={() => updateStatus(o.id, s)} style={{ padding: "5px 10px", borderRadius: 999, border: "none", fontSize: 11.5, fontWeight: 700, cursor: "pointer", background: o.status === s ? STATUS_COLOR[s] : "#F0EAF1", color: o.status === s ? "#fff" : "#8A7796" }}>{s}</button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---- Horários de funcionamento ---- */
function HorariosTab({ settings, saveSettings }) {
  const [local, setLocal] = useState(settings.horariosSemana && settings.horariosSemana.length ? settings.horariosSemana : DEFAULT_HORARIOS);
  const [autoOn, setAutoOn] = useState(!!settings.useAutoHorario);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLocal(settings.horariosSemana && settings.horariosSemana.length ? settings.horariosSemana : DEFAULT_HORARIOS);
    setAutoOn(!!settings.useAutoHorario);
  }, [settings]);

  function updateDay(day, field, value) {
    setLocal((cur) => cur.map((d) => (d.day === day ? { ...d, [field]: value } : d)));
    setSaved(false);
  }

  async function save() {
    await saveSettings({ ...settings, horariosSemana: local, useAutoHorario: autoOn });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div>
      <SectionCard title="Abertura e fechamento automático">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ paddingRight: 10 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: PURPLE_DEEP }}>Usar estes horários</div>
            <div style={{ fontSize: 11.5, color: "#8A7796" }}>Quando ligado, a loja abre e fecha sozinha seguindo a tabela abaixo. Quando desligado, use o botão "Loja aberta" na aba Config para controlar manualmente.</div>
          </div>
          <Toggle on={autoOn} onClick={() => { setAutoOn((a) => !a); setSaved(false); }} />
        </div>
      </SectionCard>

      <SectionCard title="Horário por dia da semana">
        {local.map((d) => (
          <div key={d.day} style={{ border: "1px solid #EDE1EF", borderRadius: 14, padding: 12, marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: d.enabled ? 10 : 0 }}>
              <span style={{ fontWeight: 700, fontSize: 13.5, color: PURPLE_DEEP }}>{d.label}</span>
              <Toggle on={d.enabled} onClick={() => updateDay(d.day, "enabled", !d.enabled)} />
            </div>
            {d.enabled && (
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10.5, color: "#A796AD", fontWeight: 700, marginBottom: 3 }}>Abre às</div>
                  <input type="time" value={d.from} onChange={(e) => updateDay(d.day, "from", e.target.value)} style={{ ...inputStyle, padding: "7px 8px", fontSize: 13 }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10.5, color: "#A796AD", fontWeight: 700, marginBottom: 3 }}>Fecha às</div>
                  <input type="time" value={d.to} onChange={(e) => updateDay(d.day, "to", e.target.value)} style={{ ...inputStyle, padding: "7px 8px", fontSize: 13 }} />
                </div>
              </div>
            )}
          </div>
        ))}
      </SectionCard>

      <button onClick={save} style={{ width: "100%", background: PURPLE_DEEP, color: "#fff", border: "none", borderRadius: 14, padding: "13px 0", fontWeight: 700, cursor: "pointer" }}>{saved ? "Salvo ✓" : "Salvar horários"}</button>
      <p style={{ fontSize: 11.5, color: "#B0A2B5", marginTop: 12, lineHeight: 1.5 }}>Quando a loja estiver fechada (fora do horário ou desligada em Config), os clientes veem um aviso no cardápio e não conseguem finalizar pedidos.</p>
    </div>
  );
}

/* ---- Config ---- */
function SettingsTab({ settings, saveSettings }) {
  const [local, setLocal] = useState(settings);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  useEffect(() => setLocal(settings), [settings]);
  function change(field, value) { setLocal((l) => ({ ...l, [field]: value })); setSaved(false); }
  async function save() { await saveSettings(local); setSaved(true); setTimeout(() => setSaved(false), 2000); }
  async function handleLogo(e) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    try { change("logo", await compressImage(file, 240, 0.75)); } catch (err) { alert("Não foi possível processar essa imagem."); }
    finally { setUploading(false); }
  }

  return (
    <div style={{ background: "#fff", borderRadius: 18, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
        <div onClick={() => fileRef.current?.click()} style={{ position: "relative", cursor: "pointer" }}>
          {local.logo ? <img src={local.logo} alt="" style={{ width: 84, height: 84, borderRadius: "50%", objectFit: "cover" }} /> : <div style={{ width: 84, height: 84, borderRadius: "50%", background: "#F0E4F2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30 }}>🍇</div>}
          <div style={{ position: "absolute", bottom: -2, right: -2, background: LIME, borderRadius: "50%", width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff" }}><Pencil size={12} color={PURPLE_DEEP} /></div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleLogo} style={{ display: "none" }} />
      </div>
      {uploading && <p style={{ textAlign: "center", fontSize: 12, color: "#8A7796", marginTop: -10, marginBottom: 10 }}>Processando...</p>}
      <Field label="Nome da loja"><input value={local.storeName} onChange={(e) => change("storeName", e.target.value)} style={inputStyle} /></Field>
      <Field label="Frase de efeito"><input value={local.tagline} onChange={(e) => change("tagline", e.target.value)} style={inputStyle} /></Field>
      <Field label="WhatsApp para receber pedidos" hint="Com DDI e DDD, só números — ex: 5583986188380">
        <input value={local.whatsappNumber} onChange={(e) => change("whatsappNumber", e.target.value.replace(/[^\d]/g, ""))} style={inputStyle} placeholder="5583986188380" />
      </Field>
      <Field label="Instagram"><input value={local.instagram} onChange={(e) => change("instagram", e.target.value)} style={inputStyle} placeholder="@seuinstagram" /></Field>
      <Field label="Horário de funcionamento"><input value={local.horario} onChange={(e) => change("horario", e.target.value)} style={inputStyle} placeholder="Ex: 13h às 22h" /></Field>
      <Field label="Localização"><input value={local.localizacao} onChange={(e) => change("localizacao", e.target.value)} style={inputStyle} placeholder="Ex: Sua cidade, UF" /></Field>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}><Field label="Pedido mínimo (R$)"><input type="number" step="0.01" value={local.minOrder} onChange={(e) => change("minOrder", Number(e.target.value))} style={inputStyle} /></Field></div>
        <div style={{ flex: 1 }}><Field label="Texto de entrega"><input value={local.deliveryText} onChange={(e) => change("deliveryText", e.target.value)} style={inputStyle} placeholder="Entrega grátis" /></Field></div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#F7F2F8", borderRadius: 12, padding: "10px 14px", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: PURPLE_DEEP }}>Loja aberta</div>
          <div style={{ fontSize: 11.5, color: "#8A7796" }}>Quando desligado, clientes não conseguem pedir</div>
        </div>
        <Toggle on={local.isOpen} onClick={() => change("isOpen", !local.isOpen)} />
      </div>
      <button onClick={save} style={{ width: "100%", background: PURPLE_DEEP, color: "#fff", border: "none", borderRadius: 14, padding: "13px 0", fontWeight: 700, cursor: "pointer" }}>{saved ? "Salvo ✓" : "Salvar configurações"}</button>
      <p style={{ fontSize: 11.5, color: "#B0A2B5", marginTop: 12, lineHeight: 1.5 }}>A senha do painel foi definida na criação do site e não pode ser alterada por aqui.</p>
    </div>
  );
}

/* =========================================================
   ROOT APP
========================================================= */
export default function App() {
  useGoogleFonts();
  const [catalog, saveCatalog, catalogLoaded] = useSharedState("catalog", DEFAULT_CATALOG, 6000, true);
  const [orders, saveOrders, ordersLoaded] = useSharedState("orders", [], 6000);
  const [settings, saveSettings, settingsLoaded] = useSharedState("settings", DEFAULT_SETTINGS, 6000, true);
  const [cart, setCart] = useState([]);
  const [view, setView] = useState("menu");
  const [authed, setAuthed] = useState(false);

  const ready = catalogLoaded && ordersLoaded && settingsLoaded;
  if (!ready) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: CREAM, fontFamily: "'Quicksand', sans-serif", color: PURPLE_MID }}>Carregando cardápio...</div>;
  }

  if (view === "login") return <AdminLogin onSuccess={() => { setAuthed(true); setView("admin"); }} onBack={() => setView("menu")} />;

  if (view === "admin" && authed) {
    return <AdminPanel catalog={catalog} saveCatalog={saveCatalog} orders={orders} saveOrders={saveOrders} settings={settings} saveSettings={saveSettings} onLogout={() => { setAuthed(false); setView("menu"); }} onBack={() => setView("menu")} />;
  }

  return <PublicMenu catalog={catalog} settings={settings} cart={cart} setCart={setCart} onGoAdmin={() => setView(authed ? "admin" : "login")} />;
}
