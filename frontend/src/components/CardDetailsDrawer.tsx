import { useState, useEffect } from "react";
import type { Card, Column } from "../types";

interface Props {
  card: Card | null;
  columns: Column[];
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
  onMove: (payload: { toColumnId: string; position: number }) => Promise<void>;
  onDelete: (cardId: string) => Promise<void>;
}

type PriorityValue = "" | "low" | "medium" | "high";

const priorityOptions = [
  { value: "", label: "Без приоритета" },
  { value: "low", label: "Низкий" },
  { value: "medium", label: "Средний" },
  { value: "high", label: "Высокий" },
];

export const CardDetailsDrawer = ({ card, columns, onClose, onSave, onMove, onDelete }: Props) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<PriorityValue>("");
  const [dueDate, setDueDate] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [assignees, setAssignees] = useState("");
  const [moveTarget, setMoveTarget] = useState<string>("");
  const [position, setPosition] = useState(0);
  const [saving, setSaving] = useState(false);
  const [moving, setMoving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!card) return;
    setTitle(card.title);
    setDescription(card.description ?? "");
    setPriority((card.priority as PriorityValue | null) ?? "");
    setDueDate(card.due_date ? card.due_date.slice(0, 10) : "");
    setTagsInput(
      Array.isArray(card.labels) ? card.labels.map((label) => JSON.stringify(label)).join("\n") : "",
    );
    setAssignees(card.assignees.join("\n"));
    setMoveTarget(card.column_id);
    setPosition(card.position);
    setDeleteError(null);
  }, [card]);

  if (!card) return null;

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    const parsedTags = tagsInput
      ? tagsInput
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => {
            try {
              return JSON.parse(line);
            } catch {
              return line;
            }
          })
      : [];
    try {
      await onSave({
        title,
        description,
        priority: priority || null,
        due_date: dueDate || null,
        labels: parsedTags,
        assignees: assignees
          ? assignees
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean)
          : [],
      });
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleMove = async () => {
    if (!moveTarget) return;
    setMoving(true);
    setMoveError(null);
    try {
      await onMove({ toColumnId: moveTarget, position });
    } catch (err) {
      setMoveError((err as Error).message);
    } finally {
      setMoving(false);
    }
  };

  return (
    <div className="drawer">
      <div className="drawer__backdrop" onClick={onClose} />
      <div className="drawer__panel">
        <header>
          <h2>Карточка</h2>
          <button onClick={onClose}>×</button>
        </header>
        <div className="drawer__section">
          <label>
            Название
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label>
            Описание
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
          </label>
          <div className="drawer__row">
            <label>
              Приоритет
              <select value={priority} onChange={(e) => setPriority(e.target.value as PriorityValue)}>
                {priorityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Дедлайн
              <input type="date" value={dueDate ?? ""} onChange={(e) => setDueDate(e.target.value)} />
            </label>
          </div>
          <label>
            Теги (каждый с новой строки)
            <textarea value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} rows={3} />
          </label>
          <label>
            Исполнители (каждый с новой строки)
            <textarea value={assignees} onChange={(e) => setAssignees(e.target.value)} rows={3} />
          </label>
          <button onClick={handleSave} disabled={saving} className="primary">
            {saving ? "Сохраняю..." : "Сохранить"}
          </button>
          {saveError && <p className="error small">{saveError}</p>}
        </div>

        <div className="drawer__section">
          <h3>Переместить</h3>
          <label>
            Колонка
            <select value={moveTarget} onChange={(e) => setMoveTarget(e.target.value)}>
              {columns.map((column) => (
                <option key={column.id} value={column.id}>
                  {column.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Позиция
            <input
              type="number"
              value={position}
              onChange={(e) => setPosition(Number(e.target.value))}
              min={0}
            />
          </label>
          <button onClick={handleMove} disabled={moving}>
            {moving ? "Перемещаю..." : "Переместить"}
          </button>
          {moveError && <p className="error small">{moveError}</p>}
        </div>

        <div className="drawer__section drawer__section--danger">
          <h3>Удаление</h3>
          <p>После удаления карточку нельзя будет восстановить.</p>
          <button
            type="button"
            className="danger"
            onClick={async () => {
              if (!card) return;
              if (!window.confirm("Удалить карточку? Это действие нельзя отменить.")) {
                return;
              }
              setDeleting(true);
              setDeleteError(null);
              try {
                await onDelete(card.id);
              } catch (err) {
                setDeleteError((err as Error).message);
              } finally {
                setDeleting(false);
              }
            }}
            disabled={deleting}
          >
            {deleting ? "Удаляю..." : "Удалить карточку"}
          </button>
          {deleteError && <p className="error small">{deleteError}</p>}
        </div>
      </div>
    </div>
  );
};
