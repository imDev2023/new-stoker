/**
 * The site's one search is the board's (owner, 2026-10-31; the spec's "/" to search): "/" and ⌘K reach it from any page
 * (components/SearchShortcut.tsx), focusing the field in place on the board and opening the board with it focused
 * from anywhere else.
 */

/** The attribute the board's search field carries, so the shortcut finds it on the page it is on. */
export const SITE_SEARCH_ATTRIBUTE = "data-site-search";
/** The hash the shortcut opens the board with from another page; the board answers it by focusing the field, then drops it. */
export const SEARCH_HASH = "#search";
