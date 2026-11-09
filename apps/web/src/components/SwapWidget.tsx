"use client";

import { useWallet, type WalletContextState } from "@solana/wallet-adapter-react";
import { useEffect, useRef, useState } from "react";
import { JUPITER_REFERRAL, JUPITER_REFERRAL_FEE_BPS } from "@/lib/jupiterReferral";
import styles from "./SwapWidget.module.css";

/**
 * Jupiter Plugin (developers.jup.ag/docs/tool-kits/plugin): the v1 script is the one address Jupiter publishes, so it is
 * pinned to that major; the UI suite serves it empty (tests/ui/src/fixtures.ts), so no baseline ever carries a live swap.
 */
const PLUGIN_SCRIPT = "https://plugin.jup.ag/plugin-v1.js";
const TARGET_ID = "jupiter-plugin";
export const SOL_MINT = "So11111111111111111111111111111111111111112";
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
/** The integrated form needs a fixed height, or its token search collapses it (the Plugin's FAQ). */
const HEIGHT = 520;

/** The slice of the Plugin's surface this component touches (its full declaration is in the Plugin's repository). */
type JupiterPlugin = {
  init: (props: Record<string, unknown>) => void;
  syncProps: (props: { passthroughWalletContextState?: WalletContextState }) => void;
  close?: () => void;
};

declare global {
  interface Window {
    Jupiter?: JupiterPlugin;
  }
}

/**
 * The Plugin's colours are RGB triplets read from custom properties. The Plugin draws some of its text white whatever
 * the triplets say, which a light ground leaves unreadable (production found the same), so it sits on the dark tile in
 * both schemes (`--tile` in globals.css) in the dark scheme's tokens written out: the primary is the dark button's ink,
 * the background the tile, the module the dark paper, the interactive the dark sunken well, the warning the dark down
 * colour. Change a token there, change it here.
 */
const PLUGIN_THEME: Record<string, string> = {
  "--jupiter-plugin-primary": "242, 239, 232",
  "--jupiter-plugin-background": "20, 20, 21",
  "--jupiter-plugin-primaryText": "242, 239, 232",
  "--jupiter-plugin-warning": "255, 157, 136",
  "--jupiter-plugin-interactive": "9, 9, 10",
  "--jupiter-plugin-module": "12, 12, 13",
};

/** Sets the Plugin's variables on the root, since its token search opens at the body's level, outside our box. */
function theme() {
  for (const [name, value] of Object.entries(PLUGIN_THEME)) document.documentElement.style.setProperty(name, value);
}

function untheme() {
  for (const name of Object.keys(PLUGIN_THEME)) document.documentElement.style.removeProperty(name);
}

let plugin: Promise<JupiterPlugin> | undefined;

/** Loads the Plugin's script once per page; the promise lives outside any mount, so React's development double-mount can't strand it. */
function loadPlugin(): Promise<JupiterPlugin> {
  if (window.Jupiter) return Promise.resolve(window.Jupiter);
  plugin ??= new Promise<JupiterPlugin>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = PLUGIN_SCRIPT;
    script.async = true;
    script.onload = () => (window.Jupiter ? resolve(window.Jupiter) : reject(new Error(`${PLUGIN_SCRIPT} did not define the Plugin`)));
    script.onerror = () => reject(new Error(`${PLUGIN_SCRIPT} did not load`));
    document.head.append(script);
  });
  return plugin;
}

type State = "loading" | "ready" | "failed";

/** The same pair on jup.ag, for when the Plugin can't load here: its swap page takes either side by ticker or by mint. */
function jupiterUrl(input: string, output: string) {
  const side = (mint: string) => (mint === SOL_MINT ? "SOL" : mint === USDC_MINT ? "USDC" : mint);
  return `https://jup.ag/swap/${side(input)}-${side(output)}`;
}

/** Opens the site's own wallet control: the first one in view, marked `data-wallet-connect`. */
function requestConnect() {
  for (const el of document.querySelectorAll<HTMLElement>("[data-wallet-connect]")) {
    if (el.offsetParent !== null) {
      el.click();
      return;
    }
  }
}

/**
 * The token swap (production's, owner 2026-10-30): Jupiter Plugin in integrated mode, SOL to USDC as the opening pair,
 * the wallet passed through from our adapter so one connect serves the whole site, and the colours from our dark tokens
 * on a dark tile in both schemes. The widget swaps on Solana mainnet from the browser whatever cluster the API is on;
 * everything else on the site stays a client of our API. A referral fee applies once `NEXT_PUBLIC_JUPITER_REFERRAL` is set.
 * A stock's page (#10) opens it on its own pair, `fixed` locking the stock's side, and opens it again when the pair changes.
 */
export function SwapWidget({ input = SOL_MINT, output = USDC_MINT, fixed }: { input?: string; output?: string; fixed?: string } = {}) {
  const wallet = useWallet();
  const [state, setState] = useState<State>("loading");
  const latest = useRef(wallet);
  latest.current = wallet;

  useEffect(() => {
    theme();
    return untheme;
  }, []);

  useEffect(() => {
    let gone = false;
    loadPlugin().then(
      (jupiter) => {
        if (gone) return;
        jupiter.init({
          displayMode: "integrated",
          integratedTargetId: TARGET_ID,
          enableWalletPassthrough: true,
          passthroughWalletContextState: latest.current,
          // Our own connect: the Plugin asks, and the site's wallet control opens.
          onRequestConnectWallet: () => requestConnect(),
          formProps: {
            initialInputMint: input,
            initialOutputMint: output,
            ...(fixed ? { fixedMint: fixed } : {}),
            ...(JUPITER_REFERRAL ? { referralAccount: JUPITER_REFERRAL, referralFee: JUPITER_REFERRAL_FEE_BPS } : {}),
          },
          containerStyles: { height: `${HEIGHT}px` },
          branding: { name: "Stoker", logoUri: "/icon.png" },
        });
        setState("ready");
      },
      () => {
        if (!gone) setState("failed");
      },
    );
    return () => {
      gone = true;
      window.Jupiter?.close?.();
    };
  }, [input, output, fixed]);

  // The connected wallet reaches the Plugin as it changes: one connect for the site.
  useEffect(() => {
    if (state === "ready") window.Jupiter?.syncProps({ passthroughWalletContextState: wallet });
  }, [state, wallet]);

  return (
    <div className={styles.frame} data-state={state} style={{ minHeight: HEIGHT }}>
      <div id={TARGET_ID} className={styles.target} />
      {state !== "ready" && (
        <p className={styles.status} role="status">
          <span>
            {state === "loading" ? (
              "Loading Jupiter's swap"
            ) : (
              <>
                Jupiter&apos;s swap did not load here. <a href={jupiterUrl(input, output)} target="_blank" rel="noreferrer">Open jup.ag</a> instead.
              </>
            )}
          </span>
        </p>
      )}
    </div>
  );
}
