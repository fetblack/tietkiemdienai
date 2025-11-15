import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config({ path: ".env.server" });

const app = express();

// Lấy HF_TOKEN từ môi trường (Render hoặc .env file nếu chạy local)
const HF_TOKEN = process.env.HF_TOKEN;
const HF_MODEL_ID = process.env.HF_MODEL_ID || "microsoft/resnet-50";

// Kiểm tra nếu HF_TOKEN chưa được cấp
if (!HF_TOKEN) {
  console.warn("⚠️  HF_TOKEN không tồn tại trong biến môi trường. HuggingFace sẽ lỗi.");
}

// Sử dụng biến môi trường PORT mà Render cấp tự động
const PORT = process.env.PORT || 5174; // 5174 dùng cho local, Render tự cấp port khi deploy

// 🔥 CORS: Cho phép tất cả origin và WebView Android (capacitor://localhost)
app.use(
  cors({
    origin: [
      "*",                     // Cho phép tất cả origin (ok vì mình không dùng cookie)
      "capacitor://localhost", // Android/iOS Capacitor
      "http://localhost",      // Một số WebView dùng origin này
      "http://localhost:5173", // Vite dev (local dev)
      "https://tietkiemdienai.onrender.com", // backend URL (optional)
    ],
    methods: ["GET", "POST", "OPTIONS"],
  })
);
app.use(
  express.raw({
    type: "application/octet-stream",
    limit: "15mb"
  })
);
// Route test
app.get("/", (_req, res) => {
  res.send("HF proxy server is running");
});

// API route for HuggingFace
app.post("/api/hf-image", async (req, res) => {
  try {
    const hfUrl = `https://router.huggingface.co/hf-inference/models/${HF_MODEL_ID}`;

    console.log("📤 Gửi ảnh tới HuggingFace Router...");
    console.log("🔗 Model:", HF_MODEL_ID);

    const hfRes = await fetch(hfUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        "Content-Type": "application/octet-stream",
        Accept: "application/json",

        // HF Router yêu cầu có timeout prediction
        "HF-Prediction-Timeout": "30000", // 30s

        // Chờ load model luôn (tránh 503)
        "X-Wait-For-Model": "true"
      },
      body: req.body
    });

    const text = await hfRes.text();
    const contentType = hfRes.headers.get("content-type") || "text/plain";

    console.log("📥 HF trả về status:", hfRes.status);

    // Gửi nguyên văn kết quả về frontend
    res.status(hfRes.status).set("content-type", contentType).send(text);
  } catch (err) {
    console.error("🔥 HF proxy error:", err);
    res.status(500).json({
      error: "Lỗi server khi gọi HuggingFace. Kiểm tra log server để biết thêm."
    });
  }
});

// =========================
//     START SERVER
// =========================
app.listen(PORT, () => {
  console.log("===============================================");
  console.log("🚀 HuggingFace Proxy Server đang chạy!");
  console.log("➡  API: http://localhost:" + PORT + "/api/hf-image");
  console.log("➡  Model:", HF_MODEL_ID);
  console.log("===============================================");
});