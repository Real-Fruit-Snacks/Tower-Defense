import Phaser from 'phaser';
import { SCENES, COLORS, GAME } from '../constants';
import { createGlowText, drawNeonRect } from '../rendering/NeonEffects';
import { ShapeRenderer } from '../rendering/ShapeRenderer';
import { randomRange } from '../utils/MathUtils';
import { setupStageCamera } from '../utils/StageCamera';
import type { PersistentState } from '../roguelite/PersistentState';

interface FloatingShape {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  sides: number;
  color: number;
  alpha: number;
  rotation: number;
  rotSpeed: number;
  pulsePhase: number;
}

interface MenuButton {
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  glowRing: Phaser.GameObjects.Graphics;
  color: number;
  width: number;
  height: number;
  hovered: boolean;
}

const FONT_FAMILY = 'Segoe UI, system-ui, sans-serif';
const FONT_MONO = 'monospace';

export class MainMenuScene extends Phaser.Scene {
  private shapes: FloatingShape[] = [];
  private bgGraphics!: Phaser.GameObjects.Graphics;
  private titleContainer!: Phaser.GameObjects.Container;
  private scanLine!: Phaser.GameObjects.Graphics;
  private scanLineY = 0;
  private dividerTop!: Phaser.GameObjects.Graphics;
  private dividerBottom!: Phaser.GameObjects.Graphics;
  private buttons: MenuButton[] = [];

  constructor() {
    super(SCENES.MAIN_MENU);
  }

  create(): void {
    setupStageCamera(this);
    this.cameras.main.setBackgroundColor(COLORS.BG);
    this.shapes = [];
    this.buttons = [];
    this.scanLineY = 0;

    this.createBackground();
    this.createVignette();
    this.createScanlines();
    this.createDividers();
    this.createTitle();
    this.createSubtitle();
    this.createButtons();
    this.createStatsFooter();
    this.createVersionTag();
    this.createFullscreenButton();

    // Opening camera flash for dramatic intro
    this.cameras.main.flash(500, 0, 255, 255, false, undefined, 0.15);
  }

  // ============ Background ============

  private createBackground(): void {
    // Subtle perspective grid — cyberpunk floor feel
    const gridGfx = this.add.graphics().setDepth(0);
    gridGfx.lineStyle(0.5, COLORS.ACCENT_PINK, 0.05);
    for (let x = 0; x < GAME.WIDTH; x += 40) {
      gridGfx.lineBetween(x, 0, x, GAME.HEIGHT);
    }
    for (let y = 0; y < GAME.HEIGHT; y += 40) {
      gridGfx.lineBetween(0, y, GAME.WIDTH, y);
    }

    // Radial accent — brighter center, dim edges
    const accent = this.add.graphics().setDepth(0);
    accent.setBlendMode(Phaser.BlendModes.ADD);
    accent.fillStyle(COLORS.ACCENT_CYAN, 0.03);
    accent.fillCircle(GAME.WIDTH / 2, GAME.HEIGHT / 2, 400);
    accent.fillStyle(COLORS.ACCENT_PINK, 0.02);
    accent.fillCircle(GAME.WIDTH / 2, GAME.HEIGHT / 2, 300);

    // Floating geometric shapes with pulsing alpha
    this.bgGraphics = this.add.graphics().setDepth(1);
    this.bgGraphics.setBlendMode(Phaser.BlendModes.ADD);

    const colors = [COLORS.ACCENT_CYAN, COLORS.ACCENT_PINK, COLORS.ACCENT_PURPLE, COLORS.VOID, COLORS.WIND, COLORS.LIGHTNING];
    for (let i = 0; i < 32; i++) {
      this.shapes.push({
        x: randomRange(0, GAME.WIDTH),
        y: randomRange(0, GAME.HEIGHT),
        vx: randomRange(-12, 12),
        vy: randomRange(-12, 12),
        size: randomRange(6, 40),
        sides: Math.floor(randomRange(3, 9)),
        color: colors[Math.floor(Math.random() * colors.length)]!,
        alpha: randomRange(0.04, 0.10),
        rotation: randomRange(0, Math.PI * 2),
        rotSpeed: randomRange(-0.4, 0.4),
        pulsePhase: randomRange(0, Math.PI * 2),
      });
    }
  }

