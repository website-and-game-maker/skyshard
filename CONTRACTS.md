# Module contracts

`src/main.js` owns the renderer, the fixed 60 Hz loop, game state (health, timer, deaths) and all wiring.
Modules never import each other. Everything they need is passed in by `main.js`.
Every module may import `three` (0.170). Tests sit next to the code as `*.test.js` (Vitest).

| Folder | Owner thread | Entry |
| --- | --- | --- |
| `src/input/`, `src/player/`, `src/camera/` | Character controls | `Input`, `Player`, `FollowCamera` |
| `src/level/`, `src/enemies/` | Level and enemies | `createLevel`, `createEnemies` |
| `src/ui/`, `src/audio/` | UI and audio | `createUI`, `createAudio` |
| `tests/e2e/`, `playwright.config.js`, `.github/` | Tests and deploy | |
| `src/main.js`, `index.html`, `vite.config.js`, `package.json` | Integration | |

The files now in each module folder are scaffold stubs. Replace them freely. If a rebase hits an add/add conflict on a stub, take your version.

## Input (`src/input/index.js`)
`new Input({ element, window })`, `update()` once per frame, `setTouchVisible(bool)`, `setOptions({ sensitivity, invertY })`, `dispose()`.
`state = { moveX, moveY, lookX, lookY, jump, jumpPressed, dash, dashPressed, pound, poundPressed, pausePressed }`.
`moveY` is +1 for forward. `*Pressed` is true for exactly one `update()`.
Keyboard WASD/arrows + Space, mouse look, gamepad, and a touch overlay built inside `element`
(`data-testid="touch-stick"`, `data-testid="touch-jump"`, buttons at least 44px). Touch buttons use the `.ss-tbtn` class; never style a generic class like `.ss-btn` that the menus also use.
`rumble(strength, ms)` vibrates a gamepad when one is connected.
Note: `update()` runs once per rendered frame, but the simulation may step 0 to 6 times per frame.
`Player` must latch `*Pressed` so a press is never lost or applied twice.

## Player (`src/player/index.js`)
`new Player({ scene, world })` where `world` is the level object (`colliders`, `killY`).
`update(dt, input, cameraYaw)`, `respawn(pos)`, `setCheckpoint(pos)`, `hurt(knockback: Vector3)` (starts invulnerability frames),
`bounce()` (after stomping an enemy), `on(name, fn)` for `jump | doubleJump | dash | poundStart | pound | land | spring | bonk | hurt | respawn | fall`.
Fields read by others: `position` (feet, Vector3), `velocity`, `mesh`, `grounded`, `halfWidth`, `height`, `groundPounding`, `invulnerable`.
`fall` fires once when `position.y < world.killY`. Main then calls `respawn`.

## Camera (`src/camera/index.js`)
`new FollowCamera(camera, { collidables })`, `update(dt, targetPosition, input | null)` (null in menus: slow orbit is fine),
`snap(targetPosition)` to jump without smoothing, `yaw` getter used for camera-relative movement.

## Level (`src/level/index.js`)
`createLevel({ scene, quality })` returns
`{ colliders, killY, spawn, respawnPoint, shardsTotal, shardsCollected, shardsRequired, update(dt, player | null, elapsed), reset(), dispose() }`.
Colliders: `{ box: THREE.Box3, velocity?: Vector3, bouncy?: number, hazard?: boolean }`. Moving ones update `box` in place, and `velocity` is the displacement made this step (main updates the player before the level). `bouncy` is the launch speed of a spring pad.
The level also exposes `enemySpawns` (read by enemies) and `beaconPosition`.
`update` returns events: `{type:'shard', collected, total}`, `{type:'heart'}`, `{type:'checkpoint', index, position}`,
`{type:'beaconLocked', needed}`, `{type:'goal'}`. It is called with `player = null` and `dt = 0` behind menus.
The level adds its own sky, fog and lights. Main sets ACES tone mapping, shadows and bloom.

## Enemies (`src/enemies/index.js`)
`createEnemies({ scene, level })` returns `{ update(dt, player), reset(), dispose() }`.
`update` returns `{type:'stomp', position}`, `{type:'hurt', knockback}`, `{type:'defeated', kind, position}`.
Main handles health: `hurt` is ignored while `player.invulnerable`.

## Audio (`src/audio/index.js`)
`createAudio()` returns `{ unlock(), play(name), startMusic('title'|'level'), stopMusic(), setVolumes({master, music, sfx}) }`.
Names: jump, doubleJump, dash, land, pound, shard, hurt, enemyDefeat, checkpoint, win, lose, click, hover.

## UI (`src/ui/index.js`)
`createUI(root, { onStart, onPause, onResume, onRestart, onQuit, onSettings, onSound })` returns
`{ getSettings(), showTitle(), showHud(), updateHud({shards, totalShards, health, maxHealth, timeMs}), showPause(), hide(), showWin({timeMs, shards, totalShards, best, deaths}), showLose(), toast(text), setFps(n | null) }`.
Main owns pause input (Escape / gamepad Start via `input.state.pausePressed`) and saves the best time under `skyshard.best`.
Test ids: `play` (start button), `hud`, `resume`.

## Debug hook (read-only, for tests)
`window.__SKYSHARD__ = { state, player: {x, y, z, grounded}, shards, totalShards, health, deaths, fps, quality, timeMs, frame }` (`timeMs` is run time, `frame` counts rendered frames), refreshed every frame.
`state` is one of `menu | playing | paused | won | gameover`. `quality` is the effective quality after automatic drops.

## Automatic quality
If the frame rate stays under 30 fps for 3 seconds of play, main drops one notch (high → medium → low): resolution first, then bloom, then shadow map updates (re-rendered every 10th frame instead of every frame). The quality setting is the ceiling.

## Usage counts (`src/usage/index.js`)
`createUsage({ levelId })` returns `{ runStarted(), setPlaying(bool), finished(timeMs), flush(), dispose() }`. Main calls `setPlaying` from `setState`, `runStarted` in `startRun` and `finished` in `winRun`; `levelId()` reads `level.id` (default `driftmeadow`).
Only when the game is in a frame on the same origin (Unblock Games) does it post to the parent:
`{ kind: 'skyshard-usage', v: 1, event }` where `event` is `session` (page opened), `run` (with `level`), `time` (with `seconds`, 1 to 60, play time only, paused time excluded) or `finish` (with `level` and `seconds`, the run time).
No ids, scores or device details are sent. On its own (GitHub Pages, a new tab, `file://`) nothing is sent anywhere.
