import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Lead } from "../types";
import { WhatsAppIcon } from "./WhatsAppIcon";

interface WhatsAppEditorProps {
  lead: Lead;
  onSave: (number: string | null) => void;
  compact?: boolean;
}

const digitsFromLead = (lead: Lead) =>
  lead.whatsappNumber ??
  lead.whatsappUrl?.match(/(?:wa\.me\/|phone=)(\d{8,15})/i)?.[1] ??
  "";

const formatWhatsAppNumber = (number: string) => {
  if (number.startsWith("55") && (number.length === 12 || number.length === 13)) {
    const areaCode = number.slice(2, 4);
    const local = number.slice(4);
    const splitAt = local.length === 9 ? 5 : 4;
    return `+55 (${areaCode}) ${local.slice(0, splitAt)}-${local.slice(splitAt)}`;
  }
  return `+${number}`;
};

const normalizeWhatsAppNumber = (value: string) => {
  let digits = value.replace(/\D/g, "").replace(/^0+/, "");
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return digits;
};

export function WhatsAppEditor({
  lead,
  onSave,
  compact = false,
}: WhatsAppEditorProps) {
  const savedNumber = useMemo(() => digitsFromLead(lead), [lead]);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(savedNumber);
  const [error, setError] = useState("");

  useEffect(() => {
    setValue(savedNumber);
    setEditing(false);
    setError("");
  }, [lead.id, savedNumber]);

  const cancel = () => {
    setValue(savedNumber);
    setError("");
    setEditing(false);
  };

  const save = () => {
    const normalized = normalizeWhatsAppNumber(value);
    if (normalized.length < 10 || normalized.length > 15) {
      setError("Digite um número válido com DDD.");
      return;
    }
    onSave(normalized);
    setError("");
    setEditing(false);
  };

  if (editing) {
    return (
      <div className={`whatsapp-editor is-editing ${compact ? "is-compact" : ""}`}>
        <label>
          <span>Número do WhatsApp</span>
          <input
            autoFocus
            inputMode="tel"
            type="tel"
            value={value}
            placeholder="(73) 99930-5062"
            aria-invalid={Boolean(error)}
            onChange={(event) => {
              setValue(event.target.value);
              if (error) setError("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") save();
              if (event.key === "Escape") cancel();
            }}
          />
        </label>
        <div className="whatsapp-editor-actions">
          <button
            type="button"
            className="button button--primary"
            onClick={save}
          >
            <Check size={16} />
            Salvar
          </button>
          <button
            type="button"
            className="button button--quiet"
            onClick={cancel}
          >
            <X size={16} />
            Cancelar
          </button>
        </div>
        {error ? <small role="alert">{error}</small> : null}
      </div>
    );
  }

  return (
    <div
      className={`whatsapp-editor ${savedNumber ? "has-number" : "is-missing"} ${
        compact ? "is-compact" : ""
      }`}
    >
      <span className="whatsapp-editor-icon">
        <WhatsAppIcon size={18} />
      </span>
      <span className="whatsapp-editor-copy">
        <small>WhatsApp</small>
        <strong>
          {savedNumber
            ? formatWhatsAppNumber(savedNumber)
            : "Número não cadastrado"}
        </strong>
        {!savedNumber ? (
          <em>Adicione para abrir a conversa diretamente.</em>
        ) : null}
      </span>
      <button
        type="button"
        className="button button--quiet whatsapp-editor-edit"
        onClick={() => setEditing(true)}
        aria-label={
          savedNumber
            ? `Editar WhatsApp de ${lead.handle}`
            : `Adicionar WhatsApp de ${lead.handle}`
        }
      >
        {savedNumber ? <Pencil size={15} /> : <Plus size={16} />}
        {savedNumber ? "Editar" : "Adicionar número"}
      </button>
      {savedNumber ? (
        <button
          type="button"
          className="whatsapp-editor-remove"
          onClick={() => onSave(null)}
          aria-label={`Remover WhatsApp de ${lead.handle}`}
          title="Remover número"
        >
          <Trash2 size={15} />
        </button>
      ) : null}
    </div>
  );
}
