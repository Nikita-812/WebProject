import type { FormEvent, KeyboardEvent } from "react";
import { useMemo, useState } from "react";
import { api } from "../api/client";
import { useBoardStore } from "../store/board";
import type { Card, Column } from "../types";

interface Props {
  projectId: string;
  onSelectCard: (cardId: string) => void;
}

const sortCards = (cards: Card[]) => [...cards].sort((a, b) => a.position - b.position);

export const BoardView = ({ projectId, onSelectCard }: Props) => {
  const columns = useBoardStore((state) => state.columns);
  const cards = useBoardStore((state) => state.cards);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [renames, setRenames] = useState<Record<string, string>>({});
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [cardRenameDrafts, setCardRenameDrafts] = useState<Record<string, string>>({});
  const [renamingCardId, setRenamingCardId] = useState<string | null>(null);
  const [cardInlineErrors, setCardInlineErrors] = useState<Record<string, string | null>>({});
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const upsertCard = useBoardStore((state) => state.upsertCard);
  const updateColumnStore = useBoardStore((state) => state.updateColumn);
  const removeColumn = useBoardStore((state) => state.removeColumn);

  const handleAddCard = async (event: FormEvent<HTMLFormElement>, column: Column) => {
    event.preventDefault();
    const title = drafts[column.id];
    if (!title?.trim()) return;
    const result = await api.createCard({
      project_id: projectId,
      column_id: column.id,
      title: title.trim(),
    });
    upsertCard(result);
    setDrafts((prev) => ({ ...prev, [column.id]: "" }));
  };

  const handleRenameColumn = async (column: Column) => {
    const draft = (renames[column.id] ?? column.name).trim();
    if (!draft || draft === column.name) return;
    const updated = await api.updateColumn(column.id, { name: draft });
    updateColumnStore(updated);
    setRenames((prev) => {
      const next = { ...prev };
      delete next[column.id];
      return next;
    });
    setEditingColumnId(null);
  };

  const cardsByColumn = useMemo(
    () => (columnId: string) => cards.filter((card) => card.column_id === columnId),
    [cards],
  );

  const startInlineRename = (card: Card) => {
    setEditingCardId(card.id);
    setCardRenameDrafts((prev) => ({ ...prev, [card.id]: prev[card.id] ?? card.title }));
    setCardInlineErrors((prev) => ({ ...prev, [card.id]: null }));
  };

  const cancelInlineRename = () => {
    setEditingCardId(null);
  };

  const submitInlineRename = async (card: Card) => {
    const draft = cardRenameDrafts[card.id]?.trim();
    if (!draft || draft === card.title) {
      cancelInlineRename();
      return;
    }
    setRenamingCardId(card.id);
    try {
      const updated = await api.updateCard(card.id, { title: draft, clientVersion: card.version });
      upsertCard(updated);
      setEditingCardId(null);
    } catch (err) {
      setCardInlineErrors((prev) => ({ ...prev, [card.id]: (err as Error).message }));
    } finally {
      setRenamingCardId(null);
    }
  };

  const handleCardTitleKeyDown = (event: KeyboardEvent<HTMLInputElement>, card: Card) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void submitInlineRename(card);
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancelInlineRename();
    }
  };

  const tagPalette = ["#f97316", "#a855f7", "#22d3ee", "#16a34a", "#f43f5e"];
  const normalizeTag = (value: unknown): string => {
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    if (value && typeof value === "object") {
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    }
    return "Тег";
  };

  const renderTags = (card: Card) => {
    const tagList = Array.isArray(card.labels) ? card.labels : [];
    if (!tagList.length) return null;
    const tagNames = tagList.map(normalizeTag);
    return (
      <div className="card__tags">
        {tagNames.slice(0, 3).map((tag, index) => (
          <span
            key={`${card.id}-tag-${index}`}
            className="tag-chip"
            style={{ backgroundColor: tagPalette[index % tagPalette.length] }}
            title={tag}
          >
            {tag}
          </span>
        ))}
        {tagNames.length > 3 && (
          <span className="tag-chip tag-chip--more" title={tagNames.slice(3).join(", ")}>
            +{tagNames.length - 3}
          </span>
        )}
      </div>
    );
  };

  const handleDeleteColumn = async (column: Column) => {
    if (
      !window.confirm(
        `Удалить колонку «${column.name}»? Все карточки внутри неё также будут удалены.`,
      )
    ) {
      return;
    }
    await api.deleteColumn(column.id);
    removeColumn(column.id);
  };

  type PriorityValue = "low" | "medium" | "high";
  const isPriorityValue = (priority: Card["priority"] | null): priority is PriorityValue =>
    priority === "low" || priority === "medium" || priority === "high";

  const priorityLabel: Record<PriorityValue, string> = {
    high: "Высокий",
    medium: "Средний",
    low: "Низкий",
  };

  const cardClassName = (card: Card) =>
    ["card", isPriorityValue(card.priority) ? `card--priority-${card.priority}` : ""].filter(Boolean).join(" ");

  return (
    <section className="board">
      {columns.map((column) => {
        const renameDraft = renames[column.id] ?? column.name;
        const renameTrimmed = renameDraft.trim();
        const renameDisabled = !renameTrimmed || renameTrimmed === column.name;
        const columnCards = cardsByColumn(column.id);
        return (
          <div key={column.id} className="column">
            <header>
              <div className="column__header-main">
                <div>
                  <h3>{column.name}</h3>
                  <small>{columnCards.length} карточек</small>
                </div>
                <div className="column__actions">
                  <button
                    type="button"
                    className="column__edit"
                    onClick={() => {
                      setEditingColumnId(column.id);
                      setRenames((prev) => ({ ...prev, [column.id]: renameDraft }));
                    }}
                  >
                    Переименовать
                  </button>
                  <button type="button" className="column__delete" onClick={() => void handleDeleteColumn(column)}>
                    Удалить
                  </button>
                </div>
              </div>
              {editingColumnId === column.id && (
                <form
                  className="column__rename"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleRenameColumn(column);
                  }}
                >
                  <input
                    type="text"
                    placeholder="Новое название"
                    value={renameDraft}
                    onChange={(e) => setRenames((prev) => ({ ...prev, [column.id]: e.target.value }))}
                    aria-label={`Переименовать колонку ${column.name}`}
                    autoFocus
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        setEditingColumnId(null);
                        setRenames((prev) => {
                          const next = { ...prev };
                          delete next[column.id];
                          return next;
                        });
                      }
                    }}
                  />
                  <div className="column__rename-actions">
                    <button type="submit" disabled={renameDisabled} title="Сохранить новое имя">
                      Сохранить
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => {
                        setEditingColumnId(null);
                        setRenames((prev) => {
                          const next = { ...prev };
                          delete next[column.id];
                          return next;
                        });
                      }}
                    >
                      Отмена
                    </button>
                  </div>
                </form>
              )}
            </header>
            <ul>
              {sortCards(columnCards).map((card) => {
              const isEditing = editingCardId === card.id;
              const draftValue = cardRenameDrafts[card.id] ?? card.title;
              const dueDate = card.due_date ? new Date(card.due_date) : null;
              const isOverdue = dueDate ? dueDate.getTime() < Date.now() : false;
              return (
                <li key={card.id} className={cardClassName(card)}>
                  <div className="card__header" onDoubleClick={() => startInlineRename(card)}>
                    {isEditing ? (
                      <input
                        className="card__title-input"
                        value={draftValue}
                        onChange={(e) =>
                          setCardRenameDrafts((prev) => ({ ...prev, [card.id]: e.target.value }))
                        }
                        onBlur={() => {
                          if (renamingCardId === card.id) return;
                          void submitInlineRename(card);
                        }}
                        onKeyDown={(event) => handleCardTitleKeyDown(event, card)}
                        autoFocus
                      />
                    ) : (
                      <p>{card.title}</p>
                    )}
                    <button type="button" onClick={() => onSelectCard(card.id)} className="card__action">
                      Открыть
                    </button>
                  </div>
                  {card.description && !isEditing && <small className="card__description">{card.description}</small>}
                  {renderTags(card)}
                  <div className="card__badges">
                    {isPriorityValue(card.priority) && (
                      <span className={`badge badge--priority-${card.priority}`}>
                        {priorityLabel[card.priority]}
                      </span>
                    )}
                    {dueDate && (
                      <span className={`badge badge--due${isOverdue ? " badge--due-overdue" : ""}`}>
                        {dueDate.toLocaleDateString()}
                      </span>
                    )}
                    {card.assignees.length > 0 && (
                      <span className="badge badge--assignees">{card.assignees.length} исполн.</span>
                    )}
                    {Array.isArray(card.labels) && card.labels.length > 0 && (
                      <span className="badge badge--labels">{card.labels.length} тегов</span>
                    )}
                  </div>
                  {cardInlineErrors[card.id] && (
                    <small className="card__error">{cardInlineErrors[card.id]}</small>
                  )}
                </li>
              );
            })}
          </ul>
          <form onSubmit={(event) => handleAddCard(event, column)} className="card-form">
            <input
              type="text"
              placeholder="Новая карточка"
              value={drafts[column.id] ?? ""}
              onChange={(e) => setDrafts((prev) => ({ ...prev, [column.id]: e.target.value }))}
            />
            <button type="submit">Добавить</button>
          </form>
        </div>
      );
    })}
    </section>
  );
};
