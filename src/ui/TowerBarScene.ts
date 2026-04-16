import Phaser from 'phaser';
import { SCENES, COLORS, GAME } from '../constants';
import type { GameEvents, TowerConfig } from '../types';
import { EventBus } from '../utils/EventBus';
import { ElementSystem } from '../systems/ElementSystem';
import { ShapeRenderer } from '../rendering/ShapeRenderer';
import { drawNeonRect } from '../rendering/NeonEffects';
import { UI } from './UIConstants';

export class TowerBarScene extends Phaser.Scene {
  private gameEvents!: EventBus<GameEvents>;
  private towerConfigs: TowerConfig[] = [];
  private selectedTowerId: string | null = null;
  private slotContainers: Map<string, Phaser.GameObjects.Container> = new Map();
  private barSeparator!: Phaser.GameObjects.Graphics;
  private barY = 0;
  private gold = 0;

  constructor() {
    super(SCENES.TOWER_BAR);
  }

  init(data: {
    events: EventBus<GameEvents>;
    towerConfigs: TowerConfig[];
    gold: number;
  }): void {
    this.gameEvents = data.events;
    this.towerConfigs = data.towerConfigs;
    this.gold = data.gold;
  }

  create(): void {
    this.barY = GAME.HEIGHT - GAME.TOWER_BAR_HEIGHT;

    // Gradient background
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x08080f, 0x08080f, 0x0e0e1a, 0x0e0e1a, 0.85, 0.85, 0.95, 0.95);
    bg.fillRect(0, this.barY, GAME.WIDTH, GAME.TOWER_BAR_HEIGHT);

    // Animated separator line
    this.barSeparator = this.add.graphics();
    this.barSeparator.setBlendMode(Phaser.BlendModes.ADD);

    // Tower slots
    const slotSize = 56;
    const gap = 6;
    const totalWidth = this.towerConfigs.length * (slotSize + gap) - gap;
    const startX = (GAME.WIDTH - totalWidth) / 2;

    this.towerConfigs.forEach((config, i) => {
      const x = startX + i * (slotSize + gap) + slotSize / 2;
      const y = this.barY + GAME.TOWER_BAR_HEIGHT / 2;

      const container = this.add.container(x, y);
      const color = ElementSystem.getColor(config.element);

      // Slot background
      const slotBg = this.add.graphics();
      drawNeonRect(slotBg, -slotSize / 2, -slotSize / 2, slotSize, slotSize, color, 0.05, 4);
      container.add(slotBg);

      // Tower shape (slightly larger for visibility)
      const shapeGfx = this.add.graphics();
      ShapeRenderer.drawTowerShape(shapeGfx, 0, -6, config.shape, 12, color);
      container.add(shapeGfx);

      // Cost text
      const costText = this.add.text(0, 18, `${config.baseCost}`, {
        fontFamily: UI.FONT_MONO,
        fontSize: 9,
        color: '#ffd700',
      }).setOrigin(0.5);
      container.add(costText);

      // Interactive
      const hitArea = new Phaser.Geom.Rectangle(-slotSize / 2, -slotSize / 2, slotSize, slotSize);
      container.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);

      container.on('pointerdown', () => this.selectTower(config.id));

      container.on('pointerover', () => {
        if (this.gold >= config.baseCost) {
          slotBg.clear();
          drawNeonRect(slotBg, -slotSize / 2, -slotSize / 2, slotSize, slotSize, color, 0.22, 4);
          // Scale hover
          this.tweens.add({
            targets: container, scaleX: 1.08, scaleY: 1.08,
            duration: 80, ease: 'Quad.easeOut',
          });
        }
      });

      container.on('pointerout', () => {
        const isSelected = this.selectedTowerId === config.id;
        slotBg.clear();
        drawNeonRect(slotBg, -slotSize / 2, -slotSize / 2, slotSize, slotSize, color, isSelected ? 0.25 : 0.05, 4);
        this.tweens.add({
          targets: container, scaleX: 1, scaleY: 1,
          duration: 80, ease: 'Quad.easeOut',
        });
      });

      this.slotContainers.set(config.id, container);
    });

    // Listen for gold changes
    this.gameEvents.on('GOLD_CHANGED', ({ gold }) => {
      this.gold = gold;
      this.updateAffordability();
    });

    // Listen for external selection changes (e.g. GameScene clearing selection)
    this.gameEvents.on('TOWER_SELECTED', ({ towerId }) => {
      if (towerId !== this.selectedTowerId) {
        this.selectedTowerId = towerId;
        this.updateSelection();
      }
    });
  }

  update(time: number, _delta: number): void {
    // Pulsing separator line
    this.barSeparator.clear();
    const pulseAlpha = 0.2 + Math.sin(time * 0.003) * 0.1;
    this.barSeparator.lineStyle(1.5, COLORS.ACCENT_CYAN, pulseAlpha);
    this.barSeparator.lineBetween(0, this.barY, GAME.WIDTH, this.barY);
    this.barSeparator.lineStyle(0.5, COLORS.ACCENT_CYAN, pulseAlpha * 0.3);
    this.barSeparator.lineBetween(0, this.barY - 1, GAME.WIDTH, this.barY - 1);

    // Selected tower pulse
    if (this.selectedTowerId) {
      const container = this.slotContainers.get(this.selectedTowerId);
      const config = this.towerConfigs.find(c => c.id === this.selectedTowerId);
      if (container && config) {
        const color = ElementSystem.getColor(config.element);
        const slotBg = container.getAt(0) as Phaser.GameObjects.Graphics;
        const bgAlpha = 0.18 + Math.sin(time * 0.005) * 0.08;
        slotBg.clear();
        drawNeonRect(slotBg, -28, -28, 56, 56, color, bgAlpha, 4);
      }
    }
  }

  private selectTower(towerId: string): void {
    if (this.selectedTowerId === towerId) {
      this.selectedTowerId = null;
    } else {
      this.selectedTowerId = towerId;
    }
    this.gameEvents.emit('TOWER_SELECTED', { towerId: this.selectedTowerId });
    this.updateSelection();
  }

  getSelectedTowerId(): string | null {
    return this.selectedTowerId;
  }

  private updateSelection(): void {
    for (const [id, container] of this.slotContainers) {
      const config = this.towerConfigs.find(c => c.id === id);
      if (!config) continue;
      const color = ElementSystem.getColor(config.element);
      const isSelected = this.selectedTowerId === id;
      const slotBg = container.getAt(0) as Phaser.GameObjects.Graphics;
      slotBg.clear();
      drawNeonRect(slotBg, -28, -28, 56, 56, color, isSelected ? 0.25 : 0.05, 4);
    }
  }

  private updateAffordability(): void {
    for (const [id, container] of this.slotContainers) {
      const config = this.towerConfigs.find(c => c.id === id);
      if (!config) continue;
      container.setAlpha(this.gold >= config.baseCost ? 1 : 0.35);
    }
  }
}
