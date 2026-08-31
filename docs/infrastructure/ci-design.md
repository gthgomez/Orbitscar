# Orbitscar CI design

Status: design only; no hosted workflow has been enabled.

The first CI job should run from the Orbitscar repository root and must never check out or install Tideforge.

```text
checkout
setup Node 24.x
setup pnpm 11.19.0
pnpm install --frozen-lockfile
pnpm validate:content
pnpm typecheck
pnpm test
pnpm simulate -- fixtures/battle_fixture.json
```

Required gates:

- Frozen lockfile install.
- Content schema validation.
- Strict TypeScript compilation.
- Determinism/unit tests.
- Headless fixture execution.
- Secret scanning and artifact exclusion.

The future client job should add a browser build and a mobile smoke build only after a Phaser client exists. Android signing material must remain outside the repository.
