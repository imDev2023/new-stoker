import { NAV_LINKS, PHONE_SECTIONS } from "@/lib/site";
import { NavLinks } from "./NavLinks";
import styles from "./PhoneBar.module.css";

/**
 * The sections on a phone, fixed to the window's foot under 900px. Its own element at the end of the page rather than
 * the header's nav moved by CSS: a fixed element inside the sticky header would be positioned against the header in a
 * full-page screenshot. Only one of the two "Sections" navigations is ever displayed.
 */
export function PhoneBar() {
  return (
    <nav className={`on-band ${styles.tabs}`} aria-label="Sections" data-tab-bar>
      <NavLinks links={NAV_LINKS.slice(0, PHONE_SECTIONS)} />
    </nav>
  );
}
