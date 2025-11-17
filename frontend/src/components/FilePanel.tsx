import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { FileAsset } from "../types";

interface Props {
  projectId: string;
}

export const FilePanel = ({ projectId }: Props) => {
  const [files, setFiles] = useState<FileAsset[]>([]);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null); // ID скачиваемого файла
  const [error, setError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  // Загрузка списка файлов при старте
  useEffect(() => {
    let mounted = true;
    const loadFiles = async () => {
      setListError(null);
      try {
        const list = await api.getFiles(projectId);
        if (mounted) {
          setFiles(list);
        }
      } catch (err) {
        setListError((err as Error).message);
      }
    };

    if (projectId) {
      loadFiles();
    }
    return () => {
      mounted = false;
    };
  }, [projectId]);

  // Загрузка файла (исправлен сброс формы)
  const handleUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget; // Сохраняем ссылку
    const formData = new FormData(form);
    const file = formData.get("file");

    if (!(file instanceof File) || !file.size) return;

    setUploading(true);
    setError(null);
    try {
      const uploaded = await api.uploadFile(projectId, file);
      setFiles((prev) => [...prev, uploaded]);
      form.reset(); // Используем сохраненную ссылку
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  // Скачивание файла с авторизацией 
  const handleDownload = async (file: FileAsset) => {
    setDownloading(file.id);
    setError(null);
    try {
      const blob = await api.downloadFile(file.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      
      // Извлекаем имя файла из пути (e.g., /app/storage/.../uuid_filename.txt -> uuid_filename.txt)
      const parts = file.path.split(/[\/\\]/);
      a.download = parts[parts.length - 1];
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <section className="file-panel">
      <h3>Файлы проекта</h3>
      <form onSubmit={handleUpload}>
        <input name="file" type="file" required />
        <button typeS="submit" disabled={uploading}>
          {uploading ? "Загрузка..." : "Загрузить"}
        </button>
      </form>
      {error && <p className="error small">{error}</p>}
      
      <ul>
        {listError && <li className="error small">Не удалось загрузить список</li>}
        {!listError && files.length === 0 && <li className="muted">Нет файлов</li>}
        
        {files.map((file) => (
          <li key={file.id}>
            {}
            <button
              type="button"
              className="link-button" 
              onClick={() => handleDownload(file)}
              disabled={downloading === file.id}
            >
              {downloading === file.id
                ? "Скачиваю..."
                : `${file.mime} · ${(file.size / 1024).toFixed(1)} КБ`}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
};