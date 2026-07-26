import {
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
  MessageCircle,
  Pencil,
  Send,
  UserRoundCheck,
} from "lucide-react";
import { useMemo, useState } from "react";
import { stages, type Activity, type Lead, type Stage } from "../types";
import { ContactActions } from "./ContactActions";

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
  onStageChange: (stage: Stage) => void;
  onAddNote: (note: string) => void;
  onUpload: (file: File) => void;
  onOpenClientPreview: () => void;
  onMarkPaid: () => void;
  onOpenMessages: () => void;
}

export function LeadDetail({
  lead,
  onBack,
  onStageChange,
  onAddNote,
  onUpload,
  onOpenClientPreview,
  onMarkPaid,
  onOpenMessages,
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
          <p>{lead.category} · Instagram</p>
        </div>
        <div className="lead-header-actions">
          <ContactActions lead={lead} onOpenMessages={onOpenMessages} />
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
        </section>

        <aside className="lead-side-panels">
          <section className="panel preview-panel">
            <header className="panel-header">
              <h2>Preview do cliente</h2>
            </header>
            <label className="upload-zone">
              <input
                type="file"
                accept=".zip,application/zip"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) onUpload(file);
                }}
              />
              <CloudUpload size={31} strokeWidth={1.6} />
              <strong>Enviar ZIP do site</strong>
              <span>Arraste e solte o arquivo aqui</span>
              <small>ou clique para selecionar</small>
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

            {lead.preview.status !== "none" && (
              <button
                className="button button--secondary button--full"
                onClick={onOpenClientPreview}
              >
                <ExternalLink size={17} />
                Simular acesso do cliente
              </button>
            )}
          </section>

          <section className="panel payment-panel">
            <header className="panel-header">
              <h2>Pagamento</h2>
            </header>
            <div className="offer-row">
              <div>
                <span>Oferta {lead.offer.toLowerCase()}</span>
                <small>Aprovação e pagamento são etapas separadas.</small>
              </div>
              <strong>R$ {lead.amount}</strong>
            </div>
            <span
              className={`payment-status payment-${lead.paymentStatus
                .toLowerCase()
                .replace(" ", "-")}`}
            >
              {lead.paymentStatus}
            </span>
            {lead.paymentStatus === "Aguardando PIX" && (
              <button
                className="button button--primary button--full"
                onClick={onMarkPaid}
              >
                Confirmar pagamento
              </button>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
