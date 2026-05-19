# WebKit Source Investigation — Is Declarative Web Push Actually Implemented?

## Read this first

You are an LLM investigating whether Declarative Web Push (announced by Apple
on the WebKit blog) is actually implemented in the open-source WebKit
codebase, and if so, whether it is gated behind a disabled feature flag.
You are likely a smaller model with a tight context budget. **Follow the
phases below in order. Do not skip ahead. After each phase, write your
findings to the named output file and then forget the raw search output —
your future self will re-read only the findings files.**

The desired final deliverable is `FINDINGS.md` in this same directory,
summarizing what you found in plain language a non-WebKit-engineer can use
in a blog post.

## Rules

1. **Never read a file larger than ~2000 lines whole.** Use `grep -n` to find
   the line numbers you care about, then `Read` with `offset` and `limit` to
   look at a small window (50–100 lines is usually enough).
2. **Every claim must cite a file path and line numbers.** No claim without a
   citation. If you can't cite, you don't know it — record it as "not found"
   instead.
3. **A zero-result grep is a real finding.** Record it. "Searched X, found
   nothing" tells the reader the feature is missing.
4. **Do not try to understand WebKit's full architecture.** You only need to
   answer the specific questions in each phase.
5. **Quote, don't paraphrase, code.** When you cite a line, copy the exact
   line content into your findings file.
6. **After each phase, write the phase's output file, then stop and re-read
   only the instructions for the next phase.** Do not keep raw grep output
   in context between phases.

---

## Phase 0 — Setup

Goal: get a local copy of the WebKit source you can grep.

### Steps

1. Pick a working directory outside this repo, e.g. `~/webkit-investigation`.
   Create it: `mkdir -p ~/webkit-investigation && cd ~/webkit-investigation`.
2. Shallow-clone WebKit:
   ```bash
   git clone --depth=1 https://github.com/WebKit/WebKit.git
   ```
   This is ~3 GB and takes 5–15 minutes. **Do not deepen the clone unless a
   later phase explicitly tells you to** — you don't need history yet.
3. Verify: `ls WebKit/Source` should show `WebCore`, `WebKit`, `WTF`,
   `JavaScriptCore`, etc.
4. Write `phase0.md` in the _investigation_ directory (not this repo) with:
   - The absolute path to the WebKit clone.
   - The output of `git -C WebKit rev-parse HEAD` (the commit you cloned).
   - The output of `git -C WebKit log -1 --format="%ci %s"` (date + subject
     of the tip commit).

If you cannot clone (network, disk space), stop and report the failure in
`phase0.md`. Do not try to proceed without a clone.

### Suggested starting directories (for later phases)

These are the WebKit subtrees most likely to contain Declarative Web Push
code. Reference these when a phase says "search the relevant areas":

- `Source/WebCore/Modules/push-api/` — Push API implementation
- `Source/WebCore/Modules/notifications/` — Notifications API
- `Source/WebKit/WebProcess/Notifications/` — WebKit2 notification glue
- `Source/WebKit/NetworkProcess/PushManagement/` — push delivery
- `Source/WTF/Scripts/Preferences/` — feature flags (YAML files)
- `Source/WebCore/page/DOMWindow.idl` — what gets exposed on `window`
- `LayoutTests/http/tests/push-api/` — tests (great signal for "what's wired")

---

## Phase 1 — Does the magic number `8030` appear in the source?

Goal: find the parser for the declarative push payload identifier.

Background: Apple's blog says declarative payloads include `"web_push": 8030`
as the opt-in marker. If WebKit parses declarative push, this number must
appear somewhere in C++ source. **If it doesn't appear at all, the feature
is not implemented in the open-source tree.**

### Steps

1. From inside the WebKit clone, run:
   ```bash
   grep -rn --include='*.cpp' --include='*.h' --include='*.mm' --include='*.idl' \
     -e '8030' Source/WebCore/Modules Source/WebKit
   ```
   Save the raw output mentally (or to a scratch file).
2. Also try a broader search if step 1 is empty:
   ```bash
   grep -rn --include='*.cpp' --include='*.h' --include='*.mm' \
     -e 'web_push' -e 'webPushIdentifier' -e 'DeclarativePushMessage' \
     -e 'declarativePush' -e 'parseNotificationPayload' \
     Source/WebCore Source/WebKit
   ```
3. For each promising hit (a file + line that looks like parsing code, not a
   test or a comment), open the file with `Read` using `offset` near the hit
   line and `limit: 80`. Note the surrounding function name.

