# Export format: `bsaber-map-list`

Shared between the BSLink Android app and the Windows PC app (BeatSaver custom maps).

- **MIME**: `application/json` (file extension `.json`).
- **Root fields**: `format` (literal `bsaber-map-list`), `version` (integer, currently `1`), `exportedAt` (ISO-8601), `maps` (array).

Each `maps[]` entry must include at least `key`, `hash`, `songName`, `levelAuthorName`, and `downloadURL` so the PC app can download ZIPs and build playlists. Optional `coverURL` and `songSubName` improve display and `.bplist` metadata.

Machine validation: see [bsaber-map-list.schema.json](./bsaber-map-list.schema.json).
