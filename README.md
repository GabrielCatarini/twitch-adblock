<p align="center">
  <img src="icons/icon128.png" alt="Twitch Ads Blocker" width="80" />
</p>

<h1 align="center">Twitch Ads Blocker</h1>

<p align="center">
  Chrome &amp; Firefox extension (Manifest V3) that blocks Twitch ads<br/>
  using the <strong>VAFT</strong> (Video Ad-Free Twitch) engine with performance and quality improvements.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/manifest-v3-blueviolet" alt="MV3" />
  <img src="https://img.shields.io/badge/engine-VAFT%20v37-9147ff" alt="VAFT v37" />
  <img src="https://img.shields.io/badge/chrome-%E2%9C%93-brightgreen" alt="Chrome" />
  <img src="https://img.shields.io/badge/firefox-%E2%9C%93-brightgreen" alt="Firefox" />
</p>

---

## How It Works

Twitch delivers live streams via **HLS** (HTTP Live Streaming). The player requests an M3U8 playlist every few seconds containing video segment URLs. When an ad plays, Twitch injects ad segments directly into that playlist, tagged with the `stitched` marker.

This extension intercepts the stream at multiple layers:

### 1. Worker Interception

Twitch runs its player inside a Web Worker. The extension replaces the `Worker` constructor before any Twitch scripts load, injecting the VAFT engine into the worker blob. This allows intercepting all playlist and segment requests from within the media thread.

### 2. Backup Stream (Primary Block)

When ads appear in the playlist, the extension requests **alternative access tokens** using different player types (`embed`, `popout`). Twitch treats these as separate sessions and frequently returns a clean, ad-free stream at **full source resolution**.

### 3. Backup Pre-warming

Alternative streams are pre-fetched in the background as soon as the main stream starts, and refreshed every 90 seconds. When an ad hits, the switch to the clean stream is instant because tokens and playlists are already cached.

### 4. Real Segment Looping

If no ad-free alternative stream is available, the extension performs **ad stripping** — it removes ad segments from the playlist and replaces them with the last real video segment. The viewer sees the last scene "frozen" at full resolution instead of a black screen.

### 5. Watchdog Recovery

An independent monitor checks the page's `<video>` element every 2 seconds. If `currentTime` stops progressing for 15 seconds, it attempts recovery via pause/play. If it stalls again, the tab is reloaded. Automatically resets when switching channels.

### 6. Conflict Detection

When a Twitch tab loads, the extension checks whether another ad blocker (userscript, uBlock filter, another VAFT instance) is already active, preventing conflicts that break the player.

---

## Installation

### Chrome / Edge / Brave

1. Download or clone this repository
2. Go to `chrome://extensions`
3. Enable **Developer mode** (top-right corner)
4. Click **Load unpacked**
5. Select the project folder

### Firefox

1. Download or clone this repository
2. Go to `about:debugging#/runtime/this-firefox`
3. Click **Load Temporary Add-on**
4. Select the `manifest.json` file inside the project folder

---

## Project Structure

```
├── manifest.json                 # MV3 extension manifest
├── inject.js                     # Content script — injects VAFT into the page
├── watchdog.js                   # Content script — monitors playback and recovers stalls
├── popup.html                    # Popup interface
├── popup.css                     # Popup styles (Twitch-inspired dark theme)
├── popup.js                      # Popup logic with real-time status updates
├── icons/                        # Extension icons (16, 48, 128px)
└── injected/
    ├── vaft.js                   # VAFT engine — intercepts Worker, fetch, M3U8
    ├── conflict-detector.js      # Detects other active ad blockers
    └── upstream.txt              # Upstream VAFT version metadata
```

---

## Popup

<table>
<tr>
<td width="260">

The popup uses a Twitch-inspired dark theme with custom toggle switches.

- **Ad Blocking** — enable/disable ad blocking
- **Watchdog Recovery** — enable/disable automatic stall recovery
- **Conflict Check** — shows whether another ad blocker is conflicting
- **Reload Twitch Tab** — reloads the active Twitch tab

All status indicators update in real time via `storage.onChanged`.

</td>
</tr>
</table>

---

## Flow Overview

```
Twitch tab loads
  └─ inject.js (document_start)
      ├─ Check storage: enabled?
      ├─ Run conflict-detector.js
      └─ Inject vaft.js into page
          └─ Hook Worker, fetch, visibilityState, localStorage
              └─ Twitch creates Worker → VAFT intercepts, injects code into blob
                  └─ Worker fetches .m3u8
                      ├─ No ad? → Pass through
                      └─ Has ad? → Use pre-warmed backup stream
                          ├─ Clean stream? → Use it (source resolution)
                          ├─ Still has ads? → Try next player type
                          └─ None clean? → Strip + loop last real segment

  └─ watchdog.js (parallel)
      └─ Monitor video.currentTime every 2s
          ├─ Stalled 15s? → pause/play
          └─ Stalled again? → reload tab
```

---

## Credits

The ad blocking engine is based on [VAFT (Video Ad-Free Twitch)](https://github.com/pixeltris/TwitchAdSolutions) by **pixeltris**, with the following improvements:

- Backup stream pre-warming for instant ad-free switching
- Real segment looping instead of black screen during ad stripping
- Removed `autoplay` player type (360p) from the backup rotation
- Null crash fix in `getServerTimeFromM3u8`
- Watchdog with per-channel recovery reset
- Dark-themed popup with real-time status updates

---

## License

This project is distributed for personal and educational use. The VAFT engine is maintained by [pixeltris](https://github.com/pixeltris/TwitchAdSolutions).
