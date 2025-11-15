// server/index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";

// Đọc file .env.server
dotenv.config({ path: ".env.server" });

const app = express();

// ENV
const HF_TOKEN = process.env.HF_TOKEN;
const HF_MODEL_ID = process.env.HF_MODEL_ID || "microsoft/resnet-50";
const PORT = process.env.PORT || 5174;

// Kiểm tra token ngay khi khởi động
if (!HF_TOKEN) {
  console.error("❌ LỖI: Không tìm thấy HF_TOKEN trong .env.server");
  process.exit(1);
}

// CORS cho frontend Vite
app.use(
  cors({
    origin: ["http://localhost:5173"],
    methods: ["POST", "GET", "OPTIONS"]
  })
);

// 👉 THÊM ROUTE TEST GET /
app.get("/", (_req, res) => {
  res.send("HF proxy server is running");
});

// Nhận binary image
app.use(
  express.raw({
    type: "application/octet-stream",
    limit: "15mb"
  })
);

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
        "HF-Prediction-Timeout": "30000",
        "X-Wait-For-Model": "true"
      },
      body: req.body
    });

    const text = await hfRes.text();
    const contentType = hfRes.headers.get("content-type") || "text/plain";

    console.log("📥 HF trả về status:", hfRes.status);

    res.status(hfRes.status).set("content-type", contentType).send(text);
  } catch (err) {
    console.error("🔥 HF proxy error:", err);
    res.status(500).json({
      error: "Lỗi server khi gọi HuggingFace. Kiểm tra log server để biết thêm."
    });
  }
});

app.listen(PORT, () => {
  console.log("===============================================");
  console.log("🚀 HuggingFace Proxy Server đang chạy!");
  console.log("➡  API: http://localhost:" + PORT + "/api/hf-image");
  console.log("➡  Model:", HF_MODEL_ID);
  console.log("===============================================");
});