"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ROLE_LABEL } from "@/lib/ui/status";
import {
  mobileNavItems,
  quickActions,
  visibleGroups,
  type NavItem,
} from "@/lib/ui/nav";

// AppShell (doc 11 §3/§4/§11/§14): sidebar permanente en desktop, drawer +
// barra inferior en móvil. Es un client component porque el drawer, el menú
// "+ Nuevo" y el resaltado del enlace activo son estado de navegador; los
// datos del usuario llegan ya resueltos desde el layout de servidor.

function isActive(pathname: string, item: NavItem) {
  if (item.href === "/") return pathname === "/";
  if (item.match) {
    // /orders/review no debe marcar también "Pedidos"
    if (item.match === "/orders" && pathname.startsWith("/orders/review")) return false;
    return pathname === item.match || pathname.startsWith(`${item.match}/`);
  }
  return pathname === item.href;
}

export function AppShell({
  user,
  children,
}: {
  user: { name: string; role: string };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);

  // Cerrar los paneles al navegar — si no, quedan abiertos sobre la pantalla
  // nueva después de tocar un enlace. Se ajusta durante el render y no en un
  // efecto: así React lo resuelve en la misma pasada, sin pintar primero la
  // pantalla nueva con el panel todavía abierto.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setDrawerOpen(false);
    setQuickOpen(false);
  }

  const groups = visibleGroups(user.role);
  const mobileItems = mobileNavItems(user.role);
  const actions = quickActions(user.role);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const navList = (
    <nav className="flex-1 overflow-y-auto px-3 py-4">
      {groups.map((group, gi) => (
        <div key={gi} className={gi > 0 ? "mt-6" : ""}>
          {group.title && (
            <p className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-white/40 uppercase">
              {group.title}
            </p>
          )}
          <ul className="space-y-1">
            {group.items.map((item) => {
              const active = isActive(pathname, item);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-[44px] items-center gap-3 rounded-lg px-3 text-sm font-medium transition ${
                      active
                        ? "bg-white/12 text-white"
                        : "text-white/70 hover:bg-white/8 hover:text-white"
                    }`}
                  >
                    <span aria-hidden>{item.icon}</span>
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const brand = (
    <div className="flex h-16 flex-none items-center border-b border-white/10 px-5">
      <span className="text-base font-semibold tracking-tight text-white">WOW Sales</span>
    </div>
  );

  return (
    <div className="min-h-screen md:grid md:grid-cols-[var(--sidebar-width)_1fr]">
      {/* ------------------------------------------------ sidebar desktop */}
      <aside className="sticky top-0 hidden h-screen flex-col bg-sidebar md:flex">
        {brand}
        {navList}
        <div className="flex-none border-t border-white/10 p-3">
          <p className="px-3 text-sm font-medium text-white">{user.name}</p>
          <p className="px-3 text-xs text-white/50">
            {ROLE_LABEL[user.role] ?? user.role}
          </p>
          <button
            onClick={signOut}
            className="mt-2 w-full rounded-lg px-3 py-2 text-left text-sm text-white/60 transition hover:bg-white/8 hover:text-white"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* -------------------------------------------------- drawer móvil */}
      {drawerOpen && (
        <>
          <button
            aria-label="Cerrar menú"
            onClick={() => setDrawerOpen(false)}
            className="fixed inset-0 z-[999] bg-black/45 md:hidden"
          />
          <aside className="fixed inset-y-0 left-0 z-[1000] flex w-[min(84vw,320px)] flex-col bg-sidebar md:hidden">
            {brand}
            {navList}
            <div className="flex-none border-t border-white/10 p-3">
              <p className="px-3 text-sm font-medium text-white">{user.name}</p>
              <p className="px-3 text-xs text-white/50">
                {ROLE_LABEL[user.role] ?? user.role}
              </p>
              <button
                onClick={signOut}
                className="mt-2 w-full rounded-lg px-3 py-2 text-left text-sm text-white/60 hover:bg-white/8 hover:text-white"
              >
                Cerrar sesión
              </button>
            </div>
          </aside>
        </>
      )}

      {/* ------------------------------------------------------ contenido */}
      <div className="flex min-w-0 flex-col">
        {/* topbar solo móvil: en desktop el sidebar ya identifica la app */}
        <header className="sticky top-0 z-[400] flex h-14 items-center gap-3 border-b border-line bg-surface px-4 md:hidden">
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Abrir menú"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-lg text-text-soft"
          >
            ☰
          </button>
          <span className="font-semibold">WOW Sales</span>
        </header>

        <main className="main-content">{children}</main>
      </div>

      {/* --------------------------------------- barra inferior + acciones */}
      {quickOpen && (
        <>
          <button
            aria-label="Cerrar acciones"
            onClick={() => setQuickOpen(false)}
            className="fixed inset-0 z-[499] bg-black/45 md:hidden"
          />
          <div className="safe-bottom fixed right-0 bottom-16 left-0 z-[501] mx-3 rounded-2xl border border-line bg-surface p-2 shadow-[var(--shadow-md)] md:hidden">
            {actions.map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="flex min-h-[48px] items-center gap-3 rounded-xl px-3 text-sm font-medium text-text hover:bg-surface-soft"
              >
                <span aria-hidden>{a.icon}</span>
                {a.label}
              </Link>
            ))}
            {actions.length === 0 && (
              <p className="p-3 text-sm text-text-soft">
                Tu rol no crea pedidos ni cotizaciones.
              </p>
            )}
          </div>
        </>
      )}

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-[500] grid grid-cols-5 border-t border-line bg-surface/95 backdrop-blur md:hidden">
        {mobileItems.slice(0, 2).map((item) => (
          <MobileLink key={item.href} item={item} pathname={pathname} />
        ))}

        <button
          onClick={() => setQuickOpen((v) => !v)}
          aria-label="Nuevo"
          className="flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-xs text-text-soft"
        >
          <span
            aria-hidden
            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-lg leading-none text-white"
          >
            +
          </span>
          Nuevo
        </button>

        {mobileItems.slice(2, 4).map((item) => (
          <MobileLink key={item.href} item={item} pathname={pathname} />
        ))}
      </nav>
    </div>
  );
}

function MobileLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-xs ${
        active ? "font-semibold text-text" : "text-text-soft"
      }`}
    >
      <span aria-hidden className="text-base">
        {item.icon}
      </span>
      {item.label}
    </Link>
  );
}
