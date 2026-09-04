"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError("No pudimos iniciar sesión. Revisa el correo y la contraseña.");
      setLoading(false);
      return;
    }

    router.replace("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <form onSubmit={handleSubmit} className="card card-pad w-full max-w-sm">
        <div className="mb-5">
          <h1 className="text-xl font-semibold text-text">WOW Sales</h1>
          <p className="mt-1 text-sm text-text-soft">Inicia sesión para continuar.</p>
        </div>

        <div className="mb-4">
          <label htmlFor="email" className="field-label">
            Correo
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
          />
        </div>

        <div className="mb-4">
          <label htmlFor="password" className="field-label">
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
          />
        </div>

        {error && (
          <p className="mb-4 rounded-xl border border-danger/30 bg-danger-bg p-3 text-sm text-[#b42318]">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary w-full"
        >
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
