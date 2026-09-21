# Core Luge Studio

Independent, browser-based production tooling for Core Luge. It batch-generates
deterministic two-minute courses, automatically evaluates them, supports manual
review and tuning, previews balance-board gameplay, and exports approved maps or
an ordered endless playlist.

## Run

```sh
npm run serve
```

Open `http://localhost:4173`. No install step or external package is required.

## Workflow

1. Set duration, difficulty, complexity, shape, environment, and mechanism mix.
2. Generate one course or a batch. Every generated map runs through automatic QA.
3. Review all candidates in Library. Only passing maps can be approved.
4. Tune segments and gameplay values in Editor and Debug, then rerun QA.
5. Add approved revisions to Endless and export `neon-luge.endless.v1`.

Map JSON remains compatible with the game repository's `neon-luge.map.v1`
contract. Studio-only production metadata is stored separately in the library.

The game can import `src/runtime/endless-loader.js`, call `loadEndless()` with
the exported manifest, use `current()` for the first course, and call `next()`
after each finish. The loader preserves playlist order and loops at the end.

## Arcade racing layer

The V2 generator uses an original arcade-racing layer suited to seated balance
controls: carve-to-charge drift boosts, optional fast lines, energy chains,
auto-used random supply gates, oil slicks, moving gates, ramps and shields.
Auto-use keeps the interaction physical and does not add a handheld item button.
