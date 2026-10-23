import { Request, Response } from 'express';
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { AccountRequest } from '../../interfaces/request.interface';
import AccountAdmin from '../../models/account-admin.model';

export const loginPost = async (req: AccountRequest, res: Response) => {
  try {
    const { email, password, rememberPassword } = req.body;

    let token = "";

    if (email === process.env.SUPER_ADMIN_EMAIL) {
      const isMatch = password === process.env.SUPER_ADMIN_PASSWORD;

      if (!isMatch) {
        res.json({
          code: "error",
          message: "Mật khẩu không chính xác!"
        })
        return;
      }

      // Tạo JWT token
      token = jwt.sign(
        {
          id: process.env.SUPER_ADMIN_ID,
          email: process.env.SUPER_ADMIN_EMAIL
        },
        `${process.env.JWT_SECRET}`,
        {
          expiresIn: rememberPassword == "true" ? "7d" : "1d"
        }
      );
      req.adminId = process.env.SUPER_ADMIN_ID;
    } else {
      const existAccount = await AccountAdmin.findOne({
        email: email,
        deleted: false
      })

      if (!existAccount) {
        res.json({
          code: "error",
          message: "Email không tồn tại!"
        })
        return;
      }

      const isPasswordValid = bcrypt.compareSync(password, `${existAccount.password}`);

      if (!isPasswordValid) {
        res.json({
          code: "error",
          message: "Mật khẩu không chính xác!"
        })
        return;
      }

      if (existAccount.status != "active") {
        res.json({
          code: "error",
          message: "Tài khoản chưa được kích hoạt!"
        })
        return;
      }

      // Tạo JWT token
      token = jwt.sign(
        {
          id: existAccount.id,
          email: existAccount.email
        },
        `${process.env.JWT_SECRET}`,
        {
          expiresIn: rememberPassword == "true" ? "7d" : "1d"
        }
      );
      req.adminId = existAccount.id;
    }

    // Lưu token vào cookie
    res.cookie("tokenAdmin", token, {
      httpOnly: true, // Chỉ cho phép server truy cập cookie, JavaScript ở client không thể đọc được
      secure: process.env.NODE_ENV === "production", // true: nếu là https, false: nếu là http
      sameSite: 'strict', // Chỉ gửi cookie khi request từ cùng domain
      maxAge: rememberPassword == "true" ? (7 * 24 * 60 * 60 * 1000) : (24 * 60 * 60 * 1000), // 7 ngày hoặc 1 ngày
      domain: process.env.NODE_ENV === "production" ? '.likaloka.com' : undefined
    });

    res.json({
      code: "success",
      message: "Đăng nhập thành công!"
    })

  } catch (error) {
    res.json({
      code: "error",
      message: error
    })
  }
}

export const logoutPost = async (req: Request, res: Response) => {
  try {
    res.clearCookie("tokenAdmin")
    res.json({
      code: "success",
      message: "Đăng xuất thành công!"
    })
  } catch (error) {
    res.json({
      code: "error",
      message: error
    })
  }
}

