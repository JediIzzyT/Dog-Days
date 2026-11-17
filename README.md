# Dog Days

**Sit. Stay. Solve.**

A daily, dog-themed logic puzzle with self-contained gameplay in one HTML file. No build step or dependencies required.

## Play

Download or clone this repository, then open `index.html` in a modern browser with JavaScript enabled.

### Install and play offline

Visit the hosted game over HTTPS (or localhost during development) to cache the game and its icons on your device. Use your browser's **Install app** option, or on iPhone/iPad use Safari's **Share > Add to Home Screen**. Availability and wording vary by browser.

The installed app is named **Dog Days**, uses the green paw icon, and opens in its own window on supported devices. After the initial online visit, you can reopen or reload it without a connection, play new daily puzzles, and browse the archive: puzzles are generated on-device, not downloaded. Saved progress stays in that browser's storage. Clearing site data removes offline files and progress; browsers may also evict offline files under storage pressure.

Opening `index.html` directly still works without a connection, but installation and service-worker caching require HTTPS or localhost. The GitHub link requires an internet connection.

Find all 10 dogs on a 10-by-10 board:

- Place exactly one dog in each row, column, and colored patch.
- Dogs cannot touch, even diagonally.
- A wrong placement costs one of your three hearts. Find every dog to win; lose all three hearts and the round ends.
- Pencil marks are free and do not cost hearts.

## Controls

| Action | Mouse or touch | Keyboard |
| --- | --- | --- |
| Move between tiles | Select a tile | Arrow keys |
| Toggle an empty-tile mark | Click or tap once | Space |
| Place a dog | Double-click or double-tap | Enter |

Marks appear or clear immediately on the first tap. A second tap on the same tile within 340 ms places a dog instead.

Use **Undo mark** to reverse a note or **Start over** to reset the current round. Both win and loss screens show an emoji reaction, dogs found, elapsed time, and remaining hearts. Share your result by copying a text summary with a link to the page; manual copying is available when clipboard access is blocked.

## A new puzzle each day

The browser's local calendar date seeds procedural generation. Each generated board has 10 connected colored patches and is checked for exactly one solution.

The same date produces the same puzzle. Reload the page after the date changes to load the next day's board. Replaying a puzzle resets progress without changing its layout.

Select the **DAY 000** button beside the date to open the archive calendar. Browse months and choose any puzzle from January 1, 2026 through today; future dates are unavailable. Use the calendar's arrow keys to move between dates, or choose **Back to today's puzzle**. Switching days preserves each puzzle's saved progress.

Completed days have a check mark in the calendar, even after replaying them. Completion history is stored in a small cookie for each year, with a local-storage backup. Cookies are retained for up to 400 days after the year's latest completion is saved; browser policies may shorten this. When opened directly as a local file, browsers commonly block cookies, so the calendar uses local storage instead. History stays in the same browser and is not synced between devices.

Progress is saved in the browser's local storage when available, including marks, correct placements, mistakes, and elapsed time. The timer pauses while the page is hidden. Storage availability for locally opened files depends on your browser settings.

## Project structure

- `index.html` - All markup, styles, puzzle generation, and gameplay.
- `manifest.webmanifest` - Installation name, standalone display, colors, and icon metadata.
- `sw.js` - Versioned offline cache for the game and install assets.
- `icons/` - Branded paw SVG, 192px and 512px install icons, and 180px Apple touch icon.
- `README.md` - Project information and playing instructions.

The responsive interface uses a narrow, centered layout, system sans-serif fonts, keyboard navigation, labeled grid cells, and reduced-motion support. Board squares stay the same size as marks and dogs are added, while resizing with the screen or orientation. There are no third-party scripts, fonts, or assets.

## Development

Edit `index.html` and refresh the browser. There is nothing to install or compile. To try installation and offline support, run `python -m http.server 8000` from this directory and open `http://localhost:8000`. Deploy all files above together to any HTTPS static website host; relative paths support hosting in a subdirectory.

When changing any cached file, bump `CACHE_NAME` in `sw.js`. A new worker caches the complete replacement before installing and waits for all existing game tabs/windows to close before activating, so it does not interrupt an active puzzle. Reopen the game to use the update. During development, browser developer tools can unregister the service worker to bypass the cached version.

Run the interaction, offline-cache, installation-metadata, and sharing checks with `node --test tests\interaction.test.js tests\pwa.test.js tests\share.test.js`.
