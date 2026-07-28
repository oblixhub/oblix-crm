import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildPreviewPublicSlug,
  parsePreviewPublicSlug,
} from "../_shared/preview-public-slug.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "private, no-store",
};

const normalizeHandle = (value: string) =>
  `@${value.trim().replace(/^@+/, "").toLowerCase()}`;

const response = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return response({ error: "Método não permitido." }, 405);
  }

  try {
    const body = await request.json();
    const slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
    const action = body.action;
    const feedback =
      typeof body.feedback === "string" ? body.feedback.trim().slice(0, 1000) : "";
    if (
      !/^[a-z0-9-]{3,100}$/.test(slug) ||
      !["approve", "revision"].includes(action) ||
      (action === "revision" && !feedback)
    ) {
      return response({ error: "Solicitação inválida." }, 400);
    }
    const parsedSlug = parsePreviewPublicSlug(slug);
    if (!parsedSlug) {
      return response({ error: "Preview não encontrado." }, 404);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const { data: lead, error: findError } = await admin
      .from("leads")
      .select(
        "id, handle, notes, preview_requires_login, preview_version, preview_slug",
      )
      .eq("preview_slug", parsedSlug.previewSlug)
      .maybeSingle();
    if (findError) throw findError;
    if (
      !lead?.preview_slug ||
      buildPreviewPublicSlug(lead.preview_slug, lead.id) !== slug
    ) {
      return response({ error: "Preview não encontrado." }, 404);
    }

    if (lead.preview_requires_login) {
      const username = typeof body.username === "string" ? body.username : "";
      const password = typeof body.password === "string" ? body.password : "";
      const normalizedUsername = normalizeHandle(username);
      if (
        !username ||
        !password ||
        normalizedUsername !== normalizeHandle(password) ||
        normalizeHandle(lead.handle) !== normalizedUsername
      ) {
        return response({ error: "Acesso não autorizado." }, 401);
      }
    }

    const approved = action === "approve";
    const eventLabel = approved
      ? "Preview aprovado pelo cliente"
      : "Revisão solicitada pelo cliente";
    const historyLine = `[${new Date().toISOString()}] ${eventLabel}${
      feedback ? `. Detalhe: ${feedback}` : "."
    }`;
    const notes = [lead.notes?.trim(), historyLine].filter(Boolean).join("\n");
    const occurredAt = new Date().toISOString();

    const { error: updateError } = await admin
      .from("leads")
      .update({
        stage: approved ? "Aprovação" : "Preview",
        next_action: approved ? "Enviar chave PIX" : "Revisar ajustes solicitados",
        notes,
        updated_at: occurredAt,
      })
      .eq("id", lead.id);
    if (updateError) throw updateError;

    const { error: activityError } = await admin.from("lead_activities").insert({
      lead_id: lead.id,
      actor_id: null,
      activity_type: approved ? "approval" : "note",
      title: eventLabel,
      detail: feedback || `Versão ${lead.preview_version ?? 1}.`,
      metadata: {
        source: "public_preview",
        version: lead.preview_version ?? 1,
      },
      occurred_at: occurredAt,
    });
    if (activityError) {
      console.warn("[client-preview-action] activity insert failed", activityError.message);
    }

    return response({
      success: true,
      message: approved
        ? "Aprovação registrada. Obrigado!"
        : "Pedido de revisão registrado. Obrigado!",
    });
  } catch (error) {
    console.error(
      "[client-preview-action]",
      error instanceof Error ? error.message : String(error),
    );
    return response({ error: "Não foi possível registrar a solicitação." }, 500);
  }
});
