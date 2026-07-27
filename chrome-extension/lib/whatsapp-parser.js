const ALLOWED_HOSTS = new Set([
  "wa.me",
  "api.whatsapp.com",
  "web.whatsapp.com",
  "www.whatsapp.com",
]);

function normalizeDigits(
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

  return /^[1-9]\d{7,14}$/.test(digits) ? digits : null;
}

export function parseWhatsAppContact(value, defaultCountryCode = "55") {
  const input = String(value ?? "").trim();
  if (!input) return null;
  let hasExplicitCountryCode = /^\+/.test(input);

  let decoded = input;
  try {
    decoded = decodeURIComponent(input);
  } catch {
    decoded = input;
  }

  let candidate = decoded;
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
      if (!ALLOWED_HOSTS.has(host)) return null;

      if (host === "wa.me") {
        const pathPart = url.pathname.split("/").filter(Boolean)[0] ?? "";
        candidate = pathPart.toLowerCase() === "send"
          ? url.searchParams.get("phone") ?? ""
          : pathPart;
      } else {
        candidate = url.searchParams.get("phone") ?? "";
      }
    }
  }

  const number = normalizeDigits(
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
