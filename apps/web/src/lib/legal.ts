/**
 * The site's legal words in one place (imDev2023/Stoker-Markets#156, carried by ADR 0017): the welcome on a first
 * visit, the footer's risk sentence and the legal pages read the same strings, so the excluded regions (confirmed by
 * the owner) and the risk sentence are changed once.
 */

/** The regions the site is not offered in, as a phrase after "in". */
export const EXCLUDED_REGIONS = "the United States, the United Kingdom, Canada or sanctioned countries";

/** The footer's one bold sentence, and the risk page's first. */
export const RISK_SENTENCE = "Coins launched here are speculative and can lose all their value.";

/** The footer's sentences after it. */
export const FOOTER_NOTICE = `Not offered in ${EXCLUDED_REGIONS}. Nothing here is financial advice.`;

/** When the legal pages last changed, as their heads say it. */
export const LEGAL_UPDATED = "29 October 2026";

/**
 * The browser's record that the visitor accepted the disclaimer: set by the welcome's Continue (or its Escape or a
 * press outside it, since the welcome blocks nothing), and by the launch and trade disclaimers, which stand in when the
 * record is gone. The UI suite sets it before every page load, so no baseline carries the welcome.
 */
export const DISCLAIMER_KEY = "launchpad.disclaimer.v1";

export function hasAcceptedDisclaimer() {
  try {
    return window.localStorage.getItem(DISCLAIMER_KEY) === "accepted";
  } catch {
    return false;
  }
}

/** Records the acceptance for this browser; without storage it holds for this page view alone. */
export function acceptDisclaimer() {
  try {
    window.localStorage.setItem(DISCLAIMER_KEY, "accepted");
  } catch {
    // storage unavailable: accepted for this page view only
  }
}

/** The welcome's words: the open half of the pitch, one plain risk sentence and the regions as a notice. */
export const WELCOME = {
  title: "Welcome to Stoker",
  lines: [
    "Anyone can launch a coin here, paired with the asset they choose, and anyone can trade it from the first second.",
    "Coins are their creators', not ours. A price can fall to zero, and nothing on this site is advice.",
    `Not for people in ${EXCLUDED_REGIONS}.`,
  ],
  button: "Continue",
} as const;
