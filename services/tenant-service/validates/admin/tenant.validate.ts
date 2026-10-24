import Joi from "joi";
import { validateBody, objectId } from "../../helpers/validation.helper";

const fields = {
  name: Joi.string().trim().min(1).max(150),
  domain: Joi.string().trim().max(253).allow(""),
  description: Joi.string().trim().max(2000).allow(""),
  logo: Joi.string()
    .uri({ scheme: ["http", "https"] })
    .max(2000)
    .allow(""),
  plan: Joi.string().valid("free", "pro", "enterprise"),
  quota: Joi.object({
    maxUsers: Joi.number().integer().min(1).max(1000000),
    maxStorageMB: Joi.number().integer().min(1).max(100000000),
    maxCourses: Joi.number().integer().min(1).max(100000),
    maxDailyChats: Joi.number().integer().min(1).max(10000000)
  }).min(1)
};

export const createTenant = validateBody(
  Joi.object({
    ...fields,
    name: fields.name.required(),
    code: Joi.string()
      .trim()
      .lowercase()
      .pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .min(2)
      .max(40),
    ownerId: objectId,
    plan: fields.plan.default("free")
  })
);
export const editTenant = validateBody(Joi.object(fields).min(1));
export const editSettings = validateBody(
  Joi.object({
    name: fields.name,
    domain: fields.domain,
    description: fields.description,
    logo: fields.logo
  }).min(1)
);
export const changeStatus = validateBody(
  Joi.object({
    status: Joi.string().valid("active", "inactive", "suspended").required()
  })
);
