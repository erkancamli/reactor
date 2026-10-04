# Design notes

The one memorable element is the block: twelve cells that fill as you answer, glacier for a landed transaction, striped red for noise, grey for a handover. It is the hero on the home screen, the progress bar during play, the result card at the end and the share text on X.

- Palette: ink #0a0a0a, slab #141414, paper #e8e3d5, mute #8f8a7d, glacier #9fd3e8 (correct), signal #ff5c5c (wrong), amber #f2b84b (stake). Black and paper are Rialo's own; glacier and signal carry state only.
- Two themes, night (default) and day: the tokens swap (paper becomes the page, ink becomes the text, glacier and signal get darker so they read on paper), the block cells keep their exact colours in both so a shared screenshot looks the same. The choice follows the system setting until the player taps the toggle, then it is remembered on the device; theme.js runs before the stylesheet so there is no flash.
- Type: Space Grotesk for everything, JetBrains Mono only for numbers, timers and the block cells.
- One column, 560px, left aligned, sentence case, no eyebrow labels. Structure comes from spacing and hairlines, not boxes.
- Motion: a cell lands when you answer, the question shakes on a miss, the block flashes on a hit. Nothing moves on its own; reduced motion is respected.
- Copy: plain verbs, the same word for the same thing everywhere (Daily Block, Sprint, Atlas, Webcall, Filter, Handover), explanations that teach rather than cheer.
- Turkish is written as Turkish by a Turkish speaking crypto native, not translated word by word. Numbers stay in the source's notation.

## Kelvin

The mascot is one cell of the Daily Block that came alive: a glacier body like a landed transaction, a paper scarf (Subzero), rounded tube limbs and an antenna that lights up amber when it is happy. A wrong answer turns it into the striped noise cell with crossed eyes; a handover greys it out. It is drawn in code (`kelvin(mood)` in src/app.js) from the theme tokens, so it works in both themes and in the share image. Moods: idle (bobs, blinks), happy, noise, think, skip, sleep. It is an original character and does not use Rialo's logo or marks.
