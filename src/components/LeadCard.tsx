import {
  ArrowRight,
  CalendarClock,
  Check,
  ExternalLink,
  Trash2,
  Flag,
  Layers3,
} from "lucide-react";
import {
  leadSourceLabels,
  ownerLabels,
  type Lead,
  type Priority,
} from "../types";
import { ContactActions } from "./ContactActions";
import { StageBadge } from "./StageBadge";

interface LeadCardProps {
  lead: Lead;
  onSelect: () => void;
  onOpenMessages: () => void;
  onPriorityChange: (priority: Priority) => void;
  selected?: boolean;
  onSelectionChange?: (selected: boolean) => void;
  onDelete?: (id: number) => void | Promise<void>;
  deleteDisabled?: boolean;
}

const priorities: Priority[] = ["Urgente", "Alta", "Normal", "Baixa"];

export function ownerName(owner: Lead["owner"]) {
  return ownerLabels[owner];
}

function leadInitials(handle: string) {
  const parts = handle
    .replace(/^@/, "")
    .split(/[._-]+/)
    .filter((part) => /[a-zÀ-ÿ]/i.test(part));

  if (parts.length > 1) {
    return `${parts[0][0]}${parts.at(-1)?.[0] ?? ""}`.toUpperCase();
  }

  return (parts[0] ?? "?").slice(0, 2).toUpperCase();
}

function stageClass(stage: Lead["stage"]) {
  const classes: Record<Lead["stage"], string> = {
    Validar: "validar",
    Contatar: "contatar",
    Interessado: "interessado",
    Materiais: "materiais",
    Preview: "preview",
    Aprovação: "aprovacao",
    Pagamento: "pagamento",
  };

  return classes[stage];
}

export function LeadCard({
  lead,
  onSelect,
  onOpenMessages,
  onPriorityChange,
  selected = false,
  onSelectionChange,
  onDelete,
  deleteDisabled = false,
}: LeadCardProps) {
  const initials = leadInitials(lead.handle);

  return (
    <article
      className={`lead-card lead-card--stage-${stageClass(lead.stage)} ${
        selected ? "is-selected" : ""
      } ${lead.overdue ? "is-overdue" : ""}`}
      data-priority={lead.priority.toLowerCase()}
    >
      {onSelectionChange && (
        <label
          className="lead-card-check"
          title={`Selecionar ${lead.handle}`}
          onClick={(event) => event.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={selected}
            onChange={(event) => onSelectionChange(event.target.checked)}
          />
          <span>
            <Check size={14} />
          </span>
        </label>
      )}

      <div className="lead-card-top">
        <button className="lead-card-main" onClick={onSelect}>
          <span className="lead-card-avatar">{initials}</span>
          <span className="lead-card-identity">
            <strong>{lead.handle}</strong>
            <small>
              {lead.category} · {ownerName(lead.owner)}
            </small>
          </span>
        </button>

        <div className="lead-card-meta">
          <span className="batch-chip" title={`Origem: ${lead.batchName}`}>
            <Layers3 size={13} />
            {lead.batchName}
          </span>
          <span className="source-chip">
            {leadSourceLabels[lead.sourceType]}
          </span>
          <label
            className={`priority-control priority-${lead.priority.toLowerCase()}`}
            onClick={(event) => event.stopPropagation()}
          >
            <Flag size={13} fill="currentColor" />
            <select
              aria-label={`Prioridade de ${lead.handle}`}
              value={lead.priority}
              onChange={(event) =>
                onPriorityChange(event.target.value as Priority)
              }
            >
              {priorities.map((priority) => (
                <option key={priority}>{priority}</option>
              ))}
            </select>
          </label>
          <StageBadge stage={lead.stage} />
        </div>
      </div>

      <div className="lead-card-action-row">
        <button className="lead-card-next" onClick={onSelect}>
          <ArrowRight size={18} />
          <span>
            <small>Próxima ação</small>
            <strong>{lead.nextAction}</strong>
          </span>
          <span className={`lead-card-due ${lead.overdue ? "is-danger" : ""}`}>
            <CalendarClock size={14} />
            {lead.overdue ? "Atrasado" : `${lead.scheduleDay} · ${lead.dueTime}`}
          </span>
        </button>

        <footer className="lead-card-footer" aria-label={`Ações de ${lead.handle}`}>
        <ContactActions
          lead={lead}
          compact
          onOpenMessages={onOpenMessages}
        />
        {onDelete ? (
          <button
            className="quick-contact quick-contact--danger"
            onClick={(event) => {
              event.stopPropagation();
              void onDelete(lead.id);
            }}
            disabled={deleteDisabled}
            title="Excluir lead permanentemente"
            aria-label={`Excluir ${lead.handle} permanentemente`}
          >
            <Trash2 size={14} />
          </button>
        ) : null}
        <button
          className="quick-contact quick-contact--open"
          onClick={onSelect}
          aria-label={`Abrir ficha de ${lead.handle}`}
            title="Abrir ficha completa"
          >
            <ExternalLink size={18} />
          </button>
        </footer>
      </div>
    </article>
  );
}
