local PLUGIN_NAME = "opa-authorizer"

local schema = {
  name = PLUGIN_NAME,
  fields = {
    {
      config = {
        type = "record",
        fields = {
          {
            opa_url = {
              type = "string",
              required = true,
              match = "^https?://",
            },
          },
          {
            timeout = {
              type = "integer",
              default = 3000,
              between = { 1, 30000 },
            },
          },
          {
            fail_open = {
              type = "boolean",
              default = false,
            },
          },
          {
            unavailable_status = {
              type = "integer",
              default = 503,
              between = { 400, 599 },
            },
          },
          {
            denied_status = {
              type = "integer",
              default = 403,
              between = { 400, 599 },
            },
          },
          {
            forward_headers = {
              type = "array",
              default = {},
              elements = {
                type = "string",
              },
            },
          },
        },
      },
    },
  },
}

return schema
