import type { FormEvent } from "react";
import { useState } from "react";
import { api } from "../api/client";
import { useBoardStore } from "../store/board";

interface Props {
  boardId: string | null;
}

export const ColumnCreator = ({ boardId }: Props) => {
  const addColumn = useBoardStore((state) => state.addColumn);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!boardId || !name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const column = await api.createColumn({ board_id: boardId, name: name.trim() });
      addColumn(column);
      setName("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="side-panel creator-panel">
      <h3>Новая колонка</h3>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Название колонки"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={!boardId}
        />
        <button type="submit" disabled={!boardId || !name.trim() || loading}>
          {loading ? "Создаю..." : "Создать"}
        </button>
      </form>
      {error && <p className="error small">{error}</p>}
      {!boardId && <small>Создайте проект или выберите его, чтобы добавить колонку.</small>}
    </section>
  );
};
