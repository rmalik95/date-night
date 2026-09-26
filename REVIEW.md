# Date Night review — 26 September 2026

## Outcome

Reviewed the room API, client synchronization, drawing lifecycle, scoring,
replay, invitation navigation, scrapbook, responsive styling and content.
Fixed the issues below and checked the running app in host and guest browser
sessions. This is a local review, not a guarantee of operation on every device
or a production security certification.

## Findings fixed

| Severity | Finding | Change |
| --- | --- | --- |
| Critical | The folder move left the local database in Trash. The homepage loaded but room requests returned HTTP 500. | Restored the saved SQLite database, restarted the server, and verified successful room responses. |
| High | Two writers could pass the revision check and overwrite each other. | Database updates now atomically compare the stored snapshot; the losing request gets a conflict response. |
| High | Client actions raced each other and older polling responses could roll back the display. | Serialized actions, bounded conflict retries within the same activity, and ignored older revisions. |
| High | Unrevealed quiz answers and memory notes were delivered to the other browser. | Filtered private values from both normal and conflict responses. |
| High | The client imported the full content file, including the finale letter. | Generated a public content file without the letter/date; regenerate it automatically before development/build. |
| High | Repeated lobby/finale actions could grant points or jump stages. | Added stage guards and duplicate readiness protection; invalid actions now throw explicit errors instead of relying on message wording. |
| High | Replay reset the revision counter. | Preserved monotonically increasing revisions across replay. |
| Medium | Scrapbook return navigation discarded the invite. | Remembered each tab's invite in session storage so returning to the root reconnects. |
| Medium | Missing invitations produced an endless loading screen. | Added an invitation message; unavailable rooms now show retry guidance. |
| Medium | Pending strokes carried across drawing rounds; clear could leave local strokes behind. | Remounted drawing state per round, cleared local buffers, and removed rejected pending strokes. |
| Medium | Long strokes/out-of-bounds points could fail server validation. | Bounded submitted point counts and clamped coordinates. |
| Medium | Mobile and desktop stretched drawings differently. | Fixed the canvas aspect ratio and removed the rotated pointer surface. |
| Medium | Scrapbook G&R overflowed its circular mark. | Switched to a single-row flex layout and verified desktop/mobile screenshots. |
| Low | Small-screen header/guess input crowded their containers. | Wrapped the header and constrained the input; added visible keyboard focus. |

## What works well

- The warm palette, serif typography, polaroid cards and shared-score framing
  give the experience a consistent, personal feel.
- Host and guest roles have a clear division of responsibility.
- Achievement and surprise content is editable in the main content JSON.
- The achievement drawer now visibly stays above the journey rail.
- The scrapbook adapts well to a 390px-wide phone viewport.
- Existing reduced-motion preferences are respected; decorative celebration
  layers are additionally hidden for reduced motion.

Two questions about reunions and long-distance connection were appended to
the existing six, preserving existing question indexes. They will appear in
the next full quiz run.

## Verification

- Production build, strict TypeScript check, ESLint, and diff whitespace check passed.
- `npm test` exercises the real API handlers against an atomic in-memory
  database stand-in: simultaneous arrivals and retry, full eight-question
  quiz, four drawing rounds, five memory pairs, host-only permissions, privacy,
  four achievements, duplicate finale readiness and saved replay.
- The restored local API responds successfully using the actual database.
- Opened host and guest browser sessions. Drew a test line on the host and
  verified it persisted on both screens after polling.
- Checked scrapbook desktop and mobile layouts and opened the mobile
  achievement drawer above the checkpoint line.
- The test line remains in the current drawing round. No stage was advanced
  during the live browser check.

## Remaining limits and follow-up

- Synchronization is polling: the other device receives completed strokes
  after pen-up, normally on the next 900ms drawing poll; it does not receive
  every pointer movement. This is not WebSocket streaming.
- Actual separate phones, interrupted Wi-Fi, background-tab suspension, and
  prolonged offline use were not tested. Offline actions are not durably queued;
  failures ask the user to retry.
- Invite tokens remain fixed server-side strings sent in URLs and rate limiting
  is per process. Use configurable secrets and durable limiting before treating
  this as a public production service.
- Scrapbook photos are still placeholders, and music remains an external
  Spotify link. No upload service or embedded music playback was added.
- The concurrency regression uses a database stand-in; the local live checks
  verify successful real database operations but are not a multi-region load test.
- Keep `.wrangler/state` when moving the project: it contains local saved data,
  not merely disposable build cache.

## Editing content

Edit `content/date-night.json`. Run `node scripts/sync-public-content.mjs`
after content edits while a development server is already running. Starting
the server or building also regenerates public content automatically.