  private createVignette(): void {
    const vignette = this.add.graphics().setDepth(2);
    for (let i = 0; i < 14; i++) {
      const inset = i * 18;
      const alpha = 0.28 * (1 - i / 14);
      vignette.fillStyle(0x000000, alpha);
      vignette.fillRect(0, inset, GAME.WIDTH, GAME.HEIGHT - inset * 2);
      vignette.fillRect(inset, 0, GAME.WIDTH - inset * 2, GAME.HEIGHT);
    }
  }

  private createScanlines(): void {
    // Static horizontal scanline overlay
    const scan = this.add.graphics().setDepth(3);
    scan.lineStyle(0.5, 0xffffff, 0.015);
    for (let y = 0; y < GAME.HEIGHT; y += 3) {
      scan.lineBetween(0, y, GAME.WIDTH, y);
    }

    // Sweeping scan line (animated)
    this.scanLine = this.add.graphics().setDepth(4);
    this.scanLine.setBlendMode(Phaser.BlendModes.ADD);
  }

  private createDividers(): void {
    // Top divider (below title+subtitle area)
    this.dividerTop = this.add.graphics().setDepth(8);
    this.dividerTop.setBlendMode(Phaser.BlendModes.ADD);

    // Bottom divider (above stats footer)
    this.dividerBottom = this.add.graphics().setDepth(8);
    this.dividerBottom.setBlendMode(Phaser.BlendModes.ADD);
  }

  // ============ Title ============

  private createTitle(): void {
    this.titleContainer = this.add.container(GAME.WIDTH / 2, 160).setDepth(10);

    // Draw the main title glow text (uses built-in multi-layer glow)
    const glowText = createGlowText(this, 0, 0, 'TOWER DEFENSE', COLORS.ACCENT_CYAN, 56);
    this.titleContainer.add(glowText);

    // Animate entrance: start compressed + transparent
    this.titleContainer.setScale(0.6);
    this.titleContainer.setAlpha(0);
    this.tweens.add({
      targets: this.titleContainer,
      scaleX: 1,
      scaleY: 1,
      alpha: 1,
      duration: 700,
      ease: 'Back.easeOut',
    });

    // Continuous breathing animation
    this.tweens.add({
      targets: this.titleContainer,
      scaleX: { from: 1, to: 1.02 },
      scaleY: { from: 1, to: 1.02 },
      duration: 2500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      delay: 700,
    });
  }

  private createSubtitle(): void {
    const subtitle = this.add.text(GAME.WIDTH / 2, 230, 'GEOMETRIC WARFARE', {
      fontFamily: FONT_FAMILY,
      fontSize: 16,
      color: '#ff0055',
      fontStyle: 'bold',
    });
    subtitle.setOrigin(0.5);
    subtitle.setLetterSpacing(10);
    subtitle.setDepth(10);
    subtitle.setAlpha(0);

    // Fade in after title
    this.tweens.add({
      targets: subtitle,
      alpha: 1,
      duration: 500,
      delay: 400,
      ease: 'Quad.easeOut',
    });

    // Continuous gentle alpha pulse
    this.tweens.add({
      targets: subtitle,
      alpha: { from: 1, to: 0.55 },
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      delay: 900,
    });
  }

  // ============ Buttons ============

