import type { ReactNode } from "react";
import styles from "./Steps.module.css";

export type Step = { title: string; text: ReactNode };

/**
 * Three numbered steps in place of a lede (the spec's `.steps`, Holder rewards and Curated): each a panel, its number in
 * the gold, its name and one sentence. The section's name is for screen readers only, as the spec draws none.
 */
export function Steps({ label, steps }: { label: string; steps: readonly Step[] }) {
  const id = `steps-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <section className={`shell section ${styles.flush}`} aria-labelledby={id}>
      <h2 id={id} className="visually-hidden">{label}</h2>
      <ol className={styles.steps}>
        {steps.map((s) => (
          <li key={s.title} className="panel pad">
            <h3>{s.title}</h3>
            <p>{s.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
