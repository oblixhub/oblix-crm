import { resolveOperator } from "./lib/auth.js";
import { jsonResponse, optionsResponse } from "./lib/http.js";

export function createHealthHandler({ env = process.env } = {}) {
  return async function healthHandler(request) {
    const operator = resolveOperator(request, env);
    if (!operator) {
      return jsonResponse(401, { ok: false, message: "Token inválido." });
    }

    return jsonResponse(200, { ok: true, operator: operator.name });
  };
}

export const GET = createHealthHandler();
export const OPTIONS = async () => optionsResponse();
