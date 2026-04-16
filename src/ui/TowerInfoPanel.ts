import Phaser from 'phaser';
import { GAME, COLORS } from '../constants';
import type { GameEvents } from '../types';
import { ElementSystem } from '../systems/ElementSystem';
import { ShapeRenderer } from '../rendering/ShapeRenderer';
import { BaseTower } from '../entities/towers/BaseTower';
import { TOWER_UPGRADES } from '../data/towerUpgrades';
import { EventBus } from '../utils/EventBus';
import { UI } from './UIConstants';

const PANEL_WIDTH = 300;
const PAD = 14;

export class TowerInfoPanel extends Phaser.GameObjects.Container {
  private gameEvents: EventBus<GameEvents>;
  private onSell: (tower: BaseTower) => void;
  private onUpgrade: (tower: BaseTower, branchIndex: number) => void;
  private currentTower: BaseTower | null = null;
  private gold = 0;

  // Persistent layers (reused across shows)
  private outerGlow: Phaser.GameObjects.Graphics;
  private bg: Phaser.GameObjects.Graphics;
  private accentBar: Phaser.GameObjects.Graphics;
  private dynamicChildren: Phaser.GameObjects.GameObject[] = [];

  private panelHeight = 0;

  constructor(
    scene: Phaser.Scene,
    gameEvents: EventBus<GameEvents>,
    onSell: (tower: BaseTower) => void,
    onUpgrade: (tower: BaseTower, branchIndex: number) => void,
  ) {
    super(scene, 0, 0);
    this.gameEvents = gameEvents;
    this.onSell = onSell;
    this.onUpgrade = onUpgrade;
    this.setDepth(20);

    // Layer 1: Outer glow (ADD blend)
    this.outerGlow = scene.add.graphics();
    this.outerGlow.setBlendMode(Phaser.BlendModes.ADD);
    this.add(this.outerGlow);

    // Layer 2: Main panel background
    this.bg = scene.add.graphics();
    this.add(this.bg);

    // Layer 3: Colored accent bar (left edge)
    this.accentBar = scene.add.graphics();
    this.add(this.accentBar);

    // Track gold changes for affordability updates
    this.gameEvents.on('GOLD_CHANGED', ({ gold }) => {
      this.gold = gold;
      if (this.currentTower && this.visible) {
        this.rebuildDynamicContent();
      }
    });

    this.setVisible(false);
    scene.add.existing(this);
  }

  show(tower: BaseTower, currentGold: number): void {
    this.currentTower = tower;
    this.gold = currentGold;

    this.rebuildDynamicContent();
    this.positionPanel(tower);

    // Entrance animation: scale from 0.85, fade in
    this.setVisible(true);
    this.setScale(0.85);
    this.setAlpha(0);
    this.scene.tweens.add({
      targets: this,
      scaleX: 1,
      scaleY: 1,
      alpha: 1,
      duration: 150,
      ease: 'Back.easeOut',
    });
  }

  hide(): void {
    this.clearDynamic();
    this.setVisible(false);
    this.currentTower = null;
  }

  getCurrentTower(): BaseTower | null {
    return this.currentTower;
  }

  // ============ Panel Construction ============

  private rebuildDynamicContent(): void {
    if (!this.currentTower) return;
    this.clearDynamic();

    const tower = this.currentTower;
    const color = ElementSystem.getColor(tower.config.element);
    const colorStr = '#' + color.toString(16).padStart(6, '0');

    let y = PAD;

    // ─── Header: shape icon + name + close button ───
    y = this.buildHeader(tower, color, colorStr, y);

    // ─── Element subtitle ───
    y = this.buildElementLine(tower, colorStr, y);

    // ─── Divider ───
    y = this.buildDivider(color, y, 0.3);

    // ─── Stats grid ───
    y = this.buildStats(tower, y);

    // ─── Divider ───
    y = this.buildDivider(color, y, 0.3);

    // ─── Upgrade paths ───
    y = this.buildUpgradeSection(tower, color, colorStr, y);

    // ─── Divider ───
    y += 4;
    y = this.buildDivider(color, y, 0.3);
    y += 4;

    // ─── Sell button ───
    y = this.buildSellButton(tower, y);

    // Finalize panel height and draw backing layers
    this.panelHeight = y + PAD;
    this.drawBackground(color);
  }

  // ============ Section Builders ============

