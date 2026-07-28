import {
  Trash2,
  BadgeCheck,
  CalendarClock,
  Check,
  ChevronLeft,
  Circle,
  CircleArrowRight,
  ClipboardCheck,
  CloudUpload,
  ExternalLink,
  FileArchive,
  Heart,
  Layers3,
  MessageCircle,
  Pencil,
  Send,
  UserRoundCheck,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  ownerLabels,
  leadSourceLabels,
  stages,
  type Activity,
  type CommercialRecord,
  type Lead,
  type LeadProject,
  type LeadTag,
  type Owner,
  type PaymentInstallment,
  type Stage,
} from "../types";
import { CommercialPanel } from "./CommercialPanel";
import { ContactActions } from "./ContactActions";
import { TagEditor } from "./TagEditor";
import { WhatsAppEditor } from "./WhatsAppEditor";

const activityIcons = {
  validation: UserRoundCheck,
  message: MessageCircle,
  interest: Heart,
  materials: ClipboardCheck,
  preview: Send,
  approval: BadgeCheck,
  note: Pencil,
};

interface LeadDetailProps {
  lead: Lead;
  onBack: () => void;
  onDeleteLead: (leadId: number) => Promise<void> | void;
  deletingLead: boolean;
  onStageChange: (stage: Stage) => void;
  onOwnerChange: (owner: Owner) => void;
  onAddNote: (note: string) => void;
  onUpload: (file: File) => Promise<void>;
  previewPublishing: boolean;
  onOpenClientPreview: () => void;
  onOpenTeamPreview: () => void;
  onTogglePreviewMode: (requiresLogin: boolean) => void;
  onCopyPreviewLink: () => void;
  onOpenMessages: () => void;
  onWhatsAppChange: (number: string | null) => void;
  isOwner: boolean;
  ownerOptions: Owner[];
  availableTags: LeadTag[];
  onToggleTag: (tag: LeadTag) => void;
  onCreateTag: (name: string, category: string) => Promise<LeadTag | null>;
  onContactControlChange: (
    permission: Lead["contactPermission"],
    doNotContact: boolean,
  ) => void;
  commercial?: CommercialRecord;
  project?: LeadProject;
  installments: PaymentInstallment[];
  onSaveCommercial: (
    commercial: CommercialRecord,
    project: LeadProject,
    installments: PaymentInstallment[],
  ) => Promise<void>;
}

