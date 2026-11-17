# Vendored ranking engine

`vendor/movie_elo` is an unmodified copy of [hansonhqma/elo-grouprating](https://github.com/hansonhqma/elo-grouprating) at commit `bef8ba41c5c1cf4c2946d826e4891c1e6a6b8aa7` (package `movie-night-elo` 1.0.0).

- The upstream README is preserved as `vendor/MOVIE_ELO_README.md`.
- The upstream unittest suite is in `vendor/upstream_tests` and runs as part of `npm test`.
- Do not edit the math. Reel Club talks to the package through `scripts/elo_bridge.py`, which calls `replay`, `preview_week`, `format_week_report`, and `format_standings`.
- `pyproject.toml` declares an MIT license. The upstream repository did not include a LICENSE file.
