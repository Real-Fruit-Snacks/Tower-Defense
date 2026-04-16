import Phaser from 'phaser';
import { ElementSystem } from '../systems/ElementSystem';
import { ShapeRenderer } from '../rendering/ShapeRenderer';
import { ENEMY_CONFIGS } from '../data/enemies';
import type { WaveDefinition } from '../types';
import { UI } from './UIConstants';

/**
 * Compact wave composition preview designed to live inside the HUD bar.
 * Shows: "NEXT" label + row of element-colored shape icons representing enemy groups.
 */
export class WavePreview extends Phaser.GameObjects.Container {
  private labelText: Phaser.GameObjects.Text;
  private iconsGfx: Phaser.GameObjects.Graphics;
  private countText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    this.setDepth(15);

    // "NEXT" label
    this.labelText = scene.add.text(0, 0, 'NEXT', {
      fontFamily: UI.FONT_MONO,
      fontSize: 9,
      color: '#888',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5).setLetterSpacing(2);
    this.add(this.labelText);

    // Icon row (drawn shapes)
    this.iconsGfx = scene.add.graphics();
    this.iconsGfx.setBlendMode(Phaser.BlendModes.ADD);
    this.add(this.iconsGfx);

    // Enemy count label (e.g. "×18")
    this.countText = scene.add.text(0, 0, '', {
      fontFamily: UI.FONT_MONO,
      fontSize: 10,
      color: '#888',
    }).setOrigin(0, 0.5);
    this.add(this.countText);

    scene.add.existing(this);
  }

  showWave(wave: WaveDefinition | undefined): void {
    this.iconsGfx.clear();

    if (!wave) {
      this.labelText.setText('FINAL WAVE');
      this.labelText.setColor('#ffaa00');
      this.countText.setText('');
      return;
    }

    this.labelText.setText('NEXT');
    this.labelText.setColor('#888');

    // Start rendering icons just after the label
    const labelWidth = this.labelText.width;
    let iconX = labelWidth + 12;
    const iconY = 0;

    let totalCount = 0;
    // Build a unique list of (enemyType, element) combos so we don't spam dots
    const seenKeys = new Set<string>();
    const orderedGroups: typeof wave.groups = [];
    for (const g of wave.groups) {
      const key = `${g.enemyId}|${g.element}`;
      totalCount += g.count;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        orderedGroups.push(g);
      }
    }

    // Render one icon per unique enemy-type+element combo (up to 6 shown)
    const maxShown = 6;
    const iconSize = 6;
    const iconSpacing = 16;

    const shown = orderedGroups.slice(0, maxShown);
    for (const group of shown) {
      const color = ElementSystem.getColor(group.element);
      const enemyCfg = ENEMY_CONFIGS.find(e => e.id === group.enemyId);
      const shape = enemyCfg?.shape ?? 'circle';
      const cx = iconX + iconSize;

      // Soft glow behind icon
      this.iconsGfx.fillStyle(color, 0.25);
      this.iconsGfx.fillCircle(cx, iconY, iconSize + 2);

      this.drawEnemyIcon(cx, iconY, shape, iconSize, color);

      iconX += iconSpacing;
    }

    // "..." indicator if more types exist
    if (orderedGroups.length > maxShown) {
      this.iconsGfx.fillStyle(0x888888, 0.6);
      for (let d = 0; d < 3; d++) {
        this.iconsGfx.fillCircle(iconX + d * 4, iconY, 1);
      }
      iconX += 14;
    }

    // Total count on the right
    this.countText.setText(`×${totalCount}`);
    this.countText.setPosition(iconX + 4, iconY);
  }

  private drawEnemyIcon(cx: number, cy: number, shape: string, size: number, color: number): void {
    const fillAlpha = 0.55;
    const strokeWidth = 1.2;

    switch (shape) {
      case 'triangle':
        ShapeRenderer.drawPolygon(this.iconsGfx, cx, cy, 3, size, color, fillAlpha, color, strokeWidth);
        break;
      case 'square':
        ShapeRenderer.drawPolygon(this.iconsGfx, cx, cy, 4, size, color, fillAlpha, color, strokeWidth);
        break;
      case 'pentagon':
        ShapeRenderer.drawPolygon(this.iconsGfx, cx, cy, 5, size, color, fillAlpha, color, strokeWidth);
        break;
      case 'hexagon':
        ShapeRenderer.drawPolygon(this.iconsGfx, cx, cy, 6, size, color, fillAlpha, color, strokeWidth);
        break;
      case 'octagon':
        ShapeRenderer.drawPolygon(this.iconsGfx, cx, cy, 8, size, color, fillAlpha, color, strokeWidth);
        break;
      case 'diamond':
        ShapeRenderer.drawDiamond(this.iconsGfx, cx, cy, size, color, fillAlpha, color, strokeWidth);
        break;
      case 'star':
        ShapeRenderer.drawStar(this.iconsGfx, cx, cy, size, color, fillAlpha, color, strokeWidth);
        break;
      case 'circle':
      default:
        this.iconsGfx.fillStyle(color, fillAlpha);
        this.iconsGfx.fillCircle(cx, cy, size);
        this.iconsGfx.lineStyle(strokeWidth, color, 1);
        this.iconsGfx.strokeCircle(cx, cy, size);
        break;
    }
  }
}
