// src/lib/billHistory.js
// Lưu lịch sử tính tiền điện (localStorage) + tiện ích hook để hiển thị

const STORAGE_KEY = 'tiet-kiem-dien-ai/billHistory:v1';
const EVT = 'bill-history-changed';

function read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    // đảm bảo đúng dạng
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function write(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event(EVT));
}

export function getBillHistory() {
  return read().sort((a, b) => (b.ts || 0) - (a.ts || 0));
}
export function clearBillHistory() {
  write([]);
}
export function removeBillHistory(id) {
  const list = read().filter(x => x.id !== id);
  write(list);
}
export function addBillHistory(entry) {
  const id = crypto?.randomUUID ? crypto.randomUUID() : `id_${Date.now()}_${Math.random()}`;
  const now = Date.now();
  const item = {
    id,
    ts: entry?.ts ?? now,          // timestamp ms
    kwh: entry?.kwh ?? 0,          // tổng kWh
    cost: entry?.cost ?? 0,        // tổng tiền (VND)
    tariffName: entry?.tariffName || 'Không rõ',
    period: entry?.period || null, // {start, end} ISO hoặc chuỗi
    breakdown: entry?.breakdown || [], // [{tier, kwh, rate, cost}]
    note: (entry?.note || '').trim(),
  };
  const list = [item, ...read()];
  write(list);
  return item.id;
}

// Xuất CSV/JSON tiện dùng
export function exportBillHistoryCSV(rows = getBillHistory()) {
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const headers = ['id','time','kwh','cost','tariff','period_start','period_end','note'];
  const lines = [headers.join(',')];
  for (const r of rows) {
    const pStart = r?.period?.start ?? '';
    const pEnd = r?.period?.end ?? '';
    lines.push([
      esc(r.id),
      esc(new Date(r.ts).toLocaleString('vi-VN')),
      esc(r.kwh),
      esc(r.cost),
      esc(r.tariffName),
      esc(pStart),
      esc(pEnd),
      esc(r.note || ''),
    ].join(','));
  }
  return lines.join('\n');
}

// React hook: tự cập nhật khi có thay đổi
import { useEffect, useState } from 'react';
export function useBillHistory() {
  const [rows, setRows] = useState(getBillHistory());
  useEffect(() => {
    const onChange = () => setRows(getBillHistory());
    window.addEventListener(EVT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(EVT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);
  return rows;
}
