// src/pages/HistoryTab.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";

/** ============================================
 *  Storage keys (v3 + v2 + legacy)
 * ============================================ */
const LS_KEY_V3 = "analysis.history.v3";
const LS_KEY_V2 = "analysis.history.v2";
const LS_KEY_V1 = "analysis.history";

/** ============================================
 *  Helpers
 * ============================================ */
const toNorm = (s = "") =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function readRawHistory() {
  try {
    const s3 = localStorage.getItem(LS_KEY_V3);
    if (s3) return JSON.parse(s3) || [];
  } catch {}
  try {
    const s2 = localStorage.getItem(LS_KEY_V2);
    if (s2) return JSON.parse(s2) || [];
  } catch {}
  try {
    const s1 = localStorage.getItem(LS_KEY_V1);
    if (s1) return JSON.parse(s1) || [];
  } catch {}
  return [];
}

function saveHistory(list) {
  try {
    const json = JSON.stringify(list.slice(0, 200));
    localStorage.setItem(LS_KEY_V3, json);
    localStorage.setItem(LS_KEY_V2, json);
    localStorage.setItem(LS_KEY_V1, json);
    return true;
  } catch (e) {
    console.warn("Lưu history thất bại:", e);
    return false;
  }
}

/** Chuẩn hoá 1 record từ nhiều định dạng cũ/ mới */
function normalizeRecord(r) {
  if (!r || typeof r !== "object") return null;
  const date = r.date || r.createdAt || new Date().toISOString();
  const fileName = r.fileName || r.name || "image";
  const thumbDataUrl = r.thumbDataUrl || r.thumb || r.thumbnail || "";
  // items (format mới trong AnalysisTab v3)
  let items = Array.isArray(r.items) ? r.items : [];

  // Nếu là format cũ (vd: r.detections), chuyển sang items tối giản
  if (!items.length && Array.isArray(r.detections)) {
    items = r.detections
      .map((d) => ({
        labelVi: d.labelVi || d.label || "Thiết bị",
        labelEn: d.labelEn || "",
        score: typeof d.score === "number" ? d.score : 0.0,
        advice: d.advice || "",
        cat: d.cat || "other",
        powerW: d.powerW || 100,
        kwhBefore: d.kwhBefore || 0,
        kwhAfter: d.kwhAfter || 0,
        note: d.note || "",
      }))
      .filter((x) => x.labelVi);
  }

  // Bảo vệ trường bắt buộc
  items = items
    .filter((x) => x && (x.labelVi || x.labelEn))
    .map((x) => ({
      labelVi: x.labelVi || (x.labelEn ? x.labelEn.charAt(0).toUpperCase() + x.labelEn.slice(1) : "Thiết bị"),
      labelEn: x.labelEn || "",
      score: typeof x.score === "number" ? x.score : 0,
      advice: x.advice || "",
      cat: x.cat || "other",
      powerW: typeof x.powerW === "number" ? x.powerW : 100,
      hoursBefore: typeof x.hoursBefore === "number" ? x.hoursBefore : undefined,
      hoursAfter: typeof x.hoursAfter === "number" ? x.hoursAfter : undefined,
      kwhBefore: typeof x.kwhBefore === "number" ? x.kwhBefore : 0,
      kwhAfter: typeof x.kwhAfter === "number" ? x.kwhAfter : 0,
      note: x.note || "",
    }));

  return { date, fileName, thumbDataUrl, items };
}

