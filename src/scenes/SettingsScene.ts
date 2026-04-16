import Phaser from 'phaser';
import { SCENES, COLORS, GAME } from '../constants';
import { createGlowText, drawNeonRect } from '../rendering/NeonEffects';
import { setupStageCamera } from '../utils/StageCamera';
import { randomRange } from '../utils/MathUtils';
import { audioManager } from '../systems/AudioManager';
import type { PersistentState } from '../roguelite/PersistentState';

const FONT_FAMILY = 'Segoe UI, system-ui, sans-serif';
const FONT_MONO = 'monospace';
const HEADER_HEIGHT = 80;

interface BgParticle {
  gfx: Phaser.GameObjects.Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/**
 * Settings menu — accessible from the main menu. Covers audio,
 * gameplay, display, save data, and build info. Volume changes apply
 * live to the audio manager and persist to the save file immediately.
 */
export class SettingsScene extends Phaser.Scene {
  private persistent!: PersistentState;
  private headerSeparator!: Phaser.GameObjects.Graphics;
  private bgParticles: BgParticle[] = [];

  constructor() {
    super(SCENES.SETTINGS);
  }

  create(): void {
    setupStageCamera(this);
    this.cameras.main.setBackgroundColor(COLORS.BG);
    this.persistent = this.game.registry.get('persistentState') as PersistentState;
    this.bgParticles = [];

    this.buildBackground();
    this.buildHeader();
    this.buildBody();

    this.cameras.main.flash(260, 0, 255, 255, true, undefined, 0.08);
  }

  // ============ Background / Header ============

