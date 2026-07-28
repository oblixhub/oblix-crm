import {
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  Eye,
  EyeOff,
  LoaderCircle,
  MessageSquareText,
} from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { supabaseUrl } from "../lib/supabase";
import { getPublicAppUrl, resolveLeadPreviewSource } from "../lib/preview-links";
import { Brand } from "./Brand";

type PreviewSession = {
  handle: string;
  username: string;
  password: string;
  siteUrl: string;
  version: number;
  requiresLogin: boolean;
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
  const [loading, setLoading] = useState(true);
  const [loginRequired, setLoginRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [revision, setRevision] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [sendingAction, setSendingAction] = useState(false);
  const [approved, setApproved] = useState(false);

  const openPreview = async (credentials?: {
    username: string;
    password: string;
  }) => {
    if (!supabaseUrl) {
      setError("O preview está indisponível no momento.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/client-preview-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, ...credentials }),
      });
      const data = (await response.json()) as {
        error?: string;
        handle?: string;
        siteUrl?: string;
        version?: number;
        requiresLogin?: boolean;
      };

      if (response.status === 401 && !credentials && data.requiresLogin) {
        setLoginRequired(true);
        return;
      }
      if (!response.ok || !data.handle || !data.siteUrl) {
        throw new Error(data.error ?? "Não foi possível abrir este preview.");
      }

      const resolvedSite = resolveLeadPreviewSource({ siteUrl: data.siteUrl });
      if (!resolvedSite.url) {
        throw new Error(
          resolvedSite.message ??
            "Esta prévia está em formato antigo e precisa ser republicada.",
        );
      }

      setSession({
        handle: data.handle,
        username: credentials ? normalizeHandle(credentials.username) : "",
        password: credentials ? normalizeHandle(credentials.password) : "",
        siteUrl: resolvedSite.url,
        version: data.version ?? 1,
        requiresLogin: Boolean(data.requiresLogin),
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

  useEffect(() => {
    void openPreview();
    // The short public slug changes only when a different preview route is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const login = async (event: FormEvent) => {
    event.preventDefault();
    await openPreview({ username, password });
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
          slug,
          handle: session.handle,
          username: session.username,
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
      setApproved(action === "approve");
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
          <div className="public-preview-review-heading">
            <span>Seu site está pronto para avaliar</span>
            <small>Versão {session.version}</small>
          </div>
          {revisionOpen && (
            <label>
              <span>O que gostaria de ajustar?</span>
              <textarea
                value={revision}
                onChange={(event) => setRevision(event.target.value)}
                placeholder="Ex.: trocar uma foto, corrigir um texto..."
                maxLength={1000}
                autoFocus
              />
            </label>
          )}
          <div className="public-preview-actions">
            <button
              type="button"
              className="public-preview-revision"
              disabled={sendingAction || approved}
              onClick={() => {
                if (revisionOpen) {
                  void submitAction("revision");
                } else {
                  setRevisionOpen(true);
                  setNotice(null);
                }
              }}
            >
              <MessageSquareText size={18} />
              {revisionOpen ? "Enviar revisão" : "Pedir revisão"}
            </button>
            <button
              type="button"
              className="public-preview-approve"
              disabled={sendingAction || approved}
              onClick={() => void submitAction("approve")}
            >
              {sendingAction ? (
                <LoaderCircle className="spin" size={18} />
              ) : approved ? (
                <CheckCircle2 size={19} />
              ) : (
                <BadgeCheck size={19} />
              )}
              {approved ? "Site aprovado" : "Aprovar site"}
            </button>
          </div>
          {notice && <p className="public-preview-notice">{notice}</p>}
        </aside>
      </main>
    );
  }

  const backUrl = `${getPublicAppUrl() || ""}/`;

  if (loading && !loginRequired && !error) {
    return (
      <main className="public-preview-page">
        <div className="public-preview-loading" role="status">
          <LoaderCircle className="spin" size={26} />
          <strong>Abrindo seu site...</strong>
          <span>Estamos preparando a visualização.</span>
        </div>
      </main>
    );
  }

  return (
    <main className="public-preview-page">
      <a className="public-preview-back" href={backUrl} aria-label="Voltar">
        <ArrowLeft size={17} />
        OBLIX
      </a>
      <form className="public-preview-login" onSubmit={(event) => void login(event)}>
        <Brand compact />
        <h1>
          {loginRequired ? "Seu preview está protegido." : "Preview indisponível."}
        </h1>
        <p>
          {loginRequired
            ? "Use o seu @ do Instagram como usuário e senha para visualizar o site."
            : error ?? "Não foi possível abrir este endereço."}
        </p>
        {loginRequired && (
          <>
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
            <button
              className="button button--primary public-preview-submit"
              disabled={loading}
            >
              {loading ? <LoaderCircle className="spin" size={18} /> : null}
              {loading ? "Abrindo preview..." : "Visualizar meu site"}
            </button>
          </>
        )}
      </form>
    </main>
  );
}
