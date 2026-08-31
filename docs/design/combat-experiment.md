# First Visual Breach Experiment

This is the smallest Phaser experiment intended to answer whether deployment position, reinforcement timing, composition, and commander timing create different outcomes against one fixed colony.

The fixed arena is 1200x800. The base contains a command relay, matter extractor, drop cradle, arc projector, scatter coil, and snare lattice. The legal army is three line riggers, two pulse marksmen, two ram walkers, and one needle drone. A charge uses explicit unit quantities and cannot exceed capacity 10.

The three shipped scenarios are:

- **Frontal:** west-side opening, west reinforcement, arc reroute, then a final ground charge.
- **Flank:** north/south split, later relay reroute, then a south reinforcement.
- **Delayed:** a first wave is intentionally exposed before later reserves arrive.

The Phaser client calls the same resolver used by the headless CLI. It only replays authoritative deployment, movement, damage, destruction, and ability events. It does not calculate a separate outcome.

The current prototype deliberately uses colored geometry and text labels. The visual goal is target comprehension and spatial legibility, not art validation.
