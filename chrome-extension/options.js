import { ApiError, testConnection } from "./lib/api-client.js";
import {
  getConfiguration,
  maskToken,
  saveConfiguration,
} from "./lib/storage.js";

const form = document.querySelector("#options-form");
const apiBaseUrlInput = document.querySelector("#api-base-url");
const tokenInput = document.querySelector("#token");
const tokenState = document.querySelector("#token-state");
const countryCodeInput = document.querySelector("#country-code");
const deviceNameInput = document.querySelector("#device-name");
const testButton = document.querySelector("#test-connection");
const statusBox = document.querySelector("#status");

let savedConfiguration = null;

function setStatus(message, tone = "") {
  statusBox.hidden = !message;
  statusBox.textContent = message;
  statusBox.className = `status${tone ? ` is-${tone}` : ""}`;
}

function configurationFromForm() {
  return {
    apiBaseUrl: apiBaseUrlInput.value.trim().replace(/\/+$/, ""),
    token: tokenInput.value.trim() || savedConfiguration?.token || "",
    defaultCountryCode: countryCodeInput.value.replace(/\D/g, "") || "55",
    deviceName: deviceNameInput.value.trim(),
  };
}

function validateApiUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.protocol === "https:") return true;
  return (
    url.protocol === "http:" &&
    ["localhost", "127.0.0.1"].includes(url.hostname)
  );
}

async function initialize() {
  savedConfiguration = await getConfiguration();
  apiBaseUrlInput.value = savedConfiguration.apiBaseUrl;
  countryCodeInput.value = savedConfiguration.defaultCountryCode;
  deviceNameInput.value = savedConfiguration.deviceName;
  tokenState.textContent = `Token configurado: ${maskToken(savedConfiguration.token)}`;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const configuration = configurationFromForm();

  if (!validateApiUrl(configuration.apiBaseUrl)) {
    setStatus("Informe uma URL HTTPS válida ou um endereço local.", "error");
    return;
  }

  if (!configuration.token) {
    setStatus("Informe seu token pessoal.", "error");
    return;
  }

  savedConfiguration = await saveConfiguration(configuration);
  tokenInput.value = "";
  tokenState.textContent = `Token configurado: ${maskToken(savedConfiguration.token)}`;
  setStatus("Configurações salvas neste navegador.", "success");
});

testButton.addEventListener("click", async () => {
  const configuration = configurationFromForm();
  if (!validateApiUrl(configuration.apiBaseUrl) || !configuration.token) {
    setStatus("Preencha a URL e o token antes de testar.", "error");
    return;
  }

  testButton.disabled = true;
  testButton.textContent = "Testando…";
  setStatus("");

  try {
    const response = await testConnection(configuration);
    setStatus(`Conexão confirmada para ${response.operator}.`, "success");
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      setStatus("Token inválido.", "error");
    } else {
      setStatus(error.message || "Não foi possível acessar o CRM.", "error");
    }
  } finally {
    testButton.disabled = false;
    testButton.textContent = "Testar conexão";
  }
});

initialize().catch(() => {
  setStatus("Não foi possível carregar as configurações.", "error");
});
