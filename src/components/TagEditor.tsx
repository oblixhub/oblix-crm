import { Plus, Tag, X } from "lucide-react";
import {
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import type { LeadTag } from "../types";

interface TagEditorProps {
  selected: LeadTag[];
  available: LeadTag[];
  onToggle: (tag: LeadTag) => void;
  onCreate?: (name: string, category: string) => Promise<LeadTag | null>;
  canCreate?: boolean;
  compact?: boolean;
}

export function TagEditor({
  selected,
  available,
  onToggle,
  onCreate,
  canCreate = false,
  compact = false,
}: TagEditorProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [category, setCategory] = useState("Personalizada");
  const [creating, setCreating] = useState(false);
  const selectedIds = useMemo(
    () => new Set(selected.map((tag) => tag.id)),
    [selected],
  );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!onCreate || !newName.trim()) return;
    setCreating(true);
    const created = await onCreate(newName.trim(), category);
    setCreating(false);
    if (!created) return;
    setNewName("");
    onToggle(created);
  };

  return (
    <section className={`tag-editor ${compact ? "is-compact" : ""}`}>
      <header>
        <span>
          <Tag size={16} />
          Tags
        </span>
        <button type="button" onClick={() => setPickerOpen((open) => !open)}>
          <Plus size={16} />
          Adicionar
        </button>
      </header>

      <div className="selected-tag-list" aria-label="Tags do lead">
        {selected.map((tag) => (
          <button
            type="button"
            className="lead-tag-chip"
            style={{ "--tag-color": tag.color } as CSSProperties}
            key={tag.id}
            onClick={() => onToggle(tag)}
            aria-label={`Remover tag ${tag.name}`}
          >
            {tag.name}
            <X size={13} />
          </button>
        ))}
        {selected.length === 0 && (
          <small>Nenhuma tag. Use tags para localizar este contato depois.</small>
        )}
      </div>

      {pickerOpen && (
        <div className="tag-picker">
          <div className="tag-picker-options">
            {available.map((tag) => {
              const active = selectedIds.has(tag.id);
              return (
                <button
                  type="button"
                  key={tag.id}
                  className={active ? "active" : ""}
                  onClick={() => onToggle(tag)}
                >
                  <i style={{ background: tag.color }} />
                  <span>{tag.name}</span>
                  <small>{tag.category}</small>
                </button>
              );
            })}
          </div>
          {canCreate && onCreate && (
            <form className="new-tag-form" onSubmit={submit}>
              <strong>Criar tag personalizada</strong>
              <div>
                <input
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  placeholder="Ex.: Prefere áudio"
                  maxLength={40}
                />
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                >
                  <option>Personalizada</option>
                  <option>Comportamento</option>
                  <option>Interesse</option>
                  <option>Objeção</option>
                  <option>Materiais</option>
                </select>
                <button type="submit" disabled={creating || !newName.trim()}>
                  {creating ? "Criando…" : "Criar"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </section>
  );
}
