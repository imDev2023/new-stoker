# The public API

The reference is a page of the site (owner, 2026-10-25: everything on the page, nothing left here to link out to): `/api` on the deployment, `https://stoker.markets/api` on mainnet.
Its content is `apps/web/src/app/api/reference.tsx` (moved there by #12, 2026-11-06), one section per group of endpoints with what each answers or prepares, the sign-send-report walkthrough, the referral rule, the keys and limits, the errors the API really sends, and the operator's endpoints; the page adds a quickstart the API answers live.
The zod contract in `packages/contract` is the source of truth for every shape.

When an endpoint, a field or an error changes, change `reference.tsx` in the same PR.
`tests/ui/src/developers.spec.ts` asks the stack every read the reference names, and a row that says "Outside `/v1`" is asked at the root; the prepare, error and operator rows are checked by hand against `apps/api/src`, one grep per status.
Corrected by #12 (2026-11-06): production's reference listed `/metadata` under `/v1` (it is served outside it, like `/health`) and said a too-short fee or rules lead answers 409 (the API answers 422).
