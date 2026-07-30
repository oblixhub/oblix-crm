import { ApiError, saveLead } from "./lib/api-client.js";
import { parseInstagramProfile } from "./lib/instagram-parser.js";
import {
  clearDraft,
  getConfiguration,
  getDraft,
  saveDraft,
} from "./lib/storage.js";
import { parseWhatsAppContact } from "./lib/whatsapp-parser.js";

const form = document.querySelector("#lead-form");
const emptyState = document.querySelector("#empty-state");
const profileUsername = document.querySelector("#profile-username");
const profileAvatar = document.querySelector("#profile-avatar");
const whatsappInput = document.querySelector("#whatsapp");
const whatsappFeedback = document.querySelector("#whatsapp-feedback");
const notesInput = document.querySelector("#notes");
const saveButton = document.querySelector("#save-lead");
const statusBox = document.querySelector("#status");
const discardButton = document.querySelector("#discard-draft");
const optionsButton = document.querySelector("#open-options");

let configuration = null;
let activeDraft = null;
let isSubmitting = false;

function setStatus(message, tone = "") {
  statusBox.hidden = !message;
  statusBox.textContent = message;
  statusBox.className = `status${tone ? ` is-${tone}` : ""}`;
}

function initials(username) {
  return String(username ?? "")
    .replace(/^@/, "")
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "OB";
}

function setRadioValue(name, value) {
  const input = form.querySelector(`input[name="${name}"][value="${value}"]`);
  if (input) input.checked = true;
}

function renderDraft() {
  const hasProfile = Boolean(activeDraft?.instagram?.username);
  form.hidden = !hasProfile;
  emptyState.hidden = hasProfile;

  if (!hasProfile) return;

  profileUsername.textContent = activeDraft.instagram.displayUsername;
  profileAvatar.textContent = initials(activeDraft.instagram.username);
  whatsappInput.value = activeDraft.whatsappRaw ?? "";
  notesInput.value = activeDraft.notes ?? "";
  setRadioValue("priority", activeDraft.priority ?? "normal");
  setRadioValue("website", activeDraft.websiteStatus ?? "unknown");
  updateWhatsAppFeedback();
}

function updateWhatsAppFeedback() {
  const raw = whatsappInput.value.trim();
  whatsappFeedback.className = "field-feedback";

  if (!raw) {
    whatsappFeedback.textContent = "Pode ser adicionado depois.";
    return null;
  }

  const parsed = parseWhatsAppContact(raw, configuration?.defaultCountryCode);
  if (!parsed) {
    whatsappFeedback.textContent = "Número inválido — o lead será salvo sem WhatsApp.";
    whatsappFeedback.classList.add("is-invalid");
    return null;
  }

  whatsappFeedback.textContent = `Será salvo como +${parsed.number}`;
  whatsappFeedback.classList.add("is-valid");
  return parsed;
}

async function currentTabUrl() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0]?.url ?? "";
}

async function initialize() {
  configuration = await getConfiguration();
  activeDraft = await getDraft();

  const url = await currentTabUrl();
  const instagram = parseInstagramProfile(url);
  const whatsapp = parseWhatsAppContact(url, configuration.defaultCountryCode);

  if (instagram) {
    const sameProfile =
      activeDraft?.instagram?.username === instagram.username;
    activeDraft = await saveDraft({
      instagram,
      whatsappRaw: sameProfile ? activeDraft.whatsappRaw ?? "" : "",
      priority: sameProfile ? activeDraft.priority ?? "normal" : "normal",
      websiteStatus: sameProfile
        ? activeDraft.websiteStatus ?? "unknown"
        : "unknown",
      notes: sameProfile ? activeDraft.notes ?? "" : "",
    });
  } else if (whatsapp && activeDraft?.instagram) {
    activeDraft = await saveDraft({
      ...activeDraft,
      whatsappRaw: whatsapp.url,
    });
    setStatus("WhatsApp detectado e adicionado ao rascunho.", "success");
  }

  renderDraft();

  if (!configuration.token && activeDraft?.instagram) {
    setStatus("Configure seu token pessoal antes de salvar.", "error");
  }
}

async function persistVisibleDraft() {
  if (!activeDraft?.instagram) return;
  activeDraft = await saveDraft({
    ...activeDraft,
    whatsappRaw: whatsappInput.value.trim(),
    priority: form.elements.priority.value,
    websiteStatus: form.elements.website.value,
    notes: notesInput.value.trim(),
  });
}

async function submitLead(event) {
  event.preventDefault();
  if (isSubmitting || !activeDraft?.instagram) return;

  if (!configuration?.token) {
    setStatus("Token inválido ou não configurado.", "error");
    return;
  }

  await persistVisibleDraft();
  const whatsapp = updateWhatsAppFeedback();

  isSubmitting = true;
  saveButton.disabled = true;
  saveButton.querySelector("span").textContent = "Salvando…";
  setStatus("");

  try {
    const response = await saveLead(configuration, {
      instagramUsername: activeDraft.instagram.username,
      instagramUrl: activeDraft.instagram.url,
      whatsappRaw: whatsapp ? activeDraft.whatsappRaw : "",
      whatsappNumber: whatsapp?.number ?? "",
      whatsappUrl: whatsapp?.url ?? "",
      priority: activeDraft.priority,
      websiteStatus: activeDraft.websiteStatus,
      notes: activeDraft.notes,
      source: "chrome_extension",
      extensionVersion: chrome.runtime.getManifest().version,
    });

    await clearDraft();
    activeDraft = null;
    setStatus(response.message || "Lead salvo com sucesso.", "success");
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      setStatus("Este perfil já está cadastrado.", "error");
    } else if (error instanceof ApiError && error.status === 401) {
      setStatus("Token inválido.", "error");
    } else {
      setStatus(error.message || "Não foi possível acessar o CRM.", "error");
    }
  } finally {
    isSubmitting = false;
    saveButton.disabled = false;
    saveButton.querySelector("span").textContent = "Salvar no CRM";
  }
}

whatsappInput.addEventListener("input", async () => {
  updateWhatsAppFeedback();
  await persistVisibleDraft();
});

notesInput.addEventListener("input", persistVisibleDraft);
form.addEventListener("change", persistVisibleDraft);
form.addEventListener("submit", submitLead);
form.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

discardButton.addEventListener("click", async () => {
  await clearDraft();
  activeDraft = null;
  setStatus("");
  renderDraft();
});

optionsButton.addEventListener("click", () => chrome.runtime.openOptionsPage());

initialize().catch(() => {
  form.hidden = true;
  emptyState.hidden = false;
  setStatus("Não foi possível iniciar a extensão.", "error");
});
