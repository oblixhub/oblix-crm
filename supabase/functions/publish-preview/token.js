const encoder = new TextEncoder();
const decoder = new TextDecoder();

const cache = new Map();

const normalizeTokenInput = (value) => String(value ?? "").trim();

const base64UrlEncode = (bytes) => {
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const base64UrlDecode = (value) => {
  const base64 =
    value.replace(/-/g, "+").replace(/_/g, "/") +
    "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const getSigningKey = async (secret) => {
  const normalized = normalizeTokenInput(secret);
  if (!normalized) {
    throw new Error("Chave de preview invalida.");
  }

  const existing = cache.get(normalized);
  if (existing) return existing;

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(normalized),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  cache.set(normalized, key);
  return key;
};

const normalizeVersion = (version) =>
  /^v\d+$/i.test(version) ? version.toLowerCase() : `v${version}`;

const normalizeHandle = (handle) => {
  const clean = normalizeTokenInput(handle).toLowerCase();
  return clean.replace(/^@+/, "");
};

export const createPreviewToken = async ({
  slug,
  version,
  leadId,
  expiresAt,
  secret,
  algorithm = "hmac",
}) => {
  const normalizedSlug = normalizeHandle(slug);
  if (!normalizedSlug) {
    throw new Error("Token de preview invalido: slug ausente.");
  }

  if (!/^v\d+$/i.test(version)) {
    throw new Error("Token de preview invalido: versao invalida.");
  }

  const payload = {
    a: algorithm,
    s: normalizedSlug,
    v: normalizeVersion(version),
    l: leadId ? `${leadId}` : null,
    e: Number.isFinite(expiresAt)
      ? Math.floor(expiresAt)
      : Math.floor(Date.now() / 1000 + 86400),
  };

  const payloadString = JSON.stringify(payload);
  const payloadEncoded = base64UrlEncode(encoder.encode(payloadString));
  const key = await getSigningKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payloadString));
  const signatureEncoded = base64UrlEncode(new Uint8Array(signature));
  return `${payloadEncoded}.${signatureEncoded}`;
};

export const parsePreviewToken = (token) => {
  if (typeof token !== "string") return null;
  const [payloadEncoded, signatureEncoded] = token.split(".");
  if (!payloadEncoded || !signatureEncoded) return null;

  try {
    const payloadString = decoder.decode(base64UrlDecode(payloadEncoded));
    const payload = JSON.parse(payloadString);
    if (!payload || typeof payload !== "object") return null;
    return {
      payload,
      payloadString,
      payloadEncoded,
      signatureEncoded,
    };
  } catch {
    return null;
  }
};

const timingSafeEquals = (valueA, valueB) => {
  if (!valueA || !valueB || valueA.length !== valueB.length) return false;
  let diff = 0;
  for (let index = 0; index < valueA.length; index += 1) {
    diff |= valueA.charCodeAt(index) ^ valueB.charCodeAt(index);
  }
  return diff === 0;
};

export const verifyPreviewToken = async ({
  token,
  slug,
  version,
  leadId,
  secret,
}) => {
  const parsed = parsePreviewToken(token);
  if (!parsed) {
    return { ok: false, reason: "Token mal formatado." };
  }

  const payload = parsed.payload;
  if (!payload || payload.s !== normalizeHandle(slug)) {
    return { ok: false, reason: "Token invalido para este lead." };
  }

  const normalizedVersion = normalizeVersion(version);
  if (payload.v !== normalizedVersion) {
    return { ok: false, reason: "Token invalido para esta versao." };
  }

  if (payload.e && payload.e < Math.floor(Date.now() / 1000)) {
    return { ok: false, reason: "Token expirado." };
  }

  if (leadId !== undefined && payload.l !== undefined && `${payload.l}` !== `${leadId}`) {
    return { ok: false, reason: "Token incompativel com este lead." };
  }

  const key = await getSigningKey(secret);
  const expectedSignature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(parsed.payloadString),
  );
  const expectedSignatureEncoded = base64UrlEncode(new Uint8Array(expectedSignature));

  if (!timingSafeEquals(parsed.signatureEncoded, expectedSignatureEncoded)) {
    return { ok: false, reason: "Token invalido ou adulterado." };
  }

  return {
    ok: true,
    leadId: payload.l ?? null,
    slug: payload.s,
    version: payload.v,
    expiresAt: payload.e,
  };
};

export const buildPreviewTokenConfig = ({
  ttlSeconds,
}) => {
  const safeSeconds =
    Number.isFinite(ttlSeconds) && ttlSeconds > 0 ? Math.floor(ttlSeconds) : 604800;

  return {
    expiresAt: Math.floor(Date.now() / 1000) + safeSeconds,
  };
};
