const CONFIGURATION_KEY = "oblixLeadSaverConfiguration";
const DRAFT_KEY = "oblixLeadSaverDraft";
export const DRAFT_TTL_MS = 30 * 60 * 1000;

const DEFAULT_CONFIGURATION = {
  apiBaseUrl: "https://sites.oblixhub.com",
  token: "",
  defaultCountryCode: "55",
  deviceName: "",
};

export async function getConfiguration() {
  const result = await chrome.storage.local.get(CONFIGURATION_KEY);
  return {
    ...DEFAULT_CONFIGURATION,
    ...(result[CONFIGURATION_KEY] ?? {}),
  };
}

export async function saveConfiguration(configuration) {
  const value = {
    apiBaseUrl: String(configuration.apiBaseUrl ?? "").replace(/\/+$/, ""),
    token: String(configuration.token ?? "").trim(),
    defaultCountryCode:
      String(configuration.defaultCountryCode ?? "55").replace(/\D/g, "") || "55",
    deviceName: String(configuration.deviceName ?? "").trim().slice(0, 80),
  };

  await chrome.storage.local.set({ [CONFIGURATION_KEY]: value });
  return value;
}

export async function getDraft() {
  const result = await chrome.storage.local.get(DRAFT_KEY);
  const draft = result[DRAFT_KEY] ?? null;
  if (!draft) return null;

  if (Date.now() - Number(draft.updatedAt ?? 0) > DRAFT_TTL_MS) {
    await clearDraft();
    return null;
  }

  return draft;
}

export async function saveDraft(draft) {
  const value = {
    ...draft,
    updatedAt: Date.now(),
  };
  await chrome.storage.local.set({ [DRAFT_KEY]: value });
  return value;
}

export async function clearDraft() {
  await chrome.storage.local.remove(DRAFT_KEY);
}

export function maskToken(token) {
  const value = String(token ?? "");
  if (!value) return "não configurado";
  const suffix = value.slice(-4);
  return `••••••••${suffix}`;
}
