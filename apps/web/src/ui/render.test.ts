import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseOrbitscarContent } from "@orbitscar/content";
import { createColony, recordColonyScout } from "@orbitscar/simulation";
import { createGameSession } from "../state/game-session.js";
import { renderApp, type RenderContext } from "./render.js";

const content = parseOrbitscarContent(JSON.parse(readFileSync(resolve("packages/content/data/orbitscar-v0/balance.json"), "utf8")));

function render(context: Partial<RenderContext> & Pick<RenderContext, "session" | "colony">): string {
  const root = { innerHTML: "" } as HTMLElement;
  renderApp({ root, content, selectedTarget: content.encounters["cinder-yard"], notice: "", ...context });
  return root.innerHTML;
}

describe("first-session UI and scouting", () => {
  it("leads a fresh colony through its next real objective and only shows Tier 1 training", () => {
    const html = render({ colony: createColony("fresh", content), session: createGameSession() });
    expect(html).toContain("Install a defense");
    expect(html).toContain('data-action="build:arc_projector"');
    expect(html).toContain("Line Rigger");
    expect(html).not.toContain("needle drone");
    expect(html).not.toContain("relay drone");
  });

  it("keeps exact layouts and counters hidden until signal is spent to scout", () => {
    const colony = createColony("fresh", content);
    const session = { ...createGameSession(), mode: "targets" as const };
    const unknown = render({ colony, session });
    expect(unknown).toContain("Scout target · 5 SIG");
    expect(unknown).toContain("Signal shadow");
    expect(unknown).not.toContain("Counter hints:");
    expect(unknown).not.toContain("scatter-node");
    expect(unknown).toContain('data-action="army" disabled');

    const scouted = recordColonyScout(colony, "cinder-yard", content);
    const revealed = render({ colony: scouted, session });
    expect(revealed).toContain("Counter hints:");
    expect(revealed).toContain("scatter (190 range)");
    expect(revealed).toContain('data-action="army"');
    expect(revealed).not.toContain('data-action="army" disabled');
  });
});
