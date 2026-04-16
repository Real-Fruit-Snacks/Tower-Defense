import Phaser from 'phaser';
import { SCENES, COLORS, GAME } from '../constants';
import { createGlowText, drawNeonRect } from '../rendering/NeonEffects';
import { ShapeRenderer } from '../rendering/ShapeRenderer';
import { setupStageCamera } from '../utils/StageCamera';
import { randomRange } from '../utils/MathUtils';
import type { PersistentState } from '../roguelite/PersistentState';

const FONT_FAMILY = 'Segoe UI, system-ui, sans-serif';
const FONT_MONO = 'monospace';
const HEADER_HEIGHT = 80;

type ItemIcon = 'heart' | 'coin' | 'double' | 'cross';

interface ShopItem {
  id: string;
  name: string;
  description: string;
  cost: number;
  color: number;
  icon: ItemIcon;
  apply: (persistent: PersistentState) => void;
}

interface BgParticle {
  gfx: Phaser.GameObjects.Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: number;
}

interface CardRef {
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  glow: Phaser.GameObjects.Graphics;
  iconGfx: Phaser.GameObjects.Graphics;
  priceText: Phaser.GameObjects.Text;
  buyBg: Phaser.GameObjects.Graphics;
  buyText: Phaser.GameObjects.Text;
  item: ShopItem;
  sold: boolean;
}

export class ShopScene extends Phaser.Scene {
  private persistent!: PersistentState;
  private bgParticles: BgParticle[] = [];
  private headerSeparator!: Phaser.GameObjects.Graphics;
  private shardText!: Phaser.GameObjects.Text;
  private cards: CardRef[] = [];

  constructor() {
    super(SCENES.SHOP);
  }

  create(): void {
    setupStageCamera(this);
    this.cameras.main.setBackgroundColor(COLORS.BG);
    this.persistent = this.game.registry.get('persistentState') as PersistentState;
    this.bgParticles = [];
    this.cards = [];

    this.createBackground();
    this.createHeader();
    this.createCards();
    this.createFooter();

    this.cameras.main.flash(280, 255, 215, 0, true, undefined, 0.08);
  }

  // ============ Background ============

  private createBackground(): void {
    const vignette = this.add.graphics().setDepth(-2);
    for (let i = 0; i < 14; i++) {
      const inset = i * 14;
      const alpha = 0.3 * (1 - i / 14);
      vignette.fillStyle(0x000000, alpha);
      vignette.fillRect(0, inset, GAME.WIDTH, GAME.HEIGHT - inset * 2);
      vignette.fillRect(inset, 0, GAME.WIDTH - inset * 2, GAME.HEIGHT);
    }

    const gridGfx = this.add.graphics().setDepth(-1);
    gridGfx.lineStyle(0.5, COLORS.GOLD, 0.03);
    for (let x = 0; x < GAME.WIDTH; x += 50) {
      gridGfx.lineBetween(x, 0, x, GAME.HEIGHT);
    }
    for (let y = 0; y < GAME.HEIGHT; y += 50) {
      gridGfx.lineBetween(0, y, GAME.WIDTH, y);
    }

    // Gold-tinted atmospheric particles
    const colors = [COLORS.GOLD, COLORS.ACCENT_PURPLE, COLORS.ACCENT_CYAN, COLORS.SUCCESS];
    for (let i = 0; i < 28; i++) {
      const gfx = this.add.graphics().setDepth(-1);
      gfx.setBlendMode(Phaser.BlendModes.ADD);
      const color = colors[Math.floor(Math.random() * colors.length)] ?? COLORS.GOLD;
      const alpha = randomRange(0.03, 0.08);
      gfx.fillStyle(color, alpha);
      gfx.fillCircle(0, 0, randomRange(1, 2.5));

      const x = randomRange(0, GAME.WIDTH);
      const y = randomRange(HEADER_HEIGHT, GAME.HEIGHT);
      gfx.setPosition(x, y);

      this.bgParticles.push({
        gfx, x, y,
        vx: randomRange(-8, 8),
        vy: randomRange(-5, 5),
        color,
      });
    }
  }

  // ============ Header ============

