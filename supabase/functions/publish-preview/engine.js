/**
 * @typedef {{ path: string; bytes: Uint8Array }} RawEntry
 */

const ENTRIES_LIMIT = 420;
const TOTAL_UNCOMPRESSED_BYTES_LIMIT = 60 * 1024 * 1024;
const FILE_SIZE_LIMIT = 16 * 1024 * 1024;
const MAX_PATH_DEPTH = 24;
const MAX_PATH_LENGTH = 3200;
const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

const INDEX_BY_MIME = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".dc.html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".cjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".eot": "application/vnd.ms-fontobject",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".pdf": "application/pdf",
  ".wasm": "application/wasm",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".lottie": "application/json",
};

export const HTML_EXTENSIONS = [".html", ".htm", ".dc.html"];

export const isKnownSystemPath = (path) =>
  path.startsWith("__MACOSX/") ||
  path.endsWith("/.DS_Store") ||
  path === ".DS_Store" ||
  path.endsWith("/.Thumbs.db") ||
  path === "Thumbs.db";

const hasInvalidSegment = (segment) =>
  !segment ||
  segment === "." ||
  segment === ".." ||
  segment.includes("\\") ||
  /[<>:"|?*\x00-\x1f]/.test(segment);

export const decodeAndValidatePath = (rawPath) => {
  if (!rawPath) return { ok: false, error: "Caminho vazio." };
  if (rawPath.length > MAX_PATH_LENGTH) {
    return { ok: false, error: "Caminho excessivamente longo." };
  }
  if (rawPath.includes("\\")) {
    return { ok: false, error: "Caminho com barra invertida." };
  }

  // Evita bypass de traversal via percent-encoding.
  if (/%2f|%5c|%2e|%3a/i.test(rawPath)) {
    return { ok: false, error: "Caminho com codificacao nao permitida." };
  }

  if (rawPath.includes("\0")) {
    return { ok: false, error: "Nome invalido no ZIP." };
  }

  if (rawPath.startsWith("/") || rawPath.startsWith("~") || rawPath.includes(":")) {
    return { ok: false, error: "Caminho absoluto ou invalido." };
  }

  let decoded = rawPath;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    return { ok: false, error: "Codificacao invalida no caminho." };
  }

  if (decoded.includes("\\")) {
    return { ok: false, error: "Caminho com barra invertida." };
  }

  const normalized = decoded
    .replace(/\/{2,}/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");

  if (!normalized || normalized === ".") {
    return { ok: false, error: "Entrada invalida do ZIP." };
  }

  const parts = normalized.split("/");
  if (parts.length - 1 > MAX_PATH_DEPTH) {
    return { ok: false, error: "Estrutura de diretorios muito profunda." };
  }

  if (parts.some(hasInvalidSegment)) {
    return { ok: false, error: "Caminho invalido no ZIP." };
  }

  if (parts.some((part) => /[:*?<>|]/.test(part))) {
    return { ok: false, error: "Caracteres invalidos no caminho." };
  }

  return { ok: true, path: normalized, parts };
};

export const isHtmlFile = (path) =>
  HTML_EXTENSIONS.some((ext) => path.toLowerCase().endsWith(ext));

const isCssFile = (path) => path.toLowerCase().endsWith(".css");
const isJavaScriptFile = (path) =>
  [".js", ".mjs", ".cjs"].some((extension) =>
    path.toLowerCase().endsWith(extension),
  );

export const contentTypeFor = (path) => {
  const lower = path.toLowerCase();
  const known = Object.keys(INDEX_BY_MIME).find((ext) => lower.endsWith(ext));
  return known ? INDEX_BY_MIME[known] : "application/octet-stream";
};

export const encodePathForStorage = (path) =>
  path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

export const stripSingleOuterFolder = (entries) => {
  if (!entries.length) return { entries, removedOuterFolder: null };

  const topLevelParts = new Set(
    entries.map((entry) => entry.path.split("/").filter(Boolean)[0]).filter(Boolean),
  );
  if (topLevelParts.size !== 1) return { entries, removedOuterFolder: null };

  const folder = [...topLevelParts][0];
  if (!folder) return { entries, removedOuterFolder: null };

  const hasRootFiles = entries.some((entry) => !entry.path.includes("/"));
  if (hasRootFiles) return { entries, removedOuterFolder: null };

  const prefix = `${folder}/`;
  return {
    removedOuterFolder: folder,
    entries: entries.map((entry) => ({
      ...entry,
      path: entry.path.startsWith(prefix) ? entry.path.slice(prefix.length) : entry.path,
    })),
  };
};

const relativeRootFor = (path) => {
  const depth = Math.max(0, path.split("/").length - 1);
  return depth === 0 ? "./" : "../".repeat(depth);
};

const rewriteLocalReference = (
  rawValue,
  { rootPrefix, removedOuterFolder = null },
) => {
  if (typeof rawValue !== "string" || !rawValue) return rawValue;

  const value = rawValue.trim();
  if (
    !value ||
    value.startsWith("#") ||
    value.startsWith("//") ||
    value.startsWith("{{") ||
    /^(?:[a-z][a-z0-9+.-]*:|data:)/i.test(value)
  ) {
    return rawValue;
  }

  const outerPrefix = removedOuterFolder
    ? `${removedOuterFolder.replace(/\/+$/, "")}/`
    : null;
  let normalized = value;
  let shouldAnchorToRoot = false;

  if (normalized.startsWith("/")) {
    normalized = normalized.replace(/^\/+/, "");
    shouldAnchorToRoot = true;
  }

  if (outerPrefix) {
    if (normalized.startsWith(`./${outerPrefix}`)) {
      normalized = normalized.slice(outerPrefix.length + 2);
      shouldAnchorToRoot = true;
    } else if (normalized.startsWith(outerPrefix)) {
      normalized = normalized.slice(outerPrefix.length);
      shouldAnchorToRoot = true;
    }
  }

  if (!shouldAnchorToRoot) return rawValue;
  return `${rootPrefix}${normalized}`;
};

const rewriteHtml = (source, context) => {
  let rewritten = source.replace(
    /(\b(?:src|href|action|poster|data-src|data-href)\s*=\s*)(["'])([^"']*)\2/gi,
    (match, attribute, quote, value) => {
      const next = rewriteLocalReference(value, context);
      return next === value
        ? match
        : `${attribute}${quote}${next}${quote}`;
    },
  );

  rewritten = rewritten.replace(
    /(\bsrcset\s*=\s*)(["'])([^"']*)\2/gi,
    (match, attribute, quote, value) => {
      const next = value
        .split(",")
        .map((candidate) => {
          const trimmed = candidate.trim();
          if (!trimmed) return candidate;
          const [url, ...descriptor] = trimmed.split(/\s+/);
          const rewrittenUrl = rewriteLocalReference(url, context);
          return [rewrittenUrl, ...descriptor].join(" ");
        })
        .join(", ");
      return next === value
        ? match
        : `${attribute}${quote}${next}${quote}`;
    },
  );

  return rewriteJavaScript(rewriteCss(rewritten, context), context);
};

const rewriteCss = (source, context) =>
  source
    .replace(
      /url\(\s*(["']?)([^)"']+)\1\s*\)/gi,
      (match, quote, value) => {
        const next = rewriteLocalReference(value, context);
        return next === value ? match : `url(${quote}${next}${quote})`;
      },
    )
    .replace(
      /(@import\s+)(["'])([^"']+)\2/gi,
      (match, prefix, quote, value) => {
        const next = rewriteLocalReference(value, context);
        return next === value
          ? match
          : `${prefix}${quote}${next}${quote}`;
      },
    );

const rewriteJavaScript = (source, context) => {
  const rewriteCall = (
    match,
    prefix,
    quote,
    value,
    suffix = "",
  ) => {
    const next = rewriteLocalReference(value, context);
    return next === value
      ? match
      : `${prefix}${quote}${next}${quote}${suffix}`;
  };

  return source
    .replace(
      /(\b(?:fetch|importScripts|import)\(\s*)(["'])([^"']+)\2(\s*\))/g,
      rewriteCall,
    )
    .replace(
      /(\b(?:from|import)\s+)(["'])([^"']+)\2/g,
      (match, prefix, quote, value) =>
        rewriteCall(match, prefix, quote, value),
    )
    .replace(
      /(["'])(\/(?:assets|images|img|css|js|fonts|uploads|_ds)\/[^"']*)\1/g,
      (match, quote, value) => {
        const next = rewriteLocalReference(value, context);
        return next === value ? match : `${quote}${next}${quote}`;
      },
    );
};

export const rewritePreviewEntries = ({
  entries,
  removedOuterFolder = null,
}) => {
  let rewrittenFiles = 0;
  const rewrittenEntries = entries.map((entry) => {
    if (
      !isHtmlFile(entry.path) &&
      !isCssFile(entry.path) &&
      !isJavaScriptFile(entry.path)
    ) {
      return entry;
    }

    const source = textDecoder.decode(entry.bytes);
    const context = {
      rootPrefix: relativeRootFor(entry.path),
      removedOuterFolder,
    };
    const rewritten = isHtmlFile(entry.path)
      ? rewriteHtml(source, context)
      : isCssFile(entry.path)
        ? rewriteCss(source, context)
        : rewriteJavaScript(source, context);

    if (rewritten === source) return entry;
    rewrittenFiles += 1;
    const bytes = textEncoder.encode(rewritten);
    return {
      ...entry,
      bytes,
      size: bytes.byteLength,
    };
  });

  return {
    entries: rewrittenEntries,
    rewrittenFiles,
  };
};

export const chooseEntrypoint = (entries) => {
  const htmlEntries = entries.filter((entry) => isHtmlFile(entry.path));
  if (!htmlEntries.length) {
    return { error: "O ZIP nao possui HTML principal." };
  }

  const rootEntries = htmlEntries.filter((entry) => !entry.path.includes("/"));
  const rootIndex = rootEntries.find((entry) => /^(index\.(html|htm))$/i.test(entry.path));
  if (rootIndex) return { entrypoint: rootIndex };

  if (rootEntries.length === 1) return { entrypoint: rootEntries[0] };

  if (rootEntries.length > 1) {
    return {
      error:
        "Nao foi possivel identificar a pagina inicial. Foram encontrados varios arquivos HTML na raiz.",
      candidates: rootEntries.map((entry) => entry.path),
    };
  }

  const topDirs = [...new Set(htmlEntries.map((entry) => entry.path.split("/")[0]))];
  const folderIndexEntries = htmlEntries.filter((entry) => {
    const file = entry.path.split("/").at(-1);
    return file && /^(index\.(html|htm))$/i.test(file);
  });

  if (folderIndexEntries.length === 1 && topDirs.length === 1) {
    return { entrypoint: folderIndexEntries[0] };
  }

  if (topDirs.length === 1) {
    const folderFiles = htmlEntries.filter((entry) => entry.path.startsWith(`${topDirs[0]}/`));
    if (folderFiles.length === 1) return { entrypoint: folderFiles[0] };
  }

  return {
    error: "Nao foi possivel identificar o HTML principal. Foram encontrados varios arquivos HTML.",
    candidates: htmlEntries.map((entry) => entry.path),
  };
};

export const parseZipEntries = ({ zipEntries }) => {
  const entries = [];
  const normalizedPaths = new Set();
  let totalBytes = 0;

  for (const [rawPath, bytes] of Object.entries(zipEntries)) {
    if (!bytes || !(bytes instanceof Uint8Array)) continue;
    // Mantem arquivos vazios: podem existir e precisam ser preservados em alguns builds.

    if (isKnownSystemPath(rawPath)) continue;
    if (rawPath.endsWith("/")) continue;

    const normalized = decodeAndValidatePath(rawPath);
    if (!normalized.ok) {
      return { error: normalized.error, path: rawPath };
    }

    const safePath = normalized.path;
    if (safePath === ".DS_Store") continue;
    if (normalizedPaths.has(safePath.toLowerCase())) {
      return { error: `O ZIP possui caminhos duplicados: ${safePath}` };
    }
    normalizedPaths.add(safePath.toLowerCase());

    if (bytes.byteLength > FILE_SIZE_LIMIT) {
      return { error: `Arquivo muito grande: ${safePath}` };
    }

    entries.push({
      path: safePath,
      bytes,
      size: bytes.byteLength,
    });

    totalBytes += bytes.byteLength;
    if (entries.length > ENTRIES_LIMIT) {
      return { error: "ZIP com quantidade de arquivos acima do limite." };
    }
    if (totalBytes > TOTAL_UNCOMPRESSED_BYTES_LIMIT) {
      return { error: "ZIP com tamanho apos descompressao acima do limite." };
    }
  }

  if (!entries.length) return { error: "O ZIP nao possui arquivos de site para publicar." };

  const stripped = stripSingleOuterFolder(entries);
  const rewritten = rewritePreviewEntries({
    entries: stripped.entries,
    removedOuterFolder: stripped.removedOuterFolder,
  });
  const entrypointSelection = chooseEntrypoint(rewritten.entries);

  if (entrypointSelection.error) {
    return {
      error: entrypointSelection.error,
      candidates: entrypointSelection.candidates,
    };
  }

  return {
    entries: rewritten.entries,
    entrypoint: entrypointSelection.entrypoint,
    totalBytes,
    removedOuterFolder: stripped.removedOuterFolder ?? null,
    rewrittenFiles: rewritten.rewrittenFiles,
  };
};

export const buildPreviewManifest = ({
  previewSlug,
  version,
  leadId,
  entrypoint,
  entries,
  removedOuterFolder = null,
}) => ({
  version,
  leadId,
  previewSlug,
  createdAt: new Date().toISOString(),
  removedOuterFolder,
  entrypoint: {
    path: entrypoint.path,
  },
  files: entries.map((entry) => ({
    path: entry.path,
    originalPath: entry.path,
    mime: contentTypeFor(entry.path),
    size: entry.bytes.byteLength,
    hash: null,
    isEntrypoint: entry.path === entrypoint.path,
  })),
});
