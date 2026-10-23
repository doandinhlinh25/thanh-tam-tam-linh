import { Request, Response } from 'express';
import bcrypt from "bcryptjs";

import AccountAdmin from '../../models/account-admin.model';
import slugify from 'slugify';
import Role from '../../models/role.model';
import { error } from 'node:console';

export const createPost = async (req: Request, res: Response) => {
  try {
    try {
      const existAccount = await AccountAdmin.findOne({
        email: req.body.email
      })

      if (existAccount) {
        res.json({
          code: "error",
          message: "Email đã tồn tại!"
        })
        return;
      }

      req.body.roles = JSON.parse(req.body.roles);

      req.body.search = slugify(`${req.body.fullName} ${req.body.email}`, {
        replacement: " ",
        lower: true
      });

      if (req.body.password !== req.body.confirmPassword) {
        res.json({
          code: "error",
          message: "Mật khẩu không khớp!"
        })
        return;
      }
      // Mã hóa mật khẩu
      req.body.password = await bcrypt.hash(req.body.password, 10);

      const newRecord = new AccountAdmin(req.body);
      await newRecord.save();

      res.json({
        code: "success",
        message: "Tạo tài khoản thành công!"
      })
    } catch (error) {
      res.json({
        code: "error",
        message: "Dữ liệu không hợp lệ!"
      })
    }
  } catch (error) {
    res.json({
      code: "error",
      message: error
    })
  }
}

export const adminList = async (req: Request, res: Response) => {
  try {
    const find: any = {
      deleted: false,
    };

    if (req.query.keyword) {
      const keyword = slugify(`${req.query.keyword}`, {
        lower: true,
        replacement: " "
      });
      const keywordRegex = new RegExp(keyword);
      find.search = keywordRegex;
    }

    if (req.query.role) {
      find.roles = {
        $in: [req.query.role]
      }
    }

    if (req.query.status) {
      find.status = req.query.status;
    }

    // Phân trang
    const limitItems = 5;
    let page = 1;
    if (req.query.page) {
      const currentPage = parseInt(`${req.query.page}`);
      if (currentPage > 0) {
        page = currentPage;
      }
    }
    const totalRecord = await AccountAdmin.countDocuments(find);
    const totalPage = Math.ceil(totalRecord / limitItems);
    const skip = (page - 1) * limitItems;
    const pagination = {
      skip: skip,
      limit: limitItems,
      totalRecord: totalRecord,
      totalPage: totalPage,
      currentPage: page,
    };
    // Hết Phân trang

    const adminList = await AccountAdmin
      .find(find)
      .limit(limitItems)
      .skip(skip)
      .sort({
        createdAt: "desc"
      })

    const dataFinal = await Promise.all(
      adminList.map(async (admin) => {
        const roleDetails = await Role.find({
          _id: { $in: admin.roles }
        });

        return {
          _id: admin._id,
          fullName: admin.fullName,
          avatar: admin.avatar,
          email: admin.email,
          status: admin.status,
          roles: roleDetails.map(item => item.name)
        };
      })
    );

    const statistics = {
      totalAdmin: adminList.length + 1,
      totalSuperAdmin: 1,
      totalActive: adminList.filter(item => item.status == "active").length,
      totalInactive: adminList.filter(item => item.status == "inactive").length,
    }

    res.json({
      code: "success",
      message: "Thành công!",
      adminList: dataFinal,
      statistics: statistics,
      pagination: pagination
    })
  } catch (error) {
    res.json({
      code: "error",
      message: error
    })
  }
}

export const adminDetail = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const accountDetail = await AccountAdmin.findOne({
      _id: id,
      deleted: false
    })

    if (!accountDetail) {
      res.json({
        code: "error",
        message: error
      })
      return;
    }

    res.json({
      code: "success",
      message: "Thành công!",
      accountDetail: accountDetail
    })

  } catch (error) {
    res.json({
      code: "error",
      message: error
    })
  }
}

export const adminEdit = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    const accountDetail = await AccountAdmin.findOne({
      _id: id,
      deleted: false
    })

    if (!accountDetail) {
      res.json({
        code: "error",
        message: "Tài khoản không tồn tại!"
      })
      return;
    }

    const existEmail = await AccountAdmin.findOne({
      email: req.body.email,
      _id: { $ne: id } // not equal - không bằng
    })

    if (existEmail) {
      res.json({
        code: "error",
        message: "Email đã được sử dụng bởi tác khoản khác!"
      })
      return;
    }

    req.body.roles = JSON.parse(req.body.roles);

    req.body.search = slugify(`${req.body.fullName} ${req.body.email}`, {
      replacement: " ",
      lower: true
    });

    await AccountAdmin.updateOne({
      _id: id,
      deleted: false
    }, req.body);

    res.json({
      code: "success",
      message: "Cập nhật thành công!"
    })

  } catch (error) {
    res.json({
      code: "error",
      message: error
    })
  }
}

export const adminDelete = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await AccountAdmin.updateOne({
      _id: id
    }, {
      deleted: true,
      deletedAt: Date.now(),
    });

    res.json({
      code: "success",
      message: "Xóa tài khoản thành công!"
    })

  } catch (error) {
    res.json({
      code: "error",
      message: error
    })
  }
}

export const profileChangePatch = async (req: Request, res: Response) => {
  try {
    const email = req.body.email;

    const accountAdmin = res.locals.accountAdmin;

    if (email == accountAdmin.email) {
      const accountDetail = await AccountAdmin.findOne({
        email: email,
        deleted: false
      })

      if (!accountDetail) {
        res.json({
          code: "error",
          message: "Tài khoản không tồn tại!"
        })

        return;
      }

      const isPasswordValid = bcrypt.compareSync(req.body.password, `${accountDetail.password}`);

      if (!isPasswordValid) {
        res.json({
          code: "error",
          message: "Mật khẩu không chính xác!"
        })

        return;
      }

      if (req.body.password == req.body.newPassword) {
        res.json({
          code: "error",
          message: "Mật khẩu mới và cũ không được trùng nhau"
        })

        return;
      }
      req.body.password = await bcrypt.hash(req.body.newPassword, 10);

      await AccountAdmin.updateOne({
        email: email,
        _id: accountAdmin.id,
        deleted: false
      }, req.body)

      res.json({
        code: "success",
        message: "Cập nhật thành công!"
      })
    }

  } catch (error) {
    res.json({
      code: "error",
      message: "Lỗi"
    })
  }
}
