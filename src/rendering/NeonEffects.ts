import Phaser from 'phaser';
import { colorToString } from '../utils/MathUtils';

/** Add a neon glow text effect by layering multiple text objects */
export function createGlowText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  color: number,
  fontSize: number,
  origin = 0.5,
): Phaser.GameObjects.Container {
  const container = scene.add.container(x, y);
  const colorStr = colorToString(color);

  // Glow layers (outer to inner, decreasing alpha)
  const glowLayers = [
    { scale: 1.06, alpha: 0.1 },
    { scale: 1.03, alpha: 0.2 },
  ];

  for (const layer of glowLayers) {
    const glowText = scene.add.text(0, 0, text, {
      fontFamily: 'Segoe UI, system-ui, sans-serif',
      fontSize: Math.round(fontSize * layer.scale),
      color: colorStr,
      fontStyle: 'bold',
    });
    glowText.setOrigin(origin);
    glowText.setAlpha(layer.alpha);
    container.add(glowText);
  }

  // Main text
  const mainText = scene.add.text(0, 0, text, {
    fontFamily: 'Segoe UI, system-ui, sans-serif',
    fontSize: fontSize,
    color: colorStr,
    fontStyle: 'bold',
  });
  mainText.setOrigin(origin);
  container.add(mainText);

  return container;
}

/** Draw a neon-bordered rectangle */
export function drawNeonRect(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  color: number,
  fillAlpha = 0.1,
  radius = 0,
): void {
  // Fill
  graphics.fillStyle(color, fillAlpha);
  if (radius > 0) {
    graphics.fillRoundedRect(x, y, width, height, radius);
  } else {
    graphics.fillRect(x, y, width, height);
  }

  // Border
  graphics.lineStyle(1.5, color, 0.6);
  if (radius > 0) {
    graphics.strokeRoundedRect(x, y, width, height, radius);
  } else {
    graphics.strokeRect(x, y, width, height);
  }
}
