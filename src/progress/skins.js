// Recolour Pip's hood and scarf. Works on the PipModel's public pieces (materials and the
// scarf ribbon's vertex colours) and remembers the original materials on first use.
import * as THREE from 'three';

const HOOD = 0x3cc8c0;
const HOOD_DARK = 0x2a9d97;

export function applySkin(model, skin) {
  if (!model || !skin) return;
  const root = model.root ?? model;
  if (!root.userData.skinMats) {
    const hood = new Set();
    const hoodDark = new Set();
    root.traverse((o) => {
      const m = o.material;
      if (!m?.color) return;
      const hex = m.color.getHex();
      if (hex === HOOD) hood.add(m);
      if (hex === HOOD_DARK) hoodDark.add(m);
    });
    root.userData.skinMats = { hood: [...hood], hoodDark: [...hoodDark] };
  }
  const { hood, hoodDark } = root.userData.skinMats;
  hood.forEach((m) => m.color.setHex(skin.hood));
  hoodDark.forEach((m) => m.color.setHex(skin.hoodDark));
  model.scarfMat?.color.setHex(skin.scarf);
  const colors = model.ribbon?.geometry?.attributes?.color;
  if (colors && model.scarfCount) {
    const n = model.scarfCount;
    const a = new THREE.Color(skin.scarf), b = new THREE.Color(skin.scarfTip), c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      c.copy(a).lerp(b, i / (n - 1));
      for (let k = 0; k < 2; k++) colors.array.set([c.r, c.g, c.b, c.r, c.g, c.b], (k * n + i) * 6);
    }
    colors.needsUpdate = true;
  }
}
