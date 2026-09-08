// Navegación por rol (doc 11 §2/§3). Regla deliberada: aquí solo van
// destinos que EXISTEN. El doc 11 dibuja además Despachos — esa pantalla no
// está construida todavía (no es rediseño, es funcionalidad nueva), y un
// enlace del menú que lleva a una pantalla inexistente es peor que un menú
// más corto.

import type { IconName } from "@/components/icons";

export type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  /** Roles que lo ven. Vacío = todos. */
  roles?: string[];
  /** Coincide también con subrutas (p.ej. /orders/123). */
  match?: string;
};

export type NavGroup = { title?: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    items: [{ href: "/", label: "Inicio", icon: "inicio" }],
  },
  {
    title: "Comercial",
    items: [
      { href: "/customers", label: "Clientes", icon: "clientes", match: "/customers" },
      {
        href: "/prospects",
        label: "Prospectos",
        icon: "prospectos",
        match: "/prospects",
        roles: ["SELLER", "SUPERVISOR", "ADMIN"],
      },
      {
        href: "/quotes",
        label: "Cotizaciones",
        icon: "cotizaciones",
        match: "/quotes",
        roles: ["SELLER", "SUPERVISOR", "ADMIN"],
      },
      { href: "/orders", label: "Pedidos", icon: "pedidos", match: "/orders" },
    ],
  },
  {
    title: "Operación",
    items: [
      { href: "/products", label: "Productos", icon: "productos", match: "/products" },
      {
        href: "/orders/review",
        label: "Bodega",
        icon: "bodega",
        roles: ["WAREHOUSE", "SUPERVISOR", "ADMIN"],
      },
    ],
  },
  {
    title: "Análisis",
    items: [{ href: "/reports", label: "Reportes", icon: "reportes", match: "/reports" }],
  },
  {
    title: "Administración",
    items: [
      {
        href: "/configuracion",
        label: "Configuración",
        icon: "configuracion",
        match: "/configuracion",
        roles: ["ADMIN"],
      },
    ],
  },
];

export function visibleGroups(role: string): NavGroup[] {
  return NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => !i.roles || i.roles.includes(role)),
  })).filter((g) => g.items.length > 0);
}

/** Barra inferior móvil: máximo 5 destinos (doc 11 §4/§14), el último es el menú. */
export function mobileNavItems(role: string): NavItem[] {
  if (role === "WAREHOUSE") {
    return [
      { href: "/", label: "Inicio", icon: "inicio" },
      { href: "/orders/review", label: "Bodega", icon: "bodega" },
      { href: "/orders", label: "Pedidos", icon: "pedidos", match: "/orders" },
      { href: "/customers", label: "Clientes", icon: "clientes", match: "/customers" },
    ];
  }
  return [
    { href: "/", label: "Inicio", icon: "inicio" },
    { href: "/customers", label: "Clientes", icon: "clientes", match: "/customers" },
    { href: "/orders", label: "Pedidos", icon: "pedidos", match: "/orders" },
    { href: "/quotes", label: "Cotizar", icon: "cotizaciones", match: "/quotes" },
  ];
}

/** Acciones del botón "+ Nuevo" en móvil (doc 11 §21). */
export function quickActions(role: string): NavItem[] {
  const all: NavItem[] = [
    {
      href: "/orders/new",
      label: "Nuevo pedido",
      icon: "pedidos",
      roles: ["SELLER", "SUPERVISOR", "ADMIN"],
    },
    {
      href: "/quotes/new",
      label: "Nueva cotización",
      icon: "cotizaciones",
      roles: ["SELLER", "SUPERVISOR", "ADMIN"],
    },
    {
      href: "/customers/new",
      label: "Nuevo cliente",
      icon: "clientes",
      roles: ["SELLER", "SUPERVISOR", "ADMIN"],
    },
    {
      href: "/prospects/new",
      label: "Nuevo prospecto",
      icon: "prospectos",
      roles: ["SELLER", "SUPERVISOR", "ADMIN"],
    },
    { href: "/products/new", label: "Nuevo producto", icon: "productos", roles: ["ADMIN"] },
  ];
  return all.filter((i) => !i.roles || i.roles.includes(role));
}
