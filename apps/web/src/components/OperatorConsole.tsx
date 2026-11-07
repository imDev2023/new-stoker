"use client";

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  API_KEY_RATE_LIMIT_DEFAULT, API_KEY_RATE_LIMIT_MAX, FEE_BPS_MAX, type ApiKeyInfo, type FeeAnnouncement, type IssuedApiKey, type OperatorAlert,
  type OperatorOverview, type PlatformInfo, type PreparedFeeChange, type RegionGates,
} from "@launchpad/contract";
import {
  allowAirdropCreator, announceFeeChange, ApiRequestError, createApiKey, disallowAirdropCreator, getOperatorOverview, getRegionGates,
  listAirdropCreators, listAnnouncements, listApiKeys, listOperatorAlerts, MANUAL_JOBS, prepareFeeChange, putRegionGates, revokeApiKey,
  runOperatorJob, type ManualJob,
} from "@/lib/api";
import { formatUtc, shortAddress } from "@/lib/format";
import styles from "./OperatorConsole.module.css";

/** The token stays in this browser tab's session only (production's key). */
const TOKEN_KEY = "launchpad-operator-token";
const REFRESH_MS = 10_000;

type Loaded = {
  overview: OperatorOverview;
  alerts: OperatorAlert[];
  announcements: FeeAnnouncement[];
  keys: ApiKeyInfo[];
  airdropCreators: string[];
};

/** A section of the console: the spec's section with its head, and the panel under it. */
function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="shell section" id={id} aria-labelledby={`${id}-title`}>
      <div className="section-head">
        <h2 id={`${id}-title`}>{title}</h2>
      </div>
      {children}
    </section>
  );
}

/** A time in the console: UTC to the minute, inside a `<time>` so the suite's masks cover it. */
const When = ({ iso }: { iso: string }) => <time dateTime={iso} data-utc>{formatUtc(iso)}</time>;

/**
 * The operator console (`/operator`, #13; production's operator view, `12dbc10:apps/web/src/components/OperatorView.tsx`,
 * in the spec's system): Launches, rounds, burns and uploads at a glance, open alerts, the latest run of each job with a
 * button to run it now, fee-change announcements and the admin's transaction for one that is due, the Creator wallets
 * allowed an airdrop at launch, the region gates and the API keys. Behind the operator token, which stays in this tab's
 * session only; never linked from the public pages.
 */
