import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config(); // Load .env file

const app = express();

// Sử dụng biến môi trường PORT do Render cấp
const PORT = process.env.PORT || 5174; // 5174 dùng cho local, Render tự cấp port khi deploy

app.use(
  cors({
    origin: "*", // Cho phép mọi origin (giúp Android WebView không gặp vấn đề CORS)
    methods: ["GET", "POST", "OPTIONS"],
  })
);

// Test route
app.get("/", (_req, res) => {
  res.send("HF proxy server is running");
});

// API route for HuggingFace
app.post("/api/hf-image", async (req, res) => {
  try {
    const hfUrl = `https://router.huggingface.co/hf-inference/models/microsoft/resnet-50`;

    const response = await fetch(hfUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.HF_TOKEN}`,
        "Content-Type": "application/octet-stream",
      },
      body: req.body,
    });

    const result = await response.json();
    res.json(result);
  } catch (error) {
    console.error("Error processing image:", error);
    res.status(500).json({ error: "Image processing failed" });
  }
});

// Lắng nghe trên cổng mà Render cấp
app.listen(PORT, () => {
  console.log(`Backend server đang chạy tại http://localhost:${PORT}`);
});