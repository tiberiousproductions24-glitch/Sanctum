# Chord import sources — Sanctum (legal audio only)

**Date:** Thu Nov 5 2026 (America/Los_Angeles)  
**Policy (Lawrence Davis Sr):** Skip YouTube entirely. No YouTube field, no ripping of any streaming service. Only (a) user-owned file uploads, (b) direct audio URLs that permit download (CORS), (c) royalty-free / licensed sample libraries including Sanctum `content/church-banks`, (d) metadata-only platform connectors.

## Ranked audio quality for chord analysis

| Rank | Source / format | Why | Chord-analysis note |
|---:|---|---|---|
| 1 | **Stems / isolated instrument tracks** (WAV/FLAC) | No competing voices; clear pitch classes | Best of all — organ, guitar, or piano stems crush full mixes |
| 2 | **Lossless WAV / FLAC** (44.1–96 kHz, ≥16-bit) | Full bandwidth, no codec smear | Preferred import path |
| 3 | **High-bitrate AAC / ALAC / M4A** (~256–320 kbps) | Mild HF loss; chroma mostly intact | Good; decode support varies by WebView |
| 4 | **MP3 320 kbps** | Acceptable chroma; some transient blur | Fine for charts |
| 5 | **MP3 192–256 / AAC 160–192** | More smearing of upper partials | OK for maj/min; weaker on extensions |
| 6 | **Sanctum church-banks OGG/WAV loops** | Short, looped, known key/BPM in manifest | Excellent for validation & rehearsal seeding |
| 7 | **Low-bitrate streams / 30–60 s previews** (~96–128 kbps) | Codec noise + incomplete form | Worst practical input — avoid when possible |
| 8 | **Phone voice memos of a band** | Room noise, bleed, phone mic EQ | Live-mode territory; expect lower confidence |

### Platform decode notes (WebView / browsers)

| Format | Chrome / Android WebView | Safari / iOS WKWebView | Notes |
|---|---|---|---|
| WAV (PCM) | Yes | Yes | Safest |
| MP3 | Yes | Yes | Universal |
| AAC / M4A | Usually yes | Yes | Some Android OEM WebViews flaky — fall back to WAV/MP3 |
| OGG Vorbis | Yes (Chrome) | **No** (Safari) | Sanctum banks ship OGG+WAV; prefer WAV on iOS |
| FLAC | Chrome yes; Android WebView **varies** | Safari 15+ yes | If `decodeAudioData` rejects, show clear error + suggest WAV |
| Opus | Chrome yes | Limited | Prefer re-encode to WAV for import |

## Source adapters (pluggable)

Common interface: `SourceAdapter` in `src/chords/sources.ts`.

| Adapter | Status | Audio? | Metadata | Notes |
|---|---|---|---|---|
| **File upload** | Working | Yes (user file) | filename, size, optional ID3 later | MP3/WAV/AAC/M4A/FLAC pick |
| **Direct URL** | Working | Yes if CORS allows | URL, Content-Type | Clear error on CORS/403/opaque |
| **Church banks** | Working | Yes (`/content/...`) | key, BPM, bars from manifest | Royalty-cleared Sanctum content |
| **SoundCloud oEmbed** | Lightweight | Audio **only** if owner enabled downloads via official API (not implemented without key) | title, author, thumbnail, HTML | No API key embedded; config placeholder |
| **Spotify Web API** | Stub | **No raw audio** | title, artist, album; key/tempo/sections **unavailable to new apps** | Spotify deprecated `audio-features` / `audio-analysis` for new apps on **27 Nov 2024**; still unavailable to new clients as of late 2026. Metadata (track object) only. |
| **Apple Music / MusicKit** | Stub | No raw export | catalog/library metadata | Requires developer token + user auth; placeholders only |
| **Bandcamp** | Stub | N/A | Informational | Purchased downloads are user-owned → use **file upload**. No official public search/stream API |

### Spotify status (verified)

- Blog: [Introducing some changes to our Web API](https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api) (27 Nov 2024).
- Docs mark Get Audio Features / Get Audio Analysis as **Deprecated**; new apps get **403**.
- February 2026 Web API changelog does not restore those endpoints for new apps.
- Sanctum therefore treats Spotify as **metadata-only** (title/artist/album/duration) to seed UI; chord/BPM/key come from on-device analysis of user-owned audio.

### Config placeholders

No API keys in the repo. Optional runtime config:

```json
{
  "spotifyClientId": "",
  "appleMusicDeveloperToken": "",
  "soundcloudClientId": ""
}
```

Stored via Settings / localStorage later; adapters refuse authenticated calls until filled.

