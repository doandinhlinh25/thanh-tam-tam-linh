import Joi from "joi";
import { validateBody, objectId } from "../../helpers/validation.helper";

const name = Joi.string().trim().min(1).max(150);
const description = Joi.string().trim().max(2000).allow("");
const status = Joi.string().valid("active", "draft", "archived");
export const createCourse = validateBody(
  Joi.object({
    code: Joi.string()
      .trim()
      .uppercase()
      .pattern(/^[A-Z0-9_-]+$/)
      .max(40)
      .required(),
    name: name.required(),
    description: description.default(""),
    status: status.default("active")
  })
);
export const editCourse = validateBody(Joi.object({ name, description, status }).min(1));
export const assignLecturer = validateBody(Joi.object({ userId: objectId.required() }));
export const enrollStudent = validateBody(Joi.object({ userId: objectId.required() }));
