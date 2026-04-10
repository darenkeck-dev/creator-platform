# TODO

- Vertical video handling: improve scaling/positioning to avoid large black bars; likely needs a different zoom strategy than horizontal videos.
- Safari playback: investigate and fix video stuttering during playback.
- Add fallback behavior to test if bandwidth is ok for video
- Make sure variable stream resolution is actually happening
- fast load of next combo needs to be debugged before release
- vignette is not working as expected
- add 'Daren Keck' signature image
- Audio mute can pop/clip waveform; investigate fade/ramp-down before mute (or similar anti-pop fix).
- Mute/unmute button improvements: add intermediate "medium" volume state and align sound-wave icon paths (they currently sit slightly low).
- Player phases are inconsistent between `stalled`, `playing`, and `ready`, which impacts loading-state visibility; fix phase state management in `combo-player`.
- Folder delete should recursively delete all contained assets (and their derived/original objects), not just the folder record.
- DELETE/CREATE actions should honor current folder context; upload and delete UI currently often ignore active folder location; breadcrumbs just shows UID not folder1 > nested folder > name
