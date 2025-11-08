export type UUID = string;

export interface User {
  id: UUID;
  email: string;
  display_name: string;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Project {
  id: UUID;
  name: string;
  owner_id: UUID;
  created_at: string;
}

export interface Column {
  id: UUID;
  board_id: UUID;
  name: string;
  order: number;
}

export interface Card {
  id: UUID;
  project_id: UUID;
  column_id: UUID;
  title: string;
  description?: string | null;
  labels: unknown[];
  assignees: string[];
  priority?: "low" | "medium" | "high" | null;
  due_date?: string | null;
  position: number;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface BoardSnapshot {
  board_id: UUID;
  columns: Column[];
  cards: Card[];
}

export interface Message {
  id: UUID;
  user_id: UUID;
  project_id: UUID;
  content: string;
  created_at: string;
  user_display_name?: string | null;
}

export interface FileAsset {
  id: UUID;
  project_id: UUID;
  user_id?: UUID | null;
  path: string;
  mime: string;
  size: number;
  created_at: string;
}
