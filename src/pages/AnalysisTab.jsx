// src/pages/AnalysisTab.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";

// Lấy model từ lib (không hiển thị ra UI)
import * as HF from "../lib/huggingFaceApi";

/* ====================== CẤU HÌNH CƠ BẢN ====================== */
const CONFIDENCE_MIN = 0.10;   // có thể hạ 0.07 nếu muốn “bắt” nhiều hơn
const TOP_K = 7;               // số nhãn tối đa xem xét

// Backend base (dev dùng Vite proxy nên để trống là được)
const API_BASE = import.meta.env.VITE_BACKEND_URL || "";

const DEFAULT_MODEL_ID =
  HF.HF_MODEL_ID ||
  HF.model ||
  (HF.default && (HF.default.HF_MODEL_ID || HF.default.model)) ||
  "microsoft/resnet-50"; // không hiển thị ra UI

const LS_KEY_HISTORY = "analysis.history.v3";

/* ====================== TIỆN ÍCH CHUỖI/DỊCH ====================== */
const toNorm = (s = "") =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Việt hoá mở rộng: nhiều biến thể nhãn từ ImageNet/HF */
const VI_LABELS = {
  // TV / màn hình
  tv: "Tivi",
  television: "Tivi",
  "smart tv": "Tivi",
  monitor: "Màn hình",

  // Điều hoà
  "air conditioner": "Máy lạnh",
  ac: "Máy lạnh",
  "air con": "Máy lạnh",

  // Tủ lạnh
  fridge: "Tủ lạnh",
  refrigerator: "Tủ lạnh",
  freezer: "Tủ đông",

  // Đèn
  lamp: "Đèn",
  light: "Đèn",
  bulb: "Bóng đèn",
  led: "Đèn LED",

  // Quạt
  fan: "Quạt",
  "ceiling fan": "Quạt trần",
  "standing fan": "Quạt đứng",

  // Máy giặt & sấy
  "washing machine": "Máy giặt",
  washer: "Máy giặt",
  "automatic washer": "Máy giặt",
  "laundry machine": "Máy giặt",
  "front-loading washer": "Máy giặt",
  "front-load washer": "Máy giặt",
  "top-loading washer": "Máy giặt",
  "top-load washer": "Máy giặt",
  "washer-dryer": "Máy giặt sấy",
  dryer: "Máy sấy",

  // Lò
  microwave: "Lò vi sóng",
  "microwave oven": "Lò vi sóng",
  oven: "Lò nướng",
  "convection oven": "Lò nướng",
  "toaster oven": "Lò nướng",
  range: "Lò nướng",
  cooker: "Lò nướng",
  stove: "Lò nướng", // (bếp ga sẽ bị lọc trong NON_ELECTRIC_HINTS)

  // Bếp điện/bếp từ
  "induction cooktop": "Bếp từ",
  "induction stove": "Bếp từ",
  "electric cooktop": "Bếp điện hồng ngoại",
  "electric stove": "Bếp điện hồng ngoại",
  "ceramic cooktop": "Bếp điện hồng ngoại",

  // Máy rửa chén
  dishwasher: "Máy rửa chén",

  // Máy hút mùi
  "range hood": "Máy hút mùi",
  hood: "Máy hút mùi",

  // Đồ bếp khác
  "air fryer": "Nồi chiên không dầu",
  kettle: "Ấm siêu tốc",
  "electric kettle": "Ấm siêu tốc",
  "rice cooker": "Nồi cơm điện",
  "pressure cooker": "Nồi áp suất",

  // Mạng/thiết bị số
  router: "Router Wi-Fi",
  "wi-fi": "Router Wi-Fi",
  wifi: "Router Wi-Fi",
  modem: "Router Wi-Fi",

  laptop: "Laptop",
  computer: "Máy tính",
  desktop: "Máy tính để bàn",
  "game console": "Máy chơi game",

  // Làm nóng/nước
  "water heater": "Bình nước nóng",
  heater: "Máy sưởi",
  "instant water heater": "Bình nước nóng trực tiếp",

  // Thiết bị khác
  "water dispenser": "Cây nước nóng lạnh",
  "water purifier": "Máy lọc nước",
  "vacuum cleaner": "Máy hút bụi",
  "air purifier": "Máy lọc không khí",
  dehumidifier: "Máy hút ẩm",
  "water pump": "Máy bơm nước",
  "hair dryer": "Máy sấy tóc",
  iron: "Bàn ủi",
};

