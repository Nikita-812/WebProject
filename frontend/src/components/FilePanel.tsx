import type { FormEvent } from "react";
import { useState } from "react";
import { api } from "../api/client";
import type { FileAsset } from "../types";

interface Props {
  projectId: string;
}

export const FilePanel = ({ projectId }: Props) => {
  const [files, setFiles] = useState<FileAsset[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const file = formData.get("file");
    if (!(file instanceof File) || !file.size) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded = await api.uploadFile(projectId, file);
      setFiles((prev) => [...prev, uploaded]);
      event.currentTarget.reset();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="file-panel">
      <h3>Файлы проекта</h3>
      <form onSubmit={handleUpload}>
        <input name="file" type="file" required />
        <button type="submit" disabled={uploading}>
          {uploading ? "Загрузка..." : "Загрузить"}
        </button>
      </form>
      {error && <p className="error small">{error}</p>}
      <ul>
        {files.map((file) => (
          <li key={file.id}>
            <a href={`/files/${file.id}`} target="_blank" rel="noreferrer">
              {file.mime} · {(file.size / 1024).toFixed(1)} КБ
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
};
