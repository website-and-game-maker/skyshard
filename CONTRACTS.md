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
(`data-testid="touch-stick"`, `data-testid="touch-jump"`, buttons at least 44px).
Note: `update()` runs once per rendered frame, but the simulation may step 0 to 6 times per frame.
`Player` must latch `*Pressed` so a press is never lost or applied twice.

## Player (`src/player/index.js`)
`new Player({ scene, world })` where `world` is the level object (`colliders`, `killY`).
`update(dt, input, cameraYaw)`, `respawn(pos)`, `setCheckpoint(pos)`, `hurt(knockback: Vector3)` (starts invulnerability frames),
`bounce()` (after stomping an enemy), `on(name, fn)` for `jump | doubleJump | dash | pound | land | fall`.
Fields read by others: `position` (feet, Vector3), `velocity`, `mesh`, `grounded`, `halfWidth`, `height`, `groundPounding`, `invulnerable`.
`fall` fires once when `position.y < world.killY`. Main then calls `respawn`.

## Camera (`src/camera/index.js`)
`new FollowCamera(camera, { collidables })`, `update(dt, targetPosition, input | null)` (null in menus: slow orbit is fine),
`snap(targetPosition)` to jump without smoothing, `yaw` getter used for camera-relative movement.

## Level (`src/level/index.js`)
`createLevel({ scene, quality })` returns
`{ colliders, killY, spawn, respawnPoint, shardsTotal, shardsCollected, shardsRequired, update(dt, player | null, elapsed), reset(), dispose() }`.
Colliders: `{ box: THREE.Box3, velocity?: Vector3, bouncy?: boolean, hazard?: boolean }`. Moving ones update `box` in place.
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
`createUI(root, { onStart, onPause, onResume, onRestart, onQuit, onSettings })` returns
`{ getSettings(), showTitle(), showHud(), updateHud({shards, totalShards, health, maxHealth, timeMs}), showPause(), hide(), showWin({timeMs, shards, totalShards, best, deaths}), showLose(), toast(text), setFps(n | null) }`.
Main owns pause input (Escape / gamepad Start via `input.state.pausePressed`) and saves the best time under `skyshard.best`.
Test ids: `play` (start button), `hud`, `resume`.

## Debug hook (read-only, for tests)
`window.__SKYSHARD__ = { state, player: {x, y, z, grounded}, shards, totalShards, health, deaths, fps }`, refreshed every frame.
`state` is one of `menu | playing | paused | won | gameover`.
