---
name: homey-release
description: Cut and publish a new release of the Victron Energy Homey app (com.victronenergy). Use when the user asks to make a new release, bump the version and publish, or ship the app to the Homey App Store. Covers version bump, bilingual changelog, validation gate, git commit + tag, and the interactive `homey app publish` handoff.
---

# Homey App Release

Release procedure for `com.victronenergy`. Follow the steps in order. Do NOT run
`homey app publish` yourself. Prepare everything, then hand off (see step 5).

## Inputs to gather first
- **Bump**: `patch` | `minor` | `major` | explicit `X.Y.Z`.
  - `patch` = fixes / performance / reliability, no new user-facing capability
  - `minor` = new capability / device / flow card
  - `major` = breaking change
- **Changelog** text in English *and* Swedish (one or two user-facing sentences).
  Draft both from the commits since the last release (`git log v<last>..HEAD`)
  if the user didn't give them, and show them to the user. Keep the existing
  `en`/`sv` pattern and describe user-visible impact, not internal refactors.

## Step 1 — Check whether the bump is already done
Fixes are often committed together with the version bump and changelog entry.
Compare the version in `.homeycompose/app.json` with the top entry in
`.homeychangelog.json` and the latest tag (`git tag --sort=-creatordate | head -1`).
If the version is already bumped and has a changelog entry, skip step 2.

## Step 2 — Bump version + changelog
`.homeycompose/app.json` is the source of truth. `app.json` is **generated and
gitignored**: never edit or commit it. `package.json` has its own unrelated
version (0.9.9) and is not part of the release; leave it alone.

Preferred, let the CLI do it:
```
homey app version <patch|minor|major|X.Y.Z> \
  --changelog.en "<ENGLISH>" \
  --changelog.sv "<SWEDISH>"
```
This updates `.homeycompose/app.json`, regenerates `app.json`, and prepends the
entry to `.homeychangelog.json`. Confirm with `git diff`.

(By hand: bump `version` in `.homeycompose/app.json` and add the newest-first
`{ "en": ..., "sv": ... }` entry at the top of `.homeychangelog.json`.)

## Step 3 — Validate for publish
There is no `npm test` / lint setup in this repo; validation is the gate.
```
homey app validate --level publish
```
Must end with: `App validated successfully against level 'publish'`.
This also regenerates `app.json`.

## Step 4 — Commit + tag
The main branch is **master**. Tags are **v-prefixed and lightweight**
(e.g. `v1.5.1`). Review `git status`, then stage the release files explicitly
(no blind `git add -A`, never `app.json`):
```
git add .homeycompose/app.json .homeychangelog.json
git commit -m "chore(release): v<X.Y.Z>"
git tag v<X.Y.Z>
git push origin master
git push origin v<X.Y.Z>
```
If the bump was already committed (step 1), just tag the current commit and push
the tag.

Push the tag as its own explicit ref. Do **not** use `--follow-tags`: it only pushes
*annotated* tags, so it silently skips lightweight tags and still reports
`Everything up-to-date`. Confirm the tag landed:
```
git ls-remote --tags origin | grep v<X.Y.Z>
```

## Step 5 — Publish (interactive; the user runs this)
`homey app publish` has no flags to skip its prompts, and an automated shell
cannot answer them. Tell the user to run it in their own terminal:
```
homey app publish
```
Expected prompts:
- "Update version?" → **No** (already bumped).
- Verify/confirm the changelog.
- Final confirmation to upload → **Yes**.

Requires `homey login`. Publishing submits the build for store certification;
only hand off on the user's explicit go-ahead. After publishing, the user still
promotes the build to test/live in the Homey Developer Tools.

## Notes
- `test/` and README files are excluded from the bundle via `.homeyignore`.
- Tag history has gaps: v1.5.2–v1.5.7 were released without tags. Tagging is
  consistent again from v1.5.8.
