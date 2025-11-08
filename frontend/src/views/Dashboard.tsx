import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { BoardView } from "../components/BoardView";
import { CardDetailsDrawer } from "../components/CardDetailsDrawer";
import { ChatPanel } from "../components/ChatPanel";
import { FilePanel } from "../components/FilePanel";
import { ProjectSidebar } from "../components/ProjectSidebar";
import { ColumnCreator } from "../components/ColumnCreator";
import { useRealtime } from "../hooks/useRealtime";
import { getSocket } from "../lib/socket";
import { useBoardStore } from "../store/board";
import { useAuthStore } from "../store/auth";
import type { Card, Message, Project, UUID } from "../types";

export const Dashboard = () => {
  const user = useAuthStore((state) => state.user);
  const clear = useAuthStore((state) => state.clear);
  const [selectedProject, setSelectedProject] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingUser, setTypingUser] = useState<{ id: string; displayName?: string } | null>(null);
  const typingTimeout = useRef<number | undefined>(undefined);
  const hydrateBoard = useBoardStore((state) => state.hydrate);
  const clearBoard = useBoardStore((state) => state.clear);
  const upsertCard = useBoardStore((state) => state.upsertCard);
  const columns = useBoardStore((state) => state.columns);
  const cards = useBoardStore((state) => state.cards);
  const [boardId, setBoardId] = useState<string | null>(null);
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [cardLoading, setCardLoading] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const deleteCardFromStore = useBoardStore((state) => state.deleteCard);

  const { data: projects = [], refetch: refetchProjects } = useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: api.getProjects,
  });

  useEffect(() => {
    if (!selectedProject && projects.length) {
      setSelectedProject(projects[0].id);
    }
  }, [projects, selectedProject]);

  useEffect(() => {
    if (!selectedProject) {
      clearBoard();
      setMessages([]);
      setTypingUser(null);
      setBoardId(null);
      setActiveCard(null);
      return;
    }
    api.getBoard(selectedProject).then((snapshot) => {
      hydrateBoard(snapshot);
      setBoardId(snapshot.board_id);
    });
    api.getMessages(selectedProject).then(setMessages);
  }, [selectedProject, hydrateBoard, clearBoard]);

  const handleRealtimeMessage = useCallback((message: Message) => {
    setMessages((prev) => {
      if (prev.some((item) => item.id === message.id)) {
        return prev;
      }
      return [...prev, message];
    });
  }, []);

  const handleRealtimeTyping = useCallback(
    (payload: { userId: string; displayName?: string }) => {
      if (payload.userId === user?.id) return;
      setTypingUser({ id: payload.userId, displayName: payload.displayName });
      window.clearTimeout(typingTimeout.current);
      typingTimeout.current = window.setTimeout(() => setTypingUser(null), 1500);
    },
    [user?.id],
  );

  useRealtime({
    projectId: selectedProject,
    onMessage: handleRealtimeMessage,
    onTyping: handleRealtimeTyping,
  });

  const handleSendMessage = async (text: string) => {
    if (!selectedProject || !user) {
      throw new Error("Проект не выбран");
    }
    const optimisticId =
      typeof window !== "undefined" && window.crypto?.randomUUID
        ? window.crypto.randomUUID()
        : Math.random().toString(36).slice(2);
    const optimisticMessage: Message = {
      id: optimisticId,
      project_id: selectedProject,
      user_id: user.id,
      content: text,
      created_at: new Date().toISOString(),
      user_display_name: user.display_name,
    };
    setMessages((prev) => [...prev, optimisticMessage]);
    const socket = getSocket();
    await new Promise<{ id?: string; createdAt?: string }>((resolve, reject) => {
      socket.timeout(5000).emit(
        "chat.message",
        { tempId: optimisticId, projectId: selectedProject, text },
        (response: any) => {
          if (response?.error) {
            reject(new Error(response.error));
          } else {
            resolve(response ?? {});
          }
        },
      );
    })
      .then((ack) => {
        if (!ack?.id) return;
        setMessages((prev) =>
          prev.map((message) =>
            message.id === optimisticId ? { ...message, id: ack.id!, created_at: ack.createdAt ?? message.created_at } : message,
          ),
        );
      })
      .catch((error) => {
        setMessages((prev) => prev.filter((message) => message.id !== optimisticId));
        throw error;
      });
  };

  const handleTyping = () => {
    if (!selectedProject || !user) return;
    const socket = getSocket();
    socket.emit("chat.typing", { projectId: selectedProject, userId: user.id });
  };

  const handleCreateProject = async (name: string) => {
    const project = await api.createProject({ name });
    setSelectedProject(project.id);
    await refetchProjects();
  };

  const handleSelectCard = async (cardId: string) => {
    setCardLoading(true);
    try {
      const card = await api.getCard(cardId);
      setActiveCard(card);
    } finally {
      setCardLoading(false);
    }
  };

  const handleSaveCard = async (payload: Record<string, unknown>) => {
    if (!activeCard) return;
    const applyCardState = (nextCard: Card) => {
      upsertCard(nextCard);
      setActiveCard(nextCard);
    };
    try {
      const updated = await api.updateCard(activeCard.id, {
        ...payload,
        clientVersion: activeCard.version,
      });
      applyCardState(updated);
    } catch (error) {
      if ((error as Error).message === "Failed to fetch") {
        try {
          const latest = await api.getCard(activeCard.id);
          applyCardState(latest);
          return;
        } catch (fallbackError) {
          throw fallbackError;
        }
      }
      throw error;
    }
  };

  const handleMoveCard = async ({ toColumnId, position }: { toColumnId: string; position: number }) => {
    if (!activeCard) return;
    const moved = await api.moveCard(activeCard.id, {
      fromColumnId: activeCard.column_id,
      toColumnId,
      position,
      clientVersion: activeCard.version,
    });
    upsertCard(moved);
    setActiveCard(moved);
  };

  const handleDeleteCard = async (cardId: string) => {
    await api.deleteCard(cardId);
    deleteCardFromStore(cardId as UUID);
    setActiveCard(null);
  };

  const currentProject = useMemo(
    () => projects.find((project) => project.id === selectedProject),
    [projects, selectedProject],
  );
  const avatarInitials = useMemo(() => {
    if (!user?.display_name) return "??";
    return user.display_name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0]?.toUpperCase())
      .slice(0, 2)
      .join("");
  }, [user?.display_name]);
  const boardStats = useMemo(
    () => ({
      columns: columns.length,
      cards: cards.length,
    }),
    [columns, cards],
  );
  const hasProjects = projects.length > 0;

  return (
    <div className="workspace">
      <header className="workspace__topbar">
        <div className="workspace__brand">
          <span className="workspace__logo">Flowboard</span>
          <span className="workspace__tagline">Realtime Kanban</span>
        </div>
        <div className="workspace__user">
          <div className="user-chip">
            <span className="user-chip__avatar">{avatarInitials}</span>
            <div className="user-chip__meta">
              <strong>{user?.display_name ?? "Гость"}</strong>
              <small>{user?.email ?? "Не указан"}</small>
            </div>
          </div>
          <button type="button" className="ghost" onClick={() => clear()}>
            Выйти
          </button>
        </div>
      </header>
      <div className="workspace__content">
        <ProjectSidebar
          projects={projects}
          selected={selectedProject}
          onSelect={setSelectedProject}
          onCreate={handleCreateProject}
        />
        <section className="workspace__board">
          <div className="board-hero">
            <div>
              <p className="eyebrow">Рабочая доска</p>
              <h1>{currentProject?.name ?? "Выберите проект"}</h1>
              <div className="board-hero__meta">
                <span>{boardStats.columns} колонок</span>
                <span>{boardStats.cards} карточек</span>
                <span>{projects.length} проектов</span>
              </div>
            </div>
            <div className="board-hero__actions">
              <button type="button" className="ghost" onClick={() => refetchProjects()}>
                Обновить список
              </button>
            </div>
          </div>
          {hasProjects && (
            <div className="board-tabs">
              {projects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  className={`project-chip${project.id === selectedProject ? " active" : ""}`}
                  onClick={() => setSelectedProject(project.id)}
                >
                  {project.name}
                </button>
              ))}
            </div>
          )}
          <div className="workspace__canvas">
            {selectedProject ? (
              <>
                <div className="workspace__secondary">
                  <ColumnCreator boardId={boardId} />
                  <FilePanel projectId={selectedProject} />
                </div>
                <div className="board-surface">
                  <BoardView projectId={selectedProject} onSelectCard={handleSelectCard} />
                </div>
              </>
            ) : (
              <div className="empty-state">
                <h2>Нет выбранного проекта</h2>
                <p>Создайте новый проект или выберите его в списке слева, чтобы увидеть доску.</p>
              </div>
            )}
          </div>
        </section>
      </div>
      {activeCard && !cardLoading && (
        <CardDetailsDrawer
          card={activeCard}
          columns={columns}
          onClose={() => setActiveCard(null)}
          onSave={handleSaveCard}
          onMove={handleMoveCard}
          onDelete={() => handleDeleteCard(activeCard.id)}
        />
      )}
      {selectedProject && (
        <>
          <button
            type="button"
            className="chat-toggle"
            onClick={() => setIsChatOpen((prev) => !prev)}
          >
            {isChatOpen ? "Скрыть чат" : "Открыть чат"}
          </button>
          {isChatOpen && (
            <div className="chat-window">
              <ChatPanel
                messages={messages}
                typingUser={typingUser}
                onSend={handleSendMessage}
                onTyping={handleTyping}
                currentUserId={user?.id}
                onClose={() => setIsChatOpen(false)}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
};