  private createButtons(): void {
    interface MenuEntry {
      label: string;
      color: number;
      shape: 'octagon' | 'star' | 'diamond' | 'hexagon';
      desc: string;
      onClick: () => void;
      locked?: boolean;
      lockedReason?: string;
    }

    const persistent = this.game.registry.get('persistentState') as PersistentState | undefined;
    const endlessUnlocked = persistent?.unlockTree.isModeUnlocked('endless') ?? false;
    const challengesUnlocked = persistent?.unlockTree.isModeUnlocked('challenges') ?? false;

    const entries: MenuEntry[] = [
      {
        label: 'CAMPAIGN',
        color: COLORS.ACCENT_CYAN,
        shape: 'octagon',
        desc: '3 worlds · roguelite run',
        onClick: () => this.transitionTo(SCENES.WORLD_MAP),
      },
      {
        label: 'ENDLESS',
        color: COLORS.ACCENT_PINK,
        shape: 'hexagon',
        desc: endlessUnlocked ? 'survive as long as you can' : 'LOCKED · unlock in tree',
        onClick: () => this.transitionTo(SCENES.GAME, { mode: 'endless' }),
        locked: !endlessUnlocked,
        lockedReason: 'Unlock "Endless Mode" in the Unlock Tree',
      },
      {
        label: 'CHALLENGES',
        color: COLORS.ACCENT_PURPLE,
        shape: 'star',
        desc: challengesUnlocked ? 'custom rulesets · big rewards' : 'LOCKED · unlock in tree',
        onClick: () => this.transitionTo(SCENES.CHALLENGE_SELECT),
        locked: !challengesUnlocked,
        lockedReason: 'Unlock "Challenge Mode" in the Unlock Tree',
      },
      {
        label: 'UNLOCKS',
        color: COLORS.GOLD,
        shape: 'diamond',
        desc: 'spend shards on permanent boosts',
        onClick: () => this.transitionTo(SCENES.UNLOCK_TREE_SCENE),
      },
      {
        label: 'SETTINGS',
        color: COLORS.WIND,
        shape: 'hexagon',
        desc: 'audio · data · info',
        onClick: () => this.transitionTo(SCENES.SETTINGS),
      },
    ];

    // 5 buttons now; tighten spacing so they still fit above the stats footer.
    const baseY = 318;
    const spacing = 62;

    entries.forEach((entry, i) => {
      const btn = this.createMenuButton(
        GAME.WIDTH / 2, baseY + i * spacing,
        entry.label, entry.desc, entry.color, entry.shape, entry.onClick,
        entry.locked ?? false, entry.lockedReason,
      );
      this.buttons.push(btn);

      // Stagger entrance — slide in from right with fade
      btn.container.setAlpha(0);
      btn.container.setX(btn.container.x + 80);
      this.tweens.add({
        targets: btn.container,
        alpha: 1,
        x: btn.container.x - 80,
        duration: 400,
        delay: 600 + i * 100,
        ease: 'Quad.easeOut',
      });
    });
  }

  private createMenuButton(
    x: number, y: number,
    label: string, description: string,
    color: number,
    shape: 'octagon' | 'star' | 'diamond' | 'hexagon',
    onClick: () => void,
    locked = false,
    _lockedReason?: string,
  ): MenuButton {
    const width = 320;
    const height = 56;

    // Locked entries use a desaturated gray accent instead of the category color.
    const effectiveColor = locked ? 0x555566 : color;
    const container = this.add.container(x, y).setDepth(10);
    if (locked) container.setAlpha(0.55);

    // Outer glow ring (ADD blend, shown on hover)
    const glowRing = this.add.graphics();
    glowRing.setBlendMode(Phaser.BlendModes.ADD);
    container.add(glowRing);

    // Main button background
    const bg = this.add.graphics();
    drawNeonRect(bg, -width / 2, -height / 2, width, height, effectiveColor, 0.08, 8);
    container.add(bg);

    // Shape icon on the left
    const iconGfx = this.add.graphics();
    this.drawShapeIcon(iconGfx, -width / 2 + 26, 0, shape, 10, effectiveColor);
    container.add(iconGfx);

    // Small divider between icon and text
    const divider = this.add.graphics();
    divider.lineStyle(0.5, effectiveColor, 0.3);
    divider.lineBetween(-width / 2 + 48, -height / 2 + 12, -width / 2 + 48, height / 2 - 12);
    container.add(divider);

    // Label
    const text = this.add.text(-width / 2 + 64, -6, label, {
      fontFamily: FONT_FAMILY,
      fontSize: 18,
      color: '#' + effectiveColor.toString(16).padStart(6, '0'),
      fontStyle: 'bold',
    }).setOrigin(0, 0.5).setLetterSpacing(3);
    container.add(text);

    // Description (subtle hint text)
    const descText = this.add.text(-width / 2 + 64, 12, description, {
      fontFamily: FONT_MONO,
      fontSize: 9,
      color: '#' + effectiveColor.toString(16).padStart(6, '0'),
      fontStyle: 'bold',
    }).setOrigin(0, 0.5).setAlpha(0.45).setLetterSpacing(1);
    container.add(descText);

    // Arrow indicator (right side)
    const arrow = this.add.text(width / 2 - 18, 0, '▸', {
      fontFamily: FONT_FAMILY,
      fontSize: 18,
      color: '#' + effectiveColor.toString(16).padStart(6, '0'),
      fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0.4);
    container.add(arrow);

    // Interactivity
    const hitArea = new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height);
    container.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);