export function LeadDetail({
  lead,
  onBack,
  onDeleteLead,
  deletingLead,
  onStageChange,
  onOwnerChange,
  onAddNote,
  onUpload,
  previewPublishing,
  onOpenClientPreview,
  onOpenTeamPreview,
  onTogglePreviewMode,
  onCopyPreviewLink,
  onOpenMessages,
  onWhatsAppChange,
  isOwner,
  ownerOptions,
  availableTags,
  onToggleTag,
  onCreateTag,
  onContactControlChange,
  commercial,
  project,
  installments,
  onSaveCommercial,
}: LeadDetailProps) {
  const [note, setNote] = useState("");
  const visibleStages: readonly Stage[] =
    lead.validationStatus === "pending"
      ? stages
      : stages.filter((stage) => stage !== "Validar");
  const currentIndex = visibleStages.indexOf(lead.stage);

  const sortedActivities = useMemo(
    () => [...lead.activities].reverse(),
    [lead.activities],
  );

  const submitNote = () => {
    const trimmed = note.trim();
    if (!trimmed) return;
    onAddNote(trimmed);
    setNote("");
  };

  return (
    <div className="lead-detail-page">
      <button className="back-button" onClick={onBack}>
        <ChevronLeft size={18} />
        Voltar para a fila
      </button>

      <header className="lead-detail-header">
        <div className="lead-title">
          <span className="breadcrumb">Leads / {lead.handle}</span>
          <h1>{lead.handle}</h1>
          <p className="lead-title-meta">
            <span>{lead.category} · Instagram</span>
            <span className="batch-chip">
              <Layers3 size={13} />
              {lead.batchName}
            </span>
            <span className="source-chip">
              {leadSourceLabels[lead.sourceType]}
            </span>
            {lead.capturedAt && (
              <span>
                Capturado em {new Date(lead.capturedAt).toLocaleString("pt-BR")}
                {lead.capturedBy ? ` por ${lead.capturedBy}` : ""}
              </span>
            )}
          </p>
        </div>
        <div className="lead-header-actions">
          <ContactActions lead={lead} onOpenMessages={onOpenMessages} />
          <WhatsAppEditor
            compact
            lead={lead}
            onSave={onWhatsAppChange}
          />
          {isOwner && (
            <button
              className="button validation-discard"
              onClick={() => void onDeleteLead(lead.id)}
              disabled={deletingLead}
            >
              <Trash2 size={17} />
              {deletingLead ? "Excluindo..." : "Excluir lead"}
            </button>
          )}
        </div>
        <label className="field compact-field">
          <span>Etapa atual</span>
          <select
            value={lead.stage}
            onChange={(event) => onStageChange(event.target.value as Stage)}
          >
            {visibleStages.map((stage) => (
              <option key={stage}>{stage}</option>
            ))}
          </select>
        </label>
        <label className="field compact-field">
          <span>Responsável</span>
          <select
            value={lead.owner}
            onChange={(event) => onOwnerChange(event.target.value as Owner)}
            disabled={!isOwner}
          >
            {ownerOptions.map((owner) => (
              <option key={owner} value={owner}>
                {ownerLabels[owner] ?? owner}
              </option>
            ))}
          </select>
        </label>
        <div className="next-action-card">
          <span className="next-action-icon">
            <CircleArrowRight size={23} />
          </span>
          <div>
            <span>Fazer agora · próxima ação</span>
            <strong>{lead.nextAction}</strong>
            <small>
              <CalendarClock size={13} />
              Hoje, {lead.dueTime}
            </small>
          </div>
        </div>
      </header>

      <ol className="stage-strip" aria-label="Etapas do lead">
        {visibleStages.map((stage, index) => (
          <li
            key={stage}
            className={
              index < currentIndex
                ? "complete"
                : index === currentIndex
                  ? "current"
                  : ""
            }
          >
            <span>{index < currentIndex ? <Check size={17} /> : index + 1}</span>
            <small>{stage}</small>
          </li>
        ))}
      </ol>

      <div className="lead-detail-grid">
        <section className="panel history-panel">
          <header className="panel-header">
            <h2>Histórico</h2>
            <span className="subtle-label">Todas as atividades</span>
          </header>
          <div className="timeline">
            {sortedActivities.map((activity: Activity) => {
              const Icon = activityIcons[activity.kind];
              return (
                <article key={activity.id} className="timeline-item">
                  <span className="timeline-icon">
                    <Icon size={17} strokeWidth={1.8} />
                  </span>
                  <div>
                    <strong>{activity.title}</strong>
                    <p>{activity.detail}</p>
                    <small>
                      {activity.time} · {activity.author}
                    </small>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="note-composer">
            <label htmlFor="lead-note">Adicionar observação</label>
            <textarea
              id="lead-note"
              value={note}
              maxLength={1000}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Escreva uma observação..."
            />
            <div>
              <small>{note.length}/1000</small>
              <button
                className="button button--primary"
                onClick={submitNote}
                disabled={!note.trim()}
              >
                Adicionar
              </button>
            </div>
          </div>
          <TagEditor
            selected={lead.tags}
            available={availableTags}
            onToggle={onToggleTag}
            onCreate={onCreateTag}
            canCreate={isOwner}
          />
          <section className="contact-permission-panel">
            <header>
              <strong>Permissão e segurança de contato</strong>
              <small>
                Registre quando a pessoa autorizar continuar pelo WhatsApp.
              </small>
            </header>
            <div>
              <label>
                <span>Origem/permissão</span>
                <select
                  value={lead.contactPermission}
                  onChange={(event) => {
                    const permission = event.target
                      .value as Lead["contactPermission"];
                    onContactControlChange(
                      permission,
                      permission === "opted_out"
                        ? true
                        : lead.doNotContact,
                    );
                  }}
                >
                  <option value="public_contact">
                    Contato público no Instagram
                  </option>
                  <option value="opted_in">
                    Autorizou contato no WhatsApp
                  </option>
                  <option value="opted_out">
                    Pediu para não receber mensagens
                  </option>
                </select>
              </label>
              <label className="do-not-contact-toggle">
                <input
                  type="checkbox"
                  checked={lead.doNotContact}
                  onChange={(event) =>
                    onContactControlChange(
                      event.target.checked
                        ? "opted_out"
                        : lead.contactPermission === "opted_out"
                          ? "public_contact"
                          : lead.contactPermission,
                      event.target.checked,
                    )
                  }
                />
                Não contatar novamente
              </label>
            </div>
          </section>
        </section>

        <aside className="lead-side-panels">
          {isOwner && (
          <section className="panel preview-panel">
            <header className="panel-header">
              <h2>Preview do cliente</h2>
            </header>
            <label className="upload-zone">
              <input
                type="file"
                accept=".zip,application/zip"
                disabled={previewPublishing}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void onUpload(file);
                    event.target.value = "";
                  }
                }}
              />
              <CloudUpload size={31} strokeWidth={1.6} />
              <strong>{previewPublishing ? "Publicando preview..." : "Publicar ZIP para validação"}</strong>
              <span>O CRM valida, publica e cria o link do cliente.</span>
              <small>ZIP de até 20 MB</small>
            </label>

            <div className="version-block">
              <strong>Versão atual</strong>
              {lead.preview.status === "none" ? (
                <p>Nenhuma versão publicada</p>
              ) : (
                <div className="version-file">
                  <FileArchive size={19} />
                  <div>
                    <strong>Versão {lead.preview.version}</strong>
                    <small>{lead.preview.fileName}</small>
                  </div>
                  <span className="status-success">Pronto</span>
                </div>
              )}
            </div>

            <ul className="validation-list">
              <li className={lead.preview.checklist.index ? "complete" : ""}>
                {lead.preview.checklist.index ? <Check size={15} /> : <Circle size={15} />}
                index.html
              </li>
              <li
                className={
                  lead.preview.checklist.relativePaths ? "complete" : ""
                }
              >
                {lead.preview.checklist.relativePaths ? (
                  <Check size={15} />
                ) : (
                  <Circle size={15} />
                )}
                Caminhos relativos
              </li>
              <li
                className={
                  lead.preview.checklist.protectedAccess ? "complete" : ""
                }
              >
                {lead.preview.checklist.protectedAccess ? (
                  <Check size={15} />
                ) : (
                  <Circle size={15} />
                )}
                Acesso protegido
              </li>
            </ul>

            <label className="field">
              <span>Modo de acesso do preview</span>
              <select
                value={lead.preview.requiresLogin ? "login" : "token"}
                onChange={(event) =>
                  onTogglePreviewMode(event.target.value === "login")
                }
                disabled={previewPublishing}
              >
                <option value="token">Link direto (sem login)</option>
                <option value="login">Login + senha (Instagram)</option>
              </select>
              <small>
                {lead.preview.requiresLogin
                  ? "Cliente entra pelo link com usuário e senha."
                  : "Cliente entra pelo link direto com token seguro."}
              </small>
            </label>

            {lead.preview.status !== "none" && (
              <div className="preview-link-actions">
                <button className="button button--secondary" onClick={onOpenClientPreview}>
                  <ExternalLink size={17} />
                  Abrir link do cliente
                </button>
                <button className="button button--quiet" onClick={onCopyPreviewLink}>
                  Copiar link
                </button>
                <button
                  className="button button--quiet"
                  onClick={onOpenTeamPreview}
                  disabled={previewPublishing}
                >
                  Abrir preview interno
                </button>
              </div>
            )}
          </section>

          )}
        </aside>
      </div>
      {isOwner && (
        <CommercialPanel
          lead={lead}
          commercial={commercial}
          project={project}
          installments={installments}
          onSave={onSaveCommercial}
        />
      )}
    </div>
  );
}