  private buildHeader(tower: BaseTower, color: number, colorStr: string, y: number): number {
    // Shape icon glow
    const iconBg = this.scene.add.graphics();
    iconBg.setBlendMode(Phaser.BlendModes.ADD);
    iconBg.fillStyle(color, 0.2);
    iconBg.fillCircle(PAD + 12, y + 10, 16);
    this.addDynamic(iconBg);

    // Shape icon
    const iconGfx = this.scene.add.graphics();
    this.drawTowerIcon(iconGfx, PAD + 12, y + 10, tower.config.shape, 10, color);
    this.addDynamic(iconGfx);

    // Tower name
    const name = this.scene.add.text(PAD + 32, y + 2, tower.config.name.toUpperCase(), {
      fontFamily: UI.FONT_FAMILY,
      fontSize: 15,
      color: colorStr,
      fontStyle: 'bold',
    }).setLetterSpacing(1);
    this.addDynamic(name);

    // Tier indicator (LVL)
    const branch = tower.getUpgradeBranch();
    const level = tower.getUpgradeLevel();
    const tierStr = branch >= 0 ? `TIER ${level + 1}` : 'TIER 0';
    const tier = this.scene.add.text(PANEL_WIDTH - PAD, y + 6, tierStr, {
      fontFamily: UI.FONT_MONO,
      fontSize: 9,
      color: '#888',
      fontStyle: 'bold',
    }).setOrigin(1, 0).setLetterSpacing(1);
    this.addDynamic(tier);

    return y + 26;
  }

  private buildElementLine(tower: BaseTower, colorStr: string, y: number): number {
    const elementStr = tower.config.element
      ? tower.config.element.toUpperCase() + ' ELEMENT'
      : 'NEUTRAL';
    const t = this.scene.add.text(PAD + 32, y, elementStr, {
      fontFamily: UI.FONT_MONO,
      fontSize: 9,
      color: colorStr,
      fontStyle: 'bold',
    }).setAlpha(0.7).setLetterSpacing(2);
    this.addDynamic(t);
    return y + 16;
  }

  private buildDivider(color: number, y: number, alpha: number): number {
    const d = this.scene.add.graphics();
    d.lineStyle(0.5, color, alpha);
    d.lineBetween(PAD, y, PANEL_WIDTH - PAD, y);
    this.addDynamic(d);
    return y + 8;
  }

  private buildStats(tower: BaseTower, y: number): number {
    const dps = (tower.getDamage() * tower.getAttackSpeed()).toFixed(1);

    const stats: { label: string; value: string; col: number }[] = [
      { label: 'DMG', value: tower.getDamage().toFixed(0), col: 0 },
      { label: 'SPD', value: tower.getAttackSpeed().toFixed(1) + '/s', col: 1 },
      { label: 'RNG', value: tower.getRange().toFixed(1), col: 2 },
    ];

    const colWidth = (PANEL_WIDTH - PAD * 2) / 3;
    for (const stat of stats) {
      const cx = PAD + colWidth * stat.col + colWidth / 2;
      const label = this.scene.add.text(cx, y, stat.label, {
        fontFamily: UI.FONT_MONO,
        fontSize: 8,
        color: '#666',
        fontStyle: 'bold',
      }).setOrigin(0.5, 0).setLetterSpacing(1);
      this.addDynamic(label);

      const val = this.scene.add.text(cx, y + 10, stat.value, {
        fontFamily: UI.FONT_FAMILY,
        fontSize: 14,
        color: '#fff',
        fontStyle: 'bold',
      }).setOrigin(0.5, 0);
      this.addDynamic(val);
    }

    // DPS highlighted underneath
    const dpsLabel = this.scene.add.text(PANEL_WIDTH / 2, y + 30, `DPS ${dps}`, {
      fontFamily: UI.FONT_MONO,
      fontSize: 10,
      color: '#' + COLORS.GOLD.toString(16).padStart(6, '0'),
      fontStyle: 'bold',
    }).setOrigin(0.5, 0).setLetterSpacing(2);
    this.addDynamic(dpsLabel);

    return y + 48;
  }

  private buildUpgradeSection(tower: BaseTower, color: number, colorStr: string, y: number): number {
    const branches = TOWER_UPGRADES[tower.config.id] ?? [];
    const currentBranch = tower.getUpgradeBranch();
    const currentLevel = tower.getUpgradeLevel();

    // Section header
    const header = this.scene.add.text(PAD, y, 'UPGRADE PATHS', {
      fontFamily: UI.FONT_MONO,
      fontSize: 9,
      color: '#888',
      fontStyle: 'bold',
    }).setLetterSpacing(2);
    this.addDynamic(header);
    y += 16;

    branches.forEach((branch, branchIndex) => {
      const isLockedOut = currentBranch >= 0 && currentBranch !== branchIndex;
      const isChosen = currentBranch === branchIndex;
      const nextLevel = isChosen ? currentLevel + 1 : 0;
      const levelData = branch.levels[nextLevel];

      y = this.buildBranchCard(
        tower, branchIndex, branch.branchName,
        levelData, isChosen, isLockedOut,
        color, colorStr, y,
      );
      y += 6;
    });

    return y;
  }

