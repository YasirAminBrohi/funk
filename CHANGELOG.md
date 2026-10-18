# Changelog

## 1.1.0

- **New `funk.mode` setting**: `image-and-sound` (default), `image-only`, `sound-only`.
- **Overlay now covers the editor area**: opens in the active column and can maximize it (`funk.coverEditor`), restoring the layout after.
- **Reliable sound playback from the extension host** (`ffplay`, Windows Media Player COM, `afplay`, `paplay`, `mpg123`), bypassing webview autoplay restrictions entirely.
- Whitelists custom asset folders in the webview so user-provided images/sounds actually load.
- Packet layout restore after every show; `funk.reloadAssets` also kills lingering audio.

## 1.0.0

- Initial release of Funk.
- Detects failed terminal commands (via shell integration exit codes) and failed tasks.
- Webview overlay with configurable animations: shake, bounce, spin, zoom, shake-bounce, chaos.
- Plays a configurable sound; default assets included so it works out of the box.
- Status bar toggle, test command, cooldown/debounce to prevent spam.
