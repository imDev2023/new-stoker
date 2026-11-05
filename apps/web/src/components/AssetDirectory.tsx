"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { assetsSearch, ASSETS_SEARCH_MAX, formatLiquidity, formatUsd, graduationAmount, groupAssets, searchAssets, type AssetRow, type AssetsQuery } from "@/lib/assets";
import { KINDS } from "@/lib/board";
import { quoteTicker } from "@/lib/format";
import { SITE_SEARCH_ATTRIBUTE } from "@/lib/search";
import { AssetTile } from "./AssetTile";
import styles from "./AssetDirectory.module.css";

/**
 * The assets directory (#9, the spec's assets page): a search, the kinds as chips, and every Quote Asset in one table,
 * grouped by kind and a stock by its issuer, each row its price, liquidity and what a coin paired with it raises to
 * graduate. Every control is there before the registry answers (the owner's rule of 2026-10-07); the table waits for
 * real assets. The query lives in the address (`?category=`, `?q=`), and the search is the page's own: "/" and ⌘K focus it here
 * (SearchShortcut finds it by its attribute), as they focus the board's on Explore.
 * A figure the registry doesn't have is left blank, never a zero; nothing here is a warning, which is the asset page's.
 */
export function AssetDirectory({ assets, initialQuery }: { assets: AssetRow[]; initialQuery: AssetsQuery }) {
  const [query, setQuery] = useState(initialQuery);
  const chips = useRef<HTMLDivElement>(null);
  const groups = useMemo(
    () => groupAssets(searchAssets(assets.filter((a) => query.category === null || a.category === query.category), query.q)),
    [assets, query],
  );

  // On a phone the chips slide sideways: the chosen kind is brought into the row's view, the row alone scrolled.
  useEffect(() => {
    const row = chips.current;
    const chosen = row?.querySelector<HTMLElement>("label:has(input:checked)");
    if (!row || !chosen || row.scrollWidth <= row.clientWidth) return;
    const left = chosen.offsetLeft;
    if (left < row.scrollLeft || left + chosen.offsetWidth > row.scrollLeft + row.clientWidth) row.scrollLeft = left - 16;
  }, [query.category]);

  function change(next: AssetsQuery) {
    setQuery(next);
    window.history.replaceState(null, "", `${window.location.pathname}${assetsSearch(next)}`);
  }

  const matched = groups.length > 0;

  return (
    <>
      <div className="shell page-head">
        <h1>Assets</h1>
      </div>
      <div className={`shell section ${styles.directory}`}>
        <div className="toolbar">
          <label className="search">
            <span className="visually-hidden">Search</span>
            <input
              className="input"
              type="search"
              placeholder="Name, ticker or address"
              maxLength={ASSETS_SEARCH_MAX}
              autoComplete="off"
              spellCheck={false}
              value={query.q}
              onChange={(e) => change({ ...query, q: e.target.value.slice(0, ASSETS_SEARCH_MAX) })}
              {...{ [SITE_SEARCH_ATTRIBUTE]: "" }}
            />
            <kbd className="kbd" aria-hidden="true">/</kbd>
          </label>
        </div>
        <div ref={chips} className={styles.chips} role="radiogroup" aria-label="Kind" data-scrolls>
          {[{ value: null, label: "All" }, ...KINDS].map((k) => (
            <label key={k.label} className="chip chip-pick">
              <input
                type="radio"
                name="kind"
                value={k.value ?? "all"}
                checked={query.category === k.value}
                onChange={() => change({ ...query, category: k.value })}
              />
              {k.label}
            </label>
          ))}
        </div>
        {matched && (
          <div className={`panel table-wrap ${styles.wrap}`} data-scrolls>
            <table className={`table ${styles.table}`} aria-label="Assets">
              <thead>
                <tr>
                  <th scope="col">Asset</th>
                  <th scope="col" className="r">Price</th>
                  <th scope="col" className={`r ${styles.wide}`}>Liquidity</th>
                  <th scope="col" className={`r ${styles.wide}`}>Graduates at</th>
                </tr>
              </thead>
              {groups.map((g) => (
                <tbody key={g.key}>
                  <tr className={styles.group}>
                    <th scope="colgroup" colSpan={4}>{g.label}</th>
                  </tr>
                  {g.assets.map((a) => {
                    const ticker = quoteTicker(a);
                    return (
                      <tr key={a.mint} data-mint={a.mint}>
                        <td>
                          <Link className={styles.asset} href={`/asset/${a.mint}`}>
                            <AssetTile quote={a} />
                            <span className={styles.names}>
                              <span className={styles.ticker}>
                                <b>{ticker}</b>
                                {!a.launchable && <span className="badge">Not launchable</span>}
                              </span>
                              {a.name && <span>{a.name}</span>}
                            </span>
                          </Link>
                        </td>
                        <td className="r">{a.usd ? formatUsd(a.usd) : ""}</td>
                        <td className={`r ${styles.wide}`}>{a.liquidityUsd ? formatLiquidity(a.liquidityUsd) : ""}</td>
                        <td className={`r ${styles.wide}`}>{graduationAmount(a.graduation, a.decimals, ticker) ?? ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
              ))}
            </table>
          </div>
        )}
        {/* The registry answered, but nothing it quotes matches: one sentence, as the board says it. */}
        {!matched && assets.length > 0 && (
          <div className={styles.empty}>
            <p className={styles.statement}>Nothing matches.</p>
          </div>
        )}
      </div>
    </>
  );
}
