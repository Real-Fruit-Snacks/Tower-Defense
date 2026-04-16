import Phaser from 'phaser';
import { SCENES, COLORS, GAME } from '../constants';
import { createGlowText, drawNeonRect } from '../rendering/NeonEffects';
import { CHALLENGES } from '../data/challenges';
import type { ChallengeConfig } from '../types';
import { randomRange } from '../utils/MathUtils';

interface BgParticle {
  gfx: Phaser.GameObjects.Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

const FONT_FAMILY = 'Segoe UI, system-ui, sans-serif';
const FONT_MONO = 'monospace';
const HEADER_HEIGHT = 80;

/** Colors per difficulty rating */
const DIFFICULTY_COLORS: Record<number, number> = {
  1: COLORS.SUCCESS,
  2: COLORS.WIND,
  3: COLORS.GOLD,
  4: COLORS.ACCENT_PINK,
  5: COLORS.ACCENT_PURPLE,
};

export class ChallengeSelectScene extends Phaser.Scene {
  private bgParticles: BgParticle[] = [];
  private headerSeparator!: Phaser.GameObjects.Graphics;
  private scrollContainer!: Phaser.GameObjects.Container;
  private scrollOffset = 0;
  private maxScrollY = 0;
  private isDragging = false;
  private dragStartY = 0;
  private dragStartScroll = 0;

  constructor() {
    super(SCENES.CHALLENGE_SELECT);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.BG);
    this.bgParticles = [];
    this.scrollOffset = 0;

    this.createBackground();
    this.buildHeader();
    this.buildChallengeGrid();
    this.setupScrolling();
  }

  // ============ Background ============

  private createBackground(): void {
    const vignette = this.add.graphics().setDepth(-2);
    for (let i = 0; i < 12; i++) {
      const inset = i * 15;
      const alpha = 0.3 * (1 - i / 12);
      vignette.fillStyle(0x000000, alpha);
      vignette.fillRect(0, inset, GAME.WIDTH, GAME.HEIGHT - inset * 2);
      vignette.fillRect(inset, 0, GAME.WIDTH - inset * 2, GAME.HEIGHT);
    }

    const gridGfx = this.add.graphics().setDepth(-1);
    gridGfx.lineStyle(0.5, COLORS.ACCENT_PINK, 0.03);
    for (let x = 0; x < GAME.WIDTH; x += 50) {
      gridGfx.lineBetween(x, 0, x, GAME.HEIGHT);
    }
    for (let y = 0; y < GAME.HEIGHT; y += 50) {
      gridGfx.lineBetween(0, y, GAME.WIDTH, y);
    }

    const colors = [COLORS.ACCENT_PINK, COLORS.ACCENT_PURPLE, COLORS.GOLD, COLORS.DANGER];
    for (let i = 0; i < 20; i++) {
      const gfx = this.add.graphics().setDepth(-1);
      gfx.setBlendMode(Phaser.BlendModes.ADD);
      const color = colors[Math.floor(Math.random() * colors.length)] ?? COLORS.ACCENT_PINK;
      const alpha = randomRange(0.03, 0.07);
      gfx.fillStyle(color, alpha);
      gfx.fillCircle(0, 0, randomRange(1, 2.5));

      const x = randomRange(0, GAME.WIDTH);
      const y = randomRange(HEADER_HEIGHT, GAME.HEIGHT);
      gfx.setPosition(x, y);

      this.bgParticles.push({
        gfx, x, y,
        vx: randomRange(-8, 8),
        vy: randomRange(-5, 5),
      });
    }
  }

  // ============ Header ============

