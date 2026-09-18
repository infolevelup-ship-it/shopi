"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function OlvidePasswordPage() {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/restablecer-password`,
    });

    setLoading(false);
    // Se muestra el mismo mensaje exista o no ese correo: decir "ese correo
    // no existe" le confirmaría a cualquiera qué correos son de la empresa.
    if (error) {
      setError("No se pudo enviar el correo. Intenta de nuevo en un momento.");
      return;
    }
    setEnviado(true);
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="card card-pad w-full max-w-sm">
        <div className="mb-5">
          <h1 className="text-xl font-semibold text-text">Recuperar acceso</h1>
          <p className="mt-1 text-sm text-text-soft">
            Te enviamos un enlace a tu correo para poner una contraseña nueva.
          </p>
        </div>

        {enviado ? (
          <>
            <p className="mb-4 rounded-xl border border-success/30 bg-success-bg p-3 text-sm text-[#05834b]">
              Si ese correo tiene una cuenta aquí, te va a llegar un enlace en
              los próximos minutos. Ábrelo desde el mismo celular o
              computador donde vas a usar la app.
            </p>
            <Link href="/login" className="btn btn-secondary w-full">
              Volver a iniciar sesión
            </Link>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
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
              {loading ? "Enviando…" : "Enviar enlace"}
            </button>
            <Link
              href="/login"
              className="mt-3 inline-block text-sm text-text-soft underline"
            >
              Volver a iniciar sesión
            </Link>
          </form>
        )}
      </div>
    </main>
  );
}