    const button: MenuButton = { container, bg, glowRing, color: effectiveColor, width, height, hovered: false };

    container.on('pointerover', () => {
      button.hovered = true;
      this.input.setDefaultCursor('pointer');
      bg.clear();
      drawNeonRect(bg, -width / 2, -height / 2, width, height, effectiveColor, 0.22, 8);
      this.tweens.add({
        targets: container, scaleX: 1.04, scaleY: 1.04,
        duration: 120, ease: 'Back.easeOut',
      });
      this.tweens.add({
        targets: arrow, x: width / 2 - 12, alpha: 1,
        duration: 150, ease: 'Quad.easeOut',
      });
      descText.setAlpha(0.8);
    });

    container.on('pointerout', () => {
      button.hovered = false;
      this.input.setDefaultCursor('default');
      bg.clear();
      drawNeonRect(bg, -width / 2, -height / 2, width, height, effectiveColor, 0.08, 8);
      this.tweens.add({
        targets: container, scaleX: 1, scaleY: 1,
        duration: 120, ease: 'Quad.easeOut',
      });
      this.tweens.add({
        targets: arrow, x: width / 2 - 18, alpha: 0.4,
        duration: 150, ease: 'Quad.easeOut',
      });
      descText.setAlpha(0.45);
      glowRing.clear();
    });

    container.on('pointerdown', () => {
      if (locked) {
        // Shake + flash red to signal denial; do not navigate.
        this.cameras.main.flash(100, 255, 80, 80, false, undefined, 0.15);
        this.tweens.add({
          targets: container,
          x: { from: container.x - 4, to: container.x + 4 },
          duration: 60,
          yoyo: true,
          repeat: 2,
          ease: 'Sine.easeInOut',
        });
        return;
      }
      this.cameras.main.flash(120, effectiveColor >> 16 & 0xff, effectiveColor >> 8 & 0xff, effectiveColor & 0xff, false, undefined, 0.2);
      this.tweens.add({
        targets: container, scaleX: 0.96, scaleY: 0.96,
        duration: 80, yoyo: true, ease: 'Quad.easeOut',
        onComplete: onClick,
      });
    });

    // Lock badge on the right (replaces arrow visually for locked entries)
    if (locked) {
      arrow.setVisible(false);
      const lockBadge = this.add.text(width / 2 - 18, 0, 'LOCKED', {
        fontFamily: FONT_MONO,
        fontSize: 8,
        color: '#888',
        fontStyle: 'bold',
      }).setOrigin(1, 0.5).setLetterSpacing(2);
      container.add(lockBadge);
    }

