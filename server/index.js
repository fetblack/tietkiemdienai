// server/index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";
import multer from "multer";

dotenv.config(); // đọc .env.server trên Render hoặc .env.local khi chạy local

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

const PORT = process.env.PORT || 5174;
const HF_TOKEN = process.env.HF_TOKEN;
const HF_MODEL_ID = process.env.HF_MODEL_ID;

// ===============================
// 🔥 CORS – CHO PHÉP ANDROID & WEB
// ===============================

app.use(
  cors({
    origin: [
      "*",                     // Cho phép tất cả (mobile cần)
      "capacitor://localhost", // Android/iOS Capacitor
      "http://localhost",      // Một số WebView Android dùng origin này
      "http://localhost:5173", // Vite dev
      "https://tietkiemdienai.onrender.com", // backend URL (optional)
    ],
    methods: ["GET", "POST", "OPTIONS"],
  })
);

// ===============================
// Helper: Gọi HuggingFace
// ===============================
async function queryHuggingFace(imageBuffer) {
  const hfUrl = `https://router.huggingface.co/hf-inference/${HF_MODEL_ID}`;

  const response = await fetch(hfUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${HF_TOKEN}`,
      "Content-Type": "application/octet-stream",
    },
    body: imageBuffer,
  });

  if (!response.ok) {
    console.error("HF error:", await response.text());
    throw new Error("HuggingFace API error");
  }

  return await response.json();
}

// ===============================
// ROUTES
// ===============================

// Test server
app.get("/", (req, res) => {
  res.send("HF proxy server is running");
});

// Main API
app.post("/api/hf-image", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Missing image file" });
    }

    const imgBuffer = req.file.buffer;
    const result = await queryHuggingFace(imgBuffer);

    res.json(result);
  } catch (error) {
    console.error("Error processing image:", error.message);
    res.status(500).json({ error: "Image processing failed" });
  }
});

// ===============================
// START SERVER
// ===============================

app.listen(PORT, () => {
  console.log(`Backend server running at http://localhost:${PORT}`);
});