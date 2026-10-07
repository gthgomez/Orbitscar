import { describe, expect, it, vi } from "vitest";
import { createSoundPlayer } from "./audio.js";

function audioContext() {
  const oscillator = { type: "", frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
  const gain = { gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn() };
  const context = { currentTime: 1, destination: {}, createOscillator: vi.fn(() => oscillator), createGain: vi.fn(() => gain), resume: vi.fn() };
  return { context, oscillator, gain };
}

describe("procedural sound cues", () => {
  it("stays silent when muted without creating an audio context", () => {
    const createContext = vi.fn(() => audioContext().context as unknown as AudioContext);
    const play = createSoundPlayer(createContext);
    play("deploy", true);
    expect(createContext).not.toHaveBeenCalled();
  });

  it("plays a short original deployment tone through the supplied context", () => {
    const { context, oscillator, gain } = audioContext();
    const play = createSoundPlayer(() => context as unknown as AudioContext);
    play("deploy", false);
    expect(context.createOscillator).toHaveBeenCalledOnce();
    expect(oscillator.frequency.setValueAtTime).toHaveBeenCalledWith(320, 1);
    expect(oscillator.start).toHaveBeenCalledOnce();
    expect(oscillator.stop).toHaveBeenCalledOnce();
    expect(gain.gain.exponentialRampToValueAtTime).toHaveBeenCalledOnce();
  });
});
