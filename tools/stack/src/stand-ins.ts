// `pnpm stand-ins`: the services local development stands in for, against the local chain from `pnpm localnet`, on the
// ports apps/api/wrangler.jsonc names: ArDrive Turbo and the Arweave gateway (8697), and Jupiter's price and token APIs
// answering from the mainnet snapshot the chain quotes (8698).
import { startMarketStandIn } from "./market";
import { startTurboStandIn } from "./turbo";

const rpcUrl = process.env.RPC_URL ?? "http://127.0.0.1:8699";
const turbo = await startTurboStandIn({ rpcUrl, port: Number(process.env.TURBO_PORT ?? 8697) });
const market = await startMarketStandIn({ port: Number(process.env.MARKET_PORT ?? 8698) });
console.log(`Turbo stand-in on ${turbo.url} (deposit address ${turbo.depositAddress}, chain ${rpcUrl})`);
console.log(`Jupiter stand-in on ${market.url} (mainnet snapshot of ${market.takenAt})`);
const stop = () => void Promise.all([turbo.stop(), market.stop()]).then(() => process.exit(0));
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
