# Shared tooling policy

Orbitscar is intentionally standalone. Do not create a workspace-level framework or depend on another game merely to avoid a small amount of duplication.

| Candidate | Decision | Rationale / trigger |
|---|---|---|
| Asset-generation prompts and provenance receipts | LATER | Share only after a second project uses the same schema and review workflow. |
| Deterministic RNG and canonical serialization | NOW, local | The battle contract needs them immediately; the current abstraction is small and product-owned. Extract only after a second consumer exists. |
| Headless simulation runner | NOW, local | Core product gate and balance tool; no cross-project assumptions. |
| Generic balance-report formatting | LATER | Consider a library after two simulators produce materially identical reports. |
| Telemetry event schema | DO NOT SHARE YET | Product events and privacy decisions are still changing. |
| Phaser/Godot rendering helpers | DO NOT SHARE YET | Rendering stacks and input models differ; premature sharing would couple projects. |
| Screenshot/browser automation | LATER | Reuse an existing proven workspace tool if one is available; do not build a framework now. |
| Backend auth/economy/alliance services | DO NOT SHARE | Orbitscar must establish its own trust boundary and domain model first. |

Rule: wait until at least two independent projects genuinely need the same abstraction, unless an existing proven shared tool already exists and its ownership/provenance are clear.
