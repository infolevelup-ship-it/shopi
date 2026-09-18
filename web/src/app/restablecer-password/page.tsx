"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * A donde manda `resetPasswordForEmail` el enlace del correo. El cliente de
 * Supabase (`detectSessionInUrl`) procesa solo el código que trae la URL y
 * abre una sesión de recuperación — no hace falta leerlo a mano aquí. Si el
 * enlace ya se usó o venció, esa sesión nunca se abre y `updateUser` falla
 * abajo con un mensaje claro en vez de dejar el formulario ahí sin explicar
 * nada.
 */
export default function RestablecerPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [listo, setListo] = useState(false);

  // El navegador tarda un instante en procesar el código de la URL y abrir
  // la sesión de recuperación; sin esta espera, un envío inmediato podía
  // fallar aunque el enlace fuera válido.
  const [revisando, setRevisando] = useState(true);
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(() => setRevisando(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== password2) {
      setError("Las dos contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError(
        "El enlace ya venció o ya se usó. Pide uno nuevo desde \"¿Olvidaste tu contraseña?\" en la pantalla de inicio de sesión.",
      );
      return;
    }

    setListo(true);
    setTimeout(() => {
      router.replace("/");
      router.refresh();
    }, 1500);
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="card card-pad w-full max-w-sm">
        <div className="mb-5">
          <h1 className="text-xl font-semibold text-text">
            Elige una contraseña nueva
          </h1>
        </div>

        {revisando ? (
          <p className="text-sm text-text-soft">Un momento…</p>
        ) : listo ? (
          <p className="rounded-xl border border-success/30 bg-success-bg p-3 text-sm text-[#05834b]">
            Contraseña actualizada. Entrando…
          </p>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="password" className="field-label">
                Contraseña nueva
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
              />
            </div>

            <div className="mb-4">
              <label htmlFor="password2" className="field-label">
                Repítela
              </label>
              <input
                id="password2"
                type="password"
                required
                minLength={8}
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
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
              {loading ? "Guardando…" : "Guardar contraseña"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
