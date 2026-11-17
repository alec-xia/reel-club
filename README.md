# Reel Club

A private web app for a group of friends who run a weekly movie club. Each round, one member suggests a movie. Everyone else scores it twice: how much they enjoyed watching it, and how good the movie actually is. Locked scores are replayed through [`movie_elo`](vendor/MOVIE_ELO_README.md), an Elo-style ranking of the members who pick.

## Ranking engine

`movie_elo` is a dependency-free Python library, not an HTTP service. This repo vendors it unchanged from [hansonhqma/elo-grouprating](https://github.com/hansonhqma/elo-grouprating) at commit `bef8ba41c5c1cf4c2946d826e4891c1e6a6b8aa7` (`movie-night-elo` 1.0.0):

- Package: `vendor/movie_elo`
- Upstream guide: `vendor/MOVIE_ELO_README.md`
- Upstream tests: `vendor/upstream_tests` (run by `npm test`)
- Adapter: `scripts/elo_bridge.py`

The app stores the member list and the raw rating log in SQLite. Standings are not stored. On each page that needs them, the Node server sends that log to the adapter, which calls `replay()` (and `preview_week()` for an open week). Reports on the film page come from `format_week_report`. Nothing in this repository reimplements the match math.

The adapter reads JSON on stdin and writes JSON on stdout:

```json
{
  "members": ["Mira", "Jules"],
  "weeks": [
    {
      "week_id": "2026-10-02",
      "suggester": "Mira",
      "movie": "The Grand Budapest Hotel",
      "date": "2026-10-02",
      "ratings": { "Jules": { "experience": 8, "quality": 8 } }
    }
  ],
  "preview": null
}
```

`members` are the immutable names on the board, in join order. `weeks` are locked rounds only, oldest first. `preview` is the open round, scored but not applied. The response includes `standings`, `history` (each `WeekResult` plus the library's text report), `total_elo`, and `params`.

## Rules the app enforces

- One open suggestion at a time. The person who suggests it is the suggester in `movie_elo`.
- Scores are 1–10 in half-point steps. The library accepts any real number in `[1, 10]`; the app is stricter so the buttons match the scale.
- The suggester cannot score their own movie. `movie_elo` raises `ValidationError` if they do.
- A member may submit one pair of scores per open movie and edit it until the week locks.
- While a week is open, other people's numbers are hidden. Yours stay visible to you.
- The suggester, or an admin, locks the week once at least one score is in. Locking is what feeds the log. It does not happen automatically when the roster is full.
- An admin can reopen only the most recently locked week, and only when nothing else is open. Withdrawing an open pick deletes it and its scores; those scores were never ranked.
- The first locked movie does not move anyone. It starts defending the next week. 1500 stays the group average.
- Parameters stay at the library defaults (`k=32`, `d=2`, `w=400`, `alpha=0.5`, scale 1–10). Voter credit, provisional K, and pick expiry stay off.

## Local setup

You need Node.js 20+ and Python 3.9+ (`python3` on `PATH`).

```bash
npm install
npm test
npm run dev
```

The dev server listens on [http://127.0.0.1:43123](http://127.0.0.1:43123). An empty database in development is filled with a demo club:

| Username | Name | Password | Role |
| --- | --- | --- | --- |
| mira | Mira | `reel-night` | Admin |
| jules | Jules | `reel-night` | Member |
| theo | Theo | `reel-night` | Member |
| noor | Noor | `reel-night` | Member |
| sam | Sam | `reel-night` | Member |

The development invite code is `come-watch`. Set `SEED_DEMO=0` to start from an empty club. `npm run seed` fills an empty database the same way the dev server does.

Passwords are hashed with bcrypt. Session tokens are random, stored only as SHA-256 hashes, and sent in an httpOnly cookie. No secret is committed. SQLite lives at `data/club.db` (gitignored).

## Environment

See `.env.example`.

| Variable | Purpose |
| --- | --- |
| `INVITE_CODE` | Code friends enter on the join page. Required in production. Development default: `come-watch`. |
| `SEED_DEMO` | `0` skips the demo. `1` loads it into an empty database, including in production. |
| `CLUB_DB_PATH` | SQLite file. Default `data/club.db`. |
| `PYTHON` | Python executable. Default `python3`. |
| `BCRYPT_ROUNDS` | Cost factor, default 12. |

In production, leave `SEED_DEMO` unset so a fresh server does not create the known demo password. Create the first accounts by setting `SEED_DEMO=1` once on a private machine, adding the real members, and then replacing that database — or keep one admin and have them create everyone else from **Members**. This build does not include a password-change screen. Hand new members the password you typed, and ask them to treat it as temporary among friends.

## Tests

```bash
npm test
```

- `tests/auth.test.ts` covers invite checks, hashing, login, and sessions.
- `tests/ratings.test.ts` covers suggestions, both scores, the suggester rule, the lock, and a replay whose total Elo stays `1500 × members`.
- `tests/ranking.test.ts` and `tests/test_bridge.py` check the adapter against `movie_elo.replay` directly.
- `vendor/upstream_tests` is the library's own suite, including the README worked example.

## Deploying for the group

Any host that can run Node and Python 3, with a persistent disk for `data/`, is enough. There is no external database.

```bash
docker build -t reel-club .
docker run --rm -p 43123:43123 \
  -e INVITE_CODE='a-long-private-code' \
  -e SEED_DEMO=0 \
  -v reel-data:/app/data \
  reel-club
```

Then open port 43123 only to the friends, or put Caddy or nginx in front for HTTPS. The session cookie is `Secure` when `NODE_ENV=production`, so browsers will only keep the login on HTTPS.

On a VPS without Docker:

```bash
npm ci
npm run build
INVITE_CODE='a-long-private-code' SEED_DEMO=0 npm start
```

Keep `data/` across restarts. Back it up; it is the whole club.

## Notes on the library

A few parts of the upstream guide describe a richer game than this app plays. They are left unused on purpose, not reimplemented:

- The guide's opening describes three candidate movies and a vote. This club suggests one movie. `voter_share` stays 0, so `candidates` and `votes` are never sent.
- Membership changes are not part of the week log. The app replays the current member list from the beginning. Someone who joins later sits at 1500 for old weeks and does not judge them, which matches `add_member` for a person with no past ratings. Removing a member is not supported: their name would still be inside old weeks, and replay would raise `UnknownMemberError`.
- The upstream repo declares MIT in `pyproject.toml` and does not ship a LICENSE file.
