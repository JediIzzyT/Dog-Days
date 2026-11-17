# Dog Days

**Sit. Stay. Solve.**

A daily, dog-themed logic puzzle in a single, self-contained HTML file. No server, build step, dependencies, or internet connection required to play.

## Play

Download or clone this repository, then open `index.html` in a modern browser with JavaScript enabled.

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

Use **Undo mark** to reverse a note or **Start over** to reset the current round. Both win and loss screens show an emoji reaction, dogs found, elapsed time, and remaining hearts. Share your result by copying a text summary; manual copying is available when clipboard access is blocked.

## A new puzzle each day

The browser's local calendar date seeds procedural generation. Each generated board has 10 connected colored patches and is checked for exactly one solution.

The same date produces the same puzzle. Reload the page after the date changes to load the next day's board. Replaying a puzzle resets progress without changing its layout.

Progress is saved in the browser's local storage when available, including marks, correct placements, mistakes, and elapsed time. The timer pauses while the page is hidden. Storage availability for locally opened files depends on your browser settings.

## Project structure

- `index.html` - All markup, styles, puzzle generation, and gameplay.
- `README.md` - Project information and playing instructions.

The responsive interface uses a narrow, centered layout, system sans-serif fonts, keyboard navigation, labeled grid cells, and reduced-motion support. There are no external scripts, fonts, or assets.

## Development

Edit `index.html` and refresh the browser. There is nothing to install or compile. The same file can also be hosted on any static website host.
