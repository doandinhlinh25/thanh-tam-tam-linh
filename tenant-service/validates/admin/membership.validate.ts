import Joi from "joi";
import { validateBody, objectId } from "../../helpers/validation.helper";

const role = Joi.string().valid("tenant_owner", "tenant_admin", "lecturer", "student");
export const addMember = validateBody(
  Joi.object({ userId: objectId.required(), role: role.required() })
);
export const updateRole = validateBody(Joi.object({ role: role.required() }));
export const createInvitation = validateBody(
  Joi.object({
    email: Joi.string().trim().lowercase().email().max(254).required(),
    role: Joi.string().valid("tenant_admin", "lecturer", "student").required()
  })
);
export const acceptInvitation = validateBody(
  Joi.object({
    token: Joi.string()
      .pattern(/^[A-Za-z0-9_-]{43}$/)
      .required()
  })
);
