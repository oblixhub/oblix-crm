const INSTAGRAM_HOSTS = new Set([
  "instagram.com",
  "www.instagram.com",
  "m.instagram.com",
]);

const IGNORED_INSTAGRAM_PATHS = new Set([
  "accounts",
  "about",
  "challenge",
  "direct",
  "explore",
  "legal",
  "p",
  "reel",
  "reels",
  "stories",
  "tv",
]);

const WHATSAPP_HOSTS = new Set([
  "wa.me",
  "api.whatsapp.com",
  "web.whatsapp.com",
  "www.whatsapp.com",
]);

export function stripControlCharacters(value) {
  return String(value ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
}

function normalizeInstagramUsername(value) {
  const username = stripControlCharacters(value)
    .trim()
    .replace(/^@+/, "")
    .replace(/^\/+|\/+$/g, "")
    .toLowerCase();

  if (
    !username ||
    username.length > 30 ||
    username.includes("..") ||
    IGNORED_INSTAGRAM_PATHS.has(username) ||
    !/^[a-z0-9_](?:[a-z0-9._]{0,28}[a-z0-9_])?$/.test(username)
  ) {
    return null;
  }

  return username;
}

export function parseInstagram(value) {
  const input = stripControlCharacters(value).trim();
  if (!input) return null;

  let username = null;

  if (/^https?:\/\//i.test(input)) {
    let url;
    try {
      url = new URL(input);
    } catch {
      return null;
    }

    if (!INSTAGRAM_HOSTS.has(url.hostname.toLowerCase())) return null;

    const pathParts = url.pathname
      .split("/")
      .filter(Boolean)
      .map((part) => {
        try {
          return decodeURIComponent(part);
        } catch {
          return part;
        }
      });

    if (pathParts.length !== 1) return null;
    username = normalizeInstagramUsername(pathParts[0]);
  } else {
    username = normalizeInstagramUsername(input);
  }

  if (!username) return null;

  return {
    username,
    displayUsername: `@${username}`,
    url: `https://www.instagram.com/${username}/`,
  };
}

function normalizePhoneDigits(
  value,
  defaultCountryCode = "55",
  hasExplicitCountryCode = false,
) {
  let digits = String(value ?? "").replace(/\D/g, "");
  const countryCode = String(defaultCountryCode ?? "55").replace(/\D/g, "");

  if (
    !hasExplicitCountryCode &&
    (digits.length === 10 || digits.length === 11) &&
    countryCode
  ) {
    digits = `${countryCode}${digits}`;
  }

  if (!/^[1-9]\d{7,14}$/.test(digits)) return null;
  return digits;
}

export function parseWhatsApp(value, defaultCountryCode = "55") {
  const input = stripControlCharacters(value).trim();
  if (!input) return null;

  let candidate = input;
  let hasExplicitCountryCode = /^\+/.test(input);
  let decoded = input;
  try {
    decoded = decodeURIComponent(input);
  } catch {
    decoded = input;
  }

  if (/^(https?:\/\/|whatsapp:\/\/)/i.test(decoded)) {
    hasExplicitCountryCode = true;
    let url;
    try {
      url = new URL(decoded);
    } catch {
      return null;
    }

    if (url.protocol === "whatsapp:") {
      candidate = url.searchParams.get("phone") ?? "";
    } else {
      const host = url.hostname.toLowerCase();
      if (!WHATSAPP_HOSTS.has(host)) return null;

      if (host === "wa.me") {
        const firstPathPart = url.pathname.split("/").filter(Boolean)[0] ?? "";
        candidate = firstPathPart.toLowerCase() === "send"
          ? url.searchParams.get("phone") ?? ""
          : firstPathPart;
      } else {
        candidate = url.searchParams.get("phone") ?? "";
      }
    }
  }

  const number = normalizePhoneDigits(
    candidate,
    defaultCountryCode,
    hasExplicitCountryCode,
  );
  if (!number) return null;

  return {
    number,
    url: `https://wa.me/${number}`,
  };
}

function cleanLimitedString(value, maxLength) {
  const cleaned = stripControlCharacters(value).trim();
  if (cleaned.length > maxLength) return null;
  return cleaned;
}

export function validateLeadPayload(input, defaultCountryCode = "55") {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, message: "Payload inválido." };
  }

  const usernameProfile = parseInstagram(input.instagramUsername);
  const urlProfile = parseInstagram(input.instagramUrl);
  const instagram = usernameProfile ?? urlProfile;

  if (
    !instagram ||
    (usernameProfile && urlProfile && usernameProfile.username !== urlProfile.username)
  ) {
    return { ok: false, message: "Instagram inválido." };
  }

  if (input.source !== "chrome_extension") {
    return { ok: false, message: "Origem inválida." };
  }

  if (!["normal", "priority"].includes(input.priority)) {
    return { ok: false, message: "Prioridade inválida." };
  }

  if (!["unknown", "no", "yes"].includes(input.websiteStatus)) {
    return { ok: false, message: "Situação do site inválida." };
  }

  const notes = cleanLimitedString(input.notes, 1000);
  const whatsappRaw = cleanLimitedString(input.whatsappRaw, 500);
  const extensionVersion = cleanLimitedString(input.extensionVersion, 32);

  if (notes === null || whatsappRaw === null || extensionVersion === null) {
    return { ok: false, message: "Um dos campos excede o limite permitido." };
  }

  if (!extensionVersion || !/^[0-9A-Za-z._-]+$/.test(extensionVersion)) {
    return { ok: false, message: "Versão da extensão inválida." };
  }

  const whatsappCandidate =
    whatsappRaw ||
    cleanLimitedString(input.whatsappNumber, 32) ||
    cleanLimitedString(input.whatsappUrl, 500) ||
    "";
  const whatsapp = whatsappCandidate
    ? parseWhatsApp(whatsappCandidate, defaultCountryCode)
    : null;

  return {
    ok: true,
    value: {
      instagram,
      whatsappRaw,
      whatsapp,
      priority: input.priority,
      websiteStatus: input.websiteStatus,
      notes,
      extensionVersion,
      warnings: whatsappCandidate && !whatsapp ? ["whatsapp_ignored"] : [],
    },
  };
}
