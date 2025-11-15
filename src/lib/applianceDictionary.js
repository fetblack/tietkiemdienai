// src/lib/applianceDictionary.js

// alias (tiếng Anh) → mã chuẩn (canon)
export const ALIAS_TO_CANON = {
  // Giải trí & ICT
  'home theater': 'home_theater',
  'home theatre': 'home_theater',
  'entertainment center': 'home_theater',
  tv: 'tv', television: 'tv',
  monitor: 'monitor', screen: 'monitor',
  'desktop computer': 'desktop_pc', desktop: 'desktop_pc',
  laptop: 'laptop', notebook: 'laptop',
  router: 'router', modem: 'router', 'wireless router': 'router',
  projector: 'projector',

  // Nhà bếp
  refrigerator: 'fridge', fridge: 'fridge', freezer: 'fridge',
  microwave: 'microwave', oven: 'oven',
  'rice cooker': 'rice_cooker',
  'induction cooker': 'induction',
  kettle: 'kettle', 'electric kettle': 'kettle',
  dishwasher: 'dishwasher',

  // Giặt sấy
  'washing machine': 'washing_machine', washer: 'washing_machine',
  dryer: 'dryer', 'hair dryer': 'hair_dryer',

  // Điều hoà – sưởi – quạt – đèn
  'air conditioner': 'ac', ac: 'ac', aircon: 'ac',
  fan: 'fan', 'ceiling fan': 'fan',
  lamp: 'lamp', 'table lamp': 'lamp', light: 'lamp',
  'water heater': 'water_heater',
  heater: 'space_heater', 'space heater': 'space_heater',

  // Không khí & vệ sinh
  'air purifier': 'air_purifier',
  dehumidifier: 'dehumidifier',
  humidifier: 'humidifier',
  'vacuum cleaner': 'vacuum',

  // Các nhãn KHÔNG phải thiết bị điện → loại bỏ
  'window shade': '_ignore', shade: '_ignore',
  shoji: '_ignore', couch: '_ignore', sofa: '_ignore',
  'studio couch': '_ignore', 'day bed': '_ignore',
};

// mã chuẩn (canon) → tên tiếng Việt
export const CANON_TO_VI = {
  home_theater: 'Hệ thống giải trí',
  tv: 'Tivi',
  monitor: 'Màn hình',
  desktop_pc: 'Máy tính để bàn',
  laptop: 'Laptop',
  router: 'Router Wi-Fi',
  projector: 'Máy chiếu',
  fridge: 'Tủ lạnh',
  microwave: 'Lò vi sóng',
  oven: 'Lò nướng',
  rice_cooker: 'Nồi cơm điện',
  induction: 'Bếp từ',
  kettle: 'Ấm siêu tốc',
  dishwasher: 'Máy rửa chén',
  washing_machine: 'Máy giặt',
  dryer: 'Máy sấy',
  hair_dryer: 'Máy sấy tóc',
  ac: 'Máy lạnh',
  fan: 'Quạt',
  lamp: 'Đèn',
  water_heater: 'Máy nước nóng',
  space_heater: 'Máy sưởi',
  air_purifier: 'Máy lọc không khí',
  dehumidifier: 'Máy hút ẩm',
  humidifier: 'Máy phun sương',
  vacuum: 'Máy hút bụi',
};

export const CANON_META = {
  tv: { category: 'entertainment', watts: '60–150W' },
  home_theater: { category: 'entertainment', watts: '80–300W' },
  desktop_pc: { category: 'ict', watts: '100–300W' },
  laptop: { category: 'ict', watts: '30–65W' },
  monitor: { category: 'ict', watts: '15–40W' },
  router: { category: 'network', watts: '6–12W' },
  projector: { category: 'entertainment', watts: '120–300W' },
  fridge: { category: 'kitchen', watts: '80–150W' },
  microwave: { category: 'kitchen', watts: '800–1200W' },
  oven: { category: 'kitchen', watts: '1000–2000W' },
  rice_cooker: { category: 'kitchen', watts: '300–700W' },
  induction: { category: 'kitchen', watts: '1200–2200W' },
  kettle: { category: 'kitchen', watts: '1500–2200W' },
  dishwasher: { category: 'kitchen', watts: '1200–1800W' },
  washing_machine: { category: 'laundry', watts: '300–800W' },
  dryer: { category: 'laundry', watts: '1800–3000W' },
  hair_dryer: { category: 'personal', watts: '800–1500W' },
  ac: { category: 'cooling', watts: '500–1500W' },
  fan: { category: 'cooling', watts: '30–60W' },
  lamp: { category: 'lighting', watts: '5–12W (LED)' },
  water_heater: { category: 'heating', watts: '1500–2500W' },
  space_heater: { category: 'heating', watts: '1000–2000W' },
  air_purifier: { category: 'air', watts: '20–60W' },
  dehumidifier: { category: 'air', watts: '200–500W' },
  humidifier: { category: 'air', watts: '20–40W' },
  vacuum: { category: 'cleaning', watts: '600–1200W' },
};

