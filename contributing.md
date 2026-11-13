# Contributing to BlackMusic

Thanks for helping. Bug reports, small fixes, translations and documentation improvements are all welcome.

## Workflow
1. **Open an issue first** for anything bigger than a small fix, so we can agree on the approach.
2. Fork or branch, make a focused change, and keep unrelated edits out of it.
3. Set up as in [DEVELOPMENT.md](DEVELOPMENT.md) (`pnpm install`, then `pnpm tauri:dev`).
4. Before opening a pull request, run what the repository provides: `pnpm lint`, `pnpm build` (type-checks and builds the interface), and for Rust changes `cargo test` in `src-tauri/` (the same-Wi-Fi room has unit tests).
5. Open the PR using the template: what changed, why, how you tested it, and screenshots for anything visual.

## Rules of the road
* Don't remove existing behaviour as a side effect; this project keeps old features working.
* **No silent failures:** a button that can't work is disabled or hidden, a spinner times out, an error says what to do.
* Never commit secrets, `.env` files, or private URLs. Client *secrets* must not go in `VITE_` variables.
* Desktop-only code (yt-dlp, the desktop FFmpeg runner) stays out of mobile builds at compile time.
* Be kind: see the [Code of Conduct](CODE_OF_CONDUCT.md).

## Security
Report vulnerabilities privately; see [Security.md](Security.md).

## Licence
BlackMusic is **all rights reserved** ([LICENSE](LICENSE)). By submitting a contribution you confirm you wrote it (or have the right to share it) and agree that the copyright holder may include it in BlackMusic under that licence.
