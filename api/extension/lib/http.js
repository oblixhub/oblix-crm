export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
};

export function jsonResponse(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, ...extraHeaders },
  });
}

export function optionsResponse() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function readJsonBody(request, maxBytes = 12_000) {
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > maxBytes) {
    return { ok: false, message: "Payload muito grande." };
  }

  let text;
  try {
    text = await request.text();
  } catch {
    return { ok: false, message: "Não foi possível ler a solicitação." };
  }

  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    return { ok: false, message: "Payload muito grande." };
  }

  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, message: "JSON inválido." };
  }
}
