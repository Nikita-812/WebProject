import { useEffect } from "react";
import { getSocket } from "../lib/socket";
import { useBoardStore } from "../store/board";
import type { Card, Message, UUID } from "../types";

interface TypingPayload {
  userId: string;
  displayName?: string;
}

interface Options {
  projectId?: string;
  onMessage?: (message: Message) => void;
  onTyping?: (payload: TypingPayload) => void;
}

export const useRealtime = ({ projectId, onMessage, onTyping }: Options): void => {
  useEffect(() => {
    if (!projectId) return;
    const socket = getSocket();
    socket.emit("join_room", { projectId });

    const { upsertCard, moveCard, deleteCard, removeColumn } = useBoardStore.getState();

    const handleCardCreated = (payload: Card) => upsertCard(payload);
    const handleCardUpdated = (payload: Card) => upsertCard(payload);
    const handleCardMoved = (payload: {
      id: string;
      toColumnId: string;
      position: number;
      version?: number;
    }) =>
      moveCard({
        id: payload.id,
        toColumnId: payload.toColumnId,
        position: payload.position,
        version: payload.version,
      });
    const handleMessageCreated = (payload: any) => {
      const message: Message = {
        id: payload.id,
        project_id: payload.projectId,
        user_id: payload.userId,
        content: payload.text,
        created_at: payload.createdAt,
        user_display_name: payload.displayName,
      };
      onMessage?.(message);
    };
    const handleTyping = (payload: TypingPayload) => onTyping?.(payload);

    const handleCardDeleted = (payload: { id: string }) => deleteCard(payload.id as UUID);
    const handleColumnDeleted = (payload: { id: string }) => removeColumn(payload.id as UUID);

    socket.on("card.created", handleCardCreated);
    socket.on("card.updated", handleCardUpdated);
    socket.on("card.moved", handleCardMoved);
    socket.on("card.deleted", handleCardDeleted);
    socket.on("column.deleted", handleColumnDeleted);
    socket.on("chat.message.created", handleMessageCreated);
    socket.on("chat.typing", handleTyping);

    return () => {
      socket.emit("leave_room", { projectId });
      socket.off("card.created", handleCardCreated);
      socket.off("card.updated", handleCardUpdated);
      socket.off("card.moved", handleCardMoved);
      socket.off("card.deleted", handleCardDeleted);
      socket.off("column.deleted", handleColumnDeleted);
      socket.off("chat.message.created", handleMessageCreated);
      socket.off("chat.typing", handleTyping);
    };
  }, [projectId, onMessage, onTyping]);
};
