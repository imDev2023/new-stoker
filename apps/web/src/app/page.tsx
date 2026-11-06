import Link from "next/link";
import type { Candle } from "@launchpad/contract";
import { CoinTable } from "@/components/CoinTable";
import { Ring } from "@/components/Ring";
import { getCandles, getStats, listLaunches, listQuotes } from "@/lib/api";
import { formatCount, formatFigure } from "@/lib/format";
import styles from "./page.module.css";

/** The assets the hero's pair rolls through, and the first is the one it holds under reduced motion (the spec's words). */
const ROLL = ["SOL", "USDC", "NVDAx", "SPYx", "TSLAx"];
/** The assets the first idea names (the spec's words): examples of what Raydium quotes, never a list read from a name. */
const CHIPS = ["SOL", "USDC", "USDT", "NVDAx", "SPYx", "TSLAx", "AAPLx", "GOOGLx"];
const CHECKS = ["Raydium LaunchLab", "Your wallet signs", "Copy Protection", "Risk labels on every pair", "Liquidity locked at graduation"];
/** How many coins Trending shows. */
const TRENDING = 5;

/**
 * The landing (the spec's `index.html`, ADR 0017): the slogan and the pair, the platform's figures, the three ideas, the
 * coins trading most today, the statement and the invitation. Every live part is left out until the API gives it a real,
 * non-zero value, and a read that fails leaves its part out rather than failing the page.
 */
export default async function HomePage() {
  const [quotes, stats, trending] = await Promise.all([
    listQuotes().catch(() => null),
    getStats().catch(() => null),
    listLaunches({ sort: "trending", limit: TRENDING }).catch(() => null),
  ]);
  // A coin that has never traded has no change yet, and is not trending.
  const traded = trending?.launches.filter((l) => l.market.change24h !== null) ?? [];
  const candles = new Map<string, Candle[]>();
  await Promise.all(
    traded.map(async (l) => {
      const list = await getCandles(l.mint, "1h").catch(() => null);
      if (list) candles.set(l.mint, list.candles);
    }),
  );

  const assets = quotes?.quotes.filter((q) => q.launchable).length ?? 0;
  const figures = [
    ["assets", "Assets", assets ? formatCount(assets) : null, null],
    ["launches", "Coins", stats?.launches ? formatCount(stats.launches) : null, null],
    ["graduated", "Graduated", stats?.graduated ? formatCount(stats.graduated) : null, null],
    ["volume", "24h volume", stats?.volume24h.sol ? formatFigure(stats.volume24h.sol) : null, "SOL"],
  ].filter((f): f is [string, string, string, string | null] => f[2] !== null);

  return (
    <>
      <section className={`shell on-band bleed ${styles.hero}`} aria-labelledby="hero-title">
        <span className={styles.mark} aria-hidden="true">
          <Ring size={128} />
        </span>
        <h1 id="hero-title" className="display">
          No one picks your pair. <em className="heat">You do.</em>
        </h1>
        <p className={styles.pair}>
          <span className="visually-hidden">Your coin, priced in {ROLL.slice(0, -1).join(", ")} or {ROLL.at(-1)}</span>
          <span aria-hidden="true">STOKER</span>
          <span className={styles.slash} aria-hidden="true">/</span>
          <span className={styles.roll} aria-hidden="true" data-roll>
            <span className={styles.track}>
              {[...ROLL, ROLL[0]].map((asset, i) => (
                <span key={i}>{asset}</span>
              ))}
            </span>
          </span>
        </p>
        <div className={styles.actions}>
          <Link className="button button-lg" href="/launch">
            Stoke a coin
          </Link>
          <Link className="arrow" href="/coins">
            Explore coins
          </Link>
        </div>
      </section>

      {figures.length > 0 && (
        <section className={`shell on-band bleed ${styles.figures}`} aria-label="Figures" data-figures>
          <dl className="figures">
            {figures.map(([key, term, value, unit]) => (
              <div key={key}>
                <dt>{term}</dt>
                <dd>
                  {value}
                  {unit && <small>{unit}</small>}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section className={`shell ${styles.idea}`} aria-labelledby="idea-pair">
        <div>
          <h2 id="idea-pair" className="title">Any asset Raydium quotes.</h2>
          <Link className="arrow" href="/assets">All assets</Link>
        </div>
        <div className={`panel pad ${styles.chips}`}>
          {CHIPS.map((chip) => (
            <span key={chip} className="chip">{chip}</span>
          ))}
        </div>
      </section>

      <section className={`shell ${styles.idea}`} aria-labelledby="idea-cut">
        <div>
          <h2 id="idea-cut" className="title">Half of what we collect is yours.</h2>
          <Link className="arrow" href="/fees">Every fee</Link>
        </div>
        <div className={`panel ${styles.split}`}>
          <span className={styles.you}>You</span>
          <span className={styles.us}>Stoker</span>
        </div>
      </section>

      <section className={`shell ${styles.idea}`} aria-labelledby="idea-trust">
        <div>
          <h2 id="idea-trust" className="title">Nothing on faith.</h2>
          <Link className="arrow" href="/revenue">The public ledger</Link>
        </div>
        <ul className={`panel pad ${styles.checks}`}>
          {CHECKS.map((check) => (
            <li key={check}>{check}</li>
          ))}
        </ul>
      </section>

      {traded.length > 0 && (
        <section className="shell section" aria-labelledby="trending-title" data-trending>
          <div className="section-head">
            <h2 id="trending-title">Trending</h2>
            <Link className="arrow" href="/coins">All coins</Link>
          </div>
          <div className="panel table-wrap">
            <CoinTable compact launches={traded} candles={candles} label="Trending" />
          </div>
        </section>
      )}

      <section className={`shell ${styles.band} ${styles.ruled}`} aria-label="What we hold ourselves to">
        <p className={styles.statement}>We listen. We experiment. We make rugs rare, and small.</p>
      </section>

      <section className={`shell on-band bleed ${styles.band} ${styles.invite}`} aria-labelledby="invite-title">
        <Ring size={112} />
        <h2 id="invite-title" className="title">Your coin, your pair.</h2>
        <Link className="button button-lg" href="/launch">
          Stoke a coin
        </Link>
      </section>
    </>
  );
}
