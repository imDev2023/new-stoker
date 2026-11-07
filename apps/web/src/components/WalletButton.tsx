"use client";

import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import { useEffect, useRef, useState } from "react";
import { listLaunches } from "@/lib/api";
import { shortAddress } from "@/lib/format";
import { SchemeToggle } from "./SchemeToggle";
import styles from "./WalletButton.module.css";

/**
 * A connected wallet's avatar: a disc whose two hues come from the address, so the same wallet looks the same on every
 * visit and two wallets look different, with nothing fetched and nothing stored.
 */
export function Avatar({ address, size = 22 }: { address: string; size?: number }) {
  let a = 0;
  let b = 0;
  for (let i = 0; i < address.length; i++) {
    const c = address.charCodeAt(i);
    if (i % 2 === 0) a = (a * 31 + c) % 360;
    else b = (b * 37 + c) % 360;
  }
  const style = { width: size, height: size, background: `linear-gradient(135deg, hsl(${a} 70% 56%), hsl(${(a + 40 + (b % 80)) % 360} 72% 38%))` };
  return <span className={styles.avatar} style={style} data-avatar aria-hidden="true" />;
}

/**
 * The account control, the ghost beside the header's one filled action: "Connect wallet", or the wallet's avatar and
 * short address once connected, each opening a menu that also holds the light-or-dark toggle (production's place for
 * it since imDev2023/Stoker-Markets#131). Wallets are found through the Wallet Standard, so none is bundled.
 */
export function WalletButton({ block = false }: {
  /** The trade panel's own "Connect wallet": the panel's width and height, its menu opening under it, with no scheme toggle. */
  block?: boolean;
} = {}) {
  const { wallets, wallet, publicKey, connecting, select, connect, disconnect } = useWallet();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const menu = useRef<HTMLDivElement>(null);
  const installed = wallets.filter((w) => w.readyState === WalletReadyState.Installed || w.readyState === WalletReadyState.Loadable);

  // The earnings page is a Creator's own (owner, 2026-10-08): the menu offers it only to a wallet that has launched a
  // coin here, which is asked once per connected wallet.
  const address = publicKey?.toBase58() ?? null;
  const [launched, setLaunched] = useState<{ address: string; yes: boolean } | null>(null);
  // Asked again each time the menu opens until the answer is yes, so a wallet's first launch shows the entry at once.
  const knownYes = launched?.address === address && launched.yes;
  useEffect(() => {
    if (!address || knownYes) return;
    let gone = false;
    listLaunches({ creator: address, limit: 1 })
      .then((list) => {
        if (!gone) setLaunched({ address, yes: list.launches.length > 0 });
      })
      .catch(() => undefined);
    return () => {
      gone = true;
    };
  }, [address, open, knownYes]);
  const hasLaunched = knownYes;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !menu.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  // Selecting a wallet only stages it; connect once the adapter has switched.
  useEffect(() => {
    if (pending && wallet?.adapter.name === pending && !publicKey) {
      setPending(null);
      connect().catch(() => undefined);
    }
  }, [pending, wallet, publicKey, connect]);

  const toggle = (
    <div className={styles.foot}>
      <SchemeToggle className={styles.item} />
    </div>
  );

  if (publicKey && block) return null;
  if (publicKey) {
    const name = wallet ? `Connected with ${wallet.adapter.name}` : "Wallet";
    return (
      <div className={styles.wrap} ref={menu}>
        <button type="button" className={`button button-ghost ${styles.connected}`} onClick={() => setOpen((o) => !o)} aria-expanded={open} title={name}>
          <Avatar address={publicKey.toBase58()} />
          <span className={`mono ${styles.address}`} data-address>{shortAddress(publicKey.toBase58())}</span>
        </button>
        {open && (
          <div className={styles.menu} role="menu" aria-label={name}>
            {hasLaunched && (
              <Link href="/creator" role="menuitem" className={styles.item} onClick={() => setOpen(false)}>
                Your earnings
              </Link>
            )}
            <button type="button" role="menuitem" className={styles.item} onClick={() => { setOpen(false); void disconnect(); }}>
              Disconnect
            </button>
            {toggle}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={block ? `${styles.wrap} ${styles.block}` : styles.wrap} ref={menu}>
      <button type="button" className={block ? "button button-lg button-block" : "button button-ghost"} onClick={() => setOpen((o) => !o)} aria-expanded={open} disabled={connecting}>
        {connecting ? "Connecting…" : "Connect wallet"}
      </button>
      {open && (
        <div className={styles.menu} role="menu" aria-label="Choose a wallet">
          {installed.length === 0 ? (
            <p className={styles.empty}>
              No Solana wallet found in this browser. Install{" "}
              <a href="https://phantom.com" target="_blank" rel="noreferrer">Phantom</a> or{" "}
              <a href="https://solflare.com" target="_blank" rel="noreferrer">Solflare</a>, then reload.
            </p>
          ) : (
            installed.map((w) => (
              <button
                key={w.adapter.name}
                type="button"
                role="menuitem"
                className={styles.item}
                onClick={() => { setOpen(false); setPending(w.adapter.name); select(w.adapter.name); }}
              >
                <img src={w.adapter.icon} alt="" width={20} height={20} />
                {w.adapter.name}
              </button>
            ))
          )}
          {!block && toggle}
        </div>
      )}
    </div>
  );
}