function normalizeLabelToVi(label) {
  if (!label) return "Thiết bị";
  const lower = String(label).toLowerCase();
  if (VI_LABELS[lower]) return VI_LABELS[lower];
  for (const k of Object.keys(VI_LABELS)) {
    if (lower.includes(k)) return VI_LABELS[k];
  }
  const s = toNorm(label);
  const groups = [
    { vi: "Tivi", en: ["television", "tv", "smart tv"] },
    { vi: "Máy lạnh", en: ["air conditioner", "ac", "air con"] },
    { vi: "Đèn", en: ["lamp", "light", "bulb", "led"] },
    { vi: "Quạt", en: ["fan", "ceiling fan"] },
    { vi: "Tủ lạnh", en: ["fridge", "refrigerator", "freezer"] },
    { vi: "Máy giặt", en: ["washing machine", "laundry machine", "washer"] },
  ];
  for (const g of groups) if (g.en.some((k) => s.includes(toNorm(k)))) return g.vi;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/* ====================== NON-ELECTRIC / NHIỄU ====================== */
const NON_ELECTRIC_HINTS = [
  // nội thất/đồ gia dụng không điện
  "sofa","couch","chair","table","desk","bed","wardrobe","cabinet","shelf",
  "carpet","curtain","window","door","wall","plant","flower","vase","book",
  "clothes","shoes","picture frame","painting",
  // đồ bếp không điện
  "pan","pot","bowl","plate","dish","spoon","fork","knife","chopsticks",
  "sink","faucet","counter","cup","mug","bottle","glass","cutting board",
  // nhà tắm/khác
  "washbasin","bathtub","shower","mirror",
  // bếp gas
  "gas stove","gas cooker","propane","butane","gas cylinder",
  // sinh vật
  "person","human","cat","dog","pet",
];
const seemsNonElectric = (vi, en = "") => {
  const a = toNorm(vi),
    b = toNorm(en);
  return NON_ELECTRIC_HINTS.some(
    (k) => a.includes(toNorm(k)) || b.includes(toNorm(k))
  );
};

/* ====================== GỢI Ý TIẾT KIỆM ====================== */
function adviceFor(labelVi) {
  const s = toNorm(labelVi);
  const RULES = [
    { keys: ["may lanh", "dieu hoa", "air conditioner", "ac"], tip: "Thay vì để máy lạnh hoạt động liên tục ở mức nhiệt quá thấp dưới 24°C, người dùng nên điều chỉnh nhiệt độ ở mức 26–28°C và kết hợp sử dụng quạt gió trong phòng. Khi đó, máy lạnh sẽ giảm tải công suất nén, tiêu thụ ít điện năng hơn mà vẫn giữ được cảm giác mát dễ chịu nhờ sự luân chuyển không khí từ quạt." },
    { keys: ["den", "lamp", "bulb", "led"], tip: "Nên chọn đèn LED có công suất phù hợp diện tích và mục đích sử dụng của từng phòng (ví dụ: phòng ngủ 5–7W, phòng khách 10–15W, bếp 12–18W). Bố trí đèn hợp lý để ánh sáng phân bố đều, tránh lãng phí do lắp quá nhiều đèn. Đồng thời, tắt đèn khi không sử dụng và tận dụng ánh sáng tự nhiên ban ngày, giúp giảm công suất tiêu thụ điện, tiết kiệm 30–40% điện năng mà vẫn đảm bảo độ sáng thoải mái cho sinh hoạt." },
    { keys: ["tu lanh", "fridge", "refrigerator", "freezer"], tip: "Điều chỉnh nhiệt độ tủ lạnh phù hợp: ngăn mát khoảng 3–5°C, ngăn đá -18°C, không để quá nhiều thực phẩm và hạn chế mở cửa tủ lâu hoặc liên tục. Cách này giúp máy nén hoạt động ổn định, giảm công suất tiêu thụ điện đến 20–30%, đồng thời kéo dài tuổi thọ tủ lạnh và giữ thực phẩm tươi lâu hơn." },
    { keys: ["binh nuoc nong", "water heater"], tip: "Chỉ bật bình nước nóng trước khi sử dụng khoảng 15–30 phút và tắt ngay sau khi nước đã đủ nóng, không để bình hoạt động suốt ngày. Nên chọn mức nhiệt 50–60°C là phù hợp, vừa đảm bảo an toàn, vừa giảm công suất tiêu thụ điện tới 25–40%, giúp tiết kiệm điện và tăng tuổi thọ thanh đốt của bình." },
    { keys: ["instant water heater"], tip: "Tắm nhanh; giảm nhiệt vừa đủ; tắt sau khi dùng." },
    { keys: ["router", "wifi", "wi-fi", "modem"], tip: "Tắt router Wi-Fi/modem khi không sử dụng vào ban đêm hoặc khi ra khỏi nhà, và đặt thiết bị ở nơi thoáng mát, thoát nhiệt tốt để tránh hao điện do quá nhiệt. Cách này giúp giảm công suất tiêu thụ 15–25%, kéo dài tuổi thọ linh kiện, đồng thời giảm phát xạ sóng không cần thiết, góp phần tiết kiệm điện năng và bảo vệ môi trường." },
    { keys: ["tivi", "tv", "television"], tip: "Giảm độ sáng và âm lượng tivi xuống mức vừa đủ, tắt hẳn tivi khi không xem thay vì để ở chế độ chờ (standby). Cách này giúp giảm công suất tiêu thụ điện 20–30%, bảo vệ mắt, kéo dài tuổi thọ màn hình, và góp phần tiết kiệm điện năng cho gia đình." },
    { keys: ["quat", "fan"], tip: "Quạt sau một thời gian sử dụng thường bám bụi ở cánh quạt, lồng quạt và mô-tơ, khiến khả năng tản gió giảm, mô-tơ phải hoạt động mạnh hơn để quay, từ đó tăng công suất tiêu thụ điện. Bằng cách vệ sinh quạt thường xuyên 2–4 tuần/lần và bôi trơn trục quay, ổ bi bằng dầu chuyên dụng, quạt sẽ quay nhẹ hơn, chạy êm hơn và tiết kiệm điện rõ rệt." },
    { keys: ["may giat", "washer", "washing machine"], tip: "Giặt với lượng quần áo vừa đủ theo khuyến nghị của máy, chọn chế độ giặt tiết kiệm (Eco) và giặt bằng nước lạnh khi có thể. Cách này giúp máy giặt hoạt động nhẹ hơn, giảm công suất tiêu thụ điện 25–40%, đồng thời bảo vệ sợi vải, tăng độ bền cho thiết bị và tiết kiệm nước." },
    { keys: ["may say", "dryer"], tip: "Chỉ sử dụng máy sấy tóc khi thật cần thiết, lau khô tóc bằng khăn trước khi sấy và chọn mức nhiệt thấp hoặc chế độ gió mát để rút ngắn thời gian hoạt động. Cách này giúp giảm công suất tiêu thụ điện 30–50%, bảo vệ tóc khỏi hư tổn do nhiệt cao, đồng thời tiết kiệm năng lượng và tăng tuổi thọ máy sấy." },
    { keys: ["microwave", "lo vi song"], tip: "Tắt hẳn nguồn điện của lò vi sóng sau khi sử dụng thay vì để ở chế độ chờ (standby), vì chế độ này vẫn tiêu tốn điện năng liên tục. Cách làm đơn giản này giúp giảm trực tiếp 5–10% điện tiêu thụ mỗi tháng, bảo vệ linh kiện điện tử và tránh hao phí năng lượng không cần thiết." },
    { keys: ["oven", "lo nuong"], tip: "Vệ sinh lò nướng thường xuyên, đặc biệt là thanh nhiệt và khoang lò, để loại bỏ lớp dầu mỡ và cặn bẩn bám lâu ngày. Nhờ vậy, nhiệt truyền tốt hơn, lò đạt nhiệt độ nhanh hơn, giúp giảm công suất tiêu thụ điện 20–30%, đồng thời đảm bảo an toàn thực phẩm và tăng tuổi thọ cho lò." },
    { keys: ["bep tu", "induction"], tip: "Điều chỉnh mức nhiệt phù hợp từng giai đoạn nấu – dùng mức cao để làm sôi nhanh, sau đó chuyển sang mức thấp để duy trì nhiệt. Cách này giúp bếp từ hoạt động ổn định, giảm công suất tiêu thụ điện 25–40%, tránh quá tải nhiệt, đồng thời giữ nguyên hương vị và dinh dưỡng của món ăn." },
    { keys: ["bep dien", "ceramic"], tip: "Sử dụng nồi có đáy phẳng, tiếp xúc toàn bộ với mặt bếp điện và có kích thước vừa với vòng nhiệt, giúp truyền nhiệt hiệu quả, không thất thoát điện năng. Cách này giúp giảm công suất tiêu thụ điện 25–35%, nấu nhanh hơn, đồng thời bảo vệ mặt bếp và tiết kiệm chi phí sử dụng điện." },
    { keys: ["dishwasher", "may rua chen"], tip: "Chỉ vận hành máy rửa chén khi đã đầy tải, và sắp xếp chén đĩa gọn gàng để nước và xà phòng tiếp xúc đều. Cách này giúp giảm công suất tiêu thụ điện 25–35%, tiết kiệm nước và xà phòng, đồng thời tăng hiệu quả rửa sạch và kéo dài tuổi thọ máy." },
    { keys: ["range hood", "may hut mui", "hood"], tip: "Chỉ bật máy hút mùi khi đang nấu ăn, chọn mức quạt phù hợp với lượng khói và mùi. Sau khi nấu xong 1–2 phút thì tắt, không để chạy liên tục. Cách này giúp giảm công suất tiêu thụ điện 20–30%, bảo vệ động cơ, giảm ồn và tiết kiệm năng lượng." },
    { keys: ["vacuum", "may hut bui"], tip: "Vệ sinh túi hoặc hộp chứa bụi, màng lọc HEPA định kỳ và chỉ bật máy khi thực sự cần hút, đồng thời chọn mức công suất phù hợp với loại sàn. Cách này giúp giảm công suất tiêu thụ điện 20–30%, tăng hiệu quả hút bụi, đồng thời bảo vệ động cơ, kéo dài tuổi thọ máy và tiết kiệm năng lượng." },
    { keys: ["air purifier", "may loc khong khi"], tip: "Chỉ bật máy lọc không khí khi thực sự cần thiết và chọn mức quạt phù hợp với diện tích phòng, đồng thời vệ sinh hoặc thay màng lọc định kỳ để máy hoạt động hiệu quả. Cách này giúp giảm công suất tiêu thụ điện 20–30%, tăng hiệu quả lọc bụi và vi khuẩn, đồng thời kéo dài tuổi thọ động cơ và màng lọc, tiết kiệm năng lượng cho gia đình." },
    { keys: ["dehumidifier", "may hut am"], tip: "Chỉ bật máy hút ẩm khi độ ẩm trong phòng cao (trên 60%) và chọn mức công suất phù hợp với diện tích phòng, đồng thời vệ sinh bình chứa nước và màng lọc định kỳ. Cách này giúp giảm công suất tiêu thụ điện 20–30%, tiết kiệm năng lượng, đồng thời bảo vệ tuổi thọ máy và duy trì hiệu quả hút ẩm tối ưu." },
    { keys: ["water pump", "may bom nuoc"], tip: "Chỉ bật máy bơm nước khi thực sự cần thiết, lắp đặt bình tích áp hoặc công tắc áp suất để máy tự ngắt khi đủ nước, đồng thời vệ sinh bộ lọc và đường ống định kỳ. Cách này giúp giảm công suất tiêu thụ điện 20–30%, tránh chạy không tải, đồng thời kéo dài tuổi thọ máy và tiết kiệm năng lượng hiệu quả." },
    { keys: ["water dispenser", "cay nuoc nong lanh"], tip: "Chỉ bật chế độ nước nóng khi cần sử dụng, tắt khi không dùng, và đặt mức nhiệt vừa đủ (50–60°C); đồng thời vệ sinh bình chứa và bộ đun thường xuyên để không bị cặn bẩn làm giảm hiệu suất. Cách này giúp giảm công suất tiêu thụ điện 20–30%, tiết kiệm năng lượng, đồng thời kéo dài tuổi thọ thiết bị và đảm bảo nước luôn sạch, an toàn." },
    { keys: ["hair dryer", "may say toc"], tip: "Sử dụng máy sấy tóc ở chế độ gió mát thay vì nhiệt cao khi tóc chỉ còn hơi ẩm, và chia tóc thành từng phần nhỏ để sấy nhanh, đều. Cách này giúp giảm điện năng tiêu thụ trực tiếp 30–40%, tránh làm hư tóc, đồng thời máy hoạt động nhẹ nhàng hơn, tăng tuổi thọ thiết bị." },
    { keys: ["iron", "ban ui"], tip: "Chỉ bật bàn ủi khi cần sử dụng và điều chỉnh nhiệt độ phù hợp với loại vải, đồng thời ủi nhiều quần áo cùng lúc để tận dụng nhiệt. Cách này giúp giảm công suất tiêu thụ điện 25–35%, tiết kiệm năng lượng, đồng thời bảo vệ vải, tăng tuổi thọ bàn ủi và giảm hao phí điện không cần thiết." },
    { keys: ["rice cooker", "noi com"], tip: "Chỉ bật nồi cơm khi vo gạo xong và chọn chế độ nấu phù hợp với lượng gạo, đồng thời tắt hoặc ngắt điện sau khi cơm chín, tận dụng nhiệt còn lại để giữ ấm ngắn hạn. Cách này giúp giảm công suất tiêu thụ điện 20–30%, tiết kiệm năng lượng, đồng thời giữ cơm ngon, bảo vệ linh kiện và kéo dài tuổi thọ nồi cơm." },
    { keys: ["laptop", "may tinh", "computer", "desktop"], tip: "Sử dụng chế độ tiết kiệm pin (Power Saving Mode), giảm độ sáng màn hình và tắt các chương trình không cần thiết, đồng thời rút phích cắm khi pin đầy hoặc khi không dùng lâu. Cách này giúp giảm công suất tiêu thụ điện 20–40%, kéo dài tuổi thọ pin và linh kiện, đồng thời tiết kiệm năng lượng hiệu quả cho người dùng." },
  ];

  for (const r of RULES) {
    if (r.keys.some((k) => s.includes(toNorm(k)))) return r.tip;
  }
  return "Tắt khi không cần thiết; ưu tiên thiết bị dán nhãn tiết kiệm năng lượng.";
}

/* ====================== PHÂN NHÓM → MÀU CHIP ====================== */
function categoryOf(labelVi = "") {
  const s = toNorm(labelVi);
  if (s.includes("may lanh") || s.includes("dieu hoa") || s.includes("air con")) return "cooling";
  if (s.includes("den") || s.includes("lamp") || s.includes("bulb") || s.includes("led")) return "lighting";
  if (s.includes("tu lanh") || s.includes("fridge") || s.includes("refrigerator") || s.includes("freezer")) return "fridge";
  if (s.includes("giat") || s.includes("washer")) return "laundry";
  if (s.includes("say") && !s.includes("may say toc")) return "laundry";
  if (s.includes("microwave") || s.includes("lo vi song")) return "microwave";
  if (s.includes("oven") || s.includes("lo nuong")) return "oven";
  if (s.includes("bep tu") || s.includes("induction")) return "cooktop";
  if (s.includes("bep dien") || s.includes("ceramic")) return "cooktop";
  if (s.includes("dishwasher") || s.includes("may rua chen")) return "dishwasher";
  if (s.includes("range hood") || s.includes("hut mui") || s.includes("hood")) return "range_hood";
  if (s.includes("router") || s.includes("wifi") || s.includes("wi-fi") || s.includes("modem")) return "network";
  if (s.includes("quat") || s.includes("fan")) return "fan";
  if (s.includes("binh nuoc nong truc tiep")) return "water_heater_instant";
  if (s.includes("binh nuoc nong") || s.includes("water heater")) return "water_heater";
  if (s.includes("air purifier") || s.includes("loc khong khi")) return "air_purifier";
  if (s.includes("dehumidifier") || s.includes("hut am")) return "dehumidifier";
  if (s.includes("water pump") || s.includes("bom nuoc")) return "water_pump";
  if (s.includes("water dispenser") || s.includes("cay nuoc")) return "water_dispenser";
  if (s.includes("hair dryer") || s.includes("may say toc")) return "hair_dryer";
  if (s.includes("iron") || s.includes("ban ui")) return "iron";
  if (s.includes("rice cooker") || s.includes("noi com")) return "rice_cooker";
  if (s.includes("air fryer") || s.includes("noi chien khong dau")) return "air_fryer";
  if (s.includes("kettle") || s.includes("am sieu toc")) return "kettle";
  if (s.includes("laptop") || s.includes("may tinh xach tay")) return "laptop";
  if (s.includes("may tinh de ban") || s.includes("desktop") || s.includes("computer")) return "pc";
  if (s.includes("man hinh") || s.includes("monitor")) return "monitor";
  if (s.includes("game console")) return "game_console";
  return "other";
}
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

/* ============ Canonical hoá + gộp nhóm + gỡ nhập nhằng ============ */
const CANON_MAP = [
  { key: "washer", hints: ["washing machine","automatic washer","laundry machine","front-loading washer","front-load washer","top-loading washer","top-load washer","washer","washer-dryer"] },
  { key: "dryer", hints: ["dryer"] },
  { key: "oven", hints: ["oven","convection oven","toaster oven","range","cooker","stove"] },
  { key: "microwave", hints: ["microwave","microwave oven"] },
  { key: "fridge", hints: ["fridge","refrigerator","freezer"] },
  { key: "ac", hints: ["air conditioner","ac","air con"] },
  { key: "lamp", hints: ["lamp","light","bulb","led"] },
  { key: "fan", hints: ["fan","ceiling fan","standing fan"] },
  { key: "router", hints: ["router","wi-fi","wifi","modem"] },
  { key: "ricecooker", hints: ["rice cooker"] },
  { key: "waterheater", hints: ["water heater","heater","instant water heater"] },
  { key: "tv", hints: ["television","tv","smart tv"] },
  { key: "computer", hints: ["laptop","computer","desktop"] },
  { key: "monitor", hints: ["monitor"] },
  { key: "airfryer", hints: ["air fryer"] },
  { key: "kettle", hints: ["kettle","electric kettle"] },
  { key: "cooktop_induction", hints: ["induction cooktop","induction stove"] },
  { key: "cooktop_electric", hints: ["electric cooktop","electric stove","ceramic cooktop"] },
  { key: "dishwasher", hints: ["dishwasher"] },
  { key: "rangehood", hints: ["range hood","hood"] },
  { key: "vacuum", hints: ["vacuum cleaner"] },
  { key: "airpurifier", hints: ["air purifier"] },
  { key: "dehumidifier", hints: ["dehumidifier"] },
  { key: "waterpump", hints: ["water pump"] },
  { key: "waterdispenser", hints: ["water dispenser"] },
  { key: "hairdryer", hints: ["hair dryer"] },
  { key: "iron", hints: ["iron"] },
  { key: "pressurecooker", hints: ["pressure cooker"] },
  { key: "gameconsole", hints: ["game console"] },
];

function canonicalKey(label) {
  const s = toNorm(label);
  for (const grp of CANON_MAP) {
    if (grp.hints.some((h) => s.includes(toNorm(h)))) return grp.key;
  }
  return null;
}

function groupByCanonical(preds) {
  const map = new Map();
  for (const p of preds) {
    const key = canonicalKey(p.label) || toNorm(p.label);
    const cur = map.get(key) || { key, labelEn: p.label, score: 0, raw: [] };
    cur.score += p.score;
    if (!cur.best || p.score > cur.best.score) {
      cur.best = { labelEn: p.label, score: p.score };
    }
    cur.raw.push(p);
    map.set(key, cur);
  }
  return Array.from(map.values()).map((g) => ({ ...g, labelEn: g.best.labelEn }));
}

function disambiguate(groups) {
  // Lò nướng vs lò vi sóng
  const oven = groups.find((g) => g.key === "oven");
  const micro = groups.find((g) => g.key === "microwave");
  if (oven && micro) {
    const [strong, weak] = oven.score >= micro.score ? [oven, micro] : [micro, oven];
    if (weak.score < strong.score * 0.7) groups = groups.filter((g) => g !== weak);
  }
  // Bếp từ/điện vs lò nướng (nếu lò vượt trội thì bỏ cooktop yếu)
  const cookI = groups.find((g) => g.key === "cooktop_induction");
  const cookE = groups.find((g) => g.key === "cooktop_electric");
  const candidates = [cookI, cookE].filter(Boolean);
  if (oven && candidates.length) {
    for (const c of candidates) {
      if (c && c.score < oven.score * 0.5) groups = groups.filter((g) => g !== c);
    }
  }
  return groups;
}

/* ====================== “CÔNG SUẤT TƯƠNG ĐỐI” (W) ====================== */
function typicalWattFor(labelVi, labelEn = "") {
  const s = toNorm((labelVi || "") + " " + (labelEn || ""));

  // Nóng/làm lạnh/nước
  if (s.includes("instant water heater")) return 3500;
  if (s.includes("binh nuoc nong") || s.includes("water heater")) return 2000;
  if (s.includes("may lanh") || s.includes("air conditioner") || s.includes("ac")) return 1200;

  // Bếp & lò
  if (s.includes("induction") || s.includes("bep tu")) return 2000;
  if (s.includes("ceramic") || s.includes("electric cooktop") || s.includes("bep dien")) return 1800;
  if (s.includes("oven") || s.includes("lo nuong")) return 1800;
  if (s.includes("microwave") || s.includes("lo vi song")) return 1200;
  if (s.includes("air fryer") || s.includes("noi chien")) return 1500;
  if (s.includes("kettle") || s.includes("am sieu toc")) return 2000;
  if (s.includes("rice cooker") || s.includes("noi com")) return 700;
  if (s.includes("pressure cooker") || s.includes("noi ap suat")) return 1000;
  if (s.includes("dishwasher") || s.includes("may rua chen")) return 1500;
  if (s.includes("range hood") || s.includes("hut mui") || s.includes("hood")) return 150;

  // Lạnh/điện gia dụng khác
  if (s.includes("tu lanh") || s.includes("fridge") || s.includes("refrigerator") || s.includes("freezer")) return 120;
  if (s.includes("washing machine") || s.includes("laundry machine") || s.includes("washer") || s.includes("may giat")) return 500;
  if (s.includes("dryer") || s.includes("may say")) return 1500;
  if (s.includes("vacuum cleaner") || s.includes("may hut bui")) return 1200;
  if (s.includes("air purifier") || s.includes("loc khong khi")) return 45;
  if (s.includes("dehumidifier") || s.includes("hut am")) return 300;
  if (s.includes("water pump") || s.includes("bom nuoc")) return 400;
  if (s.includes("water dispenser") || s.includes("cay nuoc")) return 600;

  // Thiết bị số
  if (s.includes("router") || s.includes("wifi") || s.includes("wi-fi") || s.includes("modem")) return 10;
  if (s.includes("laptop")) return 70;
  if (s.includes("desktop") || s.includes("computer") || s.includes("may tinh de ban")) return 150;
  if (s.includes("monitor") || s.includes("man hinh")) return 30;
  if (s.includes("game console")) return 120;

  // Chiếu sáng/quạt/khác
  if (s.includes("den") || s.includes("lamp") || s.includes("bulb") || s.includes("led")) return 12;
  if (s.includes("quat tran")) return 75;
  if (s.includes("quat") || s.includes("fan")) return 60;
  if (s.includes("tivi") || s.includes("tv") || s.includes("television")) return 90;
  if (s.includes("hair dryer") || s.includes("may say toc")) return 1500;
  if (s.includes("iron") || s.includes("ban ui")) return 1200;

  // Mặc định
  return 100;
}

/* =========== MÔ PHỎNG kWh “TRƯỚC/Sau KHUYẾN NGHỊ” =========== */
// Trả { powerW, hoursBefore, hoursAfter, kwhBefore, kwhAfter, note }
function energyEstimateFor(labelVi, labelEn = "") {
  const P = typicalWattFor(labelVi, labelEn);
  const s = toNorm((labelVi || "") + " " + (labelEn || ""));
  let hoursBefore = 2,
    hoursAfter = 2,
    powerFactorAfter = 1.0,
    note = "Đang phát triển";

  // (giữ nguyên toàn bộ các nhánh if/else của bạn ở đây – mình không dán lại cho đỡ dài,
  // trong project của bạn đã có sẵn đoạn này, đừng xoá)

  if (s.includes("instant water heater")) {
    hoursBefore = 0.25;
    hoursAfter = 0.2;
    note = "Tắm nhanh, tắt ngay sau khi dùng (giảm thời gian).";
  }
  // ... (các nhánh khác bạn đã có sẵn, giữ nguyên)

  const kwhBefore = (P * hoursBefore) / 1000;
  const kwhAfter = (P * powerFactorAfter * hoursAfter) / 1000;
  return { powerW: P, hoursBefore, hoursAfter, kwhBefore, kwhAfter, note };
}

/* ====================== HUGGING FACE INFERENCE ====================== */
// Gọi backend /api/hf-image -> backend gọi Hugging Face bằng HF Router
async function analyzeWithBackend(file) {
  const endpoint = `${API_BASE}/api/hf-image`.replace(/\/+api/, "/api");

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
    },
    body: await file.arrayBuffer(),
  });

  const text = await res.text();
  const ct = res.headers.get("content-type") || "";

  if (!res.ok || !ct.includes("application/json")) {
    throw new Error(`Backend ${res.status}: ${text.slice(0, 200)}`);
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error(`Backend trả JSON không hợp lệ: ${text.slice(0, 120)}`);
  }

  const flat = Array.isArray(data?.[0]) ? data[0] : data;
  return (flat || [])
    .map((x) => ({
      label: String(x.label || x.name || ""),
      score: Number(x.score || x.probability || 0),
    }))
    .filter((x) => x.label);
}

