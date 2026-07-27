"use client";

import { useRef } from "react";

type MobileNavigationProps = {
  items: Array<{ label: string; href: string }>;
};

export function SitesMobileNavigation({ items }: MobileNavigationProps) {
  const menuRef = useRef<HTMLDetailsElement>(null);

  const closeMenu = () => {
    menuRef.current?.removeAttribute("open");
  };

  return (
    <details className="mobile-menu" ref={menuRef}>
      <summary aria-label="Abrir menu">
        <span />
        <span />
        <span />
      </summary>
      <nav aria-label="Navegação para celular">
        {items.map((item) => (
          <a key={item.href} href={item.href} onClick={closeMenu}>
            {item.label}
          </a>
        ))}
      </nav>
    </details>
  );
}
