# Research: Whoop Triggerz / Whoop Triggerz Plus (functional reference only)

Researched 2026-11-02 for Sanctum's own trigger engine, **Sanctum Pulpit**. We copy only the *functional ideas* here.
We don't use Whoop Triggerz's name, branding, artwork, audio, collections or wording.
Whoop Triggerz® / Whoop Triggerz Plus® / The C-Dub Brand® are trademarks of Carlton "C-Dub" Whitfield.

## What it is
- A mobile app (iOS and Android) that lets someone with **no musical training** back up a preacher or a singer from a phone, so it sounds like a band is playing. It's aimed at small churches with no musicians.
- **Whoop Triggerz** (original) is a one-time purchase of $59.99 with 4 collections. It started as a PC/Mac version in 2015.
- **Whoop Triggerz Plus** costs **$24.99/month** (an annual option was added in 2.1.22). It has a 14-day free trial and unlimited collections, updated every month: preaching backup, singer backup, call to worship, congregational songs, CCM, quartet and more.
- Collections are downloaded once and then play offline. The FAQ recommends using airplane mode during service.

## Feature set (from the store listings, FAQ and version history)
| Feature | How it works / UX |
|---|---|
| **Easy Play** | One button. Each tap plays the *next* chord or band hit of a pre-recorded "realistic sequence" (stepping chord by chord, not a looping track), so one finger sounds like a band. |
| **Band modes** | **Full band**: audio samples of drums, bass, piano, rhodes, synth, organ and guitar playing together (7 pieces). **2-piece organ + drums**: Hammond-style organist plus a drummer, with triggerable **organ runs, slides and "talking" organ**. |
| **Pads view** | The user builds their own sequence of chord progressions and flows as the service changes. |
| **Key detection** | Hold the key display for about 1 s. The app listens and **highlights the detected key in green**. Later versions are marketed as "AI-powered automatic key detection … lock it in". "Enhanced key detection" arrived in 2.0.3. |
| **Change key anytime** | Live key changes without stopping the music. Since 1.5.8, key changes and mute/unmute are **in sync with time**. "Dual key" support for preaching libraries came in 2.1.14–2.1.19. |
| **Shout ("S")** | Tap S for shout music. **Swipe right** gets **4 levels of shout music** you switch between on the fly, with live key and tempo changes and drums/music mute. |
| **Worship** | **Swipe left** gets 4 levels of worship music, with key and pitch changes. |
| **Organ talk ("T")** | Tap T for endless organ-talk music in any key. |
| **Singer backup + cue words** | "Tap the blue button when you see the cue words displayed on the screen." Lyric/cue prompts tell the operator when to trigger the next chord behind a singer. |
| **Playlists** | Added in 2.1.7 (Dec 2024) along with intro/outro play. Later updates improved transitions between songs (2.1.13) and fade-out of the other player when switching libraries (2.1.9). Favorites support drag-and-drop. |
| **AutoWhoop (2025)** | An "AI-powered" mode that follows and backs up the preacher **without tapping**. Beta in 2.2.1 (Jul 2025). |
| Other | Mixer view (2.1.21), landscape (2.1.22), light/dark mode, haptics, AirPlay, idle-timer fix (screen stays awake), Bluetooth fixes, and a new audio engine (2.1.3). |
| Background vocals | Not listed as a feature anywhere we checked. Singer support is cue words plus taps. A BGV layer would be a **Sanctum differentiator**. |

User feedback seen on the App Store page asks for more 2-piece content and a better "tuning up" (pre-whoop organ) portion.

## Takeaways for Sanctum Pulpit
1. **Respond instantly to the tap.** The chord must sound on touch, so it is never quantized.
2. **Recorded realism is the product.** Their value is in the recorded sequences. Sanctum has no recorded band stems yet, so our version is the engine and the data model, with synthesized placeholders. Real recordings are the main blocker.
3. Shout and worship are **level-based** (4 levels). We use a continuous intensity control with 4 detents.
4. Organ talk and the S/T one-tap launchers are core muscle memory for operators.
5. Run everything offline, keep the screen awake, and switch libraries without leaving the performance screen.
6. Price anchor: **$24.99/month** for unlimited content.

## Sources
- App Store, Whoop Triggerz Plus: https://apps.apple.com/us/app/whoop-triggerz-plus/id1441880422 (description, subscription terms, version history)
- Google Play, Whoop Triggerz Plus: https://play.google.com/store/apps/details?id=com.cdub.whooptriggerzplus (feature list: Easy Play, key detection hold-to-detect/green, S/T buttons, 4 shout/worship levels, cue words)
- Whoop Triggerz home: https://whooptriggerz.com/
- About (Carlton Whitfield / C-Dub Brand): https://whooptriggerz.com/about
- FAQs (pricing, offline, devices): https://whooptriggerz.com/faqs
- Original Whoop Triggerz listing mirror (full band vs 2pc organ+drums, runs/slides/organ talk, mute/unmute): https://whoop-triggerz.apps112.com/
- Plus version history mirror: https://whoop-triggerz-plus-ios.apps112.com/
