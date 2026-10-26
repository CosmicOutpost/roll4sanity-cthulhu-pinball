import backgroundURL from '../assets/layered/background.png';
import cthulhuURL from '../assets/layered/cthulhu-rest.png';
import { WIDTH, HEIGHT } from './table.js';

// Coordinates are in the original 941 × 1672 artwork space. This experiment
// replaces only the printed art; existing gameplay depths start at zero.
export const ART_LAYERS = {
  background: { asset: backgroundURL, x: 0, y: 0, scale: 1, visible: true, depth: -3 },
  cthulhu: { asset: cthulhuURL, x: 0, y: 0, scale: 1, visible: true, depth: -2 },
  // No approved standalone logo exists. Supply its own URL and placement here.
  logo: { asset: null, x: 470.5, y: 1450, scale: 1, visible: false, depth: -1 },
};

export function preloadArt(scene) {
  for (const [name, config] of Object.entries(ART_LAYERS)) {
    if (config.asset) scene.load.image(`art-${name}`, config.asset);
  }
}

export function createArtLayers(scene) {
  const layers = {};
  for (const [name, config] of Object.entries(ART_LAYERS)) {
    const image = scene.add.image(config.x * WIDTH / 941, config.y * HEIGHT / 1672,
      config.asset ? `art-${name}` : '__DEFAULT').setOrigin(0)
      .setScale(config.scale * WIDTH / 941, config.scale * HEIGHT / 1672)
      .setVisible(Boolean(config.asset) && config.visible).setDepth(config.depth);
    layers[name] = image;
  }
  return layers;
}
