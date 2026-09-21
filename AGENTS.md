# Core Luge Studio Agent Instructions

This repository owns the offline course production tools for Core Luge. It is
independent from the released game repository.

- Keep exported maps compatible with `neon-luge.map.v1`.
- Keep generation deterministic: the same recipe and generator version must
  produce the same document.
- Never approve a map that fails structural, safety, pacing, or playability QA.
- The endless manifest may contain approved map revisions only.
- Do not commit generated course libraries, browser storage, or build output.
- Run `npm run verify` before handing off changes.