### Output: write `phase1.md`

Required fields:

- **Does `8030` appear in `Source/WebCore` or `Source/WebKit`?** Yes/No.
- If yes: for each hit, a line like
  `Source/WebCore/Modules/push-api/PushMessage.cpp:142 — constexpr int WebPushIdentifier = 8030;`
  (real path + line + the actual line).
- The names of any functions that look like declarative-payload parsers,
  with paths + line numbers.
- If no: write "Not found." Stop and proceed to Phase 2 anyway — absence is
  itself the answer.

Keep `phase1.md` under 60 lines.

---

## Phase 2 — Is the feature behind a flag, and what is its default?

Goal: find out whether declarative push is gated, and whether the gate is on
or off in shipping iOS Safari.

Background: WebKit uses YAML preference files to declare runtime feature
flags. Each flag has `defaultValue` keyed by configuration (`WebKitLegacy`,
`WebKit`, etc.) and sometimes by platform.

### Steps

1. Search the preferences directory:
   ```bash
   grep -rni -e 'declarative' -e 'webpush' -e 'web_push' -e 'BuiltInNotification' \
     Source/WTF/Scripts/Preferences/
   ```
2. Also try:
   ```bash
   ls Source/WTF/Scripts/Preferences/
   grep -rni 'push' Source/WTF/Scripts/Preferences/
   ```
3. For each flag found that looks related (name contains `Push`,
   `Notification`, `Declarative`, or `BuiltIn`), `Read` the surrounding ~40
   lines of the YAML file.
4. Capture, for each candidate flag:
   - **Exact flag name**
   - **File and line**
   - **`defaultValue` block** verbatim (this often distinguishes
     `WebKit: true` vs `WebKit: false`, and may have per-platform overrides)
   - **Any `humanReadableName` or comment** indicating purpose
5. Cross-check by searching the C++ side for the flag's usage:
   ```bash
   grep -rn '<FlagName>Enabled' Source/WebCore Source/WebKit
   ```
   (replace `<FlagName>` with the exact name you found). This tells you
   _what code path the flag gates_.

### Output: write `phase2.md`

Required fields:

- **Flag(s) found, if any**, with path + line + full `defaultValue` block.
- **Default in shipping iOS/macOS Safari builds**: on, off, or unclear (and
  why unclear).
- **What code the flag gates**: list the top 3–5 call sites in C++ where
  `<Flag>Enabled()` is checked, with file:line.
- If no flag exists, write "No feature flag found for declarative push.
  Either it is unconditionally compiled in, or unconditionally absent" — and
  cite the negative search.

Keep `phase2.md` under 80 lines.

---

## Phase 3 — Is `window.pushManager` exposed in the IDL?

Goal: confirm whether the `window.pushManager` entry point (the SW-less
subscribe path) is declared in the public web API surface.

Background: classic Push API exposes `pushManager` on
`ServiceWorkerRegistration`. Declarative Web Push additionally exposes
`pushManager` directly on `window`. This is observable from the IDL files.

### Steps

1. Search for the attribute on the Window IDL:
   ```bash
   grep -rn 'pushManager' Source/WebCore/page/ Source/WebCore/Modules/
   ```
2. Look specifically at the file(s) that define `Window` / `DOMWindow`:
   ```bash
   find Source/WebCore -name 'DOMWindow*.idl' -o -name 'WindowPushManager*' \
     -o -name 'WindowOrWorkerGlobalScope*'
   ```
3. For each `.idl` file that mentions `pushManager`, `Read` the relevant
   ~30-line window and quote the exact attribute declaration, including any
   `[EnabledBy=...]`, `[Conditional=...]`, or `[SecureContext]` clauses.
4. Check whether the attribute is gated by the flag(s) you found in Phase 2.
   The `[EnabledBy=FooBar]` annotation ties the IDL attribute to a
   preference.

### Output: write `phase3.md`

Required fields:

- **Is `pushManager` declared on `Window`/`DOMWindow` in IDL?** Yes/No.
- **The exact IDL line(s)**, with path + line number.
- **Any `[EnabledBy=...]` clauses** and whether they reference the Phase 2
  flag.
- **Cross-reference**: does the corresponding C++ class
  (`WindowPushManager` or similar) exist and have a working implementation,
  or is it stubbed?

Keep `phase3.md` under 60 lines.

---

## Phase 4 — Does the OS-side display path exist on iOS?

Goal: when a declarative payload is parsed, does code actually call into
iOS's notification system to display it?

Background: even if parsing exists, the bridge from WebKit to
`UNUserNotificationCenter` (iOS) or `NSUserNotificationCenter` (macOS) is
what produces a visible banner.

### Steps

1. Find the function(s) that handle an incoming declarative payload. Start
   from the parser you located in Phase 1: open it and look for what it
   returns or what calls it. Look for names like `showNotification`,
   `displayNotification`, `presentNotification`, `BuiltInNotification`.
2. Search:
   ```bash
   grep -rn -e 'showNotification' -e 'displayNotification' \
     -e 'BuiltInNotificationClient' -e 'UNUserNotificationCenter' \
     Source/WebKit
   ```
3. Identify any platform-conditional blocks (`#if PLATFORM(IOS)`,
   `#if PLATFORM(IOS_FAMILY)`, `#if !PLATFORM(IOS_FAMILY)`) around the
   display path. **A `#if !PLATFORM(IOS_FAMILY)` around the display call is
   a smoking gun — it means iOS deliberately skips display.**
4. If you find Objective-C++ (`.mm`) files in the chain, capture the iOS-
   specific delegate calls.

### Output: write `phase4.md`

Required fields:

- **Function chain** from "declarative payload received" → "OS displays
  notification", as far as you can trace it. Each link is `file:line — short
description`.
- **Any iOS-specific guards** (`#if PLATFORM(IOS_FAMILY)` etc.) that bypass
  the display call on iOS.
- **Verdict**: "display path complete on iOS", "display path stubbed on
  iOS", or "could not determine".

Keep `phase4.md` under 80 lines.

---

## Phase 5 — Git archaeology (only if Phases 1–4 are inconclusive)

Skip this phase if Phases 1–4 already give a clear answer. Otherwise:

### Steps

1. Deepen the clone enough to search history:
   ```bash
   git -C ~/webkit-investigation/WebKit fetch --deepen=2000
   ```
2. Search commit messages:
   ```bash
   git -C WebKit log --all --oneline --grep='Declarative Web Push'
   git -C WebKit log --all --oneline --grep='8030'
   git -C WebKit log --all --oneline --grep='BuiltInNotification'
   ```
3. For the top 3 most relevant commits, capture: short hash, date, subject,
   and which files they touched (`git show --stat <hash>`).
4. Look for _follow-up_ commits that **disabled** the feature — those are
   the most damning if they exist.

### Output: write `phase5.md`

Required fields:

- A timeline: 3–8 commits with date + subject + 1-line summary of what they
  did.
- Any commit that turned a flag off, removed a code path, or added an iOS-
  specific guard.

Keep `phase5.md` under 80 lines.

---

## Phase 6 — Synthesize FINDINGS.md

Now, and only now, re-read your own `phase1.md` through `phase5.md` and
write the final `FINDINGS.md` in the investigation directory.

Structure:

```markdown
# WebKit Declarative Web Push — Investigation Findings

## Summary (3–5 sentences, plain English)

Answer the headline question: "Is Declarative Web Push implemented in
open-source WebKit, and if so, why doesn't it fire on iOS today?"

## Evidence

### Parsing (the `8030` payload identifier)

- Cite from phase1.md.

### Feature flag

- Cite from phase2.md. State the default value in shipping builds.

### Public API exposure (`window.pushManager`)

- Cite from phase3.md.

### Display path on iOS

- Cite from phase4.md.

### History (optional)

- Cite from phase5.md if you ran it.

## Best-guess explanation of the observed bug

In ~5 sentences, propose why a sender sees HTTP 201 from the push service
but the iOS device displays nothing. Tie this to the specific code or flag
you found. If you couldn't determine, say so explicitly.

## What I did NOT verify

List any phase that returned unclear results. Be honest about the limits of
this investigation.

## Citations

A flat list of every (file:line) cited above so a reader can verify.
```

Keep `FINDINGS.md` under 250 lines. The goal is something a human can read
in 5 minutes and quote in a blog post.

---

## When to stop

- You have written `FINDINGS.md`, or
- You hit an unrecoverable blocker (no disk, no network, repo structure
  unrecognizable) — in which case write a short `BLOCKED.md` explaining
  what you tried and what failed.

Do not continue iterating, "polishing," or re-searching once `FINDINGS.md`
is written. The job is done.
