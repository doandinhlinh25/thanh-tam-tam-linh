import express, { Request, Response } from 'express';
import dotenv from "dotenv";
import { connectDB } from "./config/database"
import cors from "cors";
import adminRoutes from "./routes/admin/index.route";
// import clientRoutes from "./routes/client/index.route";
import cookieParser from 'cookie-parser';

import session from "express-session";

//Load biến môi trường từ .env
dotenv.config();

const app = express();
const port = 4000;

const allowedOrigins = [
  "http://localhost:3000",
];

// Cấu hình CORS
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ["GET", "POST", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

//Kết nối MoongoDB
connectDB();

// Cho phép gửi data lên dạng json
app.use(express.json());

// Cấu hình lấy được cookie
app.use(cookieParser());

// Cấu hình session
app.use(session({
  secret: `${process.env.SESSION_SECRET}`,
  resave: false,
  saveUninitialized: true,
}));


//Thiết lập đường dẫn
app.use("/admin", adminRoutes);
// app.use("/", clientRoutes);

app.listen(port, () => {
  console.log(`Website đang chạy trên cổng ${port}`);
});

