const INSTAGRAM_HOSTS = new Set([
  "instagram.com",
  "www.instagram.com",
  "m.instagram.com",
]);

const IGNORED_PATHS = new Set([
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

function normalizeUsername(value) {
  const username = String(value ?? "")
    .trim()
    .replace(/^@+/, "")
    .replace(/^\/+|\/+$/g, "")
    .toLowerCase();

  if (
    !username ||
    username.length > 30 ||
    username.includes("..") ||
    IGNORED_PATHS.has(username) ||
    !/^[a-z0-9_](?:[a-z0-9._]{0,28}[a-z0-9_])?$/.test(username)
  ) {
    return null;
  }

  return username;
}

export function parseInstagramProfile(value) {
  const input = String(value ?? "").trim();
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
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length !== 1) return null;

    try {
      username = normalizeUsername(decodeURIComponent(parts[0]));
    } catch {
      username = normalizeUsername(parts[0]);
    }
  } else {
    username = normalizeUsername(input);
  }

  if (!username) return null;
  return {
    username,
    displayUsername: `@${username}`,
    url: `https://www.instagram.com/${username}/`,
  };
}
