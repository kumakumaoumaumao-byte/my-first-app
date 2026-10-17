# Copilot instructions

## Project structure and architecture

This repository is a dependency-free, static browser game. `index.html` owns the Japanese-language page structure, canvas, HUD, end-of-game dialog, and control buttons. It loads `style.css` and defers `game.js`; keep the DOM IDs and `data-key` values in sync with the selectors and input handlers in the script.

`game.js` owns the game loop and state: world/platform/enemy data, keyboard and pointer input, player physics and collision checks, camera tracking, HUD updates, and Canvas rendering. Its canvas uses a fixed 960×540 logical coordinate space while CSS scales it responsively. World positions are in that logical space; subtract `cameraX` when drawing world objects. Keep simulation changes in `update()` and drawing in the `draw*()` functions. The animation loop passes a capped elapsed-time delta to `update()`.

`style.css` styles the page and overlays, scales the canvas, and switches from keyboard hints to on-screen pointer controls at 680px. Touch controls feed the same key sets as keyboard input, so new actions should work through that shared input path.

## Commands

There is no package manifest, build step, configured linter, or automated test suite. To serve the game locally, run `python3 -m http.server 8000` from the repository root and open `http://localhost:8000`. For a quick JavaScript syntax check, run `node --check game.js`. There is no single-test command; verify gameplay changes in the browser, including keyboard controls and touch controls when input behavior changes.

## Codebase conventions

- 説明は日本語でするようにして。
- Keep game geometry and tuning data (world size, platforms, enemy start positions, physics constants) in the existing top-level constants in `game.js`; platform and enemy coordinates are world coordinates.
- `resetGame()` initializes mutable game state, while `updateHud()` synchronizes state to the existing DOM labels. Keep restart behavior and HUD values consistent when adding state.
- Use `pressed` for one-shot actions such as jump and attack, and `keys` for held movement. Pointer controls map to the same `event.code`-style keys.
- Keep user-facing interface text in Japanese, including text added to the end-of-game dialog and controls.
- Keep presentation in `style.css` and page structure in `index.html`; load new JavaScript from the existing deferred script rather than adding inline game logic.
