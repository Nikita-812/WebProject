import type { FormEvent } from "react";
import { useState } from "react";
import type { Project } from "../types";

interface Props {
  projects: Project[];
  selected?: string;
  onSelect: (id: string) => void;
  onCreate: (name: string) => Promise<void>;
}

export const ProjectSidebar = ({ projects, selected, onSelect, onCreate }: Props) => {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    await onCreate(name.trim());
    setName("");
    setLoading(false);
  };

  return (
    <aside className="sidebar">
      <div className="sidebar__header">
        <h2>Проекты</h2>
      </div>
      <ul className="sidebar__list">
        {projects.map((project) => (
          <li key={project.id}>
            <button
              type="button"
              className={project.id === selected ? "active" : ""}
              onClick={() => onSelect(project.id)}
            >
              {project.name}
            </button>
          </li>
        ))}
      </ul>
      <form className="sidebar__form" onSubmit={handleCreate}>
        <input
          type="text"
          placeholder="Новый проект"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" disabled={loading}>
          {loading ? "..." : "Создать"}
        </button>
      </form>
    </aside>
  );
};