/** Đọc & chuẩn hoá toàn bộ + sort + dedup + ghi lại v3 */
function readAndNormalizeAll() {
  const arr = readRawHistory();
  const norm = arr
    .map(normalizeRecord)
    .filter(Boolean)
    .sort((a, b) => {
      const ta = Date.parse(a.date) || 0;
      const tb = Date.parse(b.date) || 0;
      return tb - ta;
    });

  // de-dup theo (date|fileName|firstLabel)
  const seen = new Set();
  const out = [];
  for (const r of norm) {
    const key = `${r.date}|${r.fileName}|${r.items?.[0]?.labelVi || ""}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(r);
    }
  }
  saveHistory(out);
  return out;
}

/** Chip màu theo nhóm (khớp AnalysisTab) */
const colorClass = (cat) =>
  ({
    cooling: "bg-sky-100 text-sky-800 border-sky-200",
    lighting: "bg-amber-100 text-amber-800 border-amber-200",
    fridge: "bg-emerald-100 text-emerald-800 border-emerald-200",
    laundry: "bg-violet-100 text-violet-800 border-violet-200",
    microwave: "bg-rose-100 text-rose-800 border-rose-200",
    oven: "bg-rose-100 text-rose-800 border-rose-200",
    cooktop: "bg-orange-100 text-orange-800 border-orange-200",
    dishwasher: "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200",
    range_hood: "bg-lime-100 text-lime-800 border-lime-200",
    network: "bg-cyan-100 text-cyan-800 border-cyan-200",
    fan: "bg-indigo-100 text-indigo-800 border-indigo-200",
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
    other: "bg-slate-100 text-slate-700 border-slate-200",
  }[cat] || "bg-slate-100 text-slate-700 border-slate-200");

const fmtDate = (iso) => {
  try {
    const d = new Date(iso);
    return d.toLocaleString("vi-VN");
  } catch {
    return iso || "";
  }
};
const fmtNum = (n, digits = 2) =>
  (n ?? 0).toLocaleString("vi-VN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

/** ============================================
 *  Component
 * ============================================ */
export default function HistoryTab() {
  const [rows, setRows] = useState(() => readAndNormalizeAll());
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState({}); // {index: true}

  // tải lần đầu + lắng nghe storage (cửa sổ khác)
  useEffect(() => {
    setRows(readAndNormalizeAll());
  }, []);
  useEffect(() => {
    const onStorage = (e) => {
      if ([LS_KEY_V3, LS_KEY_V2, LS_KEY_V1].includes(e.key)) {
        setRows(readAndNormalizeAll());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // tự reload khi quay lại tab/ focus (cùng cửa sổ)
  useEffect(() => {
    const refresh = () => setRows(readAndNormalizeAll());
    const onVis = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const filtered = useMemo(() => {
    if (!q) return rows;
    const nq = toNorm(q);
    return rows.filter((r) => {
      if (toNorm(r.fileName).includes(nq)) return true;
      return (r.items || []).some(
        (it) =>
          toNorm(it.labelVi).includes(nq) ||
          toNorm(it.labelEn || "").includes(nq) ||
          toNorm(it.advice || "").includes(nq)
      );
    });
  }, [rows, q]);

  function removeAt(idx) {
    if (!confirm("Xoá bản ghi này khỏi lịch sử?")) return;
    setRows((prev) => {
      const arr = [...prev];
      arr.splice(idx, 1);
      saveHistory(arr);
      return arr;
    });
  }
  function clearAll() {
    if (!confirm("Xoá toàn bộ lịch sử?")) return;
    saveHistory([]);
    setRows([]);
  }
  function refreshNow() {
    setRows(readAndNormalizeAll());
  }
  function toggleExpand(i) {
    setExpanded((m) => ({ ...m, [i]: !m[i] }));
  }

  return (
    <div
      className="mx-auto p-4 max-w-5xl"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        minHeight: "calc(100dvh - env(safe-area-inset-top))",
      }}
    >
      <h2 className="text-2xl font-bold mb-3">Lịch sử phân tích ảnh</h2>

      {/* Toolbar */}
      <div className="rounded-2xl bg-white/70 backdrop-blur p-4 shadow mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm theo tên file, nhãn thiết bị, gợi ý..."
            className="flex-1 min-w-[200px] border rounded-lg px-3 py-2"
          />
          <button
            onClick={refreshNow}
            className="px-3 py-2 rounded border hover:bg-slate-50"
            title="Làm mới"
          >
            Làm mới
          </button>
          <button
            onClick={clearAll}
            className="px-3 py-2 rounded border text-rose-600 hover:bg-rose-50"
            title="Xoá tất cả lịch sử"
          >
            Xoá tất cả
          </button>
        </div>
      </div>

      {/* Danh sách lịch sử */}
      {filtered.length === 0 ? (
        <div className="p-4 rounded-xl border bg-white text-slate-500">
          Chưa có bản ghi. Hãy phân tích ảnh ở tab <b>Phân tích</b> trước.
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((r, i) => {
            const top = r.items?.[0];
            const kwhBefore = (r.items || []).reduce(
              (s, it) => s + (Number(it.kwhBefore) || 0),
              0
            );
            const kwhAfter = (r.items || []).reduce(
              (s, it) => s + (Number(it.kwhAfter) || 0),
              0
            );
            return (
              <div key={`${r.date}-${i}`} className="rounded-2xl bg-white p-3 border shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="w-40 h-24 bg-slate-100 rounded overflow-hidden flex items-center justify-center">
                    {r.thumbDataUrl ? (
                      <img
                        src={r.thumbDataUrl}
                        alt={r.fileName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-slate-400 text-xs">No thumbnail</div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-semibold truncate">{r.fileName || "image"}</div>
                      <div className="text-xs text-slate-500">· {fmtDate(r.date)}</div>
                    </div>

                    {/* Chip nhãn */}
                    <div className="flex gap-2 overflow-x-auto mt-1 pr-2 -mr-2">
                      {(r.items || []).map((it, j) => (
                        <div
                          key={`chip-${j}`}
                          className={`whitespace-nowrap border px-2 py-0.5 rounded-full text-xs ${colorClass(
                            it.cat
                          )}`}
                          title={`${it.labelEn || ""}`}
                        >
                          {it.labelVi} {typeof it.score === "number" ? `· ${(it.score * 100).toFixed(1)}%` : ""}
                        </div>
                      ))}
                    </div>

                    {/* Tổng kWh */}
                    <div className="mt-2 text-sm">
                      <span className="text-slate-600">Tổng kWh/ngày:</span>{" "}
                      <b>{fmtNum(kwhBefore)} → {fmtNum(kwhAfter)} kWh</b>
                    </div>

                    {/* Hành động */}
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        onClick={() => toggleExpand(i)}
                        className="px-3 py-1.5 rounded border hover:bg-slate-50 text-sm"
                      >
                        {expanded[i] ? "Ẩn chi tiết" : "Xem chi tiết"}
                      </button>
                      <button
                        onClick={() => removeAt(rows.indexOf(r))}
                        className="px-3 py-1.5 rounded border text-rose-600 hover:bg-rose-50 text-sm"
                        title="Xoá bản ghi này"
                      >
                        Xoá
                      </button>
                    </div>
                  </div>
                </div>

                {/* Bảng chi tiết */}
                {expanded[i] && (
                  <div className="mt-3 overflow-x-auto">
                    <table className="min-w-[720px] w-full text-sm">
                      <thead>
                        <tr className="text-left text-slate-600">
                          <th className="pb-2 pr-3">Thiết bị</th>
                          <th className="pb-2 pr-3">Điểm</th>
                          <th className="pb-2 pr-3">Công suất (W)</th>
                          <th className="pb-2 pr-3">kWh/ngày trước</th>
                          <th className="pb-2 pr-3">kWh/ngày sau</th>
                          <th className="pb-2 pr-3">Gợi ý</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(r.items || []).map((it, k) => (
                          <tr key={k}>
                            <td className="py-1 pr-3">
                              <div className="flex items-center gap-2">
                                <span className={`inline-block h-4 w-1 rounded ${colorClass(it.cat).split(" ")[0]}`} />
                                <div className="font-medium">{it.labelVi}</div>
                                <div className="text-xs text-slate-500">EN: {it.labelEn}</div>
                              </div>
                            </td>
                            <td className="py-1 pr-3">{typeof it.score === "number" ? (it.score * 100).toFixed(1) + "%" : "-"}</td>
                            <td className="py-1 pr-3">{Math.round(it.powerW || 0)}</td>
                            <td className="py-1 pr-3">{fmtNum(it.kwhBefore || 0)}</td>
                            <td className="py-1 pr-3 text-emerald-700">{fmtNum(it.kwhAfter || 0)}</td>
                            <td className="py-1 pr-3">{it.advice || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
