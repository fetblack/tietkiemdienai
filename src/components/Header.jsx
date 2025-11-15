import React from 'react';
import Logo from './Logo';

export default function Header({ setTab, tab }) {
  const tabs = [
    { id: 'analysis', name: 'Phân tích ảnh' },
    { id: 'bill', name: 'Tính tiền điện' },
    { id: 'history', name: 'Lịch sử' },
  ];

  return (
    <div className="flex items-center justify-between p-4 bg-blue-100 shadow">
      <Logo />
      <div className="flex gap-3">
        {tabs.map(t => (
          <button key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1 rounded ${tab === t.id ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
            {t.name}
          </button>
        ))}
      </div>
    </div>
  );
}
