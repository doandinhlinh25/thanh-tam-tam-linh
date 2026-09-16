local cjson = require "cjson.safe"
local http = require "resty.http"

local HTTP_STATUS_OK_MAXIMUM = 299
local HTTP_STATUS_OK_MINIMUM = 200
local HTTP_STATUS_SERVICE_UNAVAILABLE = 503
local PLUGIN_PRIORITY = 900
local PLUGIN_VERSION = "1.0.0"

local OpaAuthorizer = {
  PRIORITY = PLUGIN_PRIORITY,
  VERSION = PLUGIN_VERSION,
}

local function exit_with_error(status, message)
  return kong.response.exit(status, {
    message = message,
  }, {
    ["Content-Type"] = "application/json",
  })
end

local function selected_headers(header_names)
  local headers = {}
  local header_value

  for _, header_name in ipairs(header_names) do
    header_value = kong.request.get_header(header_name)

    if header_value then
      headers[header_name] = header_value
    end
  end

  return headers
end

local function opa_input(config)
  local consumer = kong.client.get_consumer()
  local input = {
    input = {
      request = {
        http = {
          headers = selected_headers(config.forward_headers),
          host = kong.request.get_host(),
          method = kong.request.get_method(),
          path = kong.request.get_path(),
          scheme = kong.request.get_scheme(),
        },
      },
    },
  }

  if consumer then
    input.input.consumer = {
      id = consumer.id,
      username = consumer.username,
    }
  end

  return input
end

local function opa_failure(config, reason)
  kong.log.err("OPA authorization request failed: ", reason)

  if config.fail_open then
    return
  end

  return exit_with_error(config.unavailable_status, "Authorization service unavailable.")
end

local function is_successful_response(status)
  return status >= HTTP_STATUS_OK_MINIMUM and status <= HTTP_STATUS_OK_MAXIMUM
end

function OpaAuthorizer:access(config)
  local request_body, encode_error = cjson.encode(opa_input(config))
  local http_client = http.new()
  local response
  local request_error
  local response_body
  local decode_error
  local result
  local denied_status
  local denied_message

  if not request_body then
    return opa_failure(config, encode_error)
  end

  http_client:set_timeout(config.timeout)
  response, request_error = http_client:request_uri(config.opa_url, {
    body = request_body,
    headers = {
      ["Content-Type"] = "application/json",
    },
    method = "POST",
  })

  if not response or request_error then
    return opa_failure(config, request_error)
  end

  if not is_successful_response(response.status) then
    return opa_failure(config, "OPA returned HTTP status " .. response.status)
  end

  response_body, decode_error = cjson.decode(response.body)

  if not response_body then
    return opa_failure(config, decode_error)
  end

  result = response_body.result

  if result == true then
    return
  end

  if type(result) == "table" and result.allow == true then
    return
  end

  denied_status = config.denied_status
  denied_message = "Access denied by authorization policy."

  if type(result) == "table" then
    denied_status = result.status or denied_status
    denied_message = result.message or denied_message
  end

  return exit_with_error(denied_status, denied_message)
end

return OpaAuthorizer
