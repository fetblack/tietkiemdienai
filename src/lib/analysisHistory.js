// src/lib/analysisHistory.js
const STORAGE_KEY = 'tiet-kiem-dien-ai/analysisHistory:v1';
const EVT = 'analysis-history-changed';
const MAX_RECORDS = 200;

// ----- Core storage -----
function read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function write(list) {
  // giữ tối đa MAX_RECORDS
  const pruned = list.slice(0, MAX_RECORDS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
  window.dispatchEvent(new Event(EVT));
}

export function getAnalysisHistory() {
  return read().sort((a, b) => (b.ts || 0) - (a.ts || 0));
}
export function clearAnalysisHistory() {
  write([]);
}
export function removeAnalysisHistory(id) {
  write(read().filter(x => x.id !== id));
}

// ----- Helpers -----
export function uid() {
  return crypto?.randomUUID ? crypto.randomUUID() :
    `id_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Tạo thumbnail base64 từ File/Blob ảnh (giảm kích thước để nhẹ hơn)
 * @param {File|Blob} file
 * @param {{maxW?:number,maxH?:number,quality?:number,type?:string}} opt
 * @returns {Promise<string>} dataURL
 */
export function generateThumbnail(file, opt = {}) {
  const { maxW = 400, maxH = 400, quality = 0.85, type = 'image/jpeg' } = opt;
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('Không đọc được ảnh.'));
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
        const w = Math.round(img.width * ratio);
        const h = Math.round(img.height * ratio);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        try {
          const dataUrl = canvas.toDataURL(type, quality);
          resolve(dataUrl);
        } catch (e) {
          // fallback: trả luôn fr.result
          resolve(fr.result);
        }
      };
      img.onerror = () => reject(new Error('Không xử lý được ảnh.'));
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

/**
 * Lưu một lượt phân tích ảnh.
 * @param {Object} payload
 * @param {string} payload.thumbDataUrl  - dataURL ảnh thumbnail (hoặc null)
 * @param {string} payload.fileName      - tên file gốc (nếu có)
 * @param {Array}  payload.items         - mảng kết quả đã chuẩn hoá [{labelVi,labelEn,score,advice,canon?,watts?}]
 * @param {Object} [payload.meta]        - tuỳ chọn: {model, tokenHint, ...}
 * @param {string} [payload.note]        - ghi chú của người dùng
 */
export function addAnalysisHistory(payload) {
  const now = Date.now();
  const rec = {
    id: uid(),
    ts: now,
    fileName: payload?.fileName || '',
    thumb: payload?.thumbDataUrl || '',
    items: Array.isArray(payload?.items) ? payload.items.slice(0, 10) : [],
    meta: payload?.meta || null,
    note: (payload?.note || '').trim(),
  };
  const list = read();
  list.unshift(rec);
  write(list);
  return rec.id;
}

// ----- Export tiện dụng -----
export function exportAnalysisHistoryJSON(rows = getAnalysisHistory()) {
  return JSON.stringify(rows, null, 2);
}
export function exportAnalysisHistoryCSV(rows = getAnalysisHistory()) {
  // CSV chỉ đưa TOP1 cho gọn (vì CSV không thuận cho mảng lồng)
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const headers = ['id','time','file','top_label_vi','top_label_en','top_score','note'];
  const lines = [headers.join(',')];
  for (const r of rows) {
    const top = r.items?.[0];
    lines.push([
      esc(r.id),
      esc(new Date(r.ts).toLocaleString('vi-VN')),
      esc(r.fileName || ''),
      esc(top?.labelVi || ''),
      esc(top?.labelEn || ''),
      esc(top ? (top.score * 100).toFixed(2)+'%' : ''),
      esc(r.note || ''),
    ].join(','));
  }
  return lines.join('\n');
}

// ----- React hook -----
import { useEffect, useState } from 'react';
export function useAnalysisHistory() {
  const [rows, setRows] = useState(getAnalysisHistory());
  useEffect(() => {
    const onChange = () => setRows(getAnalysisHistory());
    window.addEventListener(EVT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(EVT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);
  return rows;
}
