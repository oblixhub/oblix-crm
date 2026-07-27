import { ArrowLeft, BadgeCheck, Eye, EyeOff, LoaderCircle, MessageSquareText } from "lucide-react";
import { type FormEvent, useState } from "react";
import { supabaseUrl } from "../lib/supabase";
import { getPublicAppUrl, resolveLeadPreviewSource } from "../lib/preview-links";
import { Brand } from "./Brand";

type PreviewSession = {
  handle: string;
  password: string;
  siteUrl: string;
  version: number;
};

const normalizeHandle = (value: string) =>
  `@${value.trim().replace(/^@+/, "").toLowerCase()}`;

export const getPublicPreviewSlug = (pathname: string) => {
  const match = pathname.match(/^\/preview\/([a-z0-9-]+)\/?$/i);
  return match ? decodeURIComponent(match[1]).toLowerCase() : null;
};

export function PublicPreviewPortal({ slug }: { slug: string }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [session, setSession] = useState<PreviewSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [revision, setRevision] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [sendingAction, setSendingAction] = useState(false);

  const login = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabaseUrl) {
      setError("O preview está indisponível no momento.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/client-preview-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, username, password }),
      });
      const data = (await response.json()) as {
        error?: string;
        handle?: string;
        siteUrl?: string;
        version?: number;
      };
      if (!response.ok || !data.handle || !data.siteUrl) {
        throw new Error(data.error ?? "Não foi possível abrir este preview.");
      }

      const resolvedSite = resolveLeadPreviewSource({
        siteUrl: data.siteUrl,
      });

      if (!resolvedSite.url) {
        throw new Error(
          resolvedSite.message ??
            "Esta prévia está em formato antigo e precisa ser republicada.",
        );
      }

      setSession({
        handle: data.handle,
        password: normalizeHandle(password),
        siteUrl: resolvedSite.url,
        version: data.version ?? 1,
      });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível abrir este preview.",
      );
    } finally {
      setLoading(false);
    }
  };

  const submitAction = async (action: "approve" | "revision") => {
    if (!session || !supabaseUrl) return;
    if (action === "revision" && !revision.trim()) {
      setNotice("Conte o que você gostaria de ajustar antes de enviar.");
      return;
    }
    setSendingAction(true);
    setNotice(null);
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/client-preview-action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle: session.handle,
          password: session.password,
          action,
          feedback: action === "revision" ? revision.trim() : "",
        }),
      });
      const data = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Não foi possível registrar sua resposta.");
      }
      setNotice(data.message ?? "Resposta registrada. Obrigado!");
      if (action === "revision") {
        setRevision("");
        setRevisionOpen(false);
      }
    } catch (requestError) {
      setNotice(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível registrar sua resposta.",
      );
    } finally {
      setSendingAction(false);
    }
  };

  if (session) {
    return (
      <main className="public-preview-page public-preview-page--open">
        <iframe
          className="public-preview-frame"
          src={session.siteUrl}
          title={`Preview de ${session.handle}`}
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-forms allow-popups allow-top-navigation-by-user-activation allow-downloads"
        />
        <aside className="public-preview-review" aria-label="Avaliação do preview">
          <span>O que achou do seu site?</span>
          {revisionOpen && (
            <label>
              <span>O que gostaria de ajustar?</span>
              <textarea
                value={revision}
                onChange={(event) => setRevision(event.target.value)}
                placeholder="Ex.: trocar uma foto, corrigir um texto..."
                maxLength={1000}
              />
            </label>
          )}
          <div className="public-preview-actions">
            <button
              type="button"
              className="public-preview-revision"
              disabled={sendingAction}
              onClick={() => {
                if (revisionOpen) {
                  void submitAction("revision");
                } else {
                  setRevisionOpen(true);
                }
              }}
            >
              <MessageSquareText size={18} />
              {revisionOpen ? "Enviar revisão" : "Pedir revisão"}
            </button>
            <button
              type="button"
              className="public-preview-approve"
              disabled={sendingAction}
              onClick={() => void submitAction("approve")}
            >
              {sendingAction ? (
                <LoaderCircle className="spin" size={18} />
              ) : (
                <BadgeCheck size={19} />
              )}
              Aprovar site
            </button>
          </div>
          {notice && <p className="public-preview-notice">{notice}</p>}
        </aside>
      </main>
    );
  }

  const backUrl = `${getPublicAppUrl() || ""}/crm`;

  return (
    <main className="public-preview-page">
      <a className="public-preview-back" href={backUrl} aria-label="Voltar">
        <ArrowLeft size={17} />
        OBLIX
      </a>
      <form className="public-preview-login" onSubmit={(event) => void login(event)}>
        <Brand compact />
        <h1>Seu preview está pronto.</h1>
        <p>Use o seu @ do Instagram como usuário e senha para visualizar o site.</p>
        <label className="field">
          <span>Usuário</span>
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="@seuperfil"
            autoComplete="username"
            required
          />
        </label>
        <label className="field">
          <span>Senha</span>
          <div className="password-field">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="@seuperfil"
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="password-toggle"
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              onClick={() => setShowPassword((visible) => !visible)}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </label>
        {error && <div className="auth-error">{error}</div>}
        <button className="button button--primary public-preview-submit" disabled={loading}>
          {loading ? <LoaderCircle className="spin" size={18} /> : null}
          {loading ? "Abrindo preview..." : "Visualizar meu site"}
        </button>
      </form>
    </main>
  );
}
