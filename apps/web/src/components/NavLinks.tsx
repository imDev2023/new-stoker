"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { sectionOf, type NavLink } from "@/lib/site";

/** The sections as links, the one the page belongs to marked current. */
export function NavLinks({ links }: { links: readonly NavLink[] }) {
  const current = sectionOf(usePathname() ?? "/");
  return links.map((l) => (
    <Link key={l.href} href={l.href} aria-current={l.href === current ? "page" : undefined}>
      {l.label}
    </Link>
  ));
}
