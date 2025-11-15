// src/pages/BillPlannerTab.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";

/** ======================= CẤU HÌNH & TIỆN ÍCH ======================= */

// Bảng giá điện sinh hoạt 6 bậc (tham khảo 2025) – đơn vị: đồng/kWh
const DEFAULT_TIERS = [
  { limit: 50,       price: 1984 },
  { limit: 100,      price: 2050 },
  { limit: 200,      price: 2380 },
  { limit: 300,      price: 2998 },
  { limit: 400,      price: 3350 },
  { limit: Infinity, price: 3460 },
];

const LS_KEY_ITEMS = "bill.items.v3";
const LS_KEY_VAT   = "bill.vat.v2";

const toNumber = (v, def = 0) => {
  if (typeof v === "number") return v;
  if (!v) return def;
  const x = String(v).replace(",", "."); // cho phép nhập 8,5
  const n = parseFloat(x);
  return Number.isFinite(n) ? n : def;
};

const fmtMoney = (n) =>
  (n ?? 0).toLocaleString("vi-VN", { maximumFractionDigits: 0 });

const fmtKwh = (n) =>
  (n ?? 0).toLocaleString("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtPercent = (p) => `${(p * 100).toFixed(0)}%`;

/** Phân hạng bậc thang theo tổng kWh */
function splitByTiers(kwhTotal, tiers = DEFAULT_TIERS) {
  let remain = Math.max(0, kwhTotal);
  const parts = [];
  let prevLimit = 0;

  for (const t of tiers) {
    const bandSize = t.limit === Infinity ? Infinity : t.limit - prevLimit;
    const use = Math.min(remain, bandSize);
    if (use > 0) {
      parts.push({ kwh: use, price: t.price, cost: use * t.price });
      remain -= use;
    }
    if (remain <= 1e-9) break;
    prevLimit = t.limit === Infinity ? prevLimit : t.limit;
  }
  return parts;
}

/** ======================= PHÂN NHÓM THIẾT BỊ (đồng bộ AnalysisTab) ======================= */
const toNorm = (s = "") =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/**
 * Trả về mã nhóm (cat) trùng với AnalysisTab:
 * cooling, lighting, fridge, laundry, microwave, oven, cooktop, dishwasher, range_hood,
 * network, fan, water_heater, water_heater_instant, air_purifier, dehumidifier,
 * water_pump, water_dispenser, hair_dryer, iron, rice_cooker, air_fryer, kettle,
 * laptop, pc, monitor, game_console, other
 */
function categoryOf(label = "") {
  const s = toNorm(label);
  if (s.includes("may lanh") || s.includes("dieu hoa") || s.includes("air conditioner") || s.includes(" ac"))
    return "cooling";
  if (s.includes("den") || s.includes("lamp") || s.includes("light") || s.includes("bulb") || s.includes("led"))
    return "lighting";
  if (s.includes("tu lanh") || s.includes("fridge") || s.includes("refrigerator") || s.includes("freezer"))
    return "fridge";
  if (s.includes("giat") || s.includes("washer") || (s.includes("say") && !s.includes("toc")) || s.includes("dryer"))
    return "laundry";
  if (s.includes("microwave") || s.includes("lo vi song"))
    return "microwave";
  if (s.includes("oven") || s.includes("lo nuong"))
    return "oven";
  if (s.includes("induction") || s.includes("bep tu") || s.includes("ceramic") || s.includes("bep dien") || s.includes("electric cooktop") || s.includes("electric stove"))
    return "cooktop";
  if (s.includes("dishwasher") || s.includes("may rua chen"))
    return "dishwasher";
  if (s.includes("range hood") || s.includes("hut mui") || s.includes("hood"))
    return "range_hood";
  if (s.includes("router") || s.includes("wifi") || s.includes("wi-fi") || s.includes("modem"))
    return "network";
  if (s.includes("quat") || s.includes("fan"))
    return "fan";
  if (s.includes("instant water heater"))
    return "water_heater_instant";
  if (s.includes("binh nuoc nong") || s.includes("water heater"))
    return "water_heater";
  if (s.includes("air purifier") || s.includes("loc khong khi"))
    return "air_purifier";
  if (s.includes("dehumidifier") || s.includes("hut am"))
    return "dehumidifier";
  if (s.includes("water pump") || s.includes("bom nuoc"))
    return "water_pump";
  if (s.includes("water dispenser") || s.includes("cay nuoc"))
    return "water_dispenser";
  if (s.includes("hair dryer") || s.includes("may say toc"))
    return "hair_dryer";
  if (s.includes("iron") || s.includes("ban ui"))
    return "iron";
  if (s.includes("rice cooker") || s.includes("noi com"))
    return "rice_cooker";
  if (s.includes("air fryer") || s.includes("noi chien"))
    return "air_fryer";
  if (s.includes("kettle") || s.includes("am sieu toc"))
    return "kettle";
  if (s.includes("laptop"))
    return "laptop";
  if (s.includes("desktop") || s.includes("computer") || s.includes("may tinh de ban"))
    return "pc";
  if (s.includes("monitor") || s.includes("man hinh"))
    return "monitor";
  if (s.includes("game console"))
    return "game_console";
  return "other";
}

const colorChip = (cat) =>
  ({
    cooling:  "bg-sky-100 text-sky-800 border-sky-200",
    lighting: "bg-amber-100 text-amber-800 border-amber-200",
    fridge:   "bg-emerald-100 text-emerald-800 border-emerald-200",
    laundry:  "bg-violet-100 text-violet-800 border-violet-200",
    microwave:"bg-rose-100 text-rose-800 border-rose-200",
    oven:     "bg-rose-100 text-rose-800 border-rose-200",
    cooktop:  "bg-orange-100 text-orange-800 border-orange-200",
    dishwasher:"bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200",
    range_hood:"bg-lime-100 text-lime-800 border-lime-200",
    network:  "bg-cyan-100 text-cyan-800 border-cyan-200",
    fan:      "bg-indigo-100 text-indigo-800 border-indigo-200",
    water_heater: "bg-orange-100 text-orange-800 border-orange-200",
    water_heater_instant: "bg-orange-100 text-orange-800 border-orange-200",
    air_purifier: "bg-teal-100 text-teal-800 border-teal-200",
    dehumidifier: "bg-teal-100 text-teal-800 border-teal-200",
    water_pump: "bg-emerald-100 text-emerald-800 border-emerald-200",
    water_dispenser: "bg-emerald-100 text-emerald-800 border-emerald-200",
    hair_dryer: "bg-pink-100 text-pink-800 border-pink-200",
    iron: "bg-slate-100 text-slate-800 border-slate-200",
    rice_cooker: "bg-yellow-100 text-yellow-800 border-yellow-200",
    air_fryer: "bg-yellow-100 text-yellow-800 border-yellow-200",
    kettle: "bg-yellow-100 text-yellow-800 border-yellow-200",
    laptop: "bg-slate-100 text-slate-700 border-slate-200",
    pc: "bg-slate-100 text-slate-700 border-slate-200",
    monitor: "bg-slate-100 text-slate-700 border-slate-200",
    game_console: "bg-slate-100 text-slate-700 border-slate-200",
    other:    "bg-slate-100 text-slate-700 border-slate-200",
  }[cat] || "bg-slate-100 text-slate-700 border-slate-200");

/** ======================= KHUYẾN NGHỊ (đồng bộ nhóm) ======================= */
/**
 * Mỗi nhóm có:
 *  - desc: mô tả khuyến nghị
 *  - factor: hệ số giảm kWh (nhờ tối ưu công suất)
 *  - hoursFactor: hệ số giảm theo thời gian sử dụng
 * Có thể chỉnh theo thực nghiệm của bạn.
 */
const RECO_MAP = {
  cooling:  { desc: "Đặt 26–28°C; vệ sinh lưới lọc; kéo rèm khi nắng gắt.", factor: 0.85 },
  lighting: { desc: "Đổi LED; tắt khi không dùng; tận dụng ánh sáng tự nhiên.", factor: 0.70 },
  fridge:   { desc: "Cách tường ≥10 cm; mở ít/lâu hơn; chỉnh 3–5°C.", factor: 0.90 },
  laundry:  { desc: "Giặt đủ tải; chế độ Eco; vắt khô trước sấy.", factor: 0.90 },
  microwave:{ desc: "Hâm/nấu vừa đủ; không bật khi trống.", hoursFactor: 0.80 },
  oven:     { desc: "Tiền nhiệt hợp lý; hạn chế mở cửa lò.", hoursFactor: 0.83 },
  cooktop:  { desc: "Nồi phù hợp; che nắp; tắt ngay khi xong.", factor: 0.90 },
  dishwasher:{ desc: "Chạy khi đủ tải; chế độ Eco; bỏ sấy nhiệt nếu không cần.", factor: 0.85 },
  range_hood:{ desc: "Bật khi nấu; tắt khi xong; vệ sinh lưới lọc.", hoursFactor: 0.70 },
  network:  { desc: "Hẹn giờ tắt ban đêm; tắt SSID khách.", hoursFactor: 0.80 },
  fan:      { desc: "Tắt khi rời phòng; ưu tiên quạt khi trời mát.", factor: 0.90 },
  water_heater: { desc: "Bật 15' trước khi dùng thay vì 30'.", hoursFactor: 0.50 },
  water_heater_instant: { desc: "Tắm nhanh; giảm nhiệt vừa đủ; tắt sau khi dùng.", hoursFactor: 0.80 },
  air_purifier: { desc: "Auto mode; đóng cửa; vệ sinh màng lọc.", factor: 0.88 },
  dehumidifier: { desc: "Đặt 50–55% RH; đóng cửa; vệ sinh lọc.", factor: 0.90 },
  water_pump: { desc: "Kiểm tra rò rỉ; tắt khi không cần.", factor: 0.90 },
  water_dispenser: { desc: "ECO/tắt ban đêm; khử cặn định kỳ.", hoursFactor: 0.83 },
  hair_dryer: { desc: "Mức nhiệt vừa; rút ngắn thời gian.", hoursFactor: 0.80 },
  iron: { desc: "Ủi gộp; nhiệt vừa; rút phích.", hoursFactor: 0.80 },
  rice_cooker: { desc: "Không giữ ấm quá lâu; rút điện sau khi nấu.", factor: 0.80 },
  air_fryer: { desc: "Nướng/hâm vừa đủ; vệ sinh khoang.", hoursFactor: 0.85 },
  kettle: { desc: "Đun vừa đủ nước; hạn chế đun lặp lại.", factor: 0.90 },
  laptop: { desc: "Power Saver; giảm sáng; auto-sleep.", factor: 0.90 },
  pc: { desc: "Balanced/Power Saver; sleep.", factor: 0.85 },
  monitor: { desc: "Giảm độ sáng; sleep.", factor: 0.90 },
  game_console: { desc: "Rest mode hợp lý; tắt auto-download.", hoursFactor: 0.90 },
  // other: đang phát triển
};

function applyRecommendation(kwhMonth, cat) {
  const r = RECO_MAP[cat];
  if (!r) return { kwhAfter: kwhMonth, note: "Đang phát triển", pending: true };
  let factor = 1.0;
  if (typeof r.factor === "number") factor *= r.factor;
  if (typeof r.hoursFactor === "number") factor *= r.hoursFactor;
  return { kwhAfter: kwhMonth * factor, note: r.desc, pending: false };
}

/** ======================= COMPONENT CHÍNH ======================= */
export default function BillPlannerTab() {
  // dữ liệu thiết bị (mẫu phổ biến VN)
  const [items, setItems] = useState(() => {
    try {
      const s = localStorage.getItem(LS_KEY_ITEMS);
      return s ? JSON.parse(s) : [
        { name: "Máy lạnh 1.5HP",     powerW: 1200, hoursPerDay: 8,  daysPerMonth: 30, qty: 1 },
        { name: "Tủ lạnh",            powerW: 120,  hoursPerDay: 24, daysPerMonth: 30, qty: 1 },
        { name: "Máy giặt",           powerW: 500,  hoursPerDay: 0.3,daysPerMonth: 15, qty: 1 },
        { name: "Lò vi sóng",         powerW: 1200, hoursPerDay: 0.1,daysPerMonth: 30, qty: 1 },
        { name: "Lò nướng",           powerW: 1800, hoursPerDay: 0.6,daysPerMonth: 8,  qty: 1 },
        { name: "Bếp từ",             powerW: 2000, hoursPerDay: 0.8,daysPerMonth: 30, qty: 1 },
        { name: "Router Wi-Fi",       powerW: 10,   hoursPerDay: 24, daysPerMonth: 30, qty: 1 },
        { name: "Đèn LED phòng khách",powerW: 12,   hoursPerDay: 5,  daysPerMonth: 30, qty: 4 },
      ];
    } catch { return []; }
  });

  // VAT
  const [vat, setVat] = useState(() => {
    const s = localStorage.getItem(LS_KEY_VAT);
    return s ? Number(s) : 0.10; // mặc định 10%
  });

  // gợi ý kéo ngang
  const [showHint, setShowHint] = useState(true);
  const scrollRef = useRef(null);
  useEffect(() => {
    const t = setTimeout(() => setShowHint(false), 3500);
    return () => clearTimeout(t);
  }, []);
  const onScroll = (e) => {
    if (e.currentTarget.scrollLeft > 0) setShowHint(false);
  };

  // lưu localStorage
  useEffect(() => {
    localStorage.setItem(LS_KEY_ITEMS, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem(LS_KEY_VAT, String(vat));
  }, [vat]);

  // Tính kWh baseline (chưa khuyến nghị)
  const perItem = useMemo(() => {
    return items.map((it) => {
      const w = toNumber(it.powerW);
      const h = toNumber(it.hoursPerDay);
      const d = toNumber(it.daysPerMonth, 30);
      const q = toNumber(it.qty, 1);
      const kwhDay = (w * h * q) / 1000;
      const kwhMonth = kwhDay * d;
      const cat = categoryOf(it.name);
      return { ...it, cat, kwhDay, kwhMonth };
    });
  }, [items]);

  const totalKwh = useMemo(
    () => perItem.reduce((s, it) => s + it.kwhMonth, 0),
    [perItem]
  );

  // Tính kWh sau khuyến nghị
  const perItemWithReco = useMemo(() => {
    return perItem.map((it) => {
      const { kwhAfter, note, pending } = applyRecommendation(it.kwhMonth, it.cat);
      const saved = Math.max(0, it.kwhMonth - kwhAfter);
      const savedPct = it.kwhMonth > 0 ? saved / it.kwhMonth : 0;
      return { ...it, recoNote: note, pending, kwhAfter, saved, savedPct };
    });
  }, [perItem]);

  const totalKwhAfter = useMemo(
    () => perItemWithReco.reduce((s, it) => s + it.kwhAfter, 0),
    [perItemWithReco]
  );

  // Tính tiền trước/sau khuyến nghị
  const tierBefore = useMemo(() => splitByTiers(totalKwh, DEFAULT_TIERS), [totalKwh]);
  const energySubtotalBefore = tierBefore.reduce((s, p) => s + p.cost, 0);
  const vatBefore = energySubtotalBefore * vat;
  const energyTotalBefore = energySubtotalBefore + vatBefore;

  const tierAfter = useMemo(() => splitByTiers(totalKwhAfter, DEFAULT_TIERS), [totalKwhAfter]);
  const energySubtotalAfter = tierAfter.reduce((s, p) => s + p.cost, 0);
  const vatAfter = energySubtotalAfter * vat;
  const energyTotalAfter = energySubtotalAfter + vatAfter;

  const savedKwh = Math.max(0, totalKwh - totalKwhAfter);
  const savedMoney = Math.max(0, energyTotalBefore - energyTotalAfter);
  const savedPct = totalKwh > 0 ? savedKwh / totalKwh : 0;

  function addItem() {
    setItems((arr) => [
      ...arr,
      { name: "", powerW: 100, hoursPerDay: 1, daysPerMonth: 30, qty: 1 },
    ]);
    setTimeout(() => {
      scrollRef.current?.scrollTo({ left: 9999, behavior: "smooth" });
    }, 50);
  }

  function clearAll() {
    if (!confirm("Xoá toàn bộ thiết bị?")) return;
    setItems([]);
  }

  function removeAt(idx) {
    setItems((arr) => arr.filter((_, i) => i !== idx));
  }

  function updateAt(idx, patch) {
    setItems((arr) => arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  /** ======================= Biểu đồ (không cần lib) ======================= */
  function TotalCompareBar({ before, after }) {
    const max = Math.max(before, after, 1e-6);
    const b = (before / max) * 100;
    const a = (after / max) * 100;
    return (
      <div className="space-y-2">
        <div>
          <div className="text-xs mb-1">Tổng kWh/tháng</div>
          <div className="w-full bg-slate-100 rounded h-4 overflow-hidden">
            <div className="bg-indigo-400 h-4" style={{ width: `${b}%` }} />
          </div>
          <div className="text-xs mt-1">Trước: <b>{fmtKwh(before)} kWh</b></div>
        </div>
        <div>
          <div className="text-xs mb-1">Sau khuyến nghị</div>
          <div className="w-full bg-slate-100 rounded h-4 overflow-hidden">
            <div className="bg-emerald-500 h-4" style={{ width: `${a}%` }} />
          </div>
          <div className="text-xs mt-1">Sau: <b>{fmtKwh(after)} kWh</b></div>
        </div>
      </div>
    );
  }

  function ItemCompareRow({ name, before, after }) {
    const max = Math.max(before, after, 1e-6);
    const bw = (before / max) * 100;
    const aw = (after / max) * 100;
    return (
      <div className="mb-2">
        <div className="text-sm mb-1 truncate">{name || "Thiết bị"}</div>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <div className="w-full bg-slate-100 rounded h-3 overflow-hidden">
              <div className="bg-indigo-400 h-3" style={{ width: `${bw}%` }} />
            </div>
            <div className="text-[11px] mt-0.5 opacity-70">
              Trước: {fmtKwh(before)} kWh
            </div>
          </div>
          <div className="flex-1">
            <div className="w-full bg-slate-100 rounded h-3 overflow-hidden">
              <div className="bg-emerald-500 h-3" style={{ width: `${aw}%` }} />
            </div>
            <div className="text-[11px] mt-0.5 opacity-70">
              Sau: {fmtKwh(after)} kWh
            </div>
          </div>
        </div>
      </div>
    );
  }

  /** ======================= RENDER ======================= */
  return (
    <div
      className="mx-auto p-4 max-w-5xl"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        minHeight: "calc(100dvh - env(safe-area-inset-top))",
      }}
    >
      <h2 className="text-2xl font-bold mb-3">Tính tiền điện & Khuyến nghị (1 tháng)</h2>

      {/* thanh chip tổng quan (kéo ngang) */}
      <div className="rounded-2xl bg-white/70 backdrop-blur p-4 shadow mb-4">
        <div className="mb-3 text-sm text-slate-600">Tổng quan nhanh</div>
        <div className="relative">
          <div
            ref={scrollRef}
            onScroll={onScroll}
            className="flex gap-2 overflow-x-auto pb-2 pr-4 -mr-4"
            style={{ scrollbarWidth: "thin", WebkitOverflowScrolling: "touch" }}
          >
            <div className="whitespace-nowrap border px-3 py-1 rounded-full text-sm bg-indigo-100 text-indigo-800 border-indigo-200">
              kWh trước: <b>{fmtKwh(totalKwh)} kWh</b>
            </div>
            <div className="whitespace-nowrap border px-3 py-1 rounded-full text-sm bg-emerald-100 text-emerald-800 border-emerald-200">
              kWh sau khuyến nghị: <b>{fmtKwh(totalKwhAfter)} kWh</b>
            </div>
            <div className="whitespace-nowrap border px-3 py-1 rounded-full text-sm bg-cyan-100 text-cyan-800 border-cyan-200">
              Tiết kiệm: <b>{fmtKwh(savedKwh)} kWh</b> ({fmtPercent(savedPct)})
            </div>
            <div className="whitespace-nowrap border px-3 py-1 rounded-full text-sm bg-rose-100 text-rose-800 border-rose-200">
              Tiền trước (VAT {Math.round(vat * 100)}%): <b>{fmtMoney(energyTotalBefore)} đ</b>
            </div>
            <div className="whitespace-nowrap border px-3 py-1 rounded-full text-sm bg-emerald-100 text-emerald-800 border-emerald-200">
              Tiền sau: <b>{fmtMoney(energyTotalAfter)} đ</b> (giảm ~{fmtMoney(savedMoney)} đ)
            </div>

            {/* từng thiết bị */}
            {perItemWithReco.map((it, i) => {
              const chip = colorChip(it.cat);
              return (
                <div
                  key={`chip-${i}`}
                  className={`whitespace-nowrap border px-3 py-1 rounded-full text-sm ${chip}`}
                  title={it.recoNote}
                >
                  {it.name || "Thiết bị"} · {fmtKwh(it.kwhMonth)}→{fmtKwh(it.kwhAfter)} kWh
                </div>
              );
            })}
          </div>

          {showHint && (
            <div className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 bg-white/80 px-2 py-0.5 rounded text-xs text-slate-600 shadow">
              ⇆ Vuốt ngang để xem
            </div>
          )}
        </div>
      </div>

      {/* khối nhập liệu */}
      <div className="rounded-2xl bg-white/70 backdrop-blur p-4 shadow">
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={addItem}
            className="px-4 py-3 rounded-xl bg-blue-600 text-white hover:bg-blue-700"
          >
            + Thêm thiết bị
          </button>
          <button
            onClick={clearAll}
            className="px-4 py-3 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100"
          >
            Xoá tất cả
          </button>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-sm">VAT</span>
            <select
              value={vat}
              onChange={(e) => setVat(Number(e.target.value))}
              className="border rounded-lg px-3 py-2"
            >
              <option value={0}>0%</option>
              <option value={0.08}>8% (ưu đãi)</option>
              <option value={0.10}>10% (mặc định)</option>
            </select>
          </div>
        </div>

        {/* bảng nhập – cho phép kéo ngang để thấy đủ cột */}
        <div className="relative">
          <div
            className="overflow-x-auto -mx-2 px-2 pb-2"
            style={{ WebkitOverflowScrolling: "touch" }}
            onScroll={(e) => e.currentTarget.scrollLeft > 0 && setShowHint(false)}
          >
            <table className="min-w-[820px] w-full">
              <thead>
                <tr className="text-left text-slate-600">
                  <th className="pb-2 pr-3">Thiết bị</th>
                  <th className="pb-2 pr-3">Công suất (W)</th>
                  <th className="pb-2 pr-3">Giờ/ngày</th>
                  <th className="pb-2 pr-3">Ngày/tháng</th>
                  <th className="pb-2 pr-3">Số lượng</th>
                  <th className="pb-2 pr-3 text-right">kWh/tháng</th>
                  <th className="pb-2 pr-3 text-right">kWh sau KN</th>
                  <th className="pb-2 pr-3 text-right">Tiết kiệm</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {perItemWithReco.map((it, i) => {
                  const chipBg = colorChip(it.cat).split(" ")[0]; // màu vạch loại
                  return (
                    <tr key={i} className="align-top">
                      <td className="py-1 pr-3">
                        <div className="flex items-center gap-2">
                          <span className={`inline-block h-4 w-1 rounded ${chipBg}`} />
                          <input
                            value={it.name}
                            onChange={(e) => updateAt(i, { name: e.target.value })}
                            placeholder="Ví dụ: Bếp từ, Máy giặt, Lò vi sóng…"
                            className="w-[300px] md:w-[360px] border rounded px-3 py-2"
                          />
                        </div>
                        <div className={`text-xs mt-1 ${it.pending ? "text-slate-500" : "text-emerald-700"}`}>
                          {it.pending ? "Khuyến nghị: Đang phát triển" : `Khuyến nghị: ${it.recoNote}`}
                        </div>
                      </td>
                      <td className="py-1 pr-3">
                        <input
                          type="number"
                          step="1"
                          inputMode="decimal"
                          value={it.powerW}
                          onChange={(e) => updateAt(i, { powerW: toNumber(e.target.value, 0) })}
                          className="w-28 border rounded px-3 py-2 text-right"
                        />
                      </td>
                      <td className="py-1 pr-3">
                        <input
                          type="number"
                          step="0.1"
                          inputMode="decimal"
                          value={it.hoursPerDay}
                          onChange={(e) => updateAt(i, { hoursPerDay: toNumber(e.target.value, 0) })}
                          className="w-24 border rounded px-3 py-2 text-right"
                        />
                      </td>
                      <td className="py-1 pr-3">
                        <input
                          type="number"
                          step="1"
                          inputMode="decimal"
                          value={it.daysPerMonth}
                          onChange={(e) => updateAt(i, { daysPerMonth: toNumber(e.target.value, 30) })}
                          className="w-24 border rounded px-3 py-2 text-right"
                        />
                      </td>
                      <td className="py-1 pr-3">
                        <input
                          type="number"
                          step="1"
                          inputMode="decimal"
                          value={it.qty}
                          onChange={(e) => updateAt(i, { qty: toNumber(e.target.value, 1) })}
                          className="w-20 border rounded px-3 py-2 text-right"
                        />
                      </td>

                      <td className="py-1 pr-3 text-right whitespace-nowrap">
                        <div className="font-medium">{fmtKwh(it.kwhMonth)}</div>
                      </td>
                      <td className="py-1 pr-3 text-right whitespace-nowrap">
                        <div className="font-medium text-emerald-700">{fmtKwh(it.kwhAfter)}</div>
                      </td>
                      <td className="py-1 pr-3 text-right whitespace-nowrap">
                        <div className="font-medium text-sky-700">
                          {fmtKwh(it.saved)} kWh ({fmtPercent(it.savedPct)})
                        </div>
                      </td>

                      <td className="py-1">
                        <button
                          onClick={() => removeAt(i)}
                          className="px-3 py-2 text-rose-600 hover:text-rose-700"
                          title="Xoá dòng"
                        >
                          Xoá
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {perItemWithReco.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-3 text-slate-500">
                      Chưa có thiết bị. Nhấn <b>+ Thêm thiết bị</b> để bắt đầu.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* gợi ý vuốt ngang */}
          {showHint && (
            <div className="pointer-events-none absolute right-2 top-0 bg-white/80 px-2 py-0.5 rounded text-xs text-slate-600 shadow">
              ⇆ Vuốt ngang để nhập đủ cột
            </div>
          )}
        </div>

        {/* tổng hợp + biểu đồ */}
        <div className="mt-6 grid lg:grid-cols-2 gap-4">
          <div className="rounded-xl border p-4 bg-white">
            <h3 className="font-semibold mb-2">Tổng hợp kWh & Tiền điện</h3>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded border p-3">
                <div className="text-slate-600">kWh trước</div>
                <div className="text-lg font-semibold">{fmtKwh(totalKwh)} kWh</div>
                <div className="mt-2 text-slate-600">Tiền trước (gồm VAT)</div>
                <div className="text-lg font-semibold">{fmtMoney(energyTotalBefore)} đ</div>
              </div>
              <div className="rounded border p-3">
                <div className="text-slate-600">kWh sau KN</div>
                <div className="text-lg font-semibold text-emerald-700">{fmtKwh(totalKwhAfter)} kWh</div>
                <div className="mt-2 text-slate-600">Tiền sau (gồm VAT)</div>
                <div className="text-lg font-semibold text-emerald-700">{fmtMoney(energyTotalAfter)} đ</div>
              </div>
            </div>

            <div className="mt-3 rounded border p-3 bg-emerald-50">
              Tiết kiệm ước tính: <b>{fmtKwh(savedKwh)} kWh</b> ({fmtPercent(savedPct)}) ≈{" "}
              <b>{fmtMoney(savedMoney)} đ</b>/tháng
            </div>
          </div>

          <div className="rounded-xl border p-4 bg-white">
            <h3 className="font-semibold mb-2">Biểu đồ so sánh (Tổng)</h3>
            <TotalCompareBar before={totalKwh} after={totalKwhAfter} />
          </div>

          <div className="rounded-xl border p-4 bg-white lg:col-span-2">
            <h3 className="font-semibold mb-2">Biểu đồ theo thiết bị</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {perItemWithReco.map((it, i) => (
                <ItemCompareRow
                  key={`bar-${i}`}
                  name={it.name}
                  before={it.kwhMonth}
                  after={it.kwhAfter}
                />
              ))}
              {perItemWithReco.length === 0 && (
                <div className="text-sm text-slate-500">Không có dữ liệu để vẽ biểu đồ.</div>
              )}
            </div>
          </div>
        </div>

        <div className="text-xs text-slate-500 mt-3">
          *Giả định mức tiết kiệm chỉ là ước lượng tương đối theo thói quen sử dụng phổ biến.
          Kết quả thực tế phụ thuộc công suất, môi trường và hành vi sử dụng.
        </div>
      </div>
    </div>
  );
}
