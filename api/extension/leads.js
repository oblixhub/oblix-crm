import { resolveOperator } from "./lib/auth.js";
import { jsonResponse, optionsResponse, readJsonBody } from "./lib/http.js";
import { validateLeadPayload } from "./lib/normalizers.js";
import { createLeadRepository } from "./lib/repository.js";

const DEFAULT_HOURLY_LIMIT = 120;

function numericLimit(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.min(parsed, 1_000)
    : DEFAULT_HOURLY_LIMIT;
}

function siteStatusLabel(status) {
  return {
    unknown: "Não verificado",
    no: "Sem site",
    yes: "Tem site",
  }[status];
}

function priorityLabel(priority) {
  return priority === "priority" ? "Alta" : "Normal";
}

export function createLeadHandler({
  env = process.env,
  repositoryFactory = createLeadRepository,
  now = () => new Date(),
} = {}) {
  return async function leadHandler(request) {
    const operator = resolveOperator(request, env);
    if (!operator) {
      return jsonResponse(401, { ok: false, message: "Token inválido." });
    }

    const parsedBody = await readJsonBody(request);
    if (!parsedBody.ok) {
      return jsonResponse(400, { ok: false, message: parsedBody.message });
    }

    const validated = validateLeadPayload(
      parsedBody.value,
      env.OBLIX_EXTENSION_DEFAULT_COUNTRY ?? "55",
    );
    if (!validated.ok) {
      return jsonResponse(400, { ok: false, message: validated.message });
    }

    let repository;
    try {
      repository = repositoryFactory(env);
      const existing = await repository.findByUsername(
        validated.value.instagram.username,
      );

      if (existing) {
        return jsonResponse(409, {
          ok: false,
          message: "Este perfil já está cadastrado.",
          leadId: existing.id,
        });
      }

      const capturedAt = now();
      const since = new Date(capturedAt.getTime() - 60 * 60 * 1000);
      const recentCaptureCount = await repository.countRecentCaptures(
        operator.name,
        since.toISOString(),
      );

      if (recentCaptureCount >= numericLimit(env.OBLIX_EXTENSION_RATE_LIMIT_HOURLY)) {
        return jsonResponse(
          429,
          {
            ok: false,
            message: "Limite temporário excedido. Tente novamente mais tarde.",
          },
          { "Retry-After": "3600" },
        );
      }

      const batchId = await repository.getExtensionBatchId();
      const whatsapp = validated.value.whatsapp;
      const priority = priorityLabel(validated.value.priority);
      const created = await repository.createLead({
        handle: `@${validated.value.instagram.username}`,
        profile_url: validated.value.instagram.url,
        stage: "Contatar",
        validation_status: "valid",
        is_validated: true,
        validated_at: capturedAt.toISOString(),
        priority,
        priority_marked: priority !== "Normal",
        next_action: "Enviar primeira mensagem",
        site_status: siteStatusLabel(validated.value.websiteStatus),
        qualification_status: "pending",
        source_name: "Extensão Chrome",
        source_type: "chrome_extension",
        batch_id: batchId,
        owner: operator.crmOwner,
        notes: validated.value.notes || null,
        whatsapp_raw: validated.value.whatsappRaw || null,
        whatsapp_number: whatsapp?.number ?? null,
        whatsapp_url: whatsapp?.url ?? null,
        has_whatsapp: Boolean(whatsapp),
        has_instagram: true,
        captured_by: operator.name,
        captured_at: capturedAt.toISOString(),
        extension_version: validated.value.extensionVersion,
      });

      return jsonResponse(201, {
        ok: true,
        message: "Lead salvo com sucesso.",
        leadId: created.id,
        warnings: validated.value.warnings,
      });
    } catch (error) {
      if (error?.code === "23505") {
        let existing = null;
        try {
          existing = await repository?.findByUsername(
            validated.value.instagram.username,
          );
        } catch {
          existing = null;
        }

        return jsonResponse(409, {
          ok: false,
          message: "Este perfil já está cadastrado.",
          ...(existing?.id ? { leadId: existing.id } : {}),
        });
      }

      console.error("OBLIX extension lead capture failed", {
        code: error?.code ?? "UNKNOWN",
      });
      return jsonResponse(500, {
        ok: false,
        message: "Não foi possível salvar o lead agora.",
      });
    }
  };
}

export const POST = createLeadHandler();
export const OPTIONS = async () => optionsResponse();
