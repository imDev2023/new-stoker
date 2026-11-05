import Link from "next/link";
import styles from "./Figures.module.css";

/** One figure of a record page: its term, its value (and unit), and the record it is summed from. */
export type Figure = { key: string; term: string; value: string; unit?: string; href: string };

/**
 * A row of the records' figures (the spec's `.figures`), each value a link to the record it comes from (#11). The caller
 * passes only figures with a real, non-zero value; with none, the row is left out.
 */
export function Figures({ figures, label = "Figures" }: { figures: Figure[]; label?: string }) {
  if (!figures.length) return null;
  return (
    <section className="shell" aria-label={label} data-figures>
      <dl className="figures">
        {figures.map((f) => (
          <div key={f.key} data-figure={f.key}>
            <dt>{f.term}</dt>
            <dd>
              <Link className={styles.value} href={f.href}>
                {f.value}
                {f.unit && <small>{f.unit}</small>}
              </Link>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
