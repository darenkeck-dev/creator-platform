# TODO

- Vertical video handling: improve scaling/positioning to avoid large black bars; likely needs a different zoom strategy than horizontal videos.
- add 'Daren Keck' signature image
- Audio mute can pop/clip waveform; investigate fade/ramp-down before mute (or similar anti-pop fix).
- Player phases are inconsistent between `stalled`, `playing`, and `ready`, which impacts loading-state visibility; fix phase state management in `combo-player`.
- DELETE/CREATE actions should honor current folder context; upload and delete UI currently often ignore active folder location; breadcrumbs just shows UID not folder1 > nested folder > name