  private buildHeader(): void {
    const bg = this.add.graphics().setDepth(20);
    bg.fillGradientStyle(0x0e0e1a, 0x0e0e1a, 0x08080f, 0x08080f, 0.95, 0.95, 0.85, 0.85);
    bg.fillRect(0, 0, GAME.WIDTH, HEADER_HEIGHT);

    this.headerSeparator = this.add.graphics().setDepth(21);
    this.headerSeparator.setBlendMode(Phaser.BlendModes.ADD);

    createGlowText(this, GAME.WIDTH / 2, 28, 'CHALLENGES', COLORS.ACCENT_PINK, 24).setDepth(25);

    this.add.text(GAME.WIDTH / 2, 54, 'CUSTOM RULESETS WITH BIG SHARD REWARDS', {
      fontFamily: FONT_MONO,
      fontSize: 10,
      color: '#888',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(25).setLetterSpacing(2);

    this.createBackButton();
  }

  private createBackButton(): void {
    const btn = this.add.container(65, 40).setDepth(25);
    const bg = this.add.graphics();
    drawNeonRect(bg, -48, -16, 96, 32, COLORS.ACCENT_CYAN, 0.1, 6);
    btn.add(bg);

    const text = this.add.text(0, 0, '← BACK', {
      fontFamily: FONT_FAMILY,
      fontSize: 13,
      color: '#00ffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setLetterSpacing(2);
    btn.add(text);

    const hitArea = new Phaser.Geom.Rectangle(-48, -16, 96, 32);
    btn.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);

    btn.on('pointerover', () => {
      bg.clear();
      drawNeonRect(bg, -48, -16, 96, 32, COLORS.ACCENT_CYAN, 0.25, 6);
      this.tweens.add({ targets: btn, scaleX: 1.05, scaleY: 1.05, duration: 100 });
    });
    btn.on('pointerout', () => {
      bg.clear();
      drawNeonRect(bg, -48, -16, 96, 32, COLORS.ACCENT_CYAN, 0.1, 6);
      this.tweens.add({ targets: btn, scaleX: 1, scaleY: 1, duration: 100 });
    });
    btn.on('pointerdown', () => {
      this.scene.start(SCENES.MAIN_MENU);
    });
  }

  // ============ Challenge Grid ============

  private buildChallengeGrid(): void {
    this.scrollContainer = this.add.container(0, 0);
    this.scrollContainer.setDepth(10);

    // 2 columns of challenge cards
    const cols = 2;
    const cardW = 520;
    const cardH = 130;
    const gapX = 20;
    const gapY = 18;
    const totalW = cardW * cols + gapX * (cols - 1);
    const startX = (GAME.WIDTH - totalW) / 2;
    const startY = HEADER_HEIGHT + 24;

    const sortedChallenges = [...CHALLENGES].sort((a, b) => a.difficulty - b.difficulty);
    sortedChallenges.forEach((challenge, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (cardW + gapX);
      const y = startY + row * (cardH + gapY);
      const card = this.createChallengeCard(challenge, x, y, cardW, cardH);
      this.scrollContainer.add(card);
    });

    // Compute max scroll
    const totalRows = Math.ceil(CHALLENGES.length / cols);
    const contentHeight = totalRows * cardH + (totalRows - 1) * gapY;
    const visibleHeight = GAME.HEIGHT - HEADER_HEIGHT - 30;
    this.maxScrollY = Math.max(0, contentHeight - visibleHeight);
  }

  private createChallengeCard(
    challenge: ChallengeConfig,
    x: number, y: number, w: number, h: number,
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const difficultyColor = DIFFICULTY_COLORS[challenge.difficulty] ?? COLORS.GOLD;

    // Outer glow (ADD blend)
    const glow = this.add.graphics();
    glow.setBlendMode(Phaser.BlendModes.ADD);
    glow.fillStyle(difficultyColor, 0.04);
    glow.fillRoundedRect(-4, -4, w + 8, h + 8, 10);
    container.add(glow);

    // Main panel background
    const bg = this.add.graphics();
    bg.fillStyle(COLORS.UI_BG, 0.96);
    bg.fillRoundedRect(0, 0, w, h, 8);
    bg.lineStyle(1.5, difficultyColor, 0.7);
    bg.strokeRoundedRect(0, 0, w, h, 8);
    bg.lineStyle(0.5, difficultyColor, 0.25);
    bg.strokeRoundedRect(2, 2, w - 4, h - 4, 7);
    container.add(bg);

    // Left accent bar
    const accent = this.add.graphics();
    accent.fillStyle(difficultyColor, 0.9);
    accent.fillRect(0, 10, 3, h - 20);
    container.add(accent);

    // Challenge name
    const name = this.add.text(16, 12, challenge.name, {
      fontFamily: FONT_FAMILY,
      fontSize: 18,
      color: this.colorToHex(difficultyColor),
      fontStyle: 'bold',
    }).setLetterSpacing(2);
    container.add(name);

    // Difficulty stars
    const starsText = '★'.repeat(challenge.difficulty) + '☆'.repeat(5 - challenge.difficulty);
    const stars = this.add.text(w - 16, 16, starsText, {
      fontFamily: FONT_FAMILY,
      fontSize: 13,
      color: this.colorToHex(difficultyColor),
    }).setOrigin(1, 0).setLetterSpacing(1);
    container.add(stars);

    // Description (wrap to width)
    const desc = this.add.text(16, 42, challenge.description, {
      fontFamily: FONT_FAMILY,
      fontSize: 11,
      color: '#cccccc',
      wordWrap: { width: w - 32 },
      lineSpacing: 2,
    });
    container.add(desc);

    // Reward badge (bottom right)
    const rewardBg = this.add.graphics();
    rewardBg.fillStyle(COLORS.ACCENT_PURPLE, 0.15);
    rewardBg.fillRoundedRect(w - 110, h - 26, 96, 18, 4);
    rewardBg.lineStyle(0.8, COLORS.ACCENT_PURPLE, 0.5);
    rewardBg.strokeRoundedRect(w - 110, h - 26, 96, 18, 4);
    container.add(rewardBg);

    const rewardText = this.add.text(w - 62, h - 17, `+${challenge.shardReward} SHARDS`, {
      fontFamily: FONT_MONO,
      fontSize: 9,
      color: this.colorToHex(COLORS.ACCENT_PURPLE),
      fontStyle: 'bold',
    }).setOrigin(0.5).setLetterSpacing(1);
    container.add(rewardText);

    // Modifier tags (bottom-left, up to reward badge)
    const modifierLabels = challenge.modifiers
      .map(m => this.formatModifier(m))
      .filter(Boolean);

    const tagsMaxX = w - 118; // leave space for reward badge
    let tagX = 16;
    const tagY = h - 24;
    for (const label of modifierLabels) {
      const tagW = label.length * 6 + 12;
      if (tagX + tagW > tagsMaxX) break;

      const tagBg = this.add.graphics();
      tagBg.fillStyle(difficultyColor, 0.14);
      tagBg.fillRoundedRect(tagX, tagY, tagW, 16, 3);
      tagBg.lineStyle(0.5, difficultyColor, 0.4);
      tagBg.strokeRoundedRect(tagX, tagY, tagW, 16, 3);
      container.add(tagBg);

      const tagText = this.add.text(tagX + tagW / 2, tagY + 8, label, {
        fontFamily: FONT_MONO,
        fontSize: 9,
        color: this.colorToHex(difficultyColor),
        fontStyle: 'bold',
      }).setOrigin(0.5).setLetterSpacing(1);
      container.add(tagText);

      tagX += tagW + 6;
    }

    // Whole card is clickable — no separate button needed
    const cardHit = new Phaser.Geom.Rectangle(0, 0, w, h);
    container.setInteractive(cardHit, Phaser.Geom.Rectangle.Contains);

    container.on('pointerover', () => {
      this.input.setDefaultCursor('pointer');
      glow.clear();
      glow.fillStyle(difficultyColor, 0.12);
      glow.fillRoundedRect(-4, -4, w + 8, h + 8, 10);
      // Brighten the border
      bg.clear();
      bg.fillStyle(COLORS.UI_BG, 0.96);
      bg.fillRoundedRect(0, 0, w, h, 8);
      bg.lineStyle(2, difficultyColor, 1);
      bg.strokeRoundedRect(0, 0, w, h, 8);
      bg.lineStyle(0.5, difficultyColor, 0.4);
      bg.strokeRoundedRect(2, 2, w - 4, h - 4, 7);
      this.tweens.add({ targets: container, scaleX: 1.015, scaleY: 1.015, duration: 120, ease: 'Quad.easeOut' });
    });

    container.on('pointerout', () => {
      this.input.setDefaultCursor('default');
      glow.clear();
      glow.fillStyle(difficultyColor, 0.04);
      glow.fillRoundedRect(-4, -4, w + 8, h + 8, 10);
      bg.clear();
      bg.fillStyle(COLORS.UI_BG, 0.96);
      bg.fillRoundedRect(0, 0, w, h, 8);
      bg.lineStyle(1.5, difficultyColor, 0.7);
      bg.strokeRoundedRect(0, 0, w, h, 8);
      bg.lineStyle(0.5, difficultyColor, 0.25);
      bg.strokeRoundedRect(2, 2, w - 4, h - 4, 7);
      this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 120, ease: 'Quad.easeOut' });
    });

    container.on('pointerdown', () => {
      this.startChallenge(challenge);
    });

    return container;
  }

  private formatModifier(mod: ChallengeConfig['modifiers'][0]): string {
    switch (mod.type) {
      case 'ban_tower': return `NO ${mod.towerId.toUpperCase()}`;
      case 'ban_element': return `NO ${mod.element.toUpperCase()}`;
      case 'only_element': return `${mod.element.toUpperCase()} ONLY`;
      case 'enemy_hp_mult': return `${mod.value}× HP`;
      case 'enemy_speed_mult': return `${mod.value}× SPEED`;
      case 'starting_gold': return `${mod.value}G START`;
      case 'starting_hp': return mod.value === 1 ? '1 HP' : `${mod.value} HP`;
      case 'gold_mult': return `${mod.value}× GOLD`;
      case 'tower_limit': return `MAX ${mod.value} TOWERS`;
      case 'no_sell': return 'NO SELL';
      case 'no_upgrades': return 'NO UPGRADES';
      case 'wave_count': return `${mod.value} WAVES`;
      case 'force_layout': return `${mod.layout.replace('_', ' ').toUpperCase()}`;
      default: return '';
    }
  }

  private startChallenge(challenge: ChallengeConfig): void {
    this.cameras.main.flash(200, 255, 0, 85);
    this.time.delayedCall(150, () => {
      this.scene.start(SCENES.GAME, {
        mode: 'challenge',
        challenge,
      });
    });
  }

  // ============ Scrolling ============

  private setupScrolling(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.y < HEADER_HEIGHT + 5) return;
      this.isDragging = true;
      this.dragStartY = pointer.y;
      this.dragStartScroll = this.scrollOffset;
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.isDragging) return;
      const dy = pointer.y - this.dragStartY;
      this.scrollOffset = Phaser.Math.Clamp(this.dragStartScroll - dy, 0, this.maxScrollY);
      this.scrollContainer.setY(-this.scrollOffset);
    });

    this.input.on('pointerup', () => {
      this.isDragging = false;
    });

    this.input.on('wheel', (_p: Phaser.Input.Pointer, _gos: Phaser.GameObjects.GameObject[], _dx: number, deltaY: number) => {
      this.scrollOffset = Phaser.Math.Clamp(this.scrollOffset + deltaY * 0.5, 0, this.maxScrollY);
      this.scrollContainer.setY(-this.scrollOffset);
    });
  }

  // ============ Update ============

  update(time: number, delta: number): void {
    // Background particles
    for (const p of this.bgParticles) {
      p.x += p.vx * (delta / 1000);
      p.y += p.vy * (delta / 1000);
      if (p.x < -20) p.x = GAME.WIDTH + 20;
      if (p.x > GAME.WIDTH + 20) p.x = -20;
      if (p.y < HEADER_HEIGHT - 20) p.y = GAME.HEIGHT + 20;
      if (p.y > GAME.HEIGHT + 20) p.y = HEADER_HEIGHT - 20;
      p.gfx.setPosition(p.x, p.y);
    }

    // Header separator pulse
    this.headerSeparator.clear();
    const pulseAlpha = 0.25 + Math.sin(time * 0.003) * 0.12;
    this.headerSeparator.lineStyle(1.5, COLORS.ACCENT_PINK, pulseAlpha);
    this.headerSeparator.lineBetween(0, HEADER_HEIGHT, GAME.WIDTH, HEADER_HEIGHT);
    this.headerSeparator.lineStyle(0.5, COLORS.ACCENT_PINK, pulseAlpha * 0.3);
    this.headerSeparator.lineBetween(0, HEADER_HEIGHT + 1, GAME.WIDTH, HEADER_HEIGHT + 1);
  }

  private colorToHex(color: number): string {
    return '#' + color.toString(16).padStart(6, '0');
  }
}
