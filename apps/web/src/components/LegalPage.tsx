import type { ReactNode } from "react";
import { LEGAL_UPDATED } from "@/lib/legal";

/**
 * A document page (terms, privacy, risk): its one title and the date it last changed, then a contents rail beside one
 * readable column, as the spec's documents are laid out. Each section is an `h2` whose id the rail links to.
 */
export function LegalPage({ title, sections, children }: { title: string; sections: readonly (readonly [id: string, heading: string])[]; children: ReactNode }) {
  return (
    <>
      <div className="shell page-head">
        <div>
          <h1>{title}</h1>
          <p>{LEGAL_UPDATED}</p>
        </div>
      </div>
      <div className="shell doc">
        <nav aria-label="On this page">
          {sections.map(([id, heading]) => (
            <a key={id} href={`#${id}`}>
              {heading}
            </a>
          ))}
        </nav>
        <article className="prose">{children}</article>
      </div>
    </>
  );
}
