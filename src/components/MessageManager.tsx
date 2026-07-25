import {
  Check,
  Copy,
  GripVertical,
  Plus,
  Search,
  Star,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
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
    if (!selected) return;
    const separator = selected.message.endsWith(" ") ? "" : " ";
    onUpdate(selected.id, {
      message: `${selected.message}${separator}${variable}`,
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
                  value={selected.title}
                  onChange={(event) => {
                    onUpdate(selected.id, { title: event.target.value });
                    setSaved(false);
                  }}
                />
              </label>

              <label className="editor-field">
                <span>Categoria</span>
                <select
                  value={selected.category}
                  onChange={(event) => {
                    onUpdate(selected.id, { category: event.target.value });
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
                  <small>{selected.message.length}/2000</small>
                </span>
                <textarea
                  maxLength={2000}
                  value={selected.message}
                  onChange={(event) => {
                    onUpdate(selected.id, { message: event.target.value });
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
                  checked={selected.shared}
                  onChange={(event) =>
                    onUpdate(selected.id, { shared: event.target.checked })
                  }
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
                    onClick={() => copyText(selected.message, selected.title)}
                  >
                    <Copy size={15} />
                    Copiar teste
                  </button>
                </header>
                <p>
                  {selected.message
                    .replaceAll("[nome]", "João")
                    .replaceAll("[seu nome]", "Você")
                    .replaceAll("[perfil]", "negócios locais")
                    .replaceAll("[valor]", "R$ 200")}
                </p>
              </div>

              <footer>
                <button
                  className="button button--secondary"
                  onClick={() => setSaved(false)}
                >
                  Cancelar
                </button>
                <button
                  className="button button--primary"
                  onClick={() => {
                    onUpdate(selected.id, { updatedLabel: "Editado agora" });
                    setSaved(true);
                    onSaved(selected.title);
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
