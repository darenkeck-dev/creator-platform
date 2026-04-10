# ComboPlayer

`ComboPlayer` renders a synchronized video+audio playback pair from two independent sources (`videoSrc`, `audioSrc`).

File: `packages/shared/src/combo-player.tsx`

## Interface

Core props:

- `videoSrc`, `audioSrc` _(required)_: source URLs for video and audio tracks
- `videoTitle`, `audioTitle` _(required)_: display/debug labels
- `comboId` _(optional)_: identifier used in logs/debug metadata
- `variant`: `default` or `background` rendering mode
- `autoPlay`: attempt playback automatically once ready
- `preload`: media preload behavior (`none` | `metadata` | `auto`)

Audio control props:

- `audioMuted`: controlled mute state
- `defaultAudioMuted` / `audioMutedByDefault`: uncontrolled initial mute
- `audioVolume`: controlled volume (`0..1` clamped)
- `onAudioMutedChange(next)`
- `showBuiltInMuteControl`: renders internal mute button

Playback lifecycle callbacks:

- `onPlaybackReady()` when both tracks are marked ready
- `onPlaybackStateChange(phase)` on phase transitions
- `onTimeUpdate({ currentTime, duration, remaining })`
- `onTimelineEnded()` when the combo timeline completes
- `onPlaybackError({ kind, message })`
- `onVideoElementChange(videoEl | null)`

## Playback model

The player treats one track as the **master timeline** and keeps the other as a **follower**.

- Master selection uses `getMasterTrackFromDurations(...)`:
  - if only one track has duration, that track is master
  - otherwise longer duration wins (video wins ties)
- Timeline duration is `max(videoDuration, audioDuration)`.

The follower track is aligned using:

- `mapFollowerTime(masterTime, followerDuration, timelineDuration)`
- modulo behavior for shorter follower tracks (loop-like alignment during timeline)

## Sync behavior

A 200ms sync loop runs while mounted:

1. Reads current master time
2. Checks timeline end (`isTimelineEnded(...)`)
3. If master paused -> phase sync (`ready` or `stalled`)
4. Computes target follower time and corrects drift if `> 0.2s`
5. If follower paused while master is playing, attempts follower `play()`

On seek:

- Master seeks to requested clamped time
- Follower seeks to mapped follower time
- If playback should resume, both tracks are resumed with guarded phase transitions

## Looping and end handling

There are two different “loop/end” paths:

1. **Follower track ends first** (`handleTrackEnded(kind)` where `kind !== masterTrack`)
   - follower `currentTime` resets to `0`
   - if playback should continue, follower `play()` is retried
   - timeline does **not** end

2. **Master timeline ends** (`stopAtEnd()`)
   - both tracks are paused
   - both times are forced to `duration`
   - phase becomes `ended`
   - `onTimelineEnded()` fires once per end event

Replay behavior:

- `togglePlayback()` calls `restartFromBeginning()` when at end
- `restartFromBeginning()` resets both tracks to `0`, clears end notification state, and sets phase to `ready`

## State machine (phase)

`ComboPlayerPhase` is defined in `combo-playback.ts`:

- `loading`
- `ready`
- `playing`
- `stalled`
- `ended`
- `error`
- `idle` _(defined for model completeness; not a common runtime phase here)_

Typical progression:

`loading -> ready -> playing -> ended` (or `stalled/error` on failures)

## Performance improvement targets

When optimizing for fewer redraws/hiccups in audio/video playback, prioritize these areas:

1. **Master-only timeline updates**
   - Today both video and audio `onTimeUpdate` paths can trigger state updates.
   - Prefer a single authoritative source for timeline updates (usually the master track).

2. **Throttle `currentTime` state updates**
   - `setCurrentTime(...)` on every tick can drive frequent React renders.
   - Throttle updates (for example every 100-250ms) or skip UI-time state when not needed.

3. **Remove hot-path console logging**
   - Logging during frequent phase or timeline events can cause jank on mobile devices.
   - Keep logs behind debug flags only.

4. **Reduce duplicate event handling**
   - Avoid doing the same work in both `onPlay` and `onPlaying` unless required.
   - Prefer one authoritative event (`playing` is commonly best for "actual start").

5. **Coalesce stalled/waiting transitions**
   - `waiting` and `stalled` may fire in bursts.
   - Guard phase updates to avoid repeated `setPhase(...)` calls for the same phase.

6. **Split fast vs rare timeline work**
   - Keep per-tick logic minimal (time propagation only).
   - Run heavier checks (end transitions, recovery actions) only when needed.

7. **Background-mode render cost checks**
   - In background variant, transforms and compositing (`scale`, `will-change`) can increase decode/compositor load.
   - Profile with and without these styles on target browsers/devices.
