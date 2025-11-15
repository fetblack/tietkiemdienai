import React, { useState } from 'react';

const rates = [
  { max: 50, price: 1984 },
  { max: 100, price: 2050 },
  { max: 200, price: 2380 },
  { max: 300, price: 2998 },
  { max: 400, price: 3350 },
  { max: Infinity, price: 3460 },
];

export default function ElectricityTab() {
  const [kwh, setKwh] = useState('');
  const [total, setTotal] = useState(null);

  const calculate = () => {
    let remain = parseFloat(kwh);
    let cost = 0;
    let prev = 0;

    for (const tier of rates) {
      if (remain <= 0) break;
      const used = Math.min(remain, tier.max - prev);
      cost += used * tier.price;
      remain -= used;
      prev = tier.max;
    }

    setTotal(cost);
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-2">Tính tiền điện sinh hoạt</h2>
      <input
        type="number"
        value={kwh}
        onChange={e => setKwh(e.target.value)}
        className="border p-2 mb-4 w-full"
        placeholder="Nhập số điện (kWh)"
      />
      <button onClick={calculate} className="bg-green-600 text-white px-4 py-2 rounded">
        Tính tiền
      </button>

      {total !== null && (
        <div className="mt-4 text-lg font-semibold text-blue-700">
          Tổng tiền: {total.toLocaleString()} đ
        </div>
      )}

      <h3 className="font-semibold mt-6 mb-2">Bảng giá điện mới nhất:</h3>
      <table className="table-auto border border-gray-400 w-full">
        <thead className="bg-gray-200">
          <tr>
            <th className="border p-2">Bậc</th>
            <th className="border p-2">Mức sử dụng (kWh)</th>
            <th className="border p-2">Giá bán (đồng/kWh)</th>
          </tr>
        </thead>
        <tbody>
          {rates.map((r, i) => (
            <tr key={i}>
              <td className="border p-2">{i + 1}</td>
              <td className="border p-2">
                {i < rates.length - 1
                  ? `${rates[i - 1]?.max + 1 || 0}–${r.max}`
                  : `${rates[i - 1]?.max + 1 || 0} trở lên`}
              </td>
              <td className="border p-2">{r.price.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
