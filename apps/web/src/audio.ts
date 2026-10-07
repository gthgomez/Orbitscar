export type SoundCue = "ui" | "deploy" | "impact" | "ability" | "victory" | "defeat";

const CUES: Record<SoundCue, { start: number; end: number; duration: number; volume: number; type: OscillatorType }> = {
  ui: { start: 560, end: 720, duration: 0.07, volume: 0.035, type: "sine" },
  deploy: { start: 320, end: 470, duration: 0.16, volume: 0.055, type: "triangle" },
  impact: { start: 150, end: 85, duration: 0.1, volume: 0.045, type: "sine" },
  ability: { start: 480, end: 820, duration: 0.22, volume: 0.05, type: "sine" },
  victory: { start: 520, end: 780, duration: 0.32, volume: 0.045, type: "triangle" },
  defeat: { start: 320, end: 180, duration: 0.28, volume: 0.045, type: "triangle" },
};

export function createSoundPlayer(createContext: () => AudioContext = () => new AudioContext()): (cue: SoundCue, muted: boolean) => void {
  let context: AudioContext | undefined;
  let lastPlayedAt = Number.NEGATIVE_INFINITY;
  return (cue, muted) => {
    if (muted) return;
    try {
      context ??= createContext();
      if (context.state === "suspended") void context.resume();
      const now = context.currentTime;
      const priority = cue === "ability" || cue === "victory" || cue === "defeat";
      if (!priority && now - lastPlayedAt < 0.055) return;
      lastPlayedAt = now;
      const profile = CUES[cue];
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = profile.type;
      oscillator.frequency.setValueAtTime(profile.start, now);
      oscillator.frequency.exponentialRampToValueAtTime(profile.end, now + profile.duration);
      gain.gain.setValueAtTime(profile.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + profile.duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + profile.duration);
    } catch {
      // Audio is an enhancement; unsupported or blocked devices keep full gameplay.
    }
  };
}
