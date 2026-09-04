// Navegación por rol (doc 11 §2/§3). Regla deliberada: aquí solo van
// destinos que EXISTEN. El doc 11 dibuja además Prospectos, Despachos y
// Configuración — esas pantallas no están construidas todavía (no son
// rediseño, son funcionalidad nueva), y un enlace del menú que lleva a una
// pantalla inexistente es peor que un menú más corto.

export type NavItem = {
  href: string;
  label: string;
  icon: string;
  /** Roles que lo ven. Vacío = todos. */
  roles?: string[];
  /** Coincide también con subrutas (p.ej. /orders/123). */
  match?: string;
};

export type NavGroup = { title?: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    items: [{ href: "/", label: "Inicio", icon: "🏠" }],
  },
  {
    title: "Comercial",
    items: [
      { href: "/customers", label: "Clientes", icon: "👥", match: "/customers" },
      {
        href: "/quotes",
        label: "Cotizaciones",
        icon: "📄",
        match: "/quotes",
        roles: ["SELLER", "SUPERVISOR", "ADMIN"],
      },
      { href: "/orders", label: "Pedidos", icon: "🛒", match: "/orders" },
    ],
  },
  {
    title: "Operación",
    items: [
      { href: "/products", label: "Productos", icon: "📦", match: "/products" },
      {
        href: "/orders/review",
        label: "Bodega",
        icon: "🏭",
        roles: ["WAREHOUSE", "SUPERVISOR", "ADMIN"],
      },
    ],
  },
  {
    title: "Análisis",
    items: [{ href: "/reports", label: "Reportes", icon: "📊", match: "/reports" }],
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
      { href: "/", label: "Inicio", icon: "🏠" },
      { href: "/orders/review", label: "Bodega", icon: "🏭" },
      { href: "/orders", label: "Pedidos", icon: "🛒", match: "/orders" },
      { href: "/customers", label: "Clientes", icon: "👥", match: "/customers" },
    ];
  }
  return [
    { href: "/", label: "Inicio", icon: "🏠" },
    { href: "/customers", label: "Clientes", icon: "👥", match: "/customers" },
    { href: "/orders", label: "Pedidos", icon: "🛒", match: "/orders" },
    { href: "/quotes", label: "Cotizar", icon: "📄", match: "/quotes" },
  ];
}

/** Acciones del botón "+ Nuevo" en móvil (doc 11 §21). */
export function quickActions(role: string): NavItem[] {
  const all: NavItem[] = [
    {
      href: "/orders/new",
      label: "Nuevo pedido",
      icon: "🛒",
      roles: ["SELLER", "SUPERVISOR", "ADMIN"],
    },
    {
      href: "/quotes/new",
      label: "Nueva cotización",
      icon: "📄",
      roles: ["SELLER", "SUPERVISOR", "ADMIN"],
    },
    {
      href: "/customers/new",
      label: "Nuevo cliente",
      icon: "👥",
      roles: ["SELLER", "SUPERVISOR", "ADMIN"],
    },
    { href: "/products/new", label: "Nuevo producto", icon: "📦", roles: ["ADMIN"] },
  ];
  return all.filter((i) => !i.roles || i.roles.includes(role));
}
