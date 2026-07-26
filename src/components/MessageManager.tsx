import {
  Check,
  Copy,
  GripVertical,
  Plus,
  Search,
  Star,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { MessageTemplate } from "../types";

interface MessageManagerProps {
  templates: MessageTemplate[];
  onCreate: () => number;
  onDuplicate: (id: number) => number;
  onDelete: (id: number) => void;
  onUpdate: (id: number, patch: Partial<MessageTemplate>) => void;
  onSaved: (title: string) => void;
  onCopied: (title: string) => void;
}

export function MessageManager({
  templates,
  onCreate,
  onDuplicate,
  onDelete,
  onUpdate,
  onSaved,
  onCopied,
}: MessageManagerProps) {
  const [selectedId, setSelectedId] = useState<number | null>(
    templates[0]?.id ?? null,
  );
  const [activeCategory, setActiveCategory] = useState("Todas");
  const [query, setQuery] = useState("");
  const [saved, setSaved] = useState(false);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [draft, setDraft] = useState<MessageTemplate | null>(
    templates[0] ? { ...templates[0] } : null,
  );

  const categories = useMemo(
    () => [
      ...new Set([
        ...templates.map((template) => template.category),
        ...customCategories,
      ]),
    ],
    [customCategories, templates],
  );

  const visibleTemplates = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return templates.filter(
      (template) =>
        (activeCategory === "Todas" ||
          template.category === activeCategory) &&
        (!normalized ||
          template.title.toLowerCase().includes(normalized) ||
          template.message.toLowerCase().includes(normalized)),
    );
  }, [activeCategory, query, templates]);

  const selected =
    templates.find((template) => template.id === selectedId) ??
    visibleTemplates[0] ??
    templates[0];

  useEffect(() => {
    if (!selected) {
      setDraft(null);
      return;
    }
    setDraft((current) =>
      current?.id === selected.id ? current : { ...selected },
    );
  }, [selected]);

  const copyText = async (text: string, title: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const field = document.createElement("textarea");
      field.value = text;
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      document.execCommand("copy");
      field.remove();
    }
    onCopied(title);
  };

  const addVariable = (variable: string) => {
    if (!draft) return;
    const separator = draft.message.endsWith(" ") ? "" : " ";
    setDraft({
      ...draft,
      message: `${draft.message}${separator}${variable}`,
    });
    setSaved(false);
  };

  const addCategory = () => {
    const value = newCategory.trim();
    if (!value) return;
    setCustomCategories((current) =>
      current.includes(value) ? current : [...current, value],
    );
    setActiveCategory(value);
    setNewCategory("");
    setAddingCategory(false);
  };

  return (
    <div className="message-manager-page">
      <header className="message-manager-heading">
        <div>
          <h1>Mensagens prontas</h1>
          <p>Crie e mantenha os scripts usados pela equipe.</p>
        </div>
        <button
          className="button button--primary"
          onClick={() => {
            const id = onCreate();
            setSelectedId(id);
            setActiveCategory("Todas");
          }}
        >
          <Plus size={18} />
          Nova mensagem
        </button>
      </header>

      <div className="message-manager-grid">
        <aside className="message-category-rail">
          <button
            className={activeCategory === "Todas" ? "active" : ""}
            onClick={() => setActiveCategory("Todas")}
          >
            <span>Todas</span>
            <strong>{templates.length}</strong>
          </button>
          {categories.map((category) => (
            <button
              key={category}
              className={activeCategory === category ? "active" : ""}
              onClick={() => setActiveCategory(category)}
            >
              <span>{category}</span>
              <strong>
                {
                  templates.filter(
                    (template) => template.category === category,
                  ).length
                }
              </strong>
            </button>
          ))}
          {addingCategory ? (
            <div className="new-category-form">
              <input
                autoFocus
                value={newCategory}
                onChange={(event) => setNewCategory(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") addCategory();
                  if (event.key === "Escape") setAddingCategory(false);
                }}
                placeholder="Nome da categoria"
              />
              <button onClick={addCategory}>Adicionar</button>
            </div>
          ) : (
            <button
              className="new-category-button"
              onClick={() => setAddingCategory(true)}
            >
              <Plus size={16} />
              Nova categoria
            </button>
          )}
        </aside>

        <section className="message-template-list">
          <label className="search-field">
            <Search size={17} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar mensagens..."
            />
          </label>

          <div>
            {visibleTemplates.map((template) => (
              <article
                key={template.id}
                className={selected?.id === template.id ? "active" : ""}
                onClick={() => {
                  setSelectedId(template.id);
                  setDraft({ ...template });
                  setSaved(false);
                }}
              >
                <GripVertical className="drag-handle" size={18} />
                <button
                  className={`favorite-button ${
                    template.favorite ? "active" : ""
                  }`}
                  aria-label={
                    template.favorite
                      ? "Remover dos favoritos"
                      : "Adicionar aos favoritos"
                  }
                  onClick={(event) => {
                    event.stopPropagation();
                    onUpdate(template.id, { favorite: !template.favorite });
                  }}
                >
                  <Star size={18} fill={template.favorite ? "currentColor" : "none"} />
                </button>
                <span>
                  <strong>{template.title}</strong>
                  <small>
                    {template.category} · {template.updatedLabel}
                  </small>
                  <p>{template.message}</p>
                </span>
                <div>
                  <button
                    aria-label={`Duplicar ${template.title}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      const id = onDuplicate(template.id);
                      setSelectedId(id);
                    }}
                  >
                    <Copy size={17} />
                  </button>
                  <button
                    aria-label={`Excluir ${template.title}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onDelete(template.id);
                      setSelectedId(
                        templates.find((item) => item.id !== template.id)?.id ??
                          null,
                      );
                    }}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </article>
            ))}
            {visibleTemplates.length === 0 && (
              <div className="message-list-empty">
                <Search size={23} />
                <strong>Nenhuma mensagem encontrada</strong>
                <p>Crie uma mensagem ou altere a busca.</p>
              </div>
            )}
          </div>
          <footer>{visibleTemplates.length} mensagens</footer>
        </section>

        <section className="message-editor">
          {selected ? (
            <>
              <header>
                <h2>Editar mensagem</h2>
                {saved && (
                  <span>
                    <Check size={16} />
                    Alterações salvas
                  </span>
                )}
              </header>

              <label className="editor-field">
                <span>Título</span>
                <input
                  value={draft?.title ?? selected.title}
                  onChange={(event) => {
                    setDraft((current) =>
                      current
                        ? { ...current, title: event.target.value }
                        : current,
                    );
                    setSaved(false);
                  }}
                />
              </label>

              <label className="editor-field">
                <span>Categoria</span>
                <select
                  value={draft?.category ?? selected.category}
                  onChange={(event) => {
                    setDraft((current) =>
                      current
                        ? { ...current, category: event.target.value }
                        : current,
                    );
                    setSaved(false);
                  }}
                >
                  {categories.map((category) => (
                    <option key={category}>{category}</option>
                  ))}
                </select>
              </label>

              <label className="editor-field editor-message-field">
                <span>
                  Mensagem
                  <small>{(draft?.message ?? selected.message).length}/2000</small>
                </span>
                <textarea
                  maxLength={2000}
                  value={draft?.message ?? selected.message}
                  onChange={(event) => {
                    setDraft((current) =>
                      current
                        ? { ...current, message: event.target.value }
                        : current,
                    );
                    setSaved(false);
                  }}
                />
              </label>

              <div className="variable-row">
                {["[nome]", "[seu nome]", "[perfil]", "[valor]"].map(
                  (variable) => (
                    <button key={variable} onClick={() => addVariable(variable)}>
                      {variable}
                    </button>
                  ),
                )}
              </div>

              <label className="shared-checkbox">
                <input
                  type="checkbox"
                  checked={draft?.shared ?? selected.shared}
                  onChange={(event) => {
                    setDraft((current) =>
                      current
                        ? { ...current, shared: event.target.checked }
                        : current,
                    );
                    setSaved(false);
                  }}
                />
                <span>
                  <strong>Disponível para toda a equipe</strong>
                  <small>Você e sua sócia poderão usar esta mensagem.</small>
                </span>
              </label>

              <div className="message-live-preview">
                <header>
                  <strong>Pré-visualização</strong>
                  <button
                    onClick={() =>
                      copyText(
                        draft?.message ?? selected.message,
                        draft?.title ?? selected.title,
                      )
                    }
                  >
                    <Copy size={15} />
                    Copiar teste
                  </button>
                </header>
                <p>
                  {(draft?.message ?? selected.message)
                    .replaceAll("[nome]", "João")
                    .replaceAll("[seu nome]", "Você")
                    .replaceAll("[perfil]", "negócios locais")
                    .replaceAll("[valor]", "R$ 200")}
                </p>
              </div>

              <footer>
                <button
                  className="button button--secondary"
                  onClick={() => {
                    setDraft({ ...selected });
                    setSaved(false);
                  }}
                >
                  Cancelar
                </button>
                <button
                  className="button button--primary"
                  onClick={() => {
                    if (!draft) return;
                    onUpdate(selected.id, {
                      title: draft.title,
                      category: draft.category,
                      message: draft.message,
                      shared: draft.shared,
                      updatedLabel: "Editado agora",
                    });
                    setDraft({ ...draft, updatedLabel: "Editado agora" });
                    setSaved(true);
                    onSaved(draft.title);
                  }}
                >
                  Salvar alterações
                </button>
              </footer>
            </>
          ) : (
            <div className="message-editor-empty">
              <Plus size={24} />
              <h2>Crie sua primeira mensagem</h2>
              <button className="button button--primary" onClick={onCreate}>
                Nova mensagem
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
