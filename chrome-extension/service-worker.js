import { getConfiguration } from "./lib/storage.js";

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason !== "install") return;

  const configuration = await getConfiguration();
  if (!configuration.token) {
    await chrome.runtime.openOptionsPage();
  }
});
