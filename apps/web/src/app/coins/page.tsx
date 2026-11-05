import type { Metadata } from "next";
import { Board } from "@/components/Board";
import { listLaunches } from "@/lib/api";
import { boardQueryFrom } from "@/lib/board";

export const metadata: Metadata = {
  title: "Explore",
  description: "Every coin launched on Stoker, by market cap, newest, 24h volume or nearest graduation.",
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Explore (#6): every coin, searched, sorted and filtered by what it is paired with. */
export default async function CoinsPage({ searchParams }: Props) {
  const query = boardQueryFrom(await searchParams);
  // The controls never wait on the API: a list that can't be read renders as none, and the board asks again.
  const launches = await listLaunches(query).then((l) => l.launches, () => []);
  return <Board initial={launches} initialQuery={query} renderedAt={Date.now()} />;
}
