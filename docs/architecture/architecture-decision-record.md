# Orbitscar independent architecture decision record

Status: **Accepted for combat prototype; revalidate before production multiplayer**  
Decision date: 2026-08-30

## Question

If Tideforge Empires did not exist, what architecture best supports a browser-first, Android-capable, asynchronous strategy game with deterministic battles?

## Client options

| Option | Strengths | Costs/risks | Decision |
|---|---|---|---|
| Godot 4 + GDScript | Purpose-built editor, native Android export, 2D/2.5D workflow, one client codebase | Web uses WebGL 2 Compatibility; web/mobile performance and audio constraints; server must duplicate or host rules outside GDScript; editor/export pipeline adds operational weight | Rejected for first client; retain as a future spike |
| TypeScript + Phaser 3 | WebGL with Canvas fallback, TypeScript, touch input, browser-native debugging, headless-friendly ecosystem, straightforward Capacitor path to Android | Android wrapper performance must be tested; asset/rendering discipline is ours; no 3D engine | **Chosen** |
| Unity 6 | Strong Android tooling, mature 2D/3D ecosystem, large asset pool | Web build size/startup and WebGL limitations; C# simulation still needs server parity; higher team/tooling overhead than this prototype warrants | Rejected for now |

The chosen client is **Phaser 3 + TypeScript**, with Phaser restricted to rendering/input orchestration. React, if used later, is for non-game surfaces such as account, alliance administration, or store pages; it is not the battle renderer.

Phaser documents WebGL/Canvas rendering, TypeScript definitions, and mobile-browser support. [Phaser documentation](https://docs.phaser.io/phaser/getting-started/what-is-phaser) [Phaser renderer configuration](https://docs.phaser.io/phaser/getting-started/making-your-first-phaser-game)

Godot remains credible, but its web export is constrained to WebGL 2 Compatibility, and native mobile exports perform better than Web exports. [Godot Web export](https://docs.godotengine.org/en/4.5/tutorials/export/exporting_for_web.html) [Godot Android export](https://docs.godotengine.org/en/latest/tutorials/export/exporting_for_android.html)

## Server options

| Option | Strengths | Costs/risks | Decision |
|---|---|---|---|
| Custom TypeScript modular monolith | Shares types and deterministic simulation package; fastest prototype iteration; PostgreSQL and HTTP/WebSocket are well understood | Requires us to build auth, rate limits, jobs, chat, and operational controls; scaling discipline is our responsibility | **Chosen for prototype and early alpha** |
| Custom Go service | Good concurrency, low memory, strong deployment profile | Duplicates TypeScript simulation or requires a cross-language rules boundary; slower iteration for this team | Revisit only after measured load requires it |
| Nakama | Authoritative runtime, groups, chat, matchmaker, leaderboards, storage primitives | Does not remove custom game rules; adds runtime/ops dependency and migration cost | Revisit for social scale, not now |

Nakama supports authoritative multiplayer and social primitives, but Orbitscar still owns its battle rules and persistence invariants. [Nakama authoritative multiplayer](https://heroiclabs.com/docs/nakama/concepts/multiplayer/authoritative/) [Nakama concepts](https://heroiclabs.com/docs/nakama/concepts/)

## Independent architecture

```text
Phaser client / browser or Capacitor Android shell
        |
        | HTTPS + WebSocket where live presence is justified
        v
TypeScript modular monolith
  - identity/session boundary
  - command validation
  - economy and inventory
  - async battle orchestration
  - alliance/territory state
  - telemetry minimization
        |
        +--> pure @orbitscar/simulation package
        +--> PostgreSQL
        +--> object storage later for versioned replay payloads
```

The simulation package is the authority for battle resolution. The client may preview, animate, or request a replay, but cannot mint state, claim rewards, or declare a result.

## Why this is not Tideforge-derived

- The root package name is `orbitscar`.
- Workspace packages are `@orbitscar/*`.
- No Tideforge package, import, path, content ID, environment variable, or schema is used.
- No existing Tideforge renderer, server, database, or UI is copied.
- The decision follows current platform evidence and the Orbitscar prototype gate, not the existing repository’s implementation.

## Reconsideration triggers

- Phaser/Capacitor cannot sustain the target device budget in a measured Android prototype.
- Browser client startup exceeds the agreed first-play budget.
- Two independent clients are required and simulation parity becomes costly.
- Async backend load or social features justify Nakama/Go.
- A Godot spike demonstrates materially better iteration or device performance without making replay authority harder.