    return button;
  }

  private drawShapeIcon(
    gfx: Phaser.GameObjects.Graphics,
    x: number, y: number,
    shape: string, size: number, color: number,
  ): void {
    // Soft glow
    gfx.fillStyle(color, 0.15);
    gfx.fillCircle(x, y, size * 1.8);

    switch (shape) {
      case 'octagon':
        ShapeRenderer.drawPolygon(gfx, x, y, 8, size, color, 0.4, color, 1.5);
        break;
      case 'hexagon':
        ShapeRenderer.drawPolygon(gfx, x, y, 6, size, color, 0.4, color, 1.5);
        break;
      case 'star':
        ShapeRenderer.drawStar(gfx, x, y, size, color, 0.4, color, 1.5);
        break;
      case 'diamond':
        ShapeRenderer.drawDiamond(gfx, x, y, size, color, 0.4, color, 1.5);
        break;
    }

    // Inner highlight
    gfx.fillStyle(0xffffff, 0.35);
    gfx.fillCircle(x, y, size * 0.25);
  }

  // ============ Stats Footer ============

  private createStatsFooter(): void {
    const persistent = this.game.registry.get('persistentState') as PersistentState | undefined;
    if (!persistent) return;

    const data = persistent.saveManager.getData();
    const stats = data.stats;
    const shards = persistent.shardTracker.getShards();

    const footerY = GAME.HEIGHT - 50;
    const divider = this.add.graphics().setDepth(10);
    divider.setBlendMode(Phaser.BlendModes.ADD);
    divider.lineStyle(0.5, COLORS.ACCENT_CYAN, 0.15);
    divider.lineBetween(GAME.WIDTH / 2 - 240, footerY - 20, GAME.WIDTH / 2 + 240, footerY - 20);

    const items: { label: string; value: string; color: number }[] = [
      { label: 'SHARDS', value: `${shards}`, color: COLORS.ACCENT_PURPLE },
      { label: 'RUNS', value: `${stats.totalRuns}`, color: COLORS.ACCENT_CYAN },
      { label: 'KILLS', value: `${stats.totalKills}`, color: COLORS.ACCENT_PINK },
      { label: 'HIGH WAVE', value: `${stats.highestWave}`, color: COLORS.GOLD },
    ];

    const spacing = 120;
    const startX = GAME.WIDTH / 2 - spacing * (items.length - 1) / 2;

    items.forEach((item, i) => {
      const itemX = startX + i * spacing;

      const valueText = this.add.text(itemX, footerY - 8, item.value, {
        fontFamily: FONT_FAMILY,
        fontSize: 16,
        color: '#' + item.color.toString(16).padStart(6, '0'),
        fontStyle: 'bold',
      }).setOrigin(0.5, 0.5).setDepth(10).setAlpha(0);

      const labelText = this.add.text(itemX, footerY + 10, item.label, {
        fontFamily: FONT_MONO,
        fontSize: 8,
        color: '#' + item.color.toString(16).padStart(6, '0'),
        fontStyle: 'bold',
      }).setOrigin(0.5, 0.5).setDepth(10).setLetterSpacing(2).setAlpha(0);

      // Fade in after buttons
      this.tweens.add({
        targets: [valueText, labelText],
        alpha: 1,
        duration: 500,
        delay: 1200 + i * 80,
        ease: 'Quad.easeOut',
      });
    });
  }

  private createVersionTag(): void {
    const v = this.add.text(GAME.WIDTH - 10, GAME.HEIGHT - 8, 'v0.1.0', {
      fontFamily: FONT_MONO,
      fontSize: 10,
      color: '#333',
    }).setOrigin(1, 1).setDepth(10);
    v.setAlpha(0);
    this.tweens.add({ targets: v, alpha: 1, duration: 500, delay: 1400 });
  }

  /**
   * Floating fullscreen toggle in the top-right corner. Mobile players
   * tap this to get the game canvas to fill the screen — otherwise the
   * browser's address bar / home indicator can clip the edges.
   */
  private createFullscreenButton(): void {
    // Some browsers (iOS Safari on iPhone) don't expose the Fullscreen API.
    // Hide the button entirely rather than showing a dead control.
    if (!this.scale.fullscreen.available) return;

    const x = GAME.WIDTH - 30;
    const y = 30;
    const r = 18;

    const container = this.add.container(x, y).setDepth(12);

    const bg = this.add.graphics();
    const iconGfx = this.add.graphics();
    iconGfx.setBlendMode(Phaser.BlendModes.ADD);

    const draw = () => {
      const active = this.scale.isFullscreen;
      const color = active ? COLORS.SUCCESS : COLORS.ACCENT_CYAN;

      bg.clear();
      bg.fillStyle(color, active ? 0.18 : 0.06);
      bg.fillCircle(0, 0, r);
      bg.lineStyle(1, color, active ? 0.7 : 0.25);
      bg.strokeCircle(0, 0, r);

      iconGfx.clear();
      iconGfx.lineStyle(1.5, color, 1);
      const bracketR = 7;
      const armLen = 4;
      const sign = active ? -1 : 1;
      // 4 corner brackets: outward when OFF, inward when ON.
      const cx = 0, cy = 0;
      // Top-left
      iconGfx.lineBetween(cx - bracketR, cy - bracketR, cx - bracketR + sign * armLen, cy - bracketR);
      iconGfx.lineBetween(cx - bracketR, cy - bracketR, cx - bracketR, cy - bracketR + sign * armLen);
      // Top-right
      iconGfx.lineBetween(cx + bracketR, cy - bracketR, cx + bracketR - sign * armLen, cy - bracketR);
      iconGfx.lineBetween(cx + bracketR, cy - bracketR, cx + bracketR, cy - bracketR + sign * armLen);
      // Bottom-left
      iconGfx.lineBetween(cx - bracketR, cy + bracketR, cx - bracketR + sign * armLen, cy + bracketR);
      iconGfx.lineBetween(cx - bracketR, cy + bracketR, cx - bracketR, cy + bracketR - sign * armLen);
      // Bottom-right
      iconGfx.lineBetween(cx + bracketR, cy + bracketR, cx + bracketR - sign * armLen, cy + bracketR);
      iconGfx.lineBetween(cx + bracketR, cy + bracketR, cx + bracketR, cy + bracketR - sign * armLen);
    };
    draw();

    container.add(bg);
    container.add(iconGfx);

    const hitArea = new Phaser.Geom.Circle(0, 0, r + 4);
    container.setInteractive(hitArea, Phaser.Geom.Circle.Contains);

    container.on('pointerover', () => {
      this.input.setDefaultCursor('pointer');
      this.tweens.add({ targets: container, scaleX: 1.1, scaleY: 1.1, duration: 120 });
    });
    container.on('pointerout', () => {
      this.input.setDefaultCursor('default');
      this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 120 });
    });
    container.on('pointerdown', () => {
      if (this.scale.isFullscreen) this.scale.stopFullscreen();
      else this.scale.startFullscreen();
      this.time.delayedCall(50, draw);
    });

    this.scale.on('enterfullscreen', draw);
    this.scale.on('leavefullscreen', draw);

    // Remove the listeners when this scene shuts down so we don't invoke
    // `draw` on a destroyed graphics object after the player navigates away.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('enterfullscreen', draw);
      this.scale.off('leavefullscreen', draw);
    });

    // Fade in after other UI
    container.setAlpha(0);
    this.tweens.add({ targets: container, alpha: 1, duration: 500, delay: 1200 });
  }

  // ============ Update Loop ============

  update(time: number, delta: number): void {
    this.bgGraphics.clear();
    const dt = delta / 1000;

    // Animate floating shapes
    for (const shape of this.shapes) {
      shape.x += shape.vx * dt;
      shape.y += shape.vy * dt;
      shape.rotation += shape.rotSpeed * dt;
      shape.pulsePhase += dt;

      if (shape.x < -50) shape.x = GAME.WIDTH + 50;
      if (shape.x > GAME.WIDTH + 50) shape.x = -50;
      if (shape.y < -50) shape.y = GAME.HEIGHT + 50;
      if (shape.y > GAME.HEIGHT + 50) shape.y = -50;

      const alpha = shape.alpha * (0.7 + Math.sin(shape.pulsePhase * 0.6) * 0.3);
      this.bgGraphics.lineStyle(1, shape.color, alpha);
      const points: Phaser.Geom.Point[] = [];
      for (let i = 0; i < shape.sides; i++) {
        const angle = (Math.PI * 2 / shape.sides) * i + shape.rotation;
        points.push(new Phaser.Geom.Point(
          shape.x + shape.size * Math.cos(angle),
          shape.y + shape.size * Math.sin(angle),
        ));
      }
      this.bgGraphics.strokePoints(points, true);
    }

    // Sweeping scan line
    this.scanLineY += dt * 180;
    if (this.scanLineY > GAME.HEIGHT + 40) this.scanLineY = -40;
    this.scanLine.clear();
    this.scanLine.lineStyle(1.5, COLORS.ACCENT_CYAN, 0.12);
    this.scanLine.lineBetween(0, this.scanLineY, GAME.WIDTH, this.scanLineY);
    this.scanLine.lineStyle(0.8, COLORS.ACCENT_CYAN, 0.05);
    this.scanLine.lineBetween(0, this.scanLineY + 2, GAME.WIDTH, this.scanLineY + 2);
    this.scanLine.lineStyle(0.5, COLORS.ACCENT_CYAN, 0.02);
    this.scanLine.lineBetween(0, this.scanLineY + 4, GAME.WIDTH, this.scanLineY + 4);

    // Animated dividers
    const dividerAlpha = 0.25 + Math.sin(time * 0.003) * 0.12;
    this.dividerTop.clear();
    this.dividerTop.lineStyle(1, COLORS.ACCENT_CYAN, dividerAlpha);
    this.dividerTop.lineBetween(GAME.WIDTH / 2 - 200, 270, GAME.WIDTH / 2 + 200, 270);
    // Secondary thin line
    this.dividerTop.lineStyle(0.5, COLORS.ACCENT_PINK, dividerAlpha * 0.5);
    this.dividerTop.lineBetween(GAME.WIDTH / 2 - 140, 274, GAME.WIDTH / 2 + 140, 274);

    // Hovered button glow rings (rotating dashed circles)
    const ringAngle = time * 0.001;
    for (const btn of this.buttons) {
      btn.glowRing.clear();
      if (!btn.hovered) continue;

      const w = btn.width;
      const h = btn.height;
      // Pulsing outer glow frame
      const a = 0.18 + Math.sin(time * 0.005) * 0.08;
      btn.glowRing.lineStyle(2, btn.color, a);
      btn.glowRing.strokeRoundedRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6, 10);
      // Corner accents
      const cornerLen = 12;
      btn.glowRing.lineStyle(2, btn.color, a * 1.5);
      const corners = [
        { x: -w / 2 - 4, y: -h / 2 - 4, dx: 1, dy: 0 },
        { x: -w / 2 - 4, y: -h / 2 - 4, dx: 0, dy: 1 },
        { x: w / 2 + 4, y: -h / 2 - 4, dx: -1, dy: 0 },
        { x: w / 2 + 4, y: -h / 2 - 4, dx: 0, dy: 1 },
        { x: -w / 2 - 4, y: h / 2 + 4, dx: 1, dy: 0 },
        { x: -w / 2 - 4, y: h / 2 + 4, dx: 0, dy: -1 },
        { x: w / 2 + 4, y: h / 2 + 4, dx: -1, dy: 0 },
        { x: w / 2 + 4, y: h / 2 + 4, dx: 0, dy: -1 },
      ];
      for (const c of corners) {
        btn.glowRing.lineBetween(c.x, c.y, c.x + c.dx * cornerLen, c.y + c.dy * cornerLen);
      }
      // Swirling dot accent
      const dotX = Math.cos(ringAngle) * (w / 2 + 12);
      const dotY = Math.sin(ringAngle) * (h / 2 + 12);
      btn.glowRing.fillStyle(btn.color, 0.7);
      btn.glowRing.fillCircle(dotX, dotY, 2.5);
      btn.glowRing.fillStyle(0xffffff, 0.4);
      btn.glowRing.fillCircle(dotX, dotY, 1);
    }
  }

  private transitionTo(scene: string, data?: object): void {
    // Brief fade out before transitioning
    this.cameras.main.fadeOut(200, 8, 8, 15);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(scene, data);
    });
  }
}