  private buildBranchCard(
    tower: BaseTower,
    branchIndex: number,
    branchName: string,
    levelData: typeof TOWER_UPGRADES[string][number]['levels'][number] | undefined,
    isChosen: boolean,
    isLockedOut: boolean,
    color: number,
    colorStr: string,
    y: number,
  ): number {
    const cardX = PAD;
    const cardW = PANEL_WIDTH - PAD * 2;
    const cardH = 42;

    const maxed = isChosen && !levelData;
    const canAfford = levelData && this.gold >= levelData.cost;

    // Card background with state-based styling
    const card = this.scene.add.graphics();
    let bgAlpha: number;
    let borderAlpha: number;
    if (isLockedOut) {
      bgAlpha = 0.03;
      borderAlpha = 0.12;
    } else if (maxed) {
      bgAlpha = 0.08;
      borderAlpha = 0.6;
    } else if (canAfford) {
      bgAlpha = 0.1;
      borderAlpha = 0.6;
    } else {
      bgAlpha = 0.05;
      borderAlpha = 0.25;
    }
    const cardColor = maxed ? COLORS.SUCCESS : color;
    card.fillStyle(cardColor, bgAlpha);
    card.fillRoundedRect(cardX, y, cardW, cardH, 4);
    card.lineStyle(1, cardColor, borderAlpha);
    card.strokeRoundedRect(cardX, y, cardW, cardH, 4);
    this.addDynamic(card);

    // Chosen-branch accent stripe on left
    if (isChosen && !maxed) {
      const stripe = this.scene.add.graphics();
      stripe.fillStyle(color, 0.7);
      stripe.fillRect(cardX, y + 4, 2, cardH - 8);
      this.addDynamic(stripe);
    }

    // Branch name
    const nameColor = isLockedOut ? '#555' : colorStr;
    const branchLabel = this.scene.add.text(cardX + 10, y + 6, branchName, {
      fontFamily: UI.FONT_FAMILY,
      fontSize: 11,
      color: nameColor,
      fontStyle: 'bold',
    });
    this.addDynamic(branchLabel);

    // Level dots (progress indicator)
    const totalLevels = 3;
    const dotX = cardX + cardW - 10 - totalLevels * 8;
    for (let i = 0; i < totalLevels; i++) {
      const dot = this.scene.add.graphics();
      const dx = dotX + i * 8;
      const dy = y + 10;
      const isCompleted = isChosen && i <= tower.getUpgradeLevel();
      if (isCompleted) {
        dot.fillStyle(color, 0.9);
        dot.fillCircle(dx, dy, 2.5);
      } else if (isLockedOut) {
        dot.lineStyle(1, 0x444444, 0.5);
        dot.strokeCircle(dx, dy, 2.5);
      } else {
        dot.lineStyle(1, color, 0.4);
        dot.strokeCircle(dx, dy, 2.5);
      }
      this.addDynamic(dot);
    }

    // Body content
    if (maxed) {
      const maxLabel = this.scene.add.text(cardX + 10, y + 22, 'MAX LEVEL REACHED', {
        fontFamily: UI.FONT_MONO,
        fontSize: 9,
        color: '#4ade80',
        fontStyle: 'bold',
      }).setLetterSpacing(1);
      this.addDynamic(maxLabel);
    } else if (isLockedOut) {
      const locked = this.scene.add.text(cardX + 10, y + 22, '✕ PATH NOT CHOSEN', {
        fontFamily: UI.FONT_MONO,
        fontSize: 9,
        color: '#555',
        fontStyle: 'bold',
      }).setLetterSpacing(1);
      this.addDynamic(locked);
    } else if (levelData) {
      // Description
      const desc = this.scene.add.text(cardX + 10, y + 22, levelData.description, {
        fontFamily: UI.FONT_FAMILY,
        fontSize: 10,
        color: '#ccc',
      });
      this.addDynamic(desc);

      // Cost button (right side)
      this.buildCostButton(tower, branchIndex, levelData.cost, canAfford ?? false, cardX + cardW - 10, y + cardH / 2);

      // Make whole card clickable if affordable
      if (canAfford) {
        const hit = new Phaser.Geom.Rectangle(cardX, y, cardW, cardH);
        const zone = this.scene.add.zone(0, 0, 0, 0).setInteractive(hit, Phaser.Geom.Rectangle.Contains);
        zone.on('pointerover', () => {
          card.clear();
          card.fillStyle(color, 0.2);
          card.fillRoundedRect(cardX, y, cardW, cardH, 4);
          card.lineStyle(1.5, color, 1);
          card.strokeRoundedRect(cardX, y, cardW, cardH, 4);
          this.scene.input.setDefaultCursor('pointer');
        });
        zone.on('pointerout', () => {
          card.clear();
          card.fillStyle(color, bgAlpha);
          card.fillRoundedRect(cardX, y, cardW, cardH, 4);
          card.lineStyle(1, color, borderAlpha);
          card.strokeRoundedRect(cardX, y, cardW, cardH, 4);
          this.scene.input.setDefaultCursor('default');
        });
        zone.on('pointerdown', () => {
          if (this.currentTower) {
            this.onUpgrade(this.currentTower, branchIndex);
            this.rebuildDynamicContent();
          }
        });
        this.addDynamic(zone);
      }
    }

    return y + cardH;
  }

