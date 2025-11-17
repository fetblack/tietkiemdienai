import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config({ path: ".env.server" });

const app = express();

// ENV
const HF_TOKEN = process.env.HF_TOKEN;
const HF_MODEL_ID = process.env.HF_MODEL_ID || "microsoft/resnet-50";
const PORT = process.env.PORT || 5174;

// Cảnh báo nếu thiếu token (KHÔNG dừng server, để bạn còn test local)
if (!HF_TOKEN) {
  console.warn(
    "⚠️  HF_TOKEN không tồn tại trong biến môi trường. HuggingFace sẽ lỗi khi gọi API."
  );
}

// 🔍 Log mọi request tới server (dùng để xem Android có gõ cửa không)
app.use((req, _res, next) => {
  console.log(
    `[${new Date().toISOString()}] ${req.method} ${req.url} - UA: ${
      req.headers["user-agent"]
    }`
  );
  next();
});

// 🔥 CORS: cho web + Android (Capacitor)
app.use(
  cors({
    origin: [
      "*",
      "capacitor://localhost",
      "http://localhost",
      "http://localhost:5173",
      "https://tietkiemdienai.onrender.com",
    ],
    methods: ["GET", "POST", "OPTIONS"],
  })
);

// Nhận binary image từ frontend
app.use(
  express.raw({
    type: "application/octet-stream",
    limit: "15mb",
  })
);

// Route test đơn giản
app.get("/", (_req, res) => {
  res.send("HF proxy server is running");
});

// Route ping để test từ điện thoại / trình duyệt
app.get("/ping", (req, res) => {
  console.log("📲 /ping từ:", req.headers["user-agent"]);
  res.json({ ok: true, time: new Date().toISOString() });
});

// API chính: nhận ảnh, forward sang HF Router
app.post("/api/hf-image", async (req, res) => {
  try {
    console.log(
      "📲 Nhận /api/hf-image, body length:",
      req.body ? req.body.length : "no body"
    );

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
        "X-Wait-For-Model": "true",
      },
      body: req.body,
    });

    const text = await hfRes.text();
    const contentType = hfRes.headers.get("content-type") || "text/plain";

    console.log("📥 HF trả về status:", hfRes.status);

    res.status(hfRes.status).set("content-type", contentType).send(text);
  } catch (err) {
    console.error("🔥 HF proxy error:", err);
    res.status(500).json({
      error: "Lỗi server khi gọi HuggingFace. Kiểm tra log server để biết thêm.",
    });
  }
});

// START SERVER
app.listen(PORT, "0.0.0.0", () => {
  console.log("===============================================");
  console.log("🚀 HuggingFace Proxy Server đang chạy!");
  console.log(`➡  Internal API: http://localhost:${PORT}/api/hf-image`);
  console.log("➡  Model:", HF_MODEL_ID);
  console.log("===============================================");
});