/* ====================== THUMBNAIL & LỊCH SỬ ====================== */
async function createThumbnailDataURL(file, maxW = 420, quality = 0.78) {
  const blobUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, err) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = err;
      i.src = blobUrl;
    });
    const scale = Math.min(1, maxW / img.width);
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    cv.getContext("2d").drawImage(img, 0, 0, w, h);
    return cv.toDataURL("image/jpeg", quality);
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}
const getHistory = () => {
  try {
    const s = localStorage.getItem(LS_KEY_HISTORY);
    return s ? JSON.parse(s) : [];
  } catch {
    return [];
  }
};
const addHistoryItem = (item) => {
  const list = getHistory();
  list.unshift(item);
  localStorage.setItem(LS_KEY_HISTORY, JSON.stringify(list.slice(0, 200)));
};

/* ============================ COMPONENT ============================ */
export default function AnalysisTab() {
  const modelId = DEFAULT_MODEL_ID;

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [items, setItems] = useState([]);
  const [errMsg, setErrMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const [showScrollHint, setShowScrollHint] = useState(true);
  const chipRowRef = useRef(null);
  useEffect(() => {
    const t = setTimeout(() => setShowScrollHint(false), 3500);
    return () => clearTimeout(t);
  }, []);
  const onChipRowScroll = (e) => {
    if (e.currentTarget.scrollLeft > 0) setShowScrollHint(false);
  };

  const fileRef = useRef(null);
  const canUseCamera = useMemo(() => Capacitor.isNativePlatform(), []);

  function handleFileChange(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(f));
    setItems([]);
    setErrMsg("");
  }

  async function handleCaptureCamera() {
    try {
      const photo = await Camera.getPhoto({
        source: CameraSource.Camera,
        resultType: CameraResultType.Uri,
        quality: 85,
      });
      const src =
        photo.webPath ||
        (photo.path ? Capacitor.convertFileSrc(photo.path) : "");
      if (!src) throw new Error("Không lấy được đường dẫn ảnh từ Camera.");
      const res = await fetch(src);
      const blob = await res.blob();
      const ext = (blob.type?.split("/")[1] || "jpg").replace("+xml", "");
      const f = new File([blob], `camera_${Date.now()}.${ext}`, {
        type: blob.type || "image/jpeg",
      });
      setFile(f);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(f));
      setItems([]);
      setErrMsg("");
    } catch (err) {
      console.error(err);
      setErrMsg("Không thể mở camera hoặc đọc ảnh. Kiểm tra quyền rồi thử lại.");
    }
  }

  async function handleAnalyze() {
    if (!file) {
      setErrMsg("Hãy chọn hoặc chụp 1 ảnh trước.");
      return;
    }

    setLoading(true);
    setErrMsg("");
    try {
      // 1) Gọi backend (proxy -> Hugging Face Router)
      const raw = await analyzeWithBackend(file);

      // 2) Lọc top-k gốc và gộp theo canonical để giảm nhiễu
      const top = raw
        .filter((it) => it.score >= CONFIDENCE_MIN)
        .sort((a, b) => b.score - a.score)
        .slice(0, TOP_K);

      let groups = groupByCanonical(top);
      groups = disambiguate(groups);

      // Lọc nhẹ theo tỉ lệ so với nhóm mạnh nhất
      const topScore = groups.length ? Math.max(...groups.map((g) => g.score)) : 0;
      groups = groups.filter((g) => g.score >= Math.max(CONFIDENCE_MIN, topScore * 0.40));

      // 3) Chuẩn hoá thành kết quả hiển thị + ước tính năng lượng
      const mappedRaw = groups.map((g) => {
        const labelVi = normalizeLabelToVi(g.labelEn);
        const cat = categoryOf(labelVi);
        const tip = adviceFor(labelVi);
        const energy = energyEstimateFor(labelVi, g.labelEn);
        return {
          labelVi,
          labelEn: g.labelEn,
          score: g.score,
          advice: tip,
          cat,
          ...energy,
        };
      });

      // 4) Loại nhãn không điện và bếp gas
      const mapped = mappedRaw.filter((it) => {
        if (/gas\s+(stove|cooker)/i.test(it.labelEn)) return false;
        return !seemsNonElectric(it.labelVi, it.labelEn);
      });

      if (!mapped.length) {
        setItems([]);
        setErrMsg(
          "Không nhận diện được thiết bị điện phù hợp. Thử ảnh rõ hơn/ít vật thể không điện."
        );
        return;
      }
      setItems(mapped);

      // 5) Lưu lịch sử (thumbnail + kết quả)
      const thumb = await createThumbnailDataURL(file, 420, 0.78);
      addHistoryItem({
        date: new Date().toISOString(),
        fileName: file.name || "image",
        thumbDataUrl: thumb,
        items: mapped,
      });
    } catch (err) {
      console.error(err);
      setErrMsg(err.message || "Có lỗi khi phân tích ảnh.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl]
  );

  const totalBefore = items.reduce((s, it) => s + (it.kwhBefore || 0), 0);
  const totalAfter = items.reduce((s, it) => s + (it.kwhAfter || 0), 0);
  const maxKwh =
    Math.max(
      ...items.flatMap((it) => [it.kwhBefore || 0, it.kwhAfter || 0]),
      totalBefore,
      totalAfter,
      0.001
    ) || 0.001;

  return (
    <div
      className="mx-auto p-4 max-w-5xl"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        minHeight: "calc(100dvh - env(safe-area-inset-top))",
      }}
    >
      <h2 className="text-2xl font-bold mb-2">
        Chọn/chụp ảnh thiết bị điện để nhận dạng, xem{" "}
        <b>công suất tương đối (W)</b> và biểu đồ{" "}
        <b>kWh/ngày trước–sau khuyến nghị</b>.
      </h2>
      <p className="text-slate-600 mb-4">
        Ảnh càng rõ, chỉ có 1 thiết bị chính thì kết quả càng ổn định.
      </p>

      {/* KHỐI CHỌN/CHỤP ẢNH */}
      <div className="rounded-2xl bg-white/70 backdrop-blur p-4 shadow mb-4">
        <div className="flex flex-wrap items-end gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="px-4 py-3 rounded-xl bg-slate-700 text-white hover:bg-slate-800"
          >
            Chọn ảnh…
          </button>
          {canUseCamera && (
            <button
              onClick={handleCaptureCamera}
              className="px-4 py-3 rounded-xl bg-blue-600 text-white hover:bg-blue-700"
            >
              Chụp bằng camera
            </button>
          )}
          <div className="text-xs text-slate-500 ml-auto">
            *Model được khai báo trong <code>lib/huggingFaceApi</code>; token nằm trên server.
          </div>
        </div>
      </div>

      {/* PREVIEW + KẾT QUẢ */}
      <div className="rounded-2xl bg-white/70 backdrop-blur p-4 shadow">
        <div className="grid md:grid-cols-2 gap-4">
          {/* PREVIEW */}
          <div>
            <div className="text-sm font-medium mb-2">Ảnh xem trước</div>
            <div className="aspect-video bg-slate-100 rounded overflow-hidden flex items-center justify-center">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="preview"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-slate-400 text-sm">Chưa chọn ảnh</div>
              )}
            </div>
            <div className="mt-3">
              <button
                onClick={handleAnalyze}
                disabled={!file || loading}
                className={`px-4 py-2 rounded-lg text-white ${
                  loading ? "bg-slate-400" : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {loading ? "Đang phân tích…" : "Phân tích ảnh"}
              </button>
            </div>
            {errMsg && (
              <div className="mt-3 text-sm text-red-600 whitespace-pre-wrap">
                {errMsg}
              </div>
            )}
          </div>

          {/* KẾT QUẢ */}
          <div>
            <div className="text-sm font-medium mb-2">Kết quả nhận diện</div>

            {!!items.length && (
              <div className="relative">
                <div
                  ref={chipRowRef}
                  onScroll={onChipRowScroll}
                  className="flex gap-2 overflow-x-auto pb-2 pr-4 -mr-4"
                  style={{ scrollbarWidth: "thin", WebkitOverflowScrolling: "touch" }}
                >
                  {items.map((it, i) => (
                    <div
                      key={`chip-${i}`}
                      className={`whitespace-nowrap border px-3 py-1 rounded-full text-sm ${colorClass(
                        it.cat
                      )}`}
                    >
                      {it.labelVi} · {(it.score * 100).toFixed(1)}%
                    </div>
                  ))}
                </div>
                {showScrollHint && (
                  <div className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 bg-white/80 px-2 py-0.5 rounded text-xs text-slate-600 shadow">
                    ⇆ Kéo ngang để xem thêm
                  </div>
                )}
              </div>
            )}

            {!items.length ? (
              <div className="p-3 mt-2 rounded border text-slate-500 text-sm">
                Chưa có kết quả. Hãy chọn/chụp ảnh và bấm <b>Phân tích ảnh</b>.
              </div>
            ) : (
              <div className="space-y-3 mt-3">
                {items.map((it, idx) => (
                  <div key={idx} className="p-3 rounded-lg border bg-white">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">{it.labelVi}</div>
                      <div className="text-xs text-slate-500">
                        {(it.score * 100).toFixed(1)}%
                      </div>
                    </div>
                    <div className="text-xs text-slate-500">EN: {it.labelEn}</div>

                    <div className="mt-1 text-sm">
                      <span className="font-medium">Công suất tương đối:</span>{" "}
                      ~ <b>{Math.round(it.powerW)} W</b>
                    </div>

                    <div className="mt-1 text-sm">
                      <span className="font-medium">Ước tính kWh/ngày:</span>{" "}
                      Trước: <b>{(it.kwhBefore || 0).toFixed(2)}</b> · Sau:{" "}
                      <b className="text-emerald-700">
                        {(it.kwhAfter || 0).toFixed(2)}
                      </b>{" "}
                      {it.note ? (
                        <span className="text-xs text-slate-500">— {it.note}</span>
                      ) : null}
                    </div>

                    <div className="mt-2 text-sm">
                      <span className="font-medium">Gợi ý:</span> {it.advice}
                    </div>

                    {/* Biểu đồ trước/sau cho từng thiết bị */}
                    <div className="mt-3">
                      <div className="text-xs text-slate-600 mb-1">
                        Biểu đồ (kWh/ngày)
                      </div>
                      <div className="space-y-1">
                        <div className="w-full bg-slate-100 rounded h-3 overflow-hidden">
                          <div
                            className="bg-indigo-400 h-3"
                            style={{
                              width: `${
                                Math.min(
                                  100,
                                  ((it.kwhBefore || 0) / maxKwh) * 100
                                ) || 0
                              }%`,
                            }}
                          />
                        </div>
                        <div className="w-full bg-slate-100 rounded h-3 overflow-hidden">
                          <div
                            className="bg-emerald-500 h-3"
                            style={{
                              width: `${
                                Math.min(
                                  100,
                                  ((it.kwhAfter || 0) / maxKwh) * 100
                                ) || 0
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* TỔNG HỢP */}
                <div className="p-3 rounded-lg border bg-white">
                  <div className="font-semibold mb-2">
                    Tổng ước tính (kWh/ngày)
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded border p-3">
                      <div className="text-slate-600">Trước khuyến nghị</div>
                      <div className="text-lg font-semibold">
                        {totalBefore.toFixed(2)} kWh
                      </div>
                    </div>
                    <div className="rounded border p-3">
                      <div className="text-slate-600">Sau khuyến nghị</div>
                      <div className="text-lg font-semibold text-emerald-700">
                        {totalAfter.toFixed(2)} kWh
                      </div>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="text-xs text-slate-600 mb-1">
                      Biểu đồ tổng (kWh/ngày)
                    </div>
                    <div className="space-y-2">
                      <div>
                        <div className="w-full bg-slate-100 rounded h-4 overflow-hidden">
                          <div
                            className="bg-indigo-400 h-4"
                            style={{
                              width: `${Math.min(
                                100,
                                (totalBefore /
                                  Math.max(totalBefore, totalAfter, 0.001)) *
                                  100
                              )}%`,
                            }}
                          />
                        </div>
                        <div className="text-xs mt-1">
                          Trước: <b>{totalBefore.toFixed(2)} kWh</b>
                        </div>
                      </div>
                      <div>
                        <div className="w-full bg-slate-100 rounded h-4 overflow-hidden">
                          <div
                            className="bg-emerald-500 h-4"
                            style={{
                              width: `${Math.min(
                                100,
                                (totalAfter /
                                  Math.max(totalBefore, totalAfter, 0.001)) *
                                  100
                              )}%`,
                            }}
                          />
                        </div>
                        <div className="text-xs mt-1">
                          Sau: <b>{totalAfter.toFixed(2)} kWh</b>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 text-xs text-slate-500">
                    *Số liệu chỉ ước tính tương đối; kết quả thực tế tùy model,
                    công suất và thói quen sử dụng.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