  private buildCostButton(
    _tower: BaseTower,
    _branchIndex: number,
    cost: number,
    canAfford: boolean,
    rightX: number,
    centerY: number,
  ): void {
    const badgeW = 50;
    const badgeH = 20;
    const badgeX = rightX - badgeW;
    const badgeY = centerY - badgeH / 2;

    const color = canAfford ? COLORS.GOLD : COLORS.DANGER;
    const alpha = canAfford ? 0.25 : 0.12;

    const badge = this.scene.add.graphics();
    badge.fillStyle(color, alpha);
    badge.fillRoundedRect(badgeX, badgeY, badgeW, badgeH, 3);
    badge.lineStyle(0.8, color, canAfford ? 0.7 : 0.3);
    badge.strokeRoundedRect(badgeX, badgeY, badgeW, badgeH, 3);
    this.addDynamic(badge);

    // Mini hex icon
    const hex = this.scene.add.graphics();
    const hx = badgeX + 10;
    const hy = badgeY + badgeH / 2;
    hex.fillStyle(color, canAfford ? 0.7 : 0.3);
    hex.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      const px = hx + 4 * Math.cos(angle);
      const py = hy + 4 * Math.sin(angle);
      if (i === 0) hex.moveTo(px, py); else hex.lineTo(px, py);
    }
    hex.closePath();
    hex.fillPath();
    this.addDynamic(hex);

