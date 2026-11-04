import Link from "next/link";
import { Ring } from "@/components/Ring";
import styles from "./not-found.module.css";

/** Nothing at this address: the ring, one line and the way home (the spec's 404). */
export default function NotFound() {
  return (
    <section className={`shell ${styles.band}`}>
      <Ring size={96} />
      <h1>Nothing here.</h1>
      <Link className="button button-lg" href="/">
        Home
      </Link>
    </section>
  );
}
