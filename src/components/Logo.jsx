import React from 'react';
import logo from '/evnlogo.png'; // ảnh bạn đã copy vào public

export default function Logo() {
  return (
    <div className="flex items-center gap-2">
      <img src={logo} alt="Logo" className="h-10" />
      <div>
        <div className="font-bold text-lg">Tiết kiệm điện AI</div>
        <div className="text-sm text-gray-300">Trường THCS D'RAN</div>
      </div>
    </div>
  );
}
