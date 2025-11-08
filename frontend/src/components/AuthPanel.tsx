import type { FormEvent } from "react";
import { useState } from "react";
import { api } from "../api/client";
import { useAuthStore } from "../store/auth";

export const AuthPanel = () => {
  const setAuth = useAuthStore((state) => state.setAuth);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [form, setForm] = useState({
    email: "",
    password: "",
    display_name: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (mode === "register") {
        await api.register({
          email: form.email,
          password: form.password,
          display_name: form.display_name || form.email,
        });
      }
      const result = await api.login({ email: form.email, password: form.password });
      setAuth(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-panel">
      <div className="auth-panel__header">
        <p className="eyebrow">Flowboard</p>
        <h1>Организуйте задачи как в Trello</h1>
        <p className="muted">Создайте аккаунт, чтобы собрать команду и вести доски в реальном времени.</p>
      </div>
      <div className="toggle">
        <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Вход</button>
        <button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>Регистрация</button>
      </div>
      <form onSubmit={handleSubmit} className="auth-form">
        {mode === "register" && (
          <label>
            Отображаемое имя
            <input
              type="text"
              value={form.display_name}
              onChange={(e) => setForm({ ...form, display_name: e.target.value })}
              required
            />
          </label>
        )}
        <label>
          Email
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
        </label>
        <label>
          Пароль
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
            minLength={8}
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? "Подождите..." : mode === "login" ? "Войти" : "Создать аккаунт"}
        </button>
      </form>
    </div>
  );
};
