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
SEED_DEMO=1 npm run dev
```

The dev server listens on [http://127.0.0.1:43123](http://127.0.0.1:43123). `SEED_DEMO=1` fills an empty database with a demo club. Without it, the database stays empty and the first person who joins with the invite code becomes the admin.

| Username | Name | Password | Role |
| --- | --- | --- | --- |
| mira | Mira | `reel-night` | Admin |
| jules | Jules | `reel-night` | Member |
| theo | Theo | `reel-night` | Member |
| noor | Noor | `reel-night` | Member |
| sam | Sam | `reel-night` | Member |

The development invite code is `come-watch`. `npm run seed` fills an empty database the same way `SEED_DEMO=1` does.

Passwords are hashed with bcrypt. Session tokens are random. The database stores only an HMAC-SHA256 of each token, keyed with `SESSION_SECRET` (or a generated file next to the database in development). The cookie is httpOnly. No secret is committed. SQLite lives at `data/club.db` unless `DATA_DIR` or `CLUB_DB_PATH` is set.

## Environment

See `.env.example`.

| Variable | Purpose |
| --- | --- |
| `INVITE_CODE` | Code friends type to join. Required in production. Development default: `come-watch`. |
| `SESSION_SECRET` | At least 16 characters. Required in production. Signs session tokens. |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | Optional. On startup, creates this admin if that username does not exist yet. Does not reset the password later. |
| `ADMIN_NAME` | Board name for that admin. Defaults to `ADMIN_USERNAME`. |
| `SEED_DEMO` | `1` loads the demo club into an empty database. Anything else, including unset, does not. |
| `DATA_DIR` | Directory for `club.db`. Production default is `/data`. |
| `CLUB_DB_PATH` | Full path to the sqlite file. Overrides `DATA_DIR`. |
| `PORT` | HTTP port. Defaults to 43123 outside Railway. |
| `PYTHON` | Python executable. Default `python3`. |
| `BCRYPT_ROUNDS` | Cost factor, default 12. |

The first admin is created in one of two ways. Set `ADMIN_USERNAME` and `ADMIN_PASSWORD` (and optionally `ADMIN_NAME`) before the first boot; that account is inserted once and later restarts leave the password alone. If those variables are unset and the database has no users, the first successful invite-code signup becomes the admin. Further signups are ordinary members. This build does not include a password-change screen.

## Tests

```bash
npm test
```

- `tests/auth.test.ts` covers invite checks, hashing, login, and sessions.
- `tests/ratings.test.ts` covers suggestions, both scores, the suggester rule, the lock, and a replay whose total Elo stays `1500 × members`.
- `tests/ranking.test.ts` and `tests/test_bridge.py` check the adapter against `movie_elo.replay` directly.
- `vendor/upstream_tests` is the library's own suite, including the README worked example.

## Deploying on Railway

The image is the `Dockerfile`. `railway.toml` selects the Dockerfile builder and sets the healthcheck to `/healthz`. Railway injects `PORT`; the server listens on `0.0.0.0:$PORT`.

Create a volume and mount it at `/data`. The database file is `/data/club.db`. The image sets `DATA_DIR=/data`. Do not leave the volume off, or every deploy starts from an empty club.

Service variables:

| Variable | Required | Example |
| --- | --- | --- |
| `INVITE_CODE` | yes | a long private phrase |
| `SESSION_SECRET` | yes | `openssl rand -base64 32` |
| `ADMIN_USERNAME` | recommended | `mira` |
| `ADMIN_PASSWORD` | recommended | 16+ random characters |
| `ADMIN_NAME` | no | `Mira` |
| `SEED_DEMO` | no | leave unset |

Do not set `SEED_DEMO` on the shared club. That loads the public demo password `reel-night`.

`/healthz` returns 200 when the config is present and SQLite answers. It returns 503 when `INVITE_CODE` or `SESSION_SECRET` is missing, so a deploy without those variables stays unhealthy instead of opening the club.

The session cookie is `Secure` in production, so the Railway domain needs HTTPS, which Railway provides.

A laptop Docker run uses the same image:

```bash
docker build -t reel-club .
docker run --rm -p 43123:43123 \
  -e INVITE_CODE='a-long-private-code' \
  -e SESSION_SECRET="$(openssl rand -base64 32)" \
  -e ADMIN_USERNAME='mira' \
  -e ADMIN_PASSWORD='choose-a-real-password' \
  -e ADMIN_NAME='Mira' \
  -v reel-data:/data \
  reel-club
```

Without `PORT`, the container listens on 43123.

## Notes on the library

A few parts of the upstream guide describe a richer game than this app plays. They are left unused on purpose, not reimplemented:

- The guide's opening describes three candidate movies and a vote. This club suggests one movie. `voter_share` stays 0, so `candidates` and `votes` are never sent.
- Membership changes are not part of the week log. The app replays the current member list from the beginning. Someone who joins later sits at 1500 for old weeks and does not judge them, which matches `add_member` for a person with no past ratings. Removing a member is not supported: their name would still be inside old weeks, and replay would raise `UnknownMemberError`.
- The upstream repo declares MIT in `pyproject.toml` and does not ship a LICENSE file.
