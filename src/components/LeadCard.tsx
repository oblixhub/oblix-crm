import { ArrowRight, CalendarClock, Check, Flag } from "lucide-react";
import type { Lead, Priority } from "../types";
import { ContactActions } from "./ContactActions";
import { StageBadge } from "./StageBadge";

interface LeadCardProps {
  lead: Lead;
  onSelect: () => void;
  onOpenMessages: () => void;
  onPriorityChange: (priority: Priority) => void;
  selected?: boolean;
  onSelectionChange?: (selected: boolean) => void;
}

const priorities: Priority[] = ["Urgente", "Alta", "Normal", "Baixa"];

export function ownerName(owner: Lead["owner"]) {
  return owner === "Você" ? "Hugo" : "Raiza";
}

export function LeadCard({
  lead,
  onSelect,
  onOpenMessages,
  onPriorityChange,
  selected = false,
  onSelectionChange,
}: LeadCardProps) {
  const initials = lead.handle.replace("@", "").slice(0, 2).toUpperCase();

  return (
    <article
      className={`lead-card ${selected ? "is-selected" : ""} ${
        lead.overdue ? "is-overdue" : ""
      }`}
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

      <button className="lead-card-main" onClick={onSelect}>
        <span className="lead-card-avatar">{initials}</span>
        <span className="lead-card-identity">
          <strong>{lead.handle}</strong>
          <small>{lead.category}</small>
        </span>
        <span className="lead-card-owner" title={`Responsável: ${ownerName(lead.owner)}`}>
          {ownerName(lead.owner).slice(0, 1)}
        </span>
      </button>

      <div className="lead-card-meta">
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

      <button className="lead-card-next" onClick={onSelect}>
        <ArrowRight size={17} />
        <span>
          <small>Próxima ação</small>
          <strong>{lead.nextAction}</strong>
        </span>
      </button>

      <footer className="lead-card-footer">
        <span className={lead.overdue ? "is-danger" : ""}>
          <CalendarClock size={15} />
          {lead.overdue ? "Atrasado" : lead.scheduleDay} · {lead.dueTime}
        </span>
        <ContactActions
          lead={lead}
          compact
          onOpenMessages={onOpenMessages}
        />
      </footer>
    </article>
  );
}