// Lời khuyên theo nhóm + ghi đè theo từng thiết bị
const CATEGORY_ADVICE = {
  entertainment: [
    'Tắt hẳn thiết bị thay vì để chế độ chờ (standby).',
    'Giảm độ sáng màn hình/phụ trợ khi không cần.',
    'Dùng ổ cắm có công tắc để ngắt điện cả hệ thống.',
  ],
  ict: [
    'Bật chế độ tiết kiệm điện, tự sleep sau 5–10 phút.',
    'Tắt màn hình khi rời máy.',
  ],
  network: ['Hẹn giờ tắt modem/router ban đêm nếu không dùng.'],
  kitchen: ['Nấu/đun vừa đủ nhu cầu, không bật thiết bị quá lâu.'],
  laundry: ['Giặt đủ tải, ưu tiên nước lạnh; sấy khi thật cần.'],
  cooling: ['Cài 26–28°C, vệ sinh lưới lọc định kỳ, dùng quạt hỗ trợ.'],
  heating: ['Không bật 24/7; đặt nhiệt vừa đủ, che kín phòng khi dùng.'],
  lighting: ['Đổi sang LED, tận dụng ánh sáng tự nhiên, tắt khi rời phòng.'],
  air: ['Dùng chế độ tự động; vệ sinh/đổi lọc đúng hạn.'],
  cleaning: ['Vệ sinh bộ lọc định kỳ, chọn công suất phù hợp.'],
  personal: ['Dùng trong thời gian ngắn, tránh bật công suất tối đa quá lâu.'],
};

const CANON_ADVICE = {
  tv: ['Tắt tính năng Always-On/Quick Start nếu không cần.', 'Giảm backlight, dùng chế độ Eco.'],
  home_theater: ['Ngắt điện ampli/loa khi không dùng.', 'Gom thiết bị vào ổ cắm có công tắc.'],
  router: ['Đổi sang Wi-Fi 6 tiết kiệm hơn nếu có.', 'Tắt SSID khách khi không dùng.'],
  fridge: ['Để cách tường ≥10cm, nhiệt 3–5°C và ngăn đá −18°C, không mở tủ quá lâu.'],
  washing_machine: ['Giặt giờ thấp điểm, chọn chế độ tiết kiệm, vệ sinh lồng giặt định kỳ.'],
  dryer: ['Vắt thật khô trước khi sấy, vệ sinh lưới lọc sau mỗi lần sấy.'],
  ac: ['Đặt 26–28°C, đóng kín cửa, dùng quạt để tăng hiệu quả làm mát.'],
  water_heater: ['Bật theo nhu cầu thay vì giữ nóng 24/7.'],
  kettle: ['Đun vừa đủ nước; không đun đi đun lại nhiều lần.'],
  induction: ['Dùng nồi đáy phẳng, đúng kích thước bếp; tắt ngay khi nấu xong.'],
  lamp: ['Dùng bóng LED chất lượng, lắp cảm biến hiện diện nếu có.'],
};

export function resolveCanon(labelEn) {
  if (!labelEn) return null;
  const l = String(labelEn).toLowerCase();
  // tách theo dấu phẩy/ngoặc để tăng khả năng khớp
  const parts = l.split(/[,\(\)\/]/).map(s => s.trim()).filter(Boolean);
  for (const p of parts) if (ALIAS_TO_CANON[p]) return ALIAS_TO_CANON[p];
  // khớp "contains"
  for (const [alias, canon] of Object.entries(ALIAS_TO_CANON)) {
    if (l.includes(alias)) return canon;
  }
  return null;
}

export const isElectricalCanon = (canon) => canon && !canon.startsWith('_');

export function buildAdvice(canon) {
  const tips = [];
  if (CANON_ADVICE[canon]) tips.push(...CANON_ADVICE[canon]);
  const cat = CANON_META[canon]?.category;
  if (cat && CATEGORY_ADVICE[cat]) tips.push(...CATEGORY_ADVICE[cat]);
  // bỏ trùng, lấy tối đa 3–4 tip
  return Array.from(new Set(tips)).slice(0, 3);
}

export function viNameFromCanon(canon, fallbackEn) {
  return CANON_TO_VI[canon] || (fallbackEn ? fallbackEn[0].toUpperCase() + fallbackEn.slice(1) : 'Thiết bị');
}
