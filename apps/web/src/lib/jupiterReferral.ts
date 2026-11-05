/**
 * The Swap page (`/swap`) is Jupiter's widget, and a swap made through it pays Jupiter's referral fee to the platform once
 * the owner's referral account is set at build time (runbook section 13); until then the swap is Jupiter's plain one and
 * takes no fee of ours. The widget reads these two settings; the Fees page reads them here, so the figure it shows is the
 * one charged (carried from production).
 */
export const JUPITER_REFERRAL = process.env.NEXT_PUBLIC_JUPITER_REFERRAL ?? "";

/** Basis points of every swap, 50 unless the owner raises it (Jupiter's program takes 50 to 255). */
export const JUPITER_REFERRAL_FEE_BPS = Math.min(255, Math.max(50, Number(process.env.NEXT_PUBLIC_JUPITER_REFERRAL_FEE_BPS ?? "50") || 50));

/** Jupiter keeps a fifth of a referral fee; the rest reaches the referral account. */
export const JUPITER_REFERRAL_KEEP_BPS = 2_000;