    // Cost number
    const costText = this.scene.add.text(badgeX + badgeW - 6, badgeY + badgeH / 2, `${cost}`, {
      fontFamily: UI.FONT_MONO,
      fontSize: 11,
      color: '#' + color.toString(16).padStart(6, '0'),
      fontStyle: 'bold',
    }).setOrigin(1, 0.5);
    this.addDynamic(costText);
  }

  private buildSellButton(tower: BaseTower, y: number): number {
    const btnX = PAD;
    const btnW = PANEL_WIDTH - PAD * 2;
    const btnH = 30;
    const sellValue = Math.floor(tower.getTotalInvested() * GAME.SELL_REFUND_RATIO);

    const btn = this.scene.add.graphics();
    btn.fillStyle(COLORS.DANGER, 0.1);
    btn.fillRoundedRect(btnX, y, btnW, btnH, 5);
    btn.lineStyle(1, COLORS.DANGER, 0.5);
    btn.strokeRoundedRect(btnX, y, btnW, btnH, 5);
    this.addDynamic(btn);

    const label = this.scene.add.text(btnX + btnW / 2, y + btnH / 2, `SELL  ·  +${sellValue}g`, {
      fontFamily: UI.FONT_FAMILY,
      fontSize: 12,
      color: '#' + COLORS.DANGER.toString(16).padStart(6, '0'),
      fontStyle: 'bold',
    }).setOrigin(0.5).setLetterSpacing(3);
    this.addDynamic(label);

    // Click target (whole button)
    const hit = new Phaser.Geom.Rectangle(btnX, y, btnW, btnH);
    const zone = this.scene.add.zone(0, 0, 0, 0).setInteractive(hit, Phaser.Geom.Rectangle.Contains);
    zone.on('pointerover', () => {
      btn.clear();
      btn.fillStyle(COLORS.DANGER, 0.25);
      btn.fillRoundedRect(btnX, y, btnW, btnH, 5);
      btn.lineStyle(1.5, COLORS.DANGER, 1);
      btn.strokeRoundedRect(btnX, y, btnW, btnH, 5);
      this.scene.input.setDefaultCursor('pointer');
    });
    zone.on('pointerout', () => {
      btn.clear();
      btn.fillStyle(COLORS.DANGER, 0.1);
      btn.fillRoundedRect(btnX, y, btnW, btnH, 5);
      btn.lineStyle(1, COLORS.DANGER, 0.5);
      btn.strokeRoundedRect(btnX, y, btnW, btnH, 5);
      this.scene.input.setDefaultCursor('default');
    });
    zone.on('pointerdown', () => {
      if (this.currentTower) {
        this.onSell(this.currentTower);
        this.hide();
      }
    });
    this.addDynamic(zone);

    return y + btnH;
  }

  // ============ Drawing Helpers ============

  private drawBackground(color: number): void {
    const w = PANEL_WIDTH;
    const h = this.panelHeight;

    // Outer glow
    this.outerGlow.clear();
    this.outerGlow.fillStyle(color, 0.08);
    this.outerGlow.fillRoundedRect(-4, -4, w + 8, h + 8, 10);

    // Main panel
    this.bg.clear();
    this.bg.fillStyle(COLORS.UI_BG, 0.96);
    this.bg.fillRoundedRect(0, 0, w, h, 8);
    // Neon border
    this.bg.lineStyle(1.5, color, 0.8);
    this.bg.strokeRoundedRect(0, 0, w, h, 8);
    // Inner highlight line
    this.bg.lineStyle(0.5, color, 0.3);
    this.bg.strokeRoundedRect(2, 2, w - 4, h - 4, 7);

    // Accent bar (left edge)
    this.accentBar.clear();
    this.accentBar.fillStyle(color, 0.9);
    this.accentBar.fillRect(0, 10, 3, h - 20);
  }

  private drawTowerIcon(
    gfx: Phaser.GameObjects.Graphics,
    x: number, y: number,
    shape: string, size: number, color: number,
  ): void {
    switch (shape) {
      case 'triangle':
        ShapeRenderer.drawPolygon(gfx, x, y, 3, size, color, 0.5, color, 1.5);
        break;
      case 'square':
        ShapeRenderer.drawPolygon(gfx, x, y, 4, size, color, 0.5, color, 1.5);
        break;
      case 'pentagon':
        ShapeRenderer.drawPolygon(gfx, x, y, 5, size, color, 0.5, color, 1.5);
        break;
      case 'hexagon':
        ShapeRenderer.drawPolygon(gfx, x, y, 6, size, color, 0.5, color, 1.5);
        break;
      case 'octagon':
        ShapeRenderer.drawPolygon(gfx, x, y, 8, size, color, 0.5, color, 1.5);
        break;
      case 'diamond':
        ShapeRenderer.drawDiamond(gfx, x, y, size, color, 0.5, color, 1.5);
        break;
      case 'star':
        ShapeRenderer.drawStar(gfx, x, y, size, color, 0.5, color, 1.5);
        break;
      default:
        gfx.fillStyle(color, 0.5);
        gfx.fillCircle(x, y, size);
        gfx.lineStyle(1.5, color, 1);
        gfx.strokeCircle(x, y, size);
    }
    // Inner highlight
    gfx.fillStyle(0xffffff, 0.3);
    gfx.fillCircle(x, y, size * 0.25);
  }

  // ============ Position / Lifecycle ============

  private positionPanel(tower: BaseTower): void {
    let px = tower.x + 30;
    let py = tower.y - 40;
    if (px + PANEL_WIDTH > GAME.WIDTH - 8) px = tower.x - PANEL_WIDTH - 30;
    if (py + this.panelHeight > GAME.HEIGHT - GAME.TOWER_BAR_HEIGHT - 8) {
      py = GAME.HEIGHT - GAME.TOWER_BAR_HEIGHT - this.panelHeight - 8;
    }
    if (py < GAME.HUD_HEIGHT + 8) py = GAME.HUD_HEIGHT + 8;
    this.setPosition(px, py);
  }

  private addDynamic(obj: Phaser.GameObjects.GameObject): void {
    this.add(obj);
    this.dynamicChildren.push(obj);
  }

  private clearDynamic(): void {
    for (const obj of this.dynamicChildren) {
      obj.destroy();
    }
    this.dynamicChildren = [];
  }
}
