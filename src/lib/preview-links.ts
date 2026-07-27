export interface PreviewUrlDecision {
  url: string | null;
  valid: boolean;
  source: "siteUrl" | "publicUrl" | null;
  message: string | null;
}

type PreviewSource = {
  requiresLogin?: boolean;
  slug?: string;
  siteUrl?: string;
  publicUrl?: string;
};

const cleanOrigin = (value: string) => value.trim().replace(/\/$/, "");
const isPreviewContentPath = (pathname: string) => {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] !== "preview-content") return false;

  const versionIndex = segments.findIndex(
    (segment, index) => index >= 2 && /^v\d+$/i.test(segment),
  );
  return versionIndex === 2 || versionIndex === 3;
};

const normalizePreviewSource = (rawValue: string) => {
  const trimmed = rawValue.trim();
  if (!trimmed) return null;

  const fallbackOrigin =
    (typeof window !== "undefined" && window.location.origin) || "https://localhost";
  const parsed = new URL(trimmed, fallbackOrigin);
  if (!isPreviewContentPath(parsed.pathname)) return null;

  const versionIndex = parsed.pathname
    .split("/")
    .filter(Boolean)
    .findIndex((segment, index) => index >= 2 && /^v\d+$/i.test(segment));
  const hasExtraAfterVersion = parsed.pathname
    .split("/")
    .filter(Boolean)
    .length > versionIndex + 1;

  const normalizedPath = hasExtraAfterVersion || parsed.pathname.endsWith("/")
    ? parsed.pathname
    : `${parsed.pathname.replace(/\/+$/, "")}/`;

  return `${normalizedPath}${parsed.search}${parsed.hash}`;
};

const normalizePreviewPortal = (rawValue: string) => {
  const trimmed = rawValue.trim();
  if (!trimmed) return null;

  const fallbackOrigin =
    (typeof window !== "undefined" && window.location.origin) || "https://localhost";
  const parsed = new URL(trimmed, fallbackOrigin);
  if (!parsed.pathname.startsWith("/preview/")) return null;

  const normalizedPath = parsed.pathname.endsWith("/")
    ? parsed.pathname
    : `${parsed.pathname.replace(/\/+$/, "")}/`;

  return `${normalizedPath}${parsed.search}${parsed.hash}`;
};

export const resolveLeadPreviewSource = (
  lead: PreviewSource | undefined,
  options: { forClient?: boolean } = {},
) => {
  const { forClient = false } = options;

  if (forClient && lead?.requiresLogin) {
    const portal = normalizePreviewPortal(lead?.publicUrl ?? "");
    if (portal) {
      return {
        url: portal,
        source: "publicUrl" as const,
        valid: true,
        message: null,
      };
    }

    if (lead.slug) {
      return {
        url: `/preview/${encodeURIComponent(lead.slug)}/`,
        source: "publicUrl" as const,
        valid: true,
        message: null,
      };
    }
  }

  const site = normalizePreviewSource(lead?.siteUrl ?? "");
  if (site) {
    return {
      url: site,
      source: "siteUrl" as const,
      valid: true,
      message: null,
    };
  }

  const publicUrl = normalizePreviewSource(lead?.publicUrl ?? "");
  if (publicUrl) {
    return {
      url: publicUrl,
      source: "publicUrl" as const,
      valid: true,
      message: null,
    };
  }

  return {
    url: null,
    source: null,
    valid: false,
    message:
      "Este lead ainda usa a URL antiga de preview. Republique o ZIP para gerar a URL protegida.",
  };
};

export const getPreviewPublicAppOrigin = () => {
  const configured =
    (import.meta.env.VITE_PUBLIC_APP_URL ?? "").trim() ||
    (import.meta.env.VITE_APP_URL ?? "").trim();
  if (configured) return cleanOrigin(configured);

  return typeof window !== "undefined" ? cleanOrigin(window.location.origin) : "";
};

export const getPublicAppUrl = getPreviewPublicAppOrigin;
