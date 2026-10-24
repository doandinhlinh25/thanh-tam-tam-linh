import { Request, Response } from "express";
import { AccountService } from "../../services/account.service";
import { errorResponse } from "../../helpers/error.helper";

export const createPost = async (req: Request, res: Response) => {
  try {
    const account = await AccountService.createAccount(req.body);
    res.json({ code: "success", message: "Tạo tài khoản thành công!", account });
  } catch (error) {
    errorResponse(res, error);
  }
};

export const adminList = async (req: Request, res: Response) => {
  try {
    const result = await AccountService.getAccounts(res.locals.accountQuery);
    res.json({ code: "success", message: "Lấy danh sách thành công!", ...result });
  } catch (error) {
    errorResponse(res, error);
  }
};

export const adminDetail = async (req: Request, res: Response) => {
  try {
    const accountDetail = await AccountService.getAccountById(String(req.params.id));
    res.json({ code: "success", message: "Lấy tài khoản thành công!", accountDetail });
  } catch (error) {
    errorResponse(res, error);
  }
};

export const adminEdit = async (req: Request, res: Response) => {
  try {
    const account = await AccountService.updateAccount(String(req.params.id), req.body);
    res.json({ code: "success", message: "Cập nhật tài khoản thành công!", account });
  } catch (error) {
    errorResponse(res, error);
  }
};

export const adminDelete = async (req: Request, res: Response) => {
  try {
    await AccountService.deleteAccount(String(req.params.id));
    res.json({ code: "success", message: "Xóa tài khoản thành công!" });
  } catch (error) {
    errorResponse(res, error);
  }
};

export const sendActivation = async (req: Request, res: Response) => {
  try {
    await AccountService.sendActivation(String(req.params.id));
    res.json({ code: "success", message: "Đã gửi email kích hoạt!" });
  } catch (error) {
    errorResponse(res, error);
  }
};
