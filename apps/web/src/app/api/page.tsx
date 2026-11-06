import type { Metadata } from "next";
import type { ReactNode } from "react";
import { API_KEY_RATE_LIMIT_DEFAULT } from "@launchpad/contract";
import { API_URL, getPlatform } from "@/lib/api";
import { SITE_LINKS } from "@/lib/site";
import { ERRORS, OPERATOR, PREPARING, READING, REFERRALS, SIGN_SEND_REPORT, SIGNING, type Row, type Section } from "./reference";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Developers",
  description: "Stoker's public API: every read open, every launch and trade returned unsigned for your wallet to sign.",
};

const METHODS = new Set(["GET", "POST", "PUT", "DELETE"]);

/** The rail beside the reference, in the page's order. */
const CONTENTS = [
  ["start", "Quickstart"],
  [READING.id, READING.title],
  [PREPARING.id, PREPARING.title],
  [SIGNING.id, SIGNING.title],
  [REFERRALS.id, REFERRALS.title],
  ["limits", "Keys and limits"],
  [ERRORS.id, ERRORS.title],
  [OPERATOR.id, OPERATOR.title],
] as const;

/**
 * Developers (#12, the spec's `api.html` with production's whole reference, `./reference`): a quickstart the API answers
 * for this very page view, every endpoint, keys and limits, the errors and the operator's endpoints, with the contents
 * as a rail beside them. The answer waits for the API: without one the request still stands, and nothing says it failed.
 */
export default async function ApiPage() {
  const base = `${API_URL}/v1`;
  const answer = await getPlatform()
    .then((p) => JSON.stringify(p, null, 2))
    .catch(() => null);
  return (
    <>
      <div className="shell page-head">
        <h1>The API</h1>
      </div>
      <div className="shell doc">
        <nav aria-label="On this page">
          {CONTENTS.map(([id, title]) => (
            <a key={id} href={`#${id}`}>
              {title}
            </a>
          ))}
        </nav>
        <div className={styles.endpoints}>
          <section className={`section ${styles.flush}`} id="start" aria-labelledby="start-title">
            <div className="section-head">
              <h2 id="start-title">Quickstart</h2>
            </div>
            <p className={styles.lead}>Every body is JSON, and every amount a raw integer as a decimal string.</p>
            <pre className={styles.code} data-live>{`curl ${base}/platform`}</pre>
            {answer && (
              <pre className={styles.code} data-live data-answer>
                {answer}
              </pre>
            )}
          </section>

          <ReferenceSection section={READING} />
          <ReferenceSection section={PREPARING} />
          <ReferenceSection section={SIGNING}>
            <pre className={styles.code}>{SIGN_SEND_REPORT}</pre>
          </ReferenceSection>
          <ReferenceSection section={REFERRALS} />

          <section className="section" id="limits" aria-labelledby="limits-title">
            <div className="section-head">
              <h2 id="limits-title">Keys and limits</h2>
            </div>
            <dl className="panel pad kv">
              <div>
                <dt>Without a key</dt>
                <dd>300 requests a minute, 25 prepares, per IP address</dd>
              </div>
              <div>
                <dt>With a key</dt>
                <dd>{API_KEY_RATE_LIMIT_DEFAULT} requests a minute, by default</dd>
              </div>
              <div>
                <dt>Header</dt>
                <dd>
                  <code>x-api-key</code>
                </dd>
              </div>
              <div>
                <dt>Your key&apos;s limits</dt>
                <dd>
                  <code>GET /keys/me</code>
                </dd>
              </div>
              <div>
                <dt>Ask for a key</dt>
                <dd>
                  <a className="link" href={`mailto:${SITE_LINKS.email}`}>
                    {SITE_LINKS.email}
                  </a>
                </dd>
              </div>
            </dl>
          </section>

          <ReferenceSection section={ERRORS} />
          <ReferenceSection section={OPERATOR} />
        </div>
      </div>
    </>
  );
}

/** A section of the reference: its title and badge, what holds for all of it, then a row per endpoint. */
function ReferenceSection({ section, children }: { section: Section; children?: ReactNode }) {
  const title = `${section.id}-title`;
  return (
    <section className="section" id={section.id} aria-labelledby={title}>
      <div className="section-head">
        <h2 id={title}>{section.title}</h2>
        {section.badge && <span className="badge">{section.badge}</span>}
      </div>
      {section.lead && <p className={styles.lead}>{section.lead}</p>}
      {section.rows && (
        <dl className={`panel ${styles.rows}`}>
          {section.rows.map((row) => (
            <ReferenceRow key={row.endpoints[0]} row={row} />
          ))}
        </dl>
      )}
      {children}
    </section>
  );
}

/** A path that may wrap after each slash and before its query, never inside a segment: `/launches/:mint/airdrop/prepare` on a phone. */
function breakable(path: string) {
  return path.split(/(?<=.\/)|(?=\?)/).flatMap((part, i) => (i === 0 ? [part] : [<wbr key={i} />, part]));
}

/** One row: each endpoint on a line, its method in the gold, then what it answers. */
function ReferenceRow({ row }: { row: Row }) {
  return (
    <div className={styles.row}>
      <dt>
        {row.endpoints.map((endpoint) => {
          const [method, ...rest] = endpoint.split(" ");
          const verb = METHODS.has(method!) ? method : null;
          return (
            <span key={endpoint} className={styles.endpoint}>
              {verb && <span className={styles.method}>{verb}</span>}
              <code>{breakable(verb ? rest.join(" ") : endpoint)}</code>
            </span>
          );
        })}
      </dt>
      <dd>{row.text}</dd>
    </div>
  );
}