  private buildBackground(): void {
    const vignette = this.add.graphics().setDepth(-2);
    for (let i = 0; i < 12; i++) {
      const inset = i * 15;
      const alpha = 0.3 * (1 - i / 12);
      vignette.fillStyle(0x000000, alpha);
      vignette.fillRect(0, inset, GAME.WIDTH, GAME.HEIGHT - inset * 2);
      vignette.fillRect(inset, 0, GAME.WIDTH - inset * 2, GAME.HEIGHT);
    }

    const grid = this.add.graphics().setDepth(-1);
    grid.lineStyle(0.5, COLORS.ACCENT_CYAN, 0.03);
    for (let x = 0; x < GAME.WIDTH; x += 50) {
      grid.lineBetween(x, 0, x, GAME.HEIGHT);
    }
    for (let y = 0; y < GAME.HEIGHT; y += 50) {
      grid.lineBetween(0, y, GAME.WIDTH, y);
    }

    const colors = [COLORS.ACCENT_CYAN, COLORS.ACCENT_PINK, COLORS.ACCENT_PURPLE, COLORS.GOLD];
    for (let i = 0; i < 22; i++) {
      const gfx = this.add.graphics().setDepth(-1);
      gfx.setBlendMode(Phaser.BlendModes.ADD);
      const color = colors[Math.floor(Math.random() * colors.length)] ?? COLORS.ACCENT_CYAN;
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
      });
    }
  }

  private buildHeader(): void {
    const bg = this.add.graphics().setDepth(20);
    bg.fillGradientStyle(0x0e0e1a, 0x0e0e1a, 0x08080f, 0x08080f, 0.95, 0.95, 0.85, 0.85);
    bg.fillRect(0, 0, GAME.WIDTH, HEADER_HEIGHT);

    this.headerSeparator = this.add.graphics().setDepth(21);
    this.headerSeparator.setBlendMode(Phaser.BlendModes.ADD);

    createGlowText(this, GAME.WIDTH / 2, 28, 'SETTINGS', COLORS.ACCENT_CYAN, 24).setDepth(25);
    this.add.text(GAME.WIDTH / 2, 54, 'PREFERENCES · DATA · INFO', {
      fontFamily: FONT_MONO,
      fontSize: 10,
      color: '#888',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(25).setLetterSpacing(3);

    this.buildBackButton();
  }

  private buildBackButton(): void {
    const btn = this.add.container(65, 40).setDepth(25);
    const bg = this.add.graphics();
    drawNeonRect(bg, -48, -16, 96, 32, COLORS.ACCENT_PINK, 0.1, 6);
    btn.add(bg);
    const text = this.add.text(0, 0, '← BACK', {
      fontFamily: FONT_FAMILY,
      fontSize: 13,
      color: '#ff0055',
      fontStyle: 'bold',
    }).setOrigin(0.5).setLetterSpacing(2);
    btn.add(text);

    btn.setInteractive(new Phaser.Geom.Rectangle(-48, -16, 96, 32), Phaser.Geom.Rectangle.Contains);
    btn.on('pointerover', () => {
      bg.clear();
      drawNeonRect(bg, -48, -16, 96, 32, COLORS.ACCENT_PINK, 0.25, 6);
      this.tweens.add({ targets: btn, scaleX: 1.05, scaleY: 1.05, duration: 100 });
    });
    btn.on('pointerout', () => {
      bg.clear();
      drawNeonRect(bg, -48, -16, 96, 32, COLORS.ACCENT_PINK, 0.1, 6);
      this.tweens.add({ targets: btn, scaleX: 1, scaleY: 1, duration: 100 });
    });
    btn.on('pointerdown', () => {
      this.cameras.main.fadeOut(200, 8, 8, 15);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(SCENES.MAIN_MENU));
    });
  }

  // ============ Body ============

  private buildBody(): void {
    const colW = 560;
    const col1X = GAME.WIDTH / 2 - colW - 24;
    const col2X = GAME.WIDTH / 2 + 24;
    let col1Y = HEADER_HEIGHT + 24;
    let col2Y = HEADER_HEIGHT + 24;

    // ── AUDIO (left column) ──
    col1Y = this.drawSectionHeader(col1X, col1Y, 'AUDIO', COLORS.WIND);
    col1Y = this.drawSlider(
      col1X, col1Y, colW,
      'Music Volume',
      this.persistent.saveManager.getData().settings.musicVolume ?? 0.7,
      (v) => {
        this.persistent.saveManager.updateSettings({ musicVolume: v });
        audioManager.setMasterVolume(v);
      },
      COLORS.WIND,
    ) + 16;
    col1Y = this.drawSlider(
      col1X, col1Y, colW,
      'SFX Volume',
      this.persistent.saveManager.getData().settings.sfxVolume ?? 0.8,
      (v) => {
        this.persistent.saveManager.updateSettings({ sfxVolume: v });
        audioManager.setSfxVolume(v);
        audioManager.playSFX('ui_click');
      },
      COLORS.WIND,
    ) + 24;

    // ── GAMEPLAY (left column, continued) ──
    col1Y = this.drawSectionHeader(col1X, col1Y, 'GAMEPLAY', COLORS.ACCENT_CYAN);
    col1Y = this.drawToggle(
      col1X, col1Y, colW,
      'Auto-Start Waves',
      'Automatically start the next wave 4s after each wave ends.',
      this.persistent.saveManager.getData().settings.autoStartWaves ?? false,
      (v) => this.persistent.saveManager.updateSettings({ autoStartWaves: v }),
      COLORS.SUCCESS,
    ) + 16;
    this.drawSegmented(
      col1X, col1Y, colW,
      'Default Game Speed',
      ['1x', '2x', '3x'],
      (this.persistent.saveManager.getData().settings.gameSpeed ?? 1) - 1,
      (i) => this.persistent.saveManager.updateSettings({ gameSpeed: i + 1 }),
      COLORS.ACCENT_CYAN,
    );

    // ── STATS (right column) ──
    col2Y = this.drawSectionHeader(col2X, col2Y, 'STATS', COLORS.GOLD);
    col2Y = this.drawStatsPanel(col2X, col2Y, colW) + 24;

    // ── DATA (right column) ──
    col2Y = this.drawSectionHeader(col2X, col2Y, 'DATA', COLORS.DANGER);
    col2Y = this.drawDangerButton(
      col2X, col2Y, colW,
      'DELETE ALL SAVE DATA',
      'Wipes shards, unlocks, campaign run, stats, and settings.',
      () => this.confirmDelete(),
    ) + 24;

    // ── INFO ──
    col2Y = this.drawSectionHeader(col2X, col2Y, 'INFO', COLORS.ACCENT_PURPLE);
    this.drawInfoPanel(col2X, col2Y, colW);
  }

  // ============ Widgets ============

  private drawSectionHeader(x: number, y: number, label: string, color: number): number {
    const textWidth = label.length * 10;
    // Colored accent bar
    const bar = this.add.graphics();
    bar.fillStyle(color, 0.9);
    bar.fillRect(x, y + 4, 3, 14);
    // Label
    this.add.text(x + 12, y, label, {
      fontFamily: FONT_MONO,
      fontSize: 13,
      color: this.colorToHex(color),
      fontStyle: 'bold',
    }).setLetterSpacing(3);
    // Right-side thin line
    const line = this.add.graphics();
    line.setBlendMode(Phaser.BlendModes.ADD);
    line.lineStyle(0.5, color, 0.3);
    const lineStart = x + 24 + textWidth;
    line.lineBetween(lineStart, y + 10, x + 540, y + 10);

    return y + 30;
  }

  /**
   * Horizontal slider. Returns the Y position after the widget so
   * callers can stack widgets vertically.
   */
  private drawSlider(
    x: number,
    y: number,
    w: number,
    label: string,
    initial: number,
    onChange: (value: number) => void,
    color: number,
  ): number {
    const clamped = Math.max(0, Math.min(1, initial));

    // Label (left) + percentage (right)
    const labelText = this.add.text(x, y, label, {
      fontFamily: FONT_FAMILY,
      fontSize: 13,
      color: '#e0e0e0',
    });
    const valueText = this.add.text(x + w - 8, y, `${Math.round(clamped * 100)}%`, {
      fontFamily: FONT_MONO,
      fontSize: 12,
      color: this.colorToHex(color),
      fontStyle: 'bold',
    }).setOrigin(1, 0);

    // Slider track
    const trackY = y + 28;
    const trackX = x;
    const trackW = w - 20;
    const trackH = 6;

    const trackBg = this.add.graphics();
    trackBg.fillStyle(0x1a1a2e, 1);
    trackBg.fillRoundedRect(trackX, trackY, trackW, trackH, 3);
    trackBg.lineStyle(0.5, color, 0.25);
    trackBg.strokeRoundedRect(trackX, trackY, trackW, trackH, 3);

    const fill = this.add.graphics();
    fill.setBlendMode(Phaser.BlendModes.ADD);
    const drawFill = (v: number): void => {
      fill.clear();
      const fw = Math.max(0, Math.min(trackW, trackW * v));
      if (fw <= 0) return;
      fill.fillStyle(color, 0.5);
      fill.fillRoundedRect(trackX, trackY, fw, trackH, 3);
      fill.fillStyle(color, 0.15);
      fill.fillRoundedRect(trackX - 2, trackY - 2, fw + 4, trackH + 4, 4);
    };
    drawFill(clamped);

    // Knob
    const knob = this.add.graphics();
    knob.setBlendMode(Phaser.BlendModes.ADD);
    const drawKnob = (v: number): void => {
      knob.clear();
      const kx = trackX + trackW * v;
      const ky = trackY + trackH / 2;
      knob.fillStyle(color, 0.2);
      knob.fillCircle(kx, ky, 14);
      knob.fillStyle(color, 0.6);
      knob.fillCircle(kx, ky, 8);
      knob.fillStyle(0xffffff, 0.9);
      knob.fillCircle(kx, ky, 3.5);
    };
    drawKnob(clamped);

    // Hit zone covering the whole row including knob travel
    const hitY = trackY - 14;
    const hitH = trackH + 28;
    const zone = this.add.zone(trackX, hitY, trackW, hitH)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true, draggable: true });

    let currentValue = clamped;
    const updateFromPointer = (pointer: Phaser.Input.Pointer): void => {
      const wp = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const rel = (wp.x - trackX) / trackW;
      const v = Math.max(0, Math.min(1, rel));
      currentValue = v;
      drawFill(v);
      drawKnob(v);
      valueText.setText(`${Math.round(v * 100)}%`);
      onChange(v);
    };
    zone.on('pointerdown', (pointer: Phaser.Input.Pointer) => updateFromPointer(pointer));
    zone.on('drag', (pointer: Phaser.Input.Pointer) => updateFromPointer(pointer));
    zone.on('pointerover', () => this.input.setDefaultCursor('pointer'));
    zone.on('pointerout', () => this.input.setDefaultCursor('default'));

    void labelText;
    void currentValue;

    return trackY + trackH + 14;
  }

  /**
   * Toggle switch widget. Returns Y after.
   */
  private drawToggle(
    x: number,
    y: number,
    w: number,
    label: string,
    subtitle: string,
    initial: boolean,
    onChange: (value: boolean) => void,
    color: number,
  ): number {
    let value = initial;

    this.add.text(x, y, label, {
      fontFamily: FONT_FAMILY,
      fontSize: 13,
      color: '#e0e0e0',
    });
    this.add.text(x, y + 18, subtitle, {
      fontFamily: FONT_FAMILY,
      fontSize: 10,
      color: '#888',
      wordWrap: { width: w - 100 },
    });

    // Switch on the right
    const sx = x + w - 70;
    const sy = y + 4;
    const sw = 50;
    const sh = 22;

    const bg = this.add.graphics();
    const knob = this.add.graphics();

    const redraw = (): void => {
      bg.clear();
      const c = value ? color : 0x444455;
      bg.fillStyle(c, value ? 0.22 : 0.18);
      bg.fillRoundedRect(sx, sy, sw, sh, 11);
      bg.lineStyle(1, c, value ? 0.75 : 0.35);
      bg.strokeRoundedRect(sx, sy, sw, sh, 11);

      knob.clear();
      const kx = value ? sx + sw - 13 : sx + 13;
      const ky = sy + sh / 2;
      knob.fillStyle(c, 0.3);
      knob.fillCircle(kx, ky, 11);
      knob.fillStyle(value ? 0xffffff : 0xaaaaaa, 0.95);
      knob.fillCircle(kx, ky, 7);
    };
    redraw();

    const hit = this.add.zone(sx, sy, sw, sh)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => {
      value = !value;
      redraw();
      onChange(value);
      audioManager.playSFX('ui_click');
    });

    return y + 32;
  }

  /**
   * Segmented control — 2..4 options displayed side-by-side.
   */
  private drawSegmented(
    x: number,
    y: number,
    w: number,
    label: string,
    options: string[],
    initialIndex: number,
    onChange: (index: number) => void,
    color: number,
  ): number {
    let currentIndex = initialIndex;
    this.add.text(x, y, label, {
      fontFamily: FONT_FAMILY,
      fontSize: 13,
      color: '#e0e0e0',
    });

    const segW = 60;
    const segH = 30;
    const gap = 4;
    const totalW = options.length * segW + (options.length - 1) * gap;
    const startX = x + w - totalW;
    const segY = y - 4;

    const bgs: Phaser.GameObjects.Graphics[] = [];
    const texts: Phaser.GameObjects.Text[] = [];

    const redraw = (): void => {
      options.forEach((_opt, i) => {
        const active = i === currentIndex;
        const bg = bgs[i]!;
        bg.clear();
        bg.fillStyle(color, active ? 0.22 : 0.05);
        bg.fillRoundedRect(startX + i * (segW + gap), segY, segW, segH, 5);
        bg.lineStyle(1, color, active ? 0.85 : 0.25);
        bg.strokeRoundedRect(startX + i * (segW + gap), segY, segW, segH, 5);
        texts[i]!.setColor(active ? this.colorToHex(color) : '#888');
      });
    };

    options.forEach((opt, i) => {
      const bg = this.add.graphics();
      bgs.push(bg);
      const txt = this.add.text(
        startX + i * (segW + gap) + segW / 2,
        segY + segH / 2,
        opt,
        {
          fontFamily: FONT_MONO,
          fontSize: 13,
          color: '#888',
          fontStyle: 'bold',
        },
      ).setOrigin(0.5);
      texts.push(txt);

      const hit = this.add.zone(startX + i * (segW + gap), segY, segW, segH)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => {
        currentIndex = i;
        redraw();
        onChange(i);
        audioManager.playSFX('ui_click');
      });
    });

    redraw();
    return y + segH + 4;
  }

  private drawStatsPanel(x: number, y: number, w: number): number {
    const data = this.persistent.saveManager.getData();
    const stats = data.stats;
    const shards = this.persistent.shardTracker.getShards();

    const panel = this.add.graphics();
    panel.fillStyle(COLORS.UI_BG, 0.8);
    panel.fillRoundedRect(x, y, w, 82, 6);
    panel.lineStyle(1, COLORS.GOLD, 0.4);
    panel.strokeRoundedRect(x, y, w, 82, 6);
    panel.lineStyle(0.5, COLORS.GOLD, 0.15);
    panel.strokeRoundedRect(x + 2, y + 2, w - 4, 78, 5);

    const items: { label: string; value: string; color: number }[] = [
      { label: 'SHARDS',     value: `${shards}`,                  color: COLORS.ACCENT_PURPLE },
      { label: 'RUNS',       value: `${stats.totalRuns}`,         color: COLORS.ACCENT_CYAN },
      { label: 'KILLS',      value: `${stats.totalKills}`,        color: COLORS.ACCENT_PINK },
      { label: 'HIGH WAVE',  value: `${stats.highestWave}`,       color: COLORS.GOLD },
    ];

    const colWidth = w / items.length;
    items.forEach((item, i) => {
      const cx = x + colWidth * (i + 0.5);
      this.add.text(cx, y + 22, item.value, {
        fontFamily: FONT_FAMILY,
        fontSize: 22,
        color: this.colorToHex(item.color),
        fontStyle: 'bold',
      }).setOrigin(0.5, 0.5);
      this.add.text(cx, y + 52, item.label, {
        fontFamily: FONT_MONO,
        fontSize: 9,
        color: this.colorToHex(item.color),
        fontStyle: 'bold',
      }).setOrigin(0.5, 0.5).setAlpha(0.65).setLetterSpacing(2);
    });

    return y + 82;
  }

  private drawDangerButton(
    x: number,
    y: number,
    w: number,
    label: string,
    subtitle: string,
    onClick: () => void,
  ): number {
    this.add.text(x, y, subtitle, {
      fontFamily: FONT_FAMILY,
      fontSize: 11,
      color: '#888',
      wordWrap: { width: w - 200 },
    });

    const btnX = x + w - 180;
    const btnY = y - 2;
    const btnW = 180;
    const btnH = 34;

    const bg = this.add.graphics();
    const drawBg = (alpha: number): void => {
      bg.clear();
      drawNeonRect(bg, btnX, btnY, btnW, btnH, COLORS.DANGER, alpha, 5);
    };
    drawBg(0.12);

    const text = this.add.text(btnX + btnW / 2, btnY + btnH / 2, label, {
      fontFamily: FONT_MONO,
      fontSize: 11,
      color: '#f87171',
      fontStyle: 'bold',
    }).setOrigin(0.5).setLetterSpacing(2);

    const hit = this.add.zone(btnX, btnY, btnW, btnH)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => {
      drawBg(0.3);
      this.tweens.add({ targets: [bg, text], scaleX: 1.03, scaleY: 1.03, duration: 100 });
    });
    hit.on('pointerout', () => {
      drawBg(0.12);
      this.tweens.add({ targets: [bg, text], scaleX: 1, scaleY: 1, duration: 100 });
    });
    hit.on('pointerdown', onClick);

    return y + btnH + 8;
  }

  private drawInfoPanel(x: number, y: number, w: number): number {
    const panel = this.add.graphics();
    panel.fillStyle(COLORS.UI_BG, 0.6);
    panel.fillRoundedRect(x, y, w, 54, 6);
    panel.lineStyle(0.5, COLORS.ACCENT_PURPLE, 0.3);
    panel.strokeRoundedRect(x, y, w, 54, 6);

    this.add.text(x + 14, y + 14, 'Tower Defense', {
      fontFamily: FONT_FAMILY,
      fontSize: 13,
      color: '#e0e0e0',
      fontStyle: 'bold',
    });
    this.add.text(x + 14, y + 32, 'v0.1.0 · Phaser 3 · TypeScript · Vite', {
      fontFamily: FONT_MONO,
      fontSize: 10,
      color: '#888',
    });

    // GitHub link (right-aligned)
    const linkText = this.add.text(x + w - 14, y + 26, 'GITHUB ↗', {
      fontFamily: FONT_MONO,
      fontSize: 11,
      color: '#a855f7',
      fontStyle: 'bold',
    }).setOrigin(1, 0.5).setLetterSpacing(2).setInteractive({ useHandCursor: true });
    linkText.on('pointerover', () => linkText.setAlpha(0.7));
    linkText.on('pointerout', () => linkText.setAlpha(1));
    linkText.on('pointerdown', () => {
      window.open('https://github.com/Real-Fruit-Snacks/Tower-Defense', '_blank');
    });

    return y + 54;
  }

  // ============ Delete data flow ============

  private confirmDelete(): void {
    const vw = GAME.WIDTH;
    const vh = GAME.HEIGHT;
    const modal = this.add.container(0, 0).setDepth(60);

    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.75);
    dim.fillRect(0, 0, vw, vh);
    dim.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, vw, vh),
      Phaser.Geom.Rectangle.Contains,
    );
    modal.add(dim);

    const pw = 460;
    const ph = 220;
    const px = (vw - pw) / 2;
    const py = (vh - ph) / 2;

    const panel = this.add.graphics();
    panel.fillStyle(COLORS.UI_BG, 0.98);
    panel.fillRoundedRect(px, py, pw, ph, 10);
    panel.lineStyle(2, COLORS.DANGER, 0.7);
    panel.strokeRoundedRect(px, py, pw, ph, 10);
    panel.lineStyle(0.5, COLORS.DANGER, 0.3);
    panel.strokeRoundedRect(px + 3, py + 3, pw - 6, ph - 6, 8);
    modal.add(panel);

    const title = this.add.text(vw / 2, py + 32, 'DELETE ALL SAVE DATA?', {
      fontFamily: FONT_FAMILY,
      fontSize: 20,
      color: '#f87171',
      fontStyle: 'bold',
    }).setOrigin(0.5).setLetterSpacing(3);
    modal.add(title);

    const body = this.add.text(
      vw / 2,
      py + 92,
      'This wipes EVERYTHING — shards, unlock tree,\ncampaign run, stats, and settings. Cannot be undone.',
      {
        fontFamily: FONT_FAMILY,
        fontSize: 12,
        color: '#cccccc',
        align: 'center',
        lineSpacing: 5,
      },
    ).setOrigin(0.5);
    modal.add(body);

    // YES, DELETE
    const yesBtn = this.add.container(vw / 2 - 90, py + ph - 40);
    const yesBg = this.add.graphics();
    drawNeonRect(yesBg, -70, -18, 140, 36, COLORS.DANGER, 0.2, 6);
    yesBtn.add(yesBg);
    const yesText = this.add.text(0, 0, 'YES, DELETE', {
      fontFamily: FONT_MONO,
      fontSize: 11,
      color: '#f87171',
      fontStyle: 'bold',
    }).setOrigin(0.5).setLetterSpacing(2);
    yesBtn.add(yesText);
    yesBtn.setInteractive(
      new Phaser.Geom.Rectangle(-70, -18, 140, 36),
      Phaser.Geom.Rectangle.Contains,
    );
    yesBtn.on('pointerover', () => {
      yesBg.clear();
      drawNeonRect(yesBg, -70, -18, 140, 36, COLORS.DANGER, 0.4, 6);
      this.tweens.add({ targets: yesBtn, scaleX: 1.05, scaleY: 1.05, duration: 100 });
    });
    yesBtn.on('pointerout', () => {
      yesBg.clear();
      drawNeonRect(yesBg, -70, -18, 140, 36, COLORS.DANGER, 0.2, 6);
      this.tweens.add({ targets: yesBtn, scaleX: 1, scaleY: 1, duration: 100 });
    });
    yesBtn.on('pointerdown', () => {
      this.persistent.saveManager.reset();
      // Re-sync audio after reset.
      const s = this.persistent.saveManager.getData().settings;
      audioManager.setMasterVolume(s.musicVolume);
      audioManager.setSfxVolume(s.sfxVolume);
      modal.destroy();
      this.cameras.main.flash(350, 255, 80, 80, true, undefined, 0.25);
      this.cameras.main.fadeOut(350, 8, 8, 15);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(SCENES.MAIN_MENU));
    });
    modal.add(yesBtn);

    // CANCEL
    const noBtn = this.add.container(vw / 2 + 90, py + ph - 40);
    const noBg = this.add.graphics();
    drawNeonRect(noBg, -70, -18, 140, 36, COLORS.ACCENT_CYAN, 0.1, 6);
    noBtn.add(noBg);
    const noText = this.add.text(0, 0, 'CANCEL', {
      fontFamily: FONT_MONO,
      fontSize: 11,
      color: '#00ffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setLetterSpacing(2);
    noBtn.add(noText);
    noBtn.setInteractive(
      new Phaser.Geom.Rectangle(-70, -18, 140, 36),
      Phaser.Geom.Rectangle.Contains,
    );
    noBtn.on('pointerover', () => {
      noBg.clear();
      drawNeonRect(noBg, -70, -18, 140, 36, COLORS.ACCENT_CYAN, 0.3, 6);
      this.tweens.add({ targets: noBtn, scaleX: 1.05, scaleY: 1.05, duration: 100 });
    });
    noBtn.on('pointerout', () => {
      noBg.clear();
      drawNeonRect(noBg, -70, -18, 140, 36, COLORS.ACCENT_CYAN, 0.1, 6);
      this.tweens.add({ targets: noBtn, scaleX: 1, scaleY: 1, duration: 100 });
    });
    noBtn.on('pointerdown', () => modal.destroy());
    modal.add(noBtn);

    modal.setAlpha(0);
    this.tweens.add({ targets: modal, alpha: 1, duration: 200, ease: 'Quad.easeOut' });
  }

  // ============ Update ============

  update(time: number, delta: number): void {
    for (const p of this.bgParticles) {
      p.x += p.vx * (delta / 1000);
      p.y += p.vy * (delta / 1000);
      if (p.x < -20) p.x = GAME.WIDTH + 20;
      if (p.x > GAME.WIDTH + 20) p.x = -20;
      if (p.y < HEADER_HEIGHT - 20) p.y = GAME.HEIGHT + 20;
      if (p.y > GAME.HEIGHT + 20) p.y = HEADER_HEIGHT - 20;
      p.gfx.setPosition(p.x, p.y);
    }

    this.headerSeparator.clear();
    const pulseAlpha = 0.25 + Math.sin(time * 0.003) * 0.12;
    this.headerSeparator.lineStyle(1.5, COLORS.ACCENT_CYAN, pulseAlpha);
    this.headerSeparator.lineBetween(0, HEADER_HEIGHT, GAME.WIDTH, HEADER_HEIGHT);
    this.headerSeparator.lineStyle(0.5, COLORS.ACCENT_CYAN, pulseAlpha * 0.3);
    this.headerSeparator.lineBetween(0, HEADER_HEIGHT + 1, GAME.WIDTH, HEADER_HEIGHT + 1);
  }

  private colorToHex(color: number): string {
    return '#' + color.toString(16).padStart(6, '0');
  }
}
