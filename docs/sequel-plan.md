# Skyshard 2: The Hollow Sky (sequel plan)

Status: planning only. Nothing here is built. Written 2026-10-31.

This is the plan for a sequel to Skyshard, to start only if the first game earns it (see [Greenlight signals](#greenlight-signals)). It assumes the fixes now in progress on Skyshard 1 land first: smoother turning, the respawn camera fix, the tutorial and the extra levels. The sequel inherits all of that.

## The pitch in one line

Pip learns to fly, swing and copy itself, and dives below the clouds to find out where the darkness in the sky comes from.

## What makes it a sequel and not more levels

Skyshard 1 is about getting good at three verbs: jump, dash, pound. The sequel keeps those exactly as they are (players who finished the first game should feel at home in five seconds) and adds verbs that change how you *read* a level, not just how far you can jump. Each new ability gets its own world built around it, and the late game is about combining them.

Rule for every new ability: it has to create a new kind of level, not just a longer gap. If an ability only makes existing jumps easier, cut it.

## Pip's new abilities

Five abilities, unlocked one per world. Two of them need no new button, which matters because touch screens fit four buttons at most.

| Ability | What it does | Input | The level it creates |
| --- | --- | --- | --- |
| **Glide** (Skycloth) | Hold jump in the air to unfurl a cloth and drift down slowly. Updrafts lift you. | Hold jump (no new button) | Wide open sky routes, riding wind columns between far islands, choosing a path while falling. |
| **Wall kick** | Slide down walls and kick off them. Chains between two walls to climb. | Jump next to a wall (no new button) | Vertical shafts, chimneys, towers you climb instead of circling. |
| **Shardline** (tether) | Fire a line at a glowing anchor and swing. Release at the top of the arc for a big launch. Can also pull light objects toward you. | New button: E / right bumper / touch button | Swing chains over voids, momentum puzzles, pulling platforms into place. |
| **Echo** | Pip records the last 4 seconds and leaves a ghost that replays them. The ghost can stand on switches, carry things and trigger enemies. | New button: Q / left bumper / touch button | Puzzles where you cooperate with yourself: hold a door with your echo, race through it. |
| **Gust form** | During a dash, hold dash to turn into wind for half a second: pass through wind gates and thorn walls, ride wind streams like rails. | Hold dash (no new button) | Fast rail-like sequences, hazard mazes that are only open in gust form. |

**Combos are the "cool things".** The final world asks for chains like: glide off a ledge, Shardline an anchor, release into a wall kick, drop an Echo on a switch, gust through the gate it opens. Each combo gets a name in the move list (players love naming tricks) and a hidden shard that only that combo reaches.

**Upgrades** (bought with shards at the hub, never required to finish): longer glide, a second Echo, faster Shardline, an extra heart. They give collecting a purpose without gating the story.

**Cut on purpose:** combat-heavy abilities (sword, shooting). Skyshard is a movement game. Enemies stay something you stomp, pound, dodge or trick with an Echo.

## Worlds

A hub plus five worlds. Each world has 3 main stages, 1 challenge stage (hard, optional, big shard reward) and a boss or set piece. That is about 20 stages, roughly 6 to 8 hours for a first run, more for 100%.

| World | Look and feel | Ability | Set piece |
| --- | --- | --- | --- |
| **Hub: Lanternreach** | The beacon island from Skyshard 1, now a small town of sky spirits that grows as you bring shards back (new houses, lights, music layers). | None | Fills in over the whole game. |
| **1. Gale Steppes** | Golden grass islands, huge sky, wind you can see. | Glide | Outrun a stormfront by gliding between collapsing islands. |
| **2. Brightwater Shoals** | A sea of cloud with half-sunk islands and coral-like crystal. | Shardline | Swing across a moving whale-sized sky creature. |
| **3. Clockwork Orchard** | Brass trees, gears, ticking platforms on timers. | Echo | A vault where you and three Echoes run four switches at once. |
| **4. Frostfall Canopy** | Icy giant trees, slippery momentum, snow that hides edges. | Wall kick | A climb up a falling tree while it tips. |
| **5. The Underlight** | Below the cloud floor. Dark, glowing, upside-down islands. Gravity flips at marked seams. | Gust form | The final climb, then the Gloam. |

Skyshard 1's enemies return (mossback, puffcap, gloomwisp) with world variants, plus one new enemy per world that tests that world's ability: gust-riding kites in the Steppes, anchor-stealing eels in the Shoals, copycat clockwork in the Orchard, ice-armored mossbacks only a wall-kick pound breaks, and shadow Echoes in the Underlight.

## Story

Skyshard 1 ends with Pip relighting the beacon. The sequel starts the next morning.

1. **The light reveals a hole.** The beacon's light reaches further than anyone expected, down through the clouds, and shows something below: a second, dark sky, the Underlight. The gloomwisps Pip fought all came from there.
2. **The Lanternreach spirits** (new characters: a nervous lamplighter, a cloth-weaver who makes the Skycloth, a clockmaker) each know part of the old story and give Pip the abilities.
3. **The Gloam.** Something below is pulling light out of the sky, which is why shards keep scattering. Every world Pip clears, the hole gets smaller and the Gloam gets louder.
4. **The twist.** The Gloam is not a monster. It was the first sky spirit, the one who built the beacon, and it fell below the clouds long ago. It has been pulling at the light because it is trying to climb home.
5. **The ending.** The final fight is a chase, then a choice: Pip uses every ability not to defeat the Gloam but to build it a way up. The beacon now has two keepers. Post-credits: the true ending for 100% shards shows the second light turning on.

Tone stays light and wordless-friendly: short text bubbles, no voice acting, every story beat readable from what happens on screen. Cutscenes are skippable and under 30 seconds.

## Tech changes

The Skyshard 1 code is a good base: modules talk only through `main.js`, every movement number lives in `src/player/tuning.js`, and there are unit, playthrough and browser tests. The sequel needs these changes, roughly in this order.

1. **Abilities as plug-ins on the player.** `Player.js` today handles jump, dash and pound directly. Before adding five more, split it into a small state machine where each ability is a module with `canStart`, `update` and `end`. Without this the player file becomes impossible to change safely. Tuning numbers stay in one file per ability.
2. **Levels as data, loaded per world.** Skyshard 1 has one hand-placed level in `src/level/layout.js`. The sequel stores each stage as a data file (islands, movers, anchors, switches, shards, enemies) and loads each world as its own lazy chunk, so the first download stays under the current 600 KB gzipped budget and later worlds load while you play the hub.
3. **An in-browser level editor** behind a `?edit` URL flag: place islands, anchors and shards, fly a free camera, export the stage file. 20 stages are not practical to build by typing coordinates.
4. **Save system.** Three save slots in `localStorage`, with a version number and migration so an update never wipes progress. Saves store abilities, shards per stage, best times and upgrades. Also export and import of a save as a text code, since school Chromebooks often clear storage.
5. **Camera upgrades.** Camera hint volumes (a stage can say "look this way here" or "pull back here"), a wider pull-back while gliding and swinging, and the respawn fix from Skyshard 1 made into a rule: the camera never starts closer than its normal distance.
6. **Echo recording.** Record Pip's position, pose and button presses each fixed step into a ring buffer, replay into a ghost. The fixed 60 Hz loop Skyshard 1 already has makes this deterministic, which is the main reason it is feasible.
7. **Dialogue and cutscenes.** A tiny scripted sequence player (move camera, show bubble, wait, play sound) driven by data, not code.
8. **Adaptive music.** The procedural synth from Skyshard 1 gains layers that fade in with ability use and hub progress.
9. **Performance.** Instanced meshes for grass, crystals and props, distance-based detail, and a per-world frame budget checked in CI with the existing automatic quality system as the safety net.
10. **Accessibility.** Assist mode (slower game speed, extra hearts, skip a stage after several deaths), full control remapping, colorblind-safe shard and hazard colors, reduced motion and camera shake toggles.
11. **Tests.** Every ability gets unit tests for its edge cases (glide into updraft, release swing at max speed, Echo replay matches the original run exactly). Every stage gets a scripted playthrough test like `src/level/playthrough.test.js` proving it can be finished with only the abilities you have at that point. That test is what stops us shipping an impossible stage.

**Same repo or new one?** Same repo, as a `skyshard2/` entry point that shares the engine folders. Splitting into two repos would mean fixing every bug twice.

## Greenlight signals

Right now nothing measures whether Skyshard is a hit. Step one is to start measuring, and then decide on real numbers instead of a feeling.

**Measure first (small task, needs Saahir's OK):** an anonymous play counter on the same Val Town setup Unblock Games already uses. It records only events like "started", "finished tutorial", "finished level N", "beat the game" and "came back on another day", with no names, no IPs stored, nothing per person. Plus the shared feedback button already planned across Skyshard and Unblock Games.

**Greenlight if, within 60 days of the full Skyshard 1 release, at least three of these are true:**

| Signal | Bar | Why it matters |
| --- | --- | --- |
| Plays | 1,000 game starts | Enough people found it. |
| Tutorial finish rate | 60% of people who start it finish it | The controls and camera fixes worked. If this is low, fix Skyshard 1 before building a sequel. |
| Full game finish rate | 15% of starters beat the game | People cared enough to see the end. For browser games this is high. |
| Comeback rate | 25% of players return on another day | It is a game people choose, not one they tried once. |
| Asked for more | 10 or more feedback messages asking for more levels, a sequel or new moves | Direct demand. |
| Saahir still wants it | Yes | The most important one. A sequel nobody is excited to build will not be good. |

**If it misses:** do not build the sequel. Spend the effort on Skyshard 1 instead (whichever signal failed points at what to fix), or ship a free "Skyshard: Gale Steppes" expansion with just the glide ability, which costs a fraction and tests whether new abilities bring people back.

## How it gets built

Built the same way as Skyshard 1: parallel workstreams, each in its own thread, with one integration thread.

| Phase | What | Size |
| --- | --- | --- |
| 0. Measure | Play counter and feedback button on Skyshard 1 | Small, one agent |
| 1. Foundations | Ability state machine, data-driven levels, save system, level editor | Big, 2 to 3 agents in parallel |
| 2. Vertical slice | Hub + Gale Steppes fully finished with glide, story intro and music. This is the second go/no-go: if the slice is not more fun than Skyshard 1, stop or rethink. | Big, 3 agents |
| 3. Production | Worlds 2 to 5, one agent per world, each owning its ability, enemy and stages | Big, 4 agents in parallel |
| 4. Story and polish | Cutscenes, ending, combos, upgrades, accessibility, performance pass | Medium, 2 agents |
| 5. Test and ship | Full playthrough tests, cross-device checks, deploy next to Skyshard 1 on GitHub Pages and Unblock Games | Medium, one agent |

My recommendation: do phase 0 now, because it is cheap and useful even with no sequel. Do not start phase 1 until the signals say yes, and treat the phase 2 slice as a hard checkpoint. The riskiest idea in this plan is Echo (it is the most original and the hardest to make readable), so the slice should include a small Echo test room even though Echo's world comes later.

## Open questions for later

- Should the sequel have a co-op mode (second player controls a second spirit)? The Echo ghost code would make it cheaper, but it doubles the testing. Decide after the slice.
- Speedrun support (timer per stage, ghost of your best run) is nearly free once Echo recording exists. Probably yes.
