import React from "react";

/**
 * Nền động cho toàn app — không bắt sự kiện chuột (pointer-events-none),
 * nằm dưới mọi thứ (-z-10). Gồm: gradient động + 3 blobs + sóng SVG phía dưới.
 */
export default function AnimatedBackground() {
  return (
    <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
      {/* Lớp gradient động */}
      <div className="absolute inset-0 animated-gradient opacity-90" />

      {/* Blobs mềm chuyển động */}
      <div className="blob blob-1" />
      <div className="blob blob-2" />
      <div className="blob blob-3" />

      {/* Sóng dưới cùng (SVG) */}
      <svg
        className="absolute bottom-0 left-0 right-0 w-[140%] -ml-[20%] h-[30vh] opacity-40"
        viewBox="0 0 1440 320"
        aria-hidden="true"
      >
        <path
          fill="url(#g)"
          d="M0,224L24,234.7C48,245,96,267,144,256C192,245,240,203,288,181.3C336,160,384,160,432,144C480,128,528,96,576,106.7C624,117,672,171,720,197.3C768,224,816,224,864,208C912,192,960,160,1008,170.7C1056,181,1104,235,1152,229.3C1200,224,1248,160,1296,128C1344,96,1392,96,1416,96L1440,96L1440,320L1416,320C1392,320,1344,320,1296,320C1248,320,1200,320,1152,320C1104,320,1056,320,1008,320C960,320,912,320,864,320C816,320,768,320,720,320C672,320,624,320,576,320C528,320,480,320,432,320C384,320,336,320,288,320C240,320,192,320,144,320C96,320,48,320,24,320H0Z"
        />
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#22d3ee" />
            <stop offset="1" stopColor="#a78bfa" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
