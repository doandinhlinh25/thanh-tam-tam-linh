import Joi from "joi";
import { validateBody, objectId } from "../helpers/validation.helper";

export const courseAuthorization = validateBody(Joi.object({ courseId: objectId.required() }));
export const checkAuthorization = validateBody(
  Joi.object({
    tenantId: objectId.required(),
    courseId: objectId.required(),
    action: Joi.string()
      .valid("course:read", "document:read", "chat:ask", "feedback:write")
      .required()
  })
);
export const consumeQuota = validateBody(
  Joi.object({
    tenantId: objectId.required(),
    courseId: objectId.required(),
    requestId: Joi.string()
      .guid({ version: ["uuidv4"] })
      .required()
  })
);

/** A tenant selector is not authorization evidence; identity always comes from Auth. */
export const authorizationContext = validateBody(Joi.object({ tenantId: objectId.required() }));
