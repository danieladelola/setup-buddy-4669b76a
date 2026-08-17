<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Runtime compatibility (Cloudflare Workers / TanStack Start edge)

The server (server functions + server routes under `src/routes/api/`) runs on
Cloudflare workerd with `nodejs_compat`. Pure Node-only packages crash at send
time, not at build time. Before adding a server-side dep, check:

- **Banned**: anything that pulls in `jsdom`, `puppeteer`, `sharp`, `canvas`,
  `child_process`, or `__dirname`/`__filename` in ESM scope.
  - `isomorphic-dompurify` — pulls in jsdom → `__dirname is not defined`.
    Use `xss` (already installed) via `@/lib/sanitize.server` instead.
  - `dompurify` server build — same reason.
  - Native-binding packages (`*.node`, `binding.gyp`, `node-gyp`).
- **Preferred**: pure-JS or Workers-documented packages. Fetch-based clients
  over raw TCP. WASM builds that embed the binary at build time.
- **Red-flag runtime errors**: `__dirname is not defined`, `[unenv] X is not
  implemented yet!`, `Cannot find module 'X'` at runtime. These mean
  Node-incompat, not a logic bug — swap the package.

`src/lib/sanitize.server.ts` is the canonical HTML/URL sanitizer for the send
path. Do not reintroduce a DOM-based sanitizer here.