  private createHeader(): void {
    const bg = this.add.graphics().setDepth(20);
    bg.fillGradientStyle(0x1a1200, 0x1a1200, 0x08080f, 0x08080f, 0.95, 0.95, 0.85, 0.85);
    bg.fillRect(0, 0, GAME.WIDTH, HEADER_HEIGHT);

    this.headerSeparator = this.add.graphics().setDepth(21);
    this.headerSeparator.setBlendMode(Phaser.BlendModes.ADD);

    createGlowText(this, GAME.WIDTH / 2, 28, 'SHOP', COLORS.GOLD, 26).setDepth(25);
    this.add.text(GAME.WIDTH / 2, 54, 'SPEND YOUR SHARDS', {
      fontFamily: FONT_MONO,
      fontSize: 10,
      color: '#888',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(25).setLetterSpacing(3);

    // Shard balance (right side, HUD-style)
    const shards = this.persistent.shardTracker.getShards();
    this.shardText = this.add.text(GAME.WIDTH - 30, 32, `◈ ${shards}`, {
      fontFamily: FONT_FAMILY,
      fontSize: 22,
      color: '#a855f7',
      fontStyle: 'bold',
    }).setOrigin(1, 0.5).setDepth(25);
    this.add.text(GAME.WIDTH - 30, 56, 'SHARDS', {
      fontFamily: FONT_MONO,
      fontSize: 9,
      color: '#a855f7',
      fontStyle: 'bold',
    }).setOrigin(1, 0.5).setDepth(25).setAlpha(0.6).setLetterSpacing(2);

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

    btn.setInteractive(new Phaser.Geom.Rectangle(-48, -16, 96, 32), Phaser.Geom.Rectangle.Contains);
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
    btn.on('pointerdown', () => this.continueToMap());
  }

  // ============ Cards ============

  private createCards(): void {
    const items: ShopItem[] = [
      {
        id: 'repair',
        name: 'Repair Kit',
        description: 'Restore 5 HP to your campaign run.',
        cost: 30,
        color: COLORS.SUCCESS,
        icon: 'heart',
        apply: (p) => {
          const data = p.saveManager.getData();
          data.campaignProgress.hp = Math.min(data.campaignProgress.hp + 5, 25);
          p.saveManager.save();
        },
      },
      {
        id: 'free_shards',
        name: 'Gold Cache',
        description: 'A small stash of shards, on the house.',
        cost: 0,
        color: COLORS.GOLD,
        icon: 'coin',
        apply: (p) => { p.shardTracker.addShards(50); },
      },
      {
        id: 'doubler',
        name: 'Shard Doubler',
        description: 'Double shard rewards for the rest of this run.',
        cost: 80,
        color: COLORS.ACCENT_PURPLE,
        icon: 'double',
        apply: () => {
          // Placeholder — tie into run-level multiplier when implemented.
        },
      },
      {
        id: 'full_heal',
        name: 'Full Heal',
        description: 'Restore all HP for your current run.',
        cost: 60,
        color: COLORS.ACCENT_CYAN,
        icon: 'cross',
        apply: (p) => {
          const data = p.saveManager.getData();
          data.campaignProgress.hp = 25;
          p.saveManager.save();
        },
      },
    ];

    // 2×2 grid centered. Card size tuned so everything breathes.
    const cols = 2;
    const cardW = 440;
    const cardH = 170;
    const gapX = 32;
    const gapY = 26;
    const totalW = cardW * cols + gapX * (cols - 1);
    const startX = (GAME.WIDTH - totalW) / 2;
    const startY = HEADER_HEIGHT + 40;

    items.forEach((item, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (cardW + gapX);
      const y = startY + row * (cardH + gapY);
      this.cards.push(this.createCard(item, x, y, cardW, cardH));
    });
  }

  private createCard(item: ShopItem, x: number, y: number, w: number, h: number): CardRef {
    const container = this.add.container(x, y);

    // Outer glow (ADD blend)
    const glow = this.add.graphics();
    glow.setBlendMode(Phaser.BlendModes.ADD);
    glow.fillStyle(item.color, 0.04);
    glow.fillRoundedRect(-4, -4, w + 8, h + 8, 10);
    container.add(glow);

    // Main panel
    const bg = this.add.graphics();
    this.drawCardBg(bg, w, h, item.color, false, 'idle');
    container.add(bg);

    // Left accent bar
    const accent = this.add.graphics();
    accent.fillStyle(item.color, 0.9);
    accent.fillRect(0, 12, 3, h - 24);
    container.add(accent);

    // Icon circle
    const iconGfx = this.add.graphics();
    this.drawIcon(iconGfx, 46, 54, item.icon, item.color);
    container.add(iconGfx);

    // Name
    const name = this.add.text(90, 20, item.name, {
      fontFamily: FONT_FAMILY,
      fontSize: 18,
      color: this.colorToHex(item.color),
      fontStyle: 'bold',
    }).setLetterSpacing(1);
    container.add(name);

    // Description (wrap)
    const desc = this.add.text(90, 46, item.description, {
      fontFamily: FONT_FAMILY,
      fontSize: 12,
      color: '#cccccc',
      wordWrap: { width: w - 120 },
      lineSpacing: 2,
    });
    container.add(desc);

    // Price pill (bottom-left)
    const canAfford = item.cost === 0 || this.persistent.shardTracker.canAfford(item.cost);
    const priceText = this.add.text(
      18,
      h - 30,
      item.cost === 0 ? 'FREE' : `◈ ${item.cost}`,
      {
        fontFamily: FONT_MONO,
        fontSize: 14,
        color: item.cost === 0
          ? '#4ade80'
          : (canAfford ? '#a855f7' : '#f87171'),
        fontStyle: 'bold',
      },
    );
    container.add(priceText);

    // BUY button (bottom-right)
    const buyW = 88;
    const buyH = 32;
    const buyX = w - buyW - 16;
    const buyY = h - buyH - 16;

    const buyBg = this.add.graphics();
    this.drawBuyBg(buyBg, buyX, buyY, buyW, buyH, item.color, false, canAfford);
    container.add(buyBg);

    const buyText = this.add.text(buyX + buyW / 2, buyY + buyH / 2, canAfford ? 'BUY' : 'LOCKED', {
      fontFamily: FONT_MONO,
      fontSize: 12,
      color: canAfford ? this.colorToHex(item.color) : '#666',
      fontStyle: 'bold',
    }).setOrigin(0.5).setLetterSpacing(2);
    container.add(buyText);

    const card: CardRef = {
      container,
      bg,
      glow,
      iconGfx,
      priceText,
      buyBg,
      buyText,
      item,
      sold: false,
    };

    // Interactivity on the whole card
    container.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, w, h),
      Phaser.Geom.Rectangle.Contains,
    );

    container.on('pointerover', () => {
      if (card.sold) return;
      this.input.setDefaultCursor(card.sold ? 'default' : 'pointer');
      this.drawCardBg(bg, w, h, item.color, false, 'hover');
      glow.clear();
      glow.fillStyle(item.color, 0.14);
      glow.fillRoundedRect(-6, -6, w + 12, h + 12, 12);
      this.tweens.add({ targets: container, scaleX: 1.015, scaleY: 1.015, duration: 120 });
    });
    container.on('pointerout', () => {
      this.input.setDefaultCursor('default');
      if (card.sold) return;
      this.drawCardBg(bg, w, h, item.color, false, 'idle');
      glow.clear();
      glow.fillStyle(item.color, 0.04);
      glow.fillRoundedRect(-4, -4, w + 8, h + 8, 10);
      this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 120 });
    });
    container.on('pointerdown', () => this.purchaseItem(card, w, h));

    return card;
  }

  private drawCardBg(
    bg: Phaser.GameObjects.Graphics,
    w: number,
    h: number,
    color: number,
    sold: boolean,
    state: 'idle' | 'hover',
  ): void {
    bg.clear();
    // Subtle gradient panel
    bg.fillGradientStyle(0x0e0e18, 0x0e0e18, 0x080810, 0x080810, 0.96, 0.96, 0.96, 0.96);
    bg.fillRoundedRect(0, 0, w, h, 8);
    // Border
    const borderAlpha = sold ? 0.3 : (state === 'hover' ? 1 : 0.7);
    const borderW = state === 'hover' ? 2 : 1.5;
    bg.lineStyle(borderW, color, borderAlpha);
    bg.strokeRoundedRect(0, 0, w, h, 8);
    // Inner highlight line
    bg.lineStyle(0.5, color, sold ? 0.1 : 0.25);
    bg.strokeRoundedRect(2, 2, w - 4, h - 4, 7);
  }

  private drawBuyBg(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    color: number,
    sold: boolean,
    canAfford: boolean,
  ): void {
    g.clear();
    const col = sold ? 0x666677 : (canAfford ? color : 0x444466);
    g.fillStyle(col, sold ? 0.1 : (canAfford ? 0.18 : 0.08));
    g.fillRoundedRect(x, y, w, h, 6);
    g.lineStyle(1, col, sold ? 0.25 : (canAfford ? 0.7 : 0.3));
    g.strokeRoundedRect(x, y, w, h, 6);
  }

  private purchaseItem(card: CardRef, w: number, h: number): void {
    if (card.sold) return;
    const item = card.item;

    if (item.cost > 0) {
      if (!this.persistent.shardTracker.canAfford(item.cost)) {
        // Flash red briefly to indicate "can't afford"
        this.cameras.main.flash(150, 255, 60, 60, true, undefined, 0.08);
        this.tweens.add({
          targets: card.container,
          x: { from: card.container.x - 4, to: card.container.x + 4 },
          duration: 50, yoyo: true, repeat: 2, ease: 'Sine.easeInOut',
        });
        return;
      }
      this.persistent.shardTracker.spendShards(item.cost);
    }

    item.apply(this.persistent);
    card.sold = true;

    // Visual sold-out state
    this.drawCardBg(card.bg, w, h, item.color, true, 'idle');
    card.glow.clear();
    card.container.setAlpha(0.6);
    const buyW = 88;
    const buyH = 32;
    const buyX = w - buyW - 16;
    const buyY = h - buyH - 16;
    this.drawBuyBg(card.buyBg, buyX, buyY, buyW, buyH, item.color, true, false);
    card.buyText.setText('SOLD');
    card.buyText.setColor('#888');
    card.container.disableInteractive();

    // Update shard display
    this.shardText.setText(`◈ ${this.persistent.shardTracker.getShards()}`);

    // Purchase feedback: camera flash + particles
    const flashColor = item.color;
    this.cameras.main.flash(
      180,
      (flashColor >> 16) & 0xff,
      (flashColor >> 8) & 0xff,
      flashColor & 0xff,
      true,
      undefined,
      0.15,
    );

    // Particle burst at card center
    const centerX = card.container.x + w / 2;
    const centerY = card.container.y + h / 2;
    for (let i = 0; i < 14; i++) {
      const angle = (Math.PI * 2 * i) / 14 + randomRange(-0.1, 0.1);
      const speed = randomRange(80, 160);
      const p = this.add.graphics().setDepth(50);
      p.setBlendMode(Phaser.BlendModes.ADD);
      p.fillStyle(i % 2 === 0 ? COLORS.GOLD : item.color, 0.9);
      p.fillCircle(0, 0, randomRange(2, 3));
      p.setPosition(centerX, centerY);
      this.tweens.add({
        targets: p,
        x: centerX + Math.cos(angle) * speed * 0.6,
        y: centerY + Math.sin(angle) * speed * 0.6,
        alpha: 0,
        duration: randomRange(400, 700),
        ease: 'Quad.easeOut',
        onComplete: () => p.destroy(),
      });
    }

    // Shard-count pulse
    this.tweens.add({
      targets: this.shardText,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 120,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }

  // ============ Item icons ============

  private drawIcon(g: Phaser.GameObjects.Graphics, cx: number, cy: number, icon: ItemIcon, color: number): void {
    // Soft halo
    g.setBlendMode(Phaser.BlendModes.ADD);
    g.fillStyle(color, 0.18);
    g.fillCircle(cx, cy, 26);
    g.fillStyle(color, 0.08);
    g.fillCircle(cx, cy, 32);

    // Base ring
    g.setBlendMode(Phaser.BlendModes.NORMAL);
    g.fillStyle(0x0e0e18, 0.9);
    g.fillCircle(cx, cy, 22);
    g.lineStyle(1.5, color, 0.75);
    g.strokeCircle(cx, cy, 22);
    g.lineStyle(0.5, color, 0.3);
    g.strokeCircle(cx, cy, 19);

    g.fillStyle(color, 1);
    switch (icon) {
      case 'heart': {
        // Heart made of two circles + triangle
        const r = 6;
        g.fillCircle(cx - r * 0.55, cy - r * 0.25, r * 0.65);
        g.fillCircle(cx + r * 0.55, cy - r * 0.25, r * 0.65);
        g.fillTriangle(cx - r * 1.1, cy + 0, cx + r * 1.1, cy + 0, cx, cy + r * 1.2);
        break;
      }
      case 'coin': {
        // Hexagon coin with inner highlight
        const points: Phaser.Geom.Point[] = [];
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI / 3) * i - Math.PI / 6;
          points.push(new Phaser.Geom.Point(cx + Math.cos(a) * 10, cy + Math.sin(a) * 10));
        }
        g.fillPoints(points, true);
        g.fillStyle(0xffffff, 0.4);
        g.fillCircle(cx, cy, 3);
        break;
      }
      case 'double': {
        // Two overlapping diamonds suggesting "×2"
        ShapeRenderer.drawDiamond(g, cx - 4, cy, 8, color, 1, color, 1);
        ShapeRenderer.drawDiamond(g, cx + 4, cy, 8, color, 1, color, 1);
        break;
      }
      case 'cross': {
        // Medical plus sign
        const a = 3;  // arm half-thickness
        const l = 9;  // arm length
        g.fillRect(cx - a, cy - l, a * 2, l * 2);
        g.fillRect(cx - l, cy - a, l * 2, a * 2);
        break;
      }
    }
  }

  // ============ Footer ============

  private createFooter(): void {
    const btn = this.add.container(GAME.WIDTH / 2, GAME.HEIGHT - 48).setDepth(25);
    const bg = this.add.graphics();
    drawNeonRect(bg, -90, -20, 180, 40, COLORS.ACCENT_CYAN, 0.12, 8);
    btn.add(bg);
    const text = this.add.text(0, 0, 'CONTINUE  →', {
      fontFamily: FONT_FAMILY,
      fontSize: 15,
      color: '#00ffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setLetterSpacing(3);
    btn.add(text);

    btn.setInteractive(new Phaser.Geom.Rectangle(-90, -20, 180, 40), Phaser.Geom.Rectangle.Contains);
    btn.on('pointerover', () => {
      this.input.setDefaultCursor('pointer');
      bg.clear();
      drawNeonRect(bg, -90, -20, 180, 40, COLORS.ACCENT_CYAN, 0.28, 8);
      this.tweens.add({ targets: btn, scaleX: 1.05, scaleY: 1.05, duration: 120 });
    });
    btn.on('pointerout', () => {
      this.input.setDefaultCursor('default');
      bg.clear();
      drawNeonRect(bg, -90, -20, 180, 40, COLORS.ACCENT_CYAN, 0.12, 8);
      this.tweens.add({ targets: btn, scaleX: 1, scaleY: 1, duration: 120 });
    });
    btn.on('pointerdown', () => this.continueToMap());
  }

  private continueToMap(): void {
    this.cameras.main.fadeOut(220, 8, 8, 15);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(SCENES.WORLD_MAP));
  }

  // ============ Update loop ============

  update(time: number, delta: number): void {
    // Float background particles
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
    this.headerSeparator.lineStyle(1.5, COLORS.GOLD, pulseAlpha);
    this.headerSeparator.lineBetween(0, HEADER_HEIGHT, GAME.WIDTH, HEADER_HEIGHT);
    this.headerSeparator.lineStyle(0.5, COLORS.GOLD, pulseAlpha * 0.3);
    this.headerSeparator.lineBetween(0, HEADER_HEIGHT + 1, GAME.WIDTH, HEADER_HEIGHT + 1);
  }

  private colorToHex(color: number): string {
    return '#' + color.toString(16).padStart(6, '0');
  }
}