export function OperatorConsole({ platform }: { platform: PlatformInfo }) {
  const [token, setToken] = useState<string | null>(null);
  const [tokenText, setTokenText] = useState("");
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [ran, setRan] = useState<{ job: ManualJob; status: string; error: string | null } | null>(null);

  useEffect(() => {
    try {
      setToken(sessionStorage.getItem(TOKEN_KEY));
    } catch {
      // No session storage: the token is typed on each visit.
    }
  }, []);

  const forget = useCallback(() => {
    try {
      sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      // nothing was kept
    }
    setToken(null);
    setData(null);
  }, []);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [overview, alerts, announcements, keys, airdropCreators] = await Promise.all([
        getOperatorOverview(token), listOperatorAlerts(token), listAnnouncements(), listApiKeys(token), listAirdropCreators(token),
      ]);
      setData({ overview, alerts: alerts.alerts, announcements: announcements.announcements, keys: keys.keys, airdropCreators: airdropCreators.wallets });
      setError(null);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 401) {
        forget();
        setError("That token was refused.");
      } else setError((e as Error).message);
    }
  }, [token, forget]);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  function signIn(e: FormEvent) {
    e.preventDefault();
    const t = tokenText.trim();
    if (!t) return;
    try {
      sessionStorage.setItem(TOKEN_KEY, t);
    } catch {
      // kept in memory only
    }
    setError(null);
    setToken(t);
    setTokenText("");
  }

  /** Runs one action, then reads everything again; its error, if any, is shown at the top. */
  async function act(label: string, work: () => Promise<void>) {
    setBusy(label);
    setError(null);
    try {
      await work();
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(null);
  }

  if (!token) {
    return (
      <>
        <div className="shell page-head">
          <h1>Operator</h1>
        </div>
        <section className="shell section">
          <form className={`panel pad ${styles.signIn}`} onSubmit={signIn} aria-label="Open the console">
            <label className="field">
              <span>Operator token</span>
              <input type="password" value={tokenText} onChange={(e) => setTokenText(e.target.value)} autoComplete="off" required />
            </label>
            <button type="submit" className="button button-lg">
              Open
            </button>
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
          </form>
        </section>
      </>
    );
  }

  const o = data?.overview;
  const open = data?.alerts.filter((a) => a.resolvedAt === null) ?? [];
  return (
    <>
      <div className="shell page-head">
        <h1>Operator</h1>
        <button type="button" className="button button-ghost" onClick={forget}>
          Forget the token
        </button>
      </div>
      {error && (
        <div className="shell">
          <p className={styles.error} role="alert">
            {error}
          </p>
        </div>
      )}

      {o && (
        <Section id="glance" title="At a glance">
          <dl className={`panel pad kv ${styles.kv}`} data-varies>
            <div>
              <dt>Launches</dt>
              <dd>
                {o.launches.total}: {o.launches.byStatus.live} live, {o.launches.byStatus.graduating} graduating, {o.launches.byStatus.graduated} graduated
              </dd>
            </div>
            <div>
              <dt>Reward Launches</dt>
              <dd>{o.launches.reward}</dd>
            </div>
            <div>
              <dt>Reward Rounds</dt>
              <dd>
                {o.rewardRounds.paying} paying, {o.rewardRounds.paid} paid
              </dd>
            </div>
            <div>
              <dt>Burn transactions</dt>
              <dd>{o.burns}</dd>
            </div>
            <div>
              <dt>Permanent metadata</dt>
              <dd>
                {o.metadataUploads.uploaded} on Arweave, {o.metadataUploads.pending} waiting
              </dd>
            </div>
            <div>
              <dt>Fees on-chain</dt>
              <dd>
                Platform {o.fees.platformFeeBps} bps, Creator {o.fees.creatorFeeBps} bps
              </dd>
            </div>
          </dl>
        </Section>
      )}

      {data && (
        <Section id="alerts" title="Alerts">
          {open.length === 0 ? (
            <p className="muted">Nothing needs attention.</p>
          ) : (
            <div className="panel table-wrap" data-varies>
              <table className={`table ${styles.wrap}`} aria-label="Open alerts">
                <tbody>
                  {open.map((a) => (
                    <tr key={`${a.kind}:${a.subject}`} data-alert={a.kind}>
                      <td>
                        <b>{a.kind.replace(/_/g, " ")}</b>
                      </td>
                      <td>{a.message}</td>
                      <td className="r muted">
                        <When iso={a.raisedAt} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      )}

      {o && (
        <Section id="jobs" title="Jobs">
          {o.jobs.length > 0 && (
            <div className="panel table-wrap" data-varies>
              <table className={`table ${styles.wrap}`} aria-label="Latest runs">
                <thead>
                  <tr>
                    <th scope="col">Job</th>
                    <th scope="col">Last run</th>
                    <th scope="col" className="r">Started</th>
                  </tr>
                </thead>
                <tbody>
                  {o.jobs.map((j) => (
                    <tr key={j.id} data-job={j.job}>
                      <td>
                        <b>{j.job}</b>
                      </td>
                      <td>
                        <span className={j.status === "failed" ? "badge badge-warn" : "badge"}>{j.status}</span>
                        {j.error && <span className={styles.jobError}>{j.error}</span>}
                      </td>
                      <td className="r muted">
                        <When iso={j.startedAt} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className={styles.actions} role="group" aria-label="Run a job now">
            {MANUAL_JOBS.map((job) => (
              <button
                key={job}
                type="button"
                className="button button-ghost"
                disabled={busy !== null}
                onClick={() =>
                  void act(job, async () => {
                    const run = await runOperatorJob(token, job);
                    setRan({ job, status: run.status, error: run.error });
                  })
                }
              >
                {busy === job ? "Running…" : `Run ${job}`}
              </button>
            ))}
          </div>
          {ran && (
            <p className={styles.note} role="status">
              {ran.job}: {ran.status}
              {ran.error ? `, ${ran.error}` : ""}
            </p>
          )}
        </Section>
      )}

      {data && (
        <Section id="fees" title="Fee changes">
          <FeeChanges token={token} platform={platform} announcements={data.announcements} busy={busy} act={act} />
        </Section>
      )}

      {data && (
        <Section id="airdrops" title="Airdrop creators">
          <AirdropCreators token={token} wallets={data.airdropCreators} busy={busy} act={act} />
        </Section>
      )}

      {data && (
        <Section id="gates" title="Region gates">
          <RegionGatesEditor token={token} />
        </Section>
      )}

      {data && (
        <Section id="keys" title="API keys">
          <ApiKeys token={token} keys={data.keys} busy={busy} act={act} />
        </Section>
      )}
    </>
  );
}

type Act = (label: string, work: () => Promise<void>) => Promise<void>;

/**
 * Fee changes (#22): a change applies to every live curve at once, so it is announced first and its transaction can only
 * be prepared once its time has come; the platform's admin key, which the site never holds, signs it.
 */
function FeeChanges({ token, platform, announcements, busy, act }: { token: string; platform: PlatformInfo; announcements: FeeAnnouncement[]; busy: string | null; act: Act }) {
  const [form, setForm] = useState({ platformFeeBps: String(platform.platformFeeBps), creatorFeeBps: String(platform.creatorFeeBps), effectiveAt: "", note: "" });
  const [prepared, setPrepared] = useState<PreparedFeeChange | null>(null);
  const now = Date.now();
  return (
    <div className={styles.stack}>
      <form
        className={`panel pad ${styles.form}`}
        aria-label="Announce a fee change"
        onSubmit={(e) => {
          e.preventDefault();
          void act("announce", async () => {
            await announceFeeChange(token, {
              platformFeeBps: Number(form.platformFeeBps),
              creatorFeeBps: Number(form.creatorFeeBps),
              effectiveAt: new Date(form.effectiveAt).toISOString(),
              note: form.note.trim() || undefined,
            });
            setForm((f) => ({ ...f, note: "" }));
          });
        }}
      >
        <label className="field">
          <span>Platform Fee, bps</span>
          <input type="number" min={0} max={FEE_BPS_MAX} value={form.platformFeeBps} onChange={(e) => setForm({ ...form, platformFeeBps: e.target.value })} required />
        </label>
        <label className="field">
          <span>Creator Fee, bps</span>
          <input type="number" min={0} max={FEE_BPS_MAX} value={form.creatorFeeBps} onChange={(e) => setForm({ ...form, creatorFeeBps: e.target.value })} required />
        </label>
        <label className="field">
          <span>Effective at</span>
          <input type="datetime-local" value={form.effectiveAt} onChange={(e) => setForm({ ...form, effectiveAt: e.target.value })} required />
        </label>
        <label className={`field ${styles.wide}`}>
          <span>Note</span>
          <input type="text" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} maxLength={500} />
        </label>
        <button type="submit" className="button" disabled={busy !== null}>
          {busy === "announce" ? "Announcing…" : "Announce"}
        </button>
      </form>
      {announcements.length > 0 && (
        <div className="panel table-wrap">
          <table className={`table ${styles.wrap}`} aria-label="Announced fee changes">
            <tbody>
              {announcements.map((a) => {
                const due = !a.appliedSignature && Date.parse(a.effectiveAt) <= now;
                return (
                  <tr key={a.id} data-announcement={a.id}>
                    <td>
                      Platform {a.platformFeeBps} bps, Creator {a.creatorFeeBps} bps
                      {a.note && <span className={styles.jobError}>{a.note}</span>}
                    </td>
                    <td className="muted">
                      <When iso={a.effectiveAt} />
                    </td>
                    <td className="r">
                      {a.appliedSignature ? (
                        <span className="badge">Applied</span>
                      ) : due ? (
                        <button type="button" className="button button-ghost" disabled={busy !== null} onClick={() => void act(a.id, async () => setPrepared(await prepareFeeChange(token, a.id)))}>
                          {busy === a.id ? "Preparing…" : "Prepare the admin's transaction"}
                        </button>
                      ) : (
                        <span className="badge">Announced</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {prepared && (
        <div className={`panel pad ${styles.shown}`} role="status">
          <p>
            Unsigned, for the admin <span className="mono">{shortAddress(prepared.admin)}</span>: Platform {prepared.platformFeeBps} bps, Creator{" "}
            {prepared.creatorFeeBps} bps. Sign it with the admin key and send it before block height {prepared.lastValidBlockHeight}.
          </p>
          <Secret value={prepared.transaction} label="Copy the transaction" />
        </div>
      )}
    </div>
  );
}

/** The Creator wallets allowed an airdrop at launch: nobody is offered one until the operator names a wallet here. */
function AirdropCreators({ token, wallets, busy, act }: { token: string; wallets: string[]; busy: string | null; act: Act }) {
  const [wallet, setWallet] = useState("");
  return (
    <div className={styles.stack}>
      <form
        className={`panel pad ${styles.inline}`}
        aria-label="Allow a Creator an airdrop"
        onSubmit={(e) => {
          e.preventDefault();
          void act("allow", async () => {
            await allowAirdropCreator(token, wallet.trim());
            setWallet("");
          });
        }}
      >
        <label className="field">
          <span>Creator wallet</span>
          <input
            className="mono"
            value={wallet}
            onChange={(e) => setWallet(e.target.value)}
            pattern="[1-9A-HJ-NP-Za-km-z]{32,44}"
            autoComplete="off"
            spellCheck={false}
            required
          />
        </label>
        <button type="submit" className="button" disabled={busy !== null}>
          {busy === "allow" ? "Allowing…" : "Allow"}
        </button>
      </form>
      {wallets.length > 0 && (
        <div className="panel table-wrap">
          <table className={`table ${styles.wrap}`} aria-label="Allowed Creators">
            <tbody>
              {wallets.map((w) => (
                <tr key={w} data-wallet={w}>
                  <td><span className="mono">{shortAddress(w)}</span></td>
                  <td className="r">
                    <button type="button" className="button button-ghost" disabled={busy !== null} onClick={() => void act(`remove:${w}`, async () => void (await disallowAirdropCreator(token, w)))}>
                      {busy === `remove:${w}` ? "Removing…" : "Remove"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** API keys (#21): a key identifies an integrator and bounds it to so many requests a minute; it is shown once, when issued. */
function ApiKeys({ token, keys, busy, act }: { token: string; keys: ApiKeyInfo[]; busy: string | null; act: Act }) {
  const [form, setForm] = useState({ name: "", rateLimitPerMinute: String(API_KEY_RATE_LIMIT_DEFAULT) });
  const [issued, setIssued] = useState<IssuedApiKey | null>(null);
  return (
    <div className={styles.stack}>
      <form
        className={`panel pad ${styles.inline}`}
        aria-label="Issue an API key"
        onSubmit={(e) => {
          e.preventDefault();
          void act("issue", async () => {
            setIssued(await createApiKey(token, { name: form.name.trim(), rateLimitPerMinute: Number(form.rateLimitPerMinute) }));
            setForm({ name: "", rateLimitPerMinute: String(API_KEY_RATE_LIMIT_DEFAULT) });
          });
        }}
      >
        <label className="field">
          <span>Name</span>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={80} required />
        </label>
        <label className="field">
          <span>Requests a minute</span>
          <input
            type="number"
            min={1}
            max={API_KEY_RATE_LIMIT_MAX}
            value={form.rateLimitPerMinute}
            onChange={(e) => setForm({ ...form, rateLimitPerMinute: e.target.value })}
            required
          />
        </label>
        <button type="submit" className="button" disabled={busy !== null}>
          {busy === "issue" ? "Issuing…" : "Issue a key"}
        </button>
      </form>
      {issued && (
        <div className={`panel pad ${styles.shown}`} role="status">
          <p>
            The key for <b>{issued.name}</b>, shown this once: it can only be revoked, never shown again.
          </p>
          <Secret value={issued.key} label="Copy the key" />
        </div>
      )}
      {keys.length > 0 && (
        <div className="panel table-wrap">
          <table className={`table ${styles.wrap}`} aria-label="Issued keys">
            <tbody>
              {keys.map((k) => (
                <tr key={k.id} data-key={k.id}>
                  <td>
                    <b>{k.name}</b>
                  </td>
                  <td className="num">{k.rateLimitPerMinute} a minute</td>
                  <td className="muted">
                    <When iso={k.createdAt} />
                  </td>
                  <td className="r">
                    {k.revokedAt ? (
                      <span className="badge">Revoked</span>
                    ) : (
                      <button type="button" className="button button-ghost" disabled={busy !== null} onClick={() => void act(`revoke:${k.id}`, () => revokeApiKey(token, k.id))}>
                        {busy === `revoke:${k.id}` ? "Revoking…" : "Revoke"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Something shown once to copy (a key, a transaction): read-only, selected whole on focus, with a copy button. */
function Secret({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className={styles.secret}>
      <textarea className={`mono ${styles.code}`} value={value} readOnly rows={3} aria-label={label.replace(/^Copy /, "")} onFocus={(e) => e.currentTarget.select()} />
      <button
        type="button"
        className="button button-ghost"
        onClick={() =>
          void navigator.clipboard.writeText(value).then(
            () => setCopied(true),
            () => setCopied(false),
          )
        }
      >
        {copied ? "Copied" : label}
      </button>
    </div>
  );
}

type GateRow = { feature: string; countries: string };

const toRows = (gates: RegionGates): GateRow[] => Object.entries(gates).map(([feature, countries]) => ({ feature, countries: countries.join(", ") }));

/** The rows as the table the API takes: slugs as typed, countries split on commas or spaces and written in capitals. */
function toGates(rows: GateRow[]): RegionGates {
  const gates: RegionGates = {};
  for (const r of rows) {
    const feature = r.feature.trim();
    if (!feature) continue;
    gates[feature] = r.countries.split(/[\s,]+/).map((c) => c.trim().toUpperCase()).filter(Boolean);
  }
  return gates;
}

/**
 * The region gate's table (ADR 0014): for each feature the site gates by name, the countries it is withheld in. Replaced
 * whole on save, and empty until someone asks for a feature's removal in their country (owner, 2026-10-29).
 */
function RegionGatesEditor({ token }: { token: string }) {
  const [rows, setRows] = useState<GateRow[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let gone = false;
    getRegionGates(token).then(
      (g) => !gone && setRows(toRows(g.gates)),
      (e: Error) => !gone && setError(e.message),
    );
    return () => {
      gone = true;
    };
  }, [token]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!rows) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      setRows(toRows((await putRegionGates(token, toGates(rows))).gates));
      setSaved(true);
    } catch (err) {
      setError((err as Error).message);
    }
    setSaving(false);
  }

  const update = (i: number, patch: Partial<GateRow>) => {
    setSaved(false);
    setRows((r) => r!.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  };

  if (!rows) return error ? <p className={styles.error} role="alert">{error}</p> : null;
  return (
    <form className={`panel pad ${styles.gates}`} aria-label="Region gates" onSubmit={(e) => void save(e)}>
      {rows.map((r, i) => (
        <div key={i} className={styles.gate} data-gate={i}>
          <label className="field">
            <span>Feature</span>
            <input value={r.feature} onChange={(e) => update(i, { feature: e.target.value })} pattern="[a-z][a-z0-9\-]{0,39}" required />
          </label>
          <label className="field">
            <span>Withheld in</span>
            <input value={r.countries} onChange={(e) => update(i, { countries: e.target.value })} placeholder="GB, CA" />
          </label>
          <button type="button" className="button button-ghost" onClick={() => setRows((rs) => rs!.filter((_, j) => j !== i))}>
            Remove
          </button>
        </div>
      ))}
      <div className={styles.actions}>
        <button
          type="button"
          className="button button-ghost"
          onClick={() => {
            setSaved(false);
            setRows((rs) => [...rs!, { feature: "", countries: "" }]);
          }}
        >
          Add a feature
        </button>
        <button type="submit" className="button" disabled={saving}>
          {saving ? "Saving…" : "Save the table"}
        </button>
        {saved && (
          <span className={styles.note} role="status">
            Saved
          </span>
        )}
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
