import { Request, Response } from 'express';
import { AccountRequest } from '../../interfaces/request.interface';
import { permissionList } from "../../config/variable.config"
import Role from '../../models/role.model';
import moment from 'moment';

export const permisionsList = async (req: AccountRequest, res: Response) => {
  try {
    const permisionsList = permissionList

    res.json({
      code: "success",
      message: "Thành công!",
      permisionsList: permisionsList
    })
  } catch (error) {
    res.json({
      code: "error",
      message: error
    })
  }
}

export const roleCreatePost = async (req: AccountRequest, res: Response) => {
  try {
    // req.body.createdBy = req.account.id;
    const newRecord = new Role(req.body);
    await newRecord.save();

    res.json({
      code: "success",
      message: "Tạo nhóm quyền thành công!"
    })
  } catch (error) {
    res.json({
      code: "error",
      message: error
    })
  }
}

export const roleList = async (req: AccountRequest, res: Response) => {
  try {
    const rolesList = await Role.find({
      deleted: false
    }).lean() as any

    const dataFinal = [];

    for (const item of rolesList) {
      const dataItemFinal = {
        _id: item._id,
        name: item.name,
        description: item.description,
        permissions: item.permissions,
        status: item.status,
        createdAtFormat: "",
        updatedAtFormat: ""
      }

      dataItemFinal.createdAtFormat = moment(item.createdAt).format("HH:mm - DD/MM/YYYY")
      dataItemFinal.updatedAtFormat = moment(item.updatedAt).format("HH:mm - DD/MM/YYYY")

      dataFinal.push(dataItemFinal);
    }

    res.json({
      code: "success",
      message: "Thành công!",
      rolesList: dataFinal
    })
  } catch (error) {
    res.json({
      code: "error",
      message: error
    })
  }
}

export const roleDetail = async (req: AccountRequest, res: Response) => {
  try {
    const { id } = req.params;

    const roleDetail = await Role.findOne({
      _id: id,
      deleted: false
    }).lean()

    if (!roleDetail) {
      res.json({
        code: "error",
        message: "Không tìm thấy bản ghi!"
      })
      return;
    }

    res.json({
      code: "success",
      message: "Thành công!",
      roleDetail: roleDetail
    })
  } catch (error) {
    res.json({
      code: "error",
      message: error
    })
  }
}

export const roleEdit = async (req: AccountRequest, res: Response) => {
  try {
    const { id } = req.params;

    await Role.updateOne({
      _id: id,
      deleted: false
    }, req.body)

    res.json({
      code: "success",
      message: "cập nhật nhóm quyền thành công!"
    })

  } catch (error) {
    res.json({
      code: "error",
      message: error
    })
  }
}

export const roleDelete = async (req: AccountRequest, res: Response) => {
  try {
    const { id } = req.params;

    await Role.findOneAndUpdate({
      _id: id,
    }, {
      deleted: true
    })

    res.json({
      code: "success",
      message: "Xóa nhóm quyền thành công!"
    })
  } catch (error) {
    res.json({
      code: "error",
      message: error
    })
  }
}

export const roleTrashList = async (req: AccountRequest, res: Response) => {
  try {
    const rolesList = await Role.find({
      deleted: true
    }).lean() as any

    const dataFinal = [];

    for (const item of rolesList) {
      const dataItemFinal = {
        _id: item._id,
        name: item.name,
        description: item.description,
        permissions: item.permissions,
        status: item.status,
        createdAtFormat: "",
        updatedAtFormat: ""
      }

      dataItemFinal.createdAtFormat = moment(item.createdAt).format("HH:mm - DD/MM/YYYY")
      dataItemFinal.updatedAtFormat = moment(item.updatedAt).format("HH:mm - DD/MM/YYYY")

      dataFinal.push(dataItemFinal);
    }

    res.json({
      code: "success",
      message: "Thành công!",
      rolesList: dataFinal
    })
  } catch (error) {
    res.json({
      code: "error",
      message: error
    })
  }
}

export const roleDestroy = async (req: AccountRequest, res: Response) => {
  try {
    const { id } = req.params;

    await Role.deleteOne({
      _id: id
    })

    res.json({
      code: "success",
      message: "Xóa thành công!"
    })

  } catch (error) {
    res.json({
      code: "error",
      mesasge: error
    })
  }
}

export const roleUndo = async (req: AccountRequest, res: Response) => {
  try {
    const { id } = req.params;

    await Role.findOneAndUpdate({
      _id: id
    }, {
      deleted: false
    })

    res.json({
      code: "success",
      message: "Khôi phục thành công!"
    })

  } catch (error) {
    res.json({
      code: "error",
      message: error
    })
  }
}

