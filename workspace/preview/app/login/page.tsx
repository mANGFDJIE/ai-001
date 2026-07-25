"use client";
import { useState } from "react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<{ text: string; type: "error" | "success" } | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setMessage({ text: "⚠️ Заполните оба поля", type: "error" });
      return;
    }
    setMessage({ text: `✅ Добро пожаловать, ${username}! (демо)`, type: "success" });
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0e1117] p-5">
      <div className="bg-[#161b22] border border-[#2a313c] rounded-xl p-8 w-full max-w-sm shadow-lg">
        <h1 className="text-2xl font-semibold text-center text-[#c9d1d9] mb-1">🔐 Вход</h1>
        <p className="text-center text-sm text-[#8b949e] mb-6">Введите свои учётные данные</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-[#b1bac4] mb-1">Имя пользователя</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="username"
              className="w-full px-3 py-2 bg-[#0d1117] border border-[#30363d] rounded-lg text-[#c9d1d9] placeholder-[#484f58] focus:outline-none focus:border-[#58a6ff] transition-colors"
              autoComplete="username"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-[#b1bac4] mb-1">Пароль</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 bg-[#0d1117] border border-[#30363d] rounded-lg text-[#c9d1d9] placeholder-[#484f58] focus:outline-none focus:border-[#58a6ff] transition-colors"
              autoComplete="current-password"
            />
          </div>
          <button
            type="submit"
            className="w-full py-2.5 bg-[#238636] rounded-lg text-white font-semibold text-sm hover:bg-[#2ea043] transition-colors cursor-pointer mt-2"
          >
            Войти
          </button>
        </form>

        {message && (
          <p className={`mt-4 text-center text-sm ${message.type === "error" ? "text-[#f85149]" : "text-[#3fb950]"}`}>
            {message.text}
          </p>
        )}

        <p className="mt-6 text-center text-sm">
          <a href="#" className="text-[#58a6ff] hover:underline">Забыли пароль?</a>
        </p>
      </div>
    </div>
  );
}
