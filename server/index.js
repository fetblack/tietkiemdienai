// server/index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config(); // local thì đọc .env / .env.server; trên Render dùng env dashboard

const app = express();
// Lấy port từ Render (hoặc sử dụng port mặc định 5174 cho dev)
const PORT = process.env.PORT || 5174;

// Đảm bảo rằng bạn không hardcode port vào, và để Render tự động cấp port cho backend
app.listen(PORT, () => {
  console.log(`Backend server đang chạy tại http://localhost:${PORT}`);
});
const HF_TOKEN = process.env.HF_TOKEN;
const HF_MODEL_ID = process.env.HF_MODEL_ID || "microsoft/resnet-50";

// Chỉ cảnh báo, không ép exit để Render khỏi restart vòng lặp
if (!HF_TOKEN) {
  console.warn("⚠️  HF_TOKEN không tồn tại trong biến môi trường. HuggingFace sẽ lỗi.");
}

// 🔥 CORS: cho web dev + app Android (Capacitor)
app.use(
  cors({
    origin: [
      "*",                     // cho phép tất cả origin (ok vì mình không dùng cookie)
      "capacitor://localhost", // Android/iOS Capacitor
      "http://localhost",      // một số WebView dùng origin này
      "http://localhost:5173", // Vite dev
      "http://tietkiemdienai.onrender.com",
    ],
    methods: ["GET", "POST", "OPTIONS"],
  })
);

// Route test
app.get("/", (_req, res) => {
  res.send("HF proxy server is running");
});

// Nhận ảnh dạng raw binary (giống như frontend đang gửi)
app.use(
  express.raw({
    type: "application/octet-stream",
    limit: "15mb",
  })
);

// Gọi HuggingFace Router với binary từ body
app.post("/api/hf-image", async (req, res) => {
  try {
    if (!HF_TOKEN) {
      return res
        .status(500)
        .json({ error: "Thiếu HF_TOKEN trên server. Kiểm tra biến môi trường." });
    }

    const hfUrl = `https://router.huggingface.co/hf-inference/models/${HF_MODEL_ID}`;

    console.log("📤 Gửi ảnh tới HuggingFace:", HF_MODEL_ID);
    console.log("📦 Kích thước body:", req.body?.length || 0, "bytes");

    const hfRes = await fetch(hfUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        "Content-Type": "application/octet-stream",
        Accept: "application/json",
        "HF-Prediction-Timeout": "30000",
        "X-Wait-For-Model": "true",
      },
      body: req.body,
    });

    const text = await hfRes.text();
    const contentType = hfRes.headers.get("content-type") || "text/plain";

    console.log("📥 HF status:", hfRes.status);
    // In 1 phần nội dung để debug nếu lỗi
    if (!hfRes.ok) {
      console.log("📥 HF body (rút gọn):", text.slice(0, 200));
    }

    res.status(hfRes.status).set("content-type", contentType).send(text);
  } catch (err) {
    console.error("🔥 HF proxy error:", err);
    res
      .status(500)
      .json({ error: "Lỗi server khi gọi HuggingFace. Xem log backend để biết thêm." });
  }
});

// Start server
app.listen(PORT, () => {
  console.log("===============================================");
  console.log("🚀 HF Proxy Server đang chạy tại cổng", PORT);
  console.log("===============================================");
});