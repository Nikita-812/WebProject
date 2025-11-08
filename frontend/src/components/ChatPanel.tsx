import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import DOMPurify from "dompurify";
import type { Message } from "../types";

interface TypingIndicator {
  id: string;
  displayName?: string;
}

interface Props {
  messages: Message[];
  onSend: (text: string) => Promise<void>;
  typingUser?: TypingIndicator | null;
  onTyping?: () => void;
  currentUserId?: string;
  onClose?: () => void;
}

const initialsFrom = (name?: string | null) => {
  if (!name) return "??";
  const [first, second] = name.trim().split(/\s+/);
  return `${first?.[0] ?? ""}${second?.[0] ?? ""}`.toUpperCase() || first?.slice(0, 2).toUpperCase() || "??";
};

const formatTime = (value: string) =>
  new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

export const ChatPanel = ({ messages, onSend, typingUser, onTyping, currentUserId, onClose }: Props) => {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUser]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await onSend(text.trim());
      setText("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const chatMessages = useMemo(() => messages, [messages]);

  return (
    <aside className="chat">
      <header className="chat__header">
        <div>
          <h3>Чат проекта</h3>
          <p>Обсуждайте идеи и уточняйте детали задач</p>
        </div>
        {onClose && (
          <button type="button" className="chat__close" onClick={onClose} aria-label="Закрыть чат">
            ×
          </button>
        )}
      </header>
      <div className="chat__messages">
        {chatMessages.length === 0 && (
          <div className="chat__empty">
            <p>Сообщений пока нет</p>
            <small>Будьте первым, кто напишет что-нибудь команде.</small>
          </div>
        )}
        {chatMessages.map((message) => {
          const isOwn = currentUserId && message.user_id === currentUserId;
          const displayName = isOwn ? "Вы" : message.user_display_name ?? "Участник";
          return (
            <div key={message.id} className={`chat__message${isOwn ? " chat__message--own" : ""}`}>
              <div className="chat__avatar">{initialsFrom(displayName)}</div>
              <div className="chat__bubble">
                <div className="chat__meta">
                  <strong>{displayName}</strong>
                  <span>{formatTime(message.created_at)}</span>
                </div>
                <p dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(message.content) }} />
              </div>
            </div>
          );
        })}
        {typingUser && (
          <div className="chat__message chat__message--typing">
            <div className="chat__avatar">{initialsFrom(typingUser.displayName)}</div>
            <div className="chat__bubble">
              <div className="chat__meta">
                <strong>{typingUser.displayName ?? "Участник"}</strong>
                <span>печатает...</span>
              </div>
              <div className="typing-dots">
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSubmit} className="chat__form">
        <input
          type="text"
          placeholder="Напишите сообщение…"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (e.target.value.trim()) {
              onTyping?.();
            }
          }}
        />
        <button type="submit" disabled={loading || !text.trim()}>
          {loading ? "Отправка…" : "Отправить"}
        </button>
      </form>
      {error && <p className="error small">{error}</p>}
    </aside>
  );
};
