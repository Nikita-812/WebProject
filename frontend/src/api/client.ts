import { authToken } from "../store/auth";
import type {
  AuthResponse,
  BoardSnapshot,
  Card,
  Column,
  FileAsset,
  Message,
  Project,
} from "../types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

type JsonLike = Record<string, unknown> | unknown[] | null;
type RequestOptions = Omit<RequestInit, "body"> & {
  body?: JsonLike | BodyInit;
  skipAuth?: boolean;
};

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { skipAuth, body, ...rest } = options;

  const isMultipart =
    (typeof FormData !== "undefined" && body instanceof FormData) ||
    (typeof Blob !== "undefined" && body instanceof Blob) ||
    (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams);

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(isMultipart ? {} : { "Content-Type": "application/json" }),
    ...(rest.headers as Record<string, string> | undefined),
  };

  const token = authToken();
  if (token && !skipAuth) {
    headers.Authorization = `Bearer ${token}`;
  }

  let preparedBody: BodyInit | undefined;
  if (isMultipart) {
    preparedBody = body as BodyInit;
  } else if (typeof body === "string") {
    preparedBody = body;
  } else if (body !== undefined) {
    preparedBody = JSON.stringify(body);
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...rest,
    headers,
    body: preparedBody,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail ?? "Request failed");
  }

  if (response.status === 204) {
    return null as T;
  }

  return (await response.json()) as T;
}

//ФУНКЦИЯ ДЛЯ СКАЧИВАНИЯ С АВТОРИЗАЦИЕЙ
async function downloadRequest(endpoint: string): Promise<Blob> {
  const headers: Record<string, string> = {};
  const token = authToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail ?? "Request failed");
  }

  return response.blob();
}

export const api = {
  register: (payload: { email: string; password: string; display_name: string }) =>
    request("/auth/register", { method: "POST", body: payload, skipAuth: true }),
  login: (payload: { email: string; password: string }) =>
    request<AuthResponse>("/auth/login", { method: "POST", body: payload, skipAuth: true }),
  getProject: (projectId: string) => request<Project>(`/projects/${projectId}`),
  getMe: () => request("/me"),
  getProjects: () => request<Project[]>("/projects"),
  createProject: (payload: { name: string }) =>
    request<Project>("/projects", { method: "POST", body: payload }),
  getBoard: (projectId: string) => request<BoardSnapshot>(`/projects/${projectId}/board`),
  createColumn: (payload: { board_id: string; name: string; order?: number }) =>
    request<Column>("/columns", { method: "POST", body: payload }),
  updateColumn: (columnId: string, payload: { name?: string; order?: number }) =>
    request<Column>(`/columns/${columnId}`, { method: "PATCH", body: payload }),
  deleteColumn: (columnId: string) => request(`/columns/${columnId}`, { method: "DELETE" }),
  createCard: (payload: {
    project_id: string;
    column_id: string;
    title: string;
    description?: string;
    position?: number;
  }) => request<Card>("/cards", { method: "POST", body: payload }),
  getCard: (cardId: string) => request<Card>(`/cards/${cardId}`),
  updateCard: (cardId: string, payload: Record<string, unknown>) =>
    request<Card>(`/cards/${cardId}`, { method: "PATCH", body: payload }),
  deleteCard: (cardId: string) => request(`/cards/${cardId}`, { method: "DELETE" }),
  moveCard: (
    cardId: string,
    payload: { fromColumnId: string; toColumnId: string; position: number; clientVersion: number },
  ) =>
    request<Card>(`/cards/${cardId}/move`, {
      method: "POST",
      body: { id: cardId, ...payload },
    }),
  getMessages: (projectId: string) =>
    request<Message[]>(`/projects/${projectId}/messages?limit=50`),
  sendMessage: (projectId: string, content: string) =>
    request<Message>(`/projects/${projectId}/messages`, {
      method: "POST",
      body: { project_id: projectId, content },
    }),

  getFiles: (projectId: string) =>
    request<FileAsset[]>(`/files?project_id=${projectId}`),
    
  downloadFile: (fileId: string) => downloadRequest(`/files/${fileId}`),

  uploadFile: (projectId: string, file: File) => {
    const formData = new FormData();
    formData.append("upload", file);
    return request<FileAsset>(`/files?project_id=${projectId}`, {
      method: "POST",
      body: formData,
    });
  },
};