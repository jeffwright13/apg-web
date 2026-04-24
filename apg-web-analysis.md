# APG-Web: Technical Profile
*Generated: 2026-04-24*

---

## 1. Project Purpose & Intent

**apg-web** is a browser-based **Audio Program Generator** — a single-page app that converts a structured text script into a fully mixed audio file. The user writes (or uploads) a program in a simple `phrase; pause_seconds` format, picks a TTS engine and voice, optionally layers in background music, and downloads a finished MP3 or WAV.

**Target user:** Someone creating guided audio experiences: meditation sessions, yoga flows, qi gong sequences, stretch routines, language drills, or any guided practice where a voice speaks cues with timed pauses between them. The tool is personal/hobbyist in nature — there is no server, no accounts, no billing UI. The user is expected to supply their own API key.

**Problem solved:** Producing guided audio programs normally requires a DAW or scripted toolchain. This app moves the whole workflow into the browser with zero installation, handles API calls and audio mixing client-side, and saves money by caching generated speech so re-runs don't repeat API calls.

---

## 2. Architecture Overview

**Type:** Single-page application (SPA) — one `index.html`, no router, no build step, no bundler. Served statically; works from `file://` or any static host.

**Module structure:**

```
index.html              — Shell, all UI markup, two inline scripts (offline detection, version fetch)
scripts/
  main.js               — Entry point; instantiates AppController on DOMContentLoaded
  controllers/
    AppController.js    — God-object controller (~2275 lines); owns all UI wiring + workflow
  services/
    TTSService.js       — Facade over TTS adapters; manages engine selection + Web Speech API
    TTSEngineAdapter.js — Abstract base class for TTS adapters
    GoogleCloudTTSAdapter.js — Google Cloud TTS adapter
    OpenAITTSAdapter.js      — OpenAI TTS adapter (tts-1, tts-1-hd, gpt-4o-mini-tts)
    GTTSAdapter.js           — Google Translate TTS (free, unauthenticated)
    AudioService.js     — Web Audio API: decode, mix, fade, WAV/MP3 export, EQ
    TTSCacheService.js  — IndexedDB cache for TTS audio blobs (100 MB LRU)
    ProjectCacheService.js   — IndexedDB store for full project snapshots (last 10)
    TextEditorService.js     — Editor stats, syntax validation, localStorage auto-save
    FileService.js      — File upload reading/validation
    SampleAudioService.js    — Discovers and loads bundled MP3 samples from /samples/
  utils/
    parser.js           — Parses the `phrase; seconds` text format into an object array
styles/
  custom.css            — Supplement to Pico.css; editor + mobile UX styles
samples/                — 5 bundled background MP3 files
tests/unit/             — Jest unit tests (~3930 lines, 9 test files)
```

**Key relationships:**
- `AppController` owns all services as instance properties.
- On submit, it calls `parseTextFile()` → loops phrases → calls `generateOrGetCachedSpeech()` (which consults `TTSCacheService`, then delegates to `TTSService`/adapter) → accumulates `AudioBuffer` objects → calls `AudioService` to concatenate/mix/fade → stores `currentAudioBuffer` → shows output UI.
- Download triggers `AudioService.audioBufferToMP3()` (lamejs) or `audioBufferToWav()`, then uses `showSaveFilePicker` / blob-URL fallback.

---

## 3. Tech Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Language | Vanilla ES2022 JavaScript | ESM modules (`type: module`), no TypeScript |
| CSS framework | Pico.css v2 (CDN) | Minimal semantic CSS; dark/light via `data-theme` |
| MP3 encoder | lamejs 1.2.1 (CDN) | Pure-JS LAME wrapper; loaded as global, not ESM |
| Audio APIs | Web Audio API, Web Speech API | Both browser-native |
| Storage | `localStorage` + IndexedDB | Keys/settings in `localStorage`; audio blobs in IndexedDB |
| TTS APIs | OpenAI `/v1/audio/speech`, Google Cloud `texttospeech.googleapis.com`, Google Translate TTS (free), Web Speech API | 4 engines total |
| Testing | Jest 29 + jsdom | `--experimental-vm-modules` for ESM |
| Linting/formatting | ESLint 9 flat config + Prettier 3 | Enforced on commit via husky + lint-staged |
| Build | None | No bundler; `npx serve .` for local dev |
| Export | File System Access API (`showSaveFilePicker`) with anchor-tag fallback | |

**Notable choices:**
- No build step is a deliberate simplicity tradeoff. Works fine for this scale but means no tree-shaking, no TypeScript inference, no source maps.
- lamejs loaded as CDN global (not `import`) because it predates ESM. This creates an offline dependency for MP3 export (detected via offline banner).
- All data stays in the browser — no server component at all. API keys go only to OpenAI/Google endpoints directly.

---

## 4. Core Features & Capabilities

1. **Text editor for programs** — in-browser textarea with auto-save to `localStorage` (2s debounce), live stats (lines/chars/words), and real-time syntax validation with error/warning display.

2. **File upload mode** — alternative to the editor; accepts `.txt` files up to 10 MB.

3. **TTS engine selection** — four engines available:
   - **OpenAI TTS** (tts-1, tts-1-hd, gpt-4o-mini-tts) — 13 voices, speed control, optional voice instructions for gpt-4o-mini-tts
   - **Google Cloud TTS** — Neural2 voices, speaking rate / pitch / volume gain, dynamic voice discovery after API key entry
   - **Google Translate TTS (gTTS)** — free, no key required, regional accent selection
   - **Web Speech API** — browser-native playback only (no export or mixing)

4. **API key management** — test and save buttons for OpenAI/Google Cloud keys, stored in `localStorage`, unsaved-change detection on the Save button.

5. **OpenAI voice preview** — test any voice/model/instructions combo before generating, with caching to avoid repeat API hits.

6. **Background audio mixing** — upload an audio file or choose one of 5 built-in samples; configurable attenuation (dB), fade-in, and fade-out. Background loops to match speech duration. Disabled when Web Speech API is selected.

7. **TTS caching** — IndexedDB-backed; each phrase is keyed by `engine:text:options-hash`. Cache hits are logged; LRU pruning keeps it under 100 MB. Clear-cache button available.

8. **Generation pipeline** — progress bar + cancellation button while generating phrase-by-phrase; status text per phrase.

9. **Audio playback** — `<audio>` element with native browser controls.

10. **3-band EQ** — Web Audio API lowshelf/peaking/highshelf chain on the audio player; adjustable in real time, resettable.

11. **Export** — WAV (instant) or MP3 (in-browser lamejs encoding at 128/192/256/320 kbps) with progress bar. Uses `showSaveFilePicker` where supported, blob URL fallback elsewhere.

12. **Descriptive filenames** — downloaded files named `audio-program_YYYYMMDD-HHmmss_<desc>_<voice>_<bg>.<ext>`.

13. **Project history** — up to 10 recent projects stored in IndexedDB, shown in collapsible "Recent Projects" section; one-click Restore repopulates all settings and editor content.

14. **Theme switcher** — Light / Dark / Auto (system) / Auto (Sun-based, using NOAA solar calculation with geolocation).

15. **Offline detection** — fixed banner if Pico CSS or lamejs didn't load; live `online`/`offline` event handling.

16. **Mobile UX** — 44-48 px touch targets, responsive editor, collapsible sections.

---

## 5. Data Flow

```
User input
  ├─ Text editor textarea  ─┐
  └─ .txt file upload       ├──► parseTextFile() → [{phrase, duration}, ...]
                             │
                             ▼
                    Loop over phrases
                         │
                         ▼
              TTSCacheService.get(text, engine, options)
                    │
           HIT ─────┘           MISS
            │                    │
            │          TTSService.generatePhrase()
            │               │
            │          adapter.generateSpeech() → fetch(TTS API) → Blob
            │               │
            └───────────────┘
                    │
                    ▼
           speechBlob.arrayBuffer()
                    │
                    ▼
           AudioService.decodeAudioData() → AudioBuffer (speech)
                    +
           AudioService.createSilence(phrase.duration) → AudioBuffer (pause)
                    │
                    ▼
          AudioService.concatenateBuffers([...]) → finalBuffer
                    │
              (if background)
                    │
          FileService.readAudioFile() → ArrayBuffer
          AudioService.decodeAudioData() → AudioBuffer (background)
          AudioService.mixBuffers(final, bg, {attenuation}) → mixed
          AudioService.applyFades(mixed, {fadeIn, fadeOut}) → finalBuffer
                    │
                    ▼
           this.currentAudioBuffer = finalBuffer
           this.currentAudioBlob = audioBufferToWav(finalBuffer)
                    │
                    ▼
             audio player src = blob URL
                    │
           (on Download click)
                    │
          AudioService.audioBufferToMP3(currentAudioBuffer, bitrate)
               or audioBufferToWav(currentAudioBuffer)
                    │
                    ▼
             showSaveFilePicker / anchor click → file on disk

Side effects:
  TTSCacheService.set(text, engine, options, blob)   ← after each API call
  ProjectCacheService.saveProject({...})             ← after successful generation
  localStorage['apg_editor_content']                 ← debounced on keypress
  localStorage['openai-tts-api-key']                 ← on save
  localStorage['google-cloud-tts-api-key']           ← on save
  localStorage['theme']                              ← on theme change
```

---

## 6. UI/UX Approach

**Layout:** Single-column, max-width 800px. Four collapsible `<details>` sections (Recent Projects, Create Phrase File, Configure TTS, Configure Background Audio) plus a permanently-open Generate/Preview/Save section. Sections collapse to reduce scroll on smaller screens.

**Framework:** Pico.css provides clean semantic defaults (form labels, selects, progress bars, `<article>` cards, `<details>` styling). Custom CSS is minimal — mostly the editor styling, validation indicators, and mobile overrides.

**Progressive disclosure:** All "advanced" settings are inside nested `<details>` elements (Editor Settings, Advanced TTS Settings, Equalizer). First-time users see a simple path: type → pick voice → generate.

**Context-awareness:**
- Background mixing UI is disabled/hidden when Web Speech API is selected.
- MP3 bitrate selector hidden when WAV format is chosen.
- `gpt-4o-mini-tts`-only voices auto-upgrade the model selector (and downgrade when switching back).
- Voice instructions textarea appears only for `gpt-4o-mini-tts`.

**Feedback patterns:**
- Buttons temporarily show `✓ Saved`, `✅ Valid`, `🔊 Playing...`, `❌ Invalid key`, etc., then revert after 2-3s.
- Save button shows unsaved state (`Save *`, contrast color) vs. saved state (`Saved ✓`, secondary).
- Progress bar + cancellable generation.
- Auto-save indicator in editor stats bar.

**Mobile:** 44/48 px minimum touch targets enforced via CSS; editor max-height 400px on small screens; toolbar buttons go full-width.

---

## 7. Current State & Completeness

**Finished and working:**
- Complete end-to-end workflow for all three API-based engines (OpenAI, Google Cloud, gTTS)
- Web Speech API playback mode
- TTS caching + project history (both full-featured)
- MP3/WAV export with EQ, background mixing, fades
- Voice preview with caching
- Recent projects: save, restore, delete, prune
- Descriptive filenames, theme switcher (including solar-based mode)
- Unit test suite (~3930 lines, 9 files)

**In-progress / partially implemented:**
- `TextEditorService.applySyntaxHighlighting()` exists and produces HTML but is **never called** from `AppController`. The editor is a plain `<textarea>`, not a `contenteditable` overlay, so the highlighted HTML has nowhere to go. The CSS classes (`.syntax-text`, `.syntax-duration`, `.syntax-separator`) are defined but unused in the rendered UI. This is dead code from a planned highlighting feature that wasn't completed.
- `TextEditorService.generateLineNumbers()` is similarly implemented but never used — there are no line number gutters in the current editor.
- `GTTSAdapter` exists and the engine selector has it in the HTML source as `value="gtts"`, but it is **not listed** in the `<select>` options the user sees (the gTTS option is absent from `tts-engine` in `index.html`). The adapter itself hits a CORS-restricted Google endpoint (`translate.google.com/translate_tts`) which would fail from a browser anyway. This adapter is vestigial.
- `ProjectCacheService.listProjects()` returns metadata only (excludes blobs for listing), but `ttsOptions`, `backgroundSettings`, and `programDescription` are only returned in `getProject()`. The project card display in `loadRecentProjects()` calls `listProjects()` and tries to read `project.programDescription`, `project.ttsOptions`, and `project.backgroundSettings` — these are `undefined` from the list call. The card rendering silently falls through to defaults/fallbacks. This is a subtle data-shape bug that causes voice/background info to show incorrectly for some projects.
- The `ideas.txt` file lists three features explicitly planned but not yet implemented: full UI state reload on session restore (partial — editor content and settings restore, but not all UI state), JSON export/import of sessions, and a text display panel for showing the current cue visually during playback.

**Stubs / TODOs:**
- `docs/IMPLEMENTATION.md` mentions future work for Web Workers (MP3 encoding), AAC/OGG export, VBR, ID3 tags, batch export, project search/filter, cloud sync, and ElevenLabs adapter.
- Coverage thresholds are set at a modest 50-53%, suggesting the test suite covers the most critical paths but not comprehensively.

---

## 8. Strengths

1. **Adapter pattern for TTS engines** — `TTSEngineAdapter` base class with `getName()`, `requiresApiKey()`, `validateApiKey()`, `generateSpeech()`, `getCapabilities()` makes adding a new engine straightforward. OpenAI, Google, and gTTS all follow the pattern consistently.

2. **Two-tier caching architecture** — The `TTSCacheService` (phrase-level audio blobs) and `ProjectCacheService` (full project snapshots) work together elegantly. The IMPLEMENTATION.md cache key documentation is unusually thorough and accurate.

3. **Client-side audio pipeline** — Everything from decode to mix to encode is done in-browser with no server. The `AudioService` WAV writer and lamejs MP3 encoder are solid implementations; the buffer loop properly yields to the UI thread every 10 blocks to avoid freezing.

4. **Robust OpenAI adapter** — Handles empty-response retries with exponential backoff (1s/2s/3s), logs extensively, treats bare `.` as silence (gpt-4o-mini-tts quirk), correctly gates `instructions` to `gpt-4o-mini-tts` only.

5. **Test suite quality** — The AppController tests (`AppController.test.js`) use a custom minimal mock for `fetch` instead of a library, which is clean and readable. The `buildDownloadFilename` and `createProjectCard` test suites are particularly thorough — they cover edge cases like missing descriptions, generic filenames, and old project data formats.

6. **Voice/model auto-upgrade** — When user selects a gpt-4o-mini-tts-only voice (`ballad`, `cedar`, `marin`, `verse`), the model selector auto-upgrades; switching back to a standard voice auto-downgrades. This prevents a class of silent API errors.

7. **Solar theme mode** — The `getSunTimes()` / `isDaytime()` implementation using NOAA solar calculations with geolocation fallback to 6am-6pm is a genuinely nice touch for a personal tool.

8. **Descriptive filename generation** — `buildDownloadFilename()` produces sortable ISO-style timestamps with program description, voice, and background track in the filename. Well-tested.

9. **No build toolchain** — Zero configuration to get started; straightforward to fork and self-host.

---

## 9. Notable Gaps or Technical Debt

1. **`AppController` is a 2275-line monolith.** It owns UI wiring, workflow orchestration, DOM manipulation, project card rendering, theme logic, solar calculations, EQ setup, and more. The form submission handler `handleSubmit()` has three near-identical blocks (~100 lines each) for OpenAI / Google Cloud / gTTS that differ only in parameter extraction — these should be extracted to a shared function. The gTTS and Google Cloud engine paths are copy-paste of the OpenAI path.

2. **`audioBufferToWav()` and `writeString()` are duplicated across four files** — `AudioService.js`, `TTSService.js`, `OpenAITTSAdapter.js`, `GoogleCloudTTSAdapter.js`, and `GTTSAdapter.js` all implement the same WAV writer. This should live in one place (`AudioService` or a `utils/audio.js`).

3. **Dead syntax-highlighting code** — `TextEditorService.applySyntaxHighlighting()` and `generateLineNumbers()` are unreachable from the live UI. Either implement the overlay editor or delete these methods.

4. **`listProjects()` metadata-only bug** — Cards try to read `ttsOptions`, `backgroundSettings`, and `programDescription` from `listProjects()` results, but those fields are only in the full project record from `getProject()`. The `listProjects()` cursor projection should include them, or the card renderer should do a `getProject()` per entry.

5. **gTTS adapter is unreachable dead code** — The gTTS `<select>` option does not exist in the UI HTML, and the Google Translate endpoint is CORS-blocked in browsers anyway. The adapter and its UI elements (`gtts-settings`, `gtts-accent`, `gtts-slow-speech`) in `index.html` should either be completed (via a CORS proxy) or removed.

6. **API keys in `localStorage` as plaintext** — Acceptable for a personal local tool but worth noting. There's no encryption, and the keys are trivially readable by any JS on the same origin.

7. **Hash collision risk in `TTSCacheService.generateKey()`** — The 32-bit djb2-style hash can collide. With 1000+ cached phrases this is low but non-zero. A content-addressable key (SHA-256 via `crypto.subtle`) would be more correct, though it would require async key generation.

8. **`SampleAudioService` discovers samples via N serial `HEAD` requests** (one per expected filename). For 5 samples this is fine; it would need a manifest or batch approach at larger scale.

9. **No EQ state persistence** — EQ settings are lost when the page is reloaded. Projects don't save EQ state either.

10. **`restoreProject()` contains `voice-name` element reference** (line ~363 in AppController) but the Google Cloud voice selector ID in the HTML is `google-voice`, not `voice-name`. This means Google Cloud voice selection is silently not restored from projects.

11. **Coverage thresholds at 50-53%** — Real-world behavior in `handleSubmit()`, the mixing pipeline, and the Web Speech API playback path have minimal or no test coverage.

12. **`attenuation` default mismatch** — HTML default is `-6` dB; `saveCurrentProject()` uses `parseInt(formData.get('attenuation')) || 0` which would store `0` if the field reads `-6` (since `-6` is falsy as `||`'s LHS). The correct guard is `?? 0`, not `|| 0`. Similar issue in background settings restore.

---

## 10. Inferred Roadmap

Based on `ideas.txt`, `docs/IMPLEMENTATION.md` future-enhancement sections, the partially-implemented code, and the overall trajectory of recent commits (v1.9.6–v1.9.9):

**Near-term (based on `ideas.txt` and in-progress code):**
- Complete the text overlay/display panel so the current phrase appears on screen during playback — useful for users who miss an audio cue.
- Full UI state persistence on project restore (currently editor + settings restore; EQ, theme, and exact input-mode details don't).
- JSON export/import of project state for cross-device or cross-browser sharing (currently blocked by IndexedDB being origin-local).

**Medium-term (based on IMPLEMENTATION.md future-enhancements):**
- Web Workers for MP3 encoding to unblock the main thread on long programs.
- EQ settings saved per project.
- ID3 tag embedding in downloaded MP3s (title, artist, etc.).
- Additional export formats (AAC, OGG/Opus).
- Cost/usage estimation display before generation (count phrases × rate).

**Architectural (likely needed as the app grows):**
- Break `AppController` into smaller focused controllers or a state-management approach — as-is, adding a 5th TTS engine would require a 4th near-identical block in `handleSubmit()`.
- Extract the shared `audioBufferToWav()`/`writeString()` helper to avoid the 4-way duplication.
- Fix the `listProjects()` metadata gap before adding more project metadata fields.
- Possibly remove gTTS or implement it via a CORS proxy backend — the free endpoint is too useful to discard but is genuinely broken in-browser.

**Speculative (based on the use-case pattern):**
- ElevenLabs TTS adapter (mentioned in existing docs); the adapter pattern makes this straightforward.
- SSML support for Google Cloud / OpenAI (enabling per-phrase prosody control).
- A "preview phrase" mode where a single line is spoken in isolation without full generation.
- Mobile voice-input-to-editor integration (the textarea placeholder already mentions "supports mobile voice input").
