# Project Orbitscar — Asset Production Bible

**Status:** ART PIPELINE V0.1

## Naming and folders

```text
assets/
  buildings/<building_id>/{concept,neutral,tiers,damage,icons}/
  units/<unit_id>/{concept,portrait,icons,anim}/
  vfx/<effect_id>/
  terrain/{tiles,cliffs,props,background}/
  ui/{icons,frames,illustrations}/
  audio/{sfx,ui,music}/
  provenance/<asset_id>.json
```

Names are lowercase snake_case with stable IDs. Never put “edgeworld,” an original unit/building name, or copied source filename in an asset ID.

## Buildings

Each building requires concept sheet, neutral base, construction scaffold, operational loop, tier 1/4/8/12 visual states, damaged, disabled, destroyed, icon, thumbnail, and cosmetic hook. Export a 256px planning sprite and 512px inspection sprite initially; measure atlas memory before raising either target.

## Units

Each unit requires concept, 256px portrait, 128px icon, idle, locomotion, attack, hit, disabled/destruction, selection indicator, and at least four directional reads. Use a shared animation rig only when it does not collapse silhouettes. The first slice may use static directional cards plus procedural motion.

## VFX

Required families: projectile, muzzle, impact, shield, explosion, deployment, repair, collection, and two commander effects. Every VFX has low-effects and color-vision-safe variants.

## Terrain

Use modular plinth tiles, edges/cliffs, mineral deposits, craters, roads/platforms, salvage props, and background layers. Terrain must not encode copied map geography.

## Technical conventions

- Transparent PNG/WebP for sprites; SVG for simple UI icons where engine support is verified.
- Pivot at logical ground contact; building pivot at footprint center; VFX pivot at origin event.
- Four-direction or eight-direction requirements are decided per unit by readability tests.
- Compression is platform-specific and verified visually; do not commit source caches.
- Every asset commit includes provenance JSON: prompt/tool/model/date, generalized references, transformation intent, reviewer, similarity decision, and revision.

## Prototype manifest

The first vertical-slice pack uses `apps/web/public/art/orbitscar/asset-manifest.json` as its stable presentation mapping. Entries are replaceable and record source/provenance and pending project-owned license status. This is a prototype asset boundary, not a final art catalog.
