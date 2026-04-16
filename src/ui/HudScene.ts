import Phaser from 'phaser';
import { SCENES, COLORS, GAME } from '../constants';
import type { GameEvents, WaveDefinition } from '../types';
import { EventBus } from '../utils/EventBus';
import { UI } from './UIConstants';
import { WavePreview } from './WavePreview';

export class HudScene extends Phaser.Scene {
  private gameEvents!: EventBus<GameEvents>;
  // Left anchor (gold + HP)
  private goldIcon!: Phaser.GameObjects.Graphics;
  private hpIcon!: Phaser.GameObjects.Graphics;
  private goldText!: Phaser.GameObjects.Text;
  private hpText!: Phaser.GameObjects.Text;
  // Center anchor (wave + preview + start button)
  private waveText!: Phaser.GameObjects.Text;
  private startWaveBtn!: Phaser.GameObjects.Text;
  private wavePreview!: WavePreview;
  private startWavePulse?: Phaser.Tweens.Tween;
  // Right anchor (fullscreen, auto, speed)
  private speedText!: Phaser.GameObjects.Text;
  private speedBg!: Phaser.GameObjects.Graphics;
  private autoText!: Phaser.GameObjects.Text;
  private autoBg!: Phaser.GameObjects.Graphics;
  private fsBg!: Phaser.GameObjects.Graphics;
  private fsIconGfx!: Phaser.GameObjects.Graphics;
  private fsHitZone!: Phaser.GameObjects.Zone;
  // Background + separator (full-bleed)
  private hudBg!: Phaser.GameObjects.Graphics;
  private separatorLine!: Phaser.GameObjects.Graphics;

  private currentSpeed = 1;
  private autoStartEnabled = false;
  private onStartWave?: () => void;
  private onSetSpeed?: (speed: number) => void;
  private onToggleAutoStart?: (enabled: boolean) => void;
  private initialTotalWaves = 0;
  private resizeHandler!: () => void;

  constructor() {
    super(SCENES.HUD);
  }

  init(data: {
    events: EventBus<GameEvents>;
    gold: number;
    hp: number;
    wave: number;
    totalWaves: number;
    onStartWave: () => void;
    onSetSpeed: (speed: number) => void;
    onToggleAutoStart?: (enabled: boolean) => void;
    autoStart?: boolean;
  }): void {
    this.gameEvents = data.events;
    this.onStartWave = data.onStartWave;
    this.onSetSpeed = data.onSetSpeed;
    this.onToggleAutoStart = data.onToggleAutoStart;
    this.autoStartEnabled = data.autoStart ?? false;
    this.initialTotalWaves = data.totalWaves;
  }

  create(): void {
    // Full-bleed background + separator (re-drawn on resize via layout()).
    this.hudBg = this.add.graphics();
    this.separatorLine = this.add.graphics();
    this.separatorLine.setBlendMode(Phaser.BlendModes.ADD);

    // --- LEFT: Gold + HP (anchored to left edge) ---
    this.goldIcon = this.add.graphics();
    this.goldIcon.setBlendMode(Phaser.BlendModes.ADD);
    this.goldText = this.add.text(0, 14, '200', {
      fontFamily: UI.FONT_FAMILY,
      fontSize: 16,
      color: '#ffd700',
      fontStyle: 'bold',
    });

    this.hpIcon = this.add.graphics();
    this.hpIcon.setBlendMode(Phaser.BlendModes.ADD);
    this.hpText = this.add.text(0, 14, '20', {
      fontFamily: UI.FONT_FAMILY,
      fontSize: 16,
      color: '#ff4444',
      fontStyle: 'bold',
    });

    // --- CENTER: Wave counter + preview + Start Wave button ---
    const initialLabel = Number.isFinite(this.initialTotalWaves)
      ? `Wave 1/${this.initialTotalWaves}`
      : 'Wave 1';
    this.waveText = this.add.text(0, 12, initialLabel, {
      fontFamily: UI.FONT_FAMILY,
      fontSize: 14,
      color: '#00ffff',
    }).setOrigin(0.5, 0);

    this.wavePreview = new WavePreview(this, 0, 22);

    this.startWaveBtn = this.add.text(0, 30, '▶ START WAVE', {
      fontFamily: UI.FONT_FAMILY,
      fontSize: 11,
      color: '#4ade80',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    this.startWaveBtn.on('pointerdown', () => this.onStartWave?.());
    this.startWaveBtn.on('pointerover', () => this.startWaveBtn.setScale(1.1));
    this.startWaveBtn.on('pointerout', () => this.startWaveBtn.setScale(1));

    this.startWavePulse = this.tweens.add({
      targets: this.startWaveBtn,
      alpha: { from: 1, to: 0.4 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // --- RIGHT: fullscreen + AUTO + SPEED (anchored to right edge) ---
    const fsAvailable = this.scale.fullscreen.available;
    this.fsBg = this.add.graphics();
    this.fsIconGfx = this.add.graphics();
    this.fsIconGfx.setBlendMode(Phaser.BlendModes.ADD);
    this.fsHitZone = this.add.zone(0, 24, 34, 24).setOrigin(0.5, 0.5);
    if (fsAvailable) {
      this.fsHitZone.setInteractive({ useHandCursor: true });
      this.fsHitZone.on('pointerdown', () => {
        if (this.scale.isFullscreen) this.scale.stopFullscreen();
        else this.scale.startFullscreen();
        this.time.delayedCall(50, () => this.drawFsPill());
      });
      this.fsHitZone.on('pointerover', () => this.fsIconGfx.setScale(1.1));
      this.fsHitZone.on('pointerout', () => this.fsIconGfx.setScale(1));
    }

    this.autoBg = this.add.graphics();
    this.autoText = this.add.text(0, 15, 'AUTO', {
      fontFamily: UI.FONT_MONO,
      fontSize: 11,
      color: this.autoStartEnabled ? '#4ade80' : '#6a6a80',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true }).setLetterSpacing(1);
    this.autoText.on('pointerdown', () => {
      this.autoStartEnabled = !this.autoStartEnabled;
      this.refreshAutoVisual();
      this.onToggleAutoStart?.(this.autoStartEnabled);
    });
    this.autoText.on('pointerover', () => this.autoText.setScale(1.1));
    this.autoText.on('pointerout', () => this.autoText.setScale(1));

    this.speedBg = this.add.graphics();
    this.speedText = this.add.text(0, 15, '1x', {
      fontFamily: UI.FONT_MONO,
      fontSize: 14,
      color: '#4ade80',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    this.speedText.on('pointerdown', () => {
      this.currentSpeed = this.currentSpeed >= 3 ? 1 : this.currentSpeed + 1;
      this.speedText.setText(`${this.currentSpeed}x`);
      this.drawSpeedPill();
      this.onSetSpeed?.(this.currentSpeed);
    });
    this.speedText.on('pointerover', () => this.speedText.setScale(1.1));
    this.speedText.on('pointerout', () => this.speedText.setScale(1));

    // Initial layout + resize handling
    this.layout();
    this.resizeHandler = (): void => this.layout();
    this.scale.on('resize', this.resizeHandler);

    // Fullscreen pill sync
    const onFsChange = (): void => this.drawFsPill();
    this.scale.on('enterfullscreen', onFsChange);
    this.scale.on('leavefullscreen', onFsChange);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.resizeHandler);
      this.scale.off('enterfullscreen', onFsChange);
      this.scale.off('leavefullscreen', onFsChange);
    });

    // Subscribe to events
    this.gameEvents.on('GOLD_CHANGED', ({ gold, delta }) => {
      this.goldText.setText(`⬡ ${gold}`);
      this.tweens.add({
        targets: this.goldText,
        scaleX: 1.25, scaleY: 1.25,
        duration: 100, yoyo: true,
      });
      if (delta > 0) {
        this.goldText.setColor('#4ade80');
        this.time.delayedCall(200, () => this.goldText.setColor('#ffd700'));
      } else if (delta < 0) {
        this.goldText.setColor('#f87171');
        this.time.delayedCall(200, () => this.goldText.setColor('#ffd700'));
      }
    });

    this.gameEvents.on('HP_CHANGED', ({ hp, delta }) => {
      this.hpText.setText(`♥ ${hp}`);
      if (delta < 0) {
        this.tweens.add({
          targets: this.hpText,
          scaleX: 1.4, scaleY: 1.4,
          duration: 100, yoyo: true,
        });
        this.cameras.main.flash(200, 255, 0, 0);
      }
    });

    this.gameEvents.on('WAVE_START', () => {
      this.startWaveBtn.setVisible(false);
      this.startWavePulse?.pause();
    });

    this.gameEvents.on('WAVE_END', () => {
      this.startWaveBtn.setVisible(true);
      this.startWavePulse?.resume();
    });
  }

  /**
   * Position every element based on the *current* viewport size. Called
   * on create() and every resize. Left-anchored (gold/HP), centered
   * (wave block), and right-anchored (FS/AUTO/SPEED) regions stay at
   * their respective screen edges so the HUD always looks filled.
   */
  private layout(): void {
    const vw = this.scale.width;

    // --- Full-bleed background bar ---
    this.hudBg.clear();
    this.hudBg.fillGradientStyle(0x0e0e1a, 0x0e0e1a, 0x08080f, 0x08080f, 0.95, 0.95, 0.85, 0.85);
    this.hudBg.fillRect(0, 0, vw, GAME.HUD_HEIGHT);

    // --- LEFT anchor ---
    this.goldIcon.clear();
    this.drawHexIcon(this.goldIcon, 28, 22, 8, COLORS.GOLD);
    this.goldText.setPosition(42, 14);

    this.hpIcon.clear();
    this.drawHeartIcon(this.hpIcon, 158, 22, 7, COLORS.HP_RED);
    this.hpText.setPosition(170, 14);

    // --- CENTER anchor ---
    this.waveText.setPosition(vw / 2, 12);
    this.wavePreview.setPosition(vw / 2 + 80, 22);
    this.startWaveBtn.setPosition(vw / 2, 30);

    // --- RIGHT anchor ---
    // Speed pill: rightmost
    const speedBgX = vw - 72;
    this.drawSpeedPill(speedBgX);
    this.speedText.setPosition(vw - 52, 15);

    // AUTO pill: left of speed
    const autoBgX = vw - 134;
    this.drawAutoPill(autoBgX);
    this.autoText.setPosition(vw - 107, 15);

    // Fullscreen pill: left of AUTO
    const fsBgX = vw - 176;
    this.drawFsPill(fsBgX);
    this.fsHitZone.setPosition(fsBgX + 17, 24);
  }

  update(time: number, _delta: number): void {
    // Animated pulsing separator line — sized to full viewport width.
    const vw = this.scale.width;
    this.separatorLine.clear();
    const pulseAlpha = 0.25 + Math.sin(time * 0.003) * 0.12;
    this.separatorLine.lineStyle(1.5, COLORS.ACCENT_CYAN, pulseAlpha);
    this.separatorLine.lineBetween(0, GAME.HUD_HEIGHT, vw, GAME.HUD_HEIGHT);
    this.separatorLine.lineStyle(0.5, COLORS.ACCENT_CYAN, pulseAlpha * 0.3);
    this.separatorLine.lineBetween(0, GAME.HUD_HEIGHT + 1, vw, GAME.HUD_HEIGHT + 1);
  }

  private drawHexIcon(gfx: Phaser.GameObjects.Graphics, x: number, y: number, r: number, color: number): void {
    gfx.fillStyle(color, 0.2);
    gfx.fillCircle(x, y, r + 3);
    const points: Phaser.Geom.Point[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      points.push(new Phaser.Geom.Point(x + r * Math.cos(angle), y + r * Math.sin(angle)));
    }
    gfx.fillStyle(color, 0.5);
    gfx.fillPoints(points, true);
    gfx.lineStyle(1.5, color, 1);
    gfx.strokePoints(points, true);
    gfx.fillStyle(0xffffff, 0.4);
    gfx.fillCircle(x, y, r * 0.3);
  }

  private drawHeartIcon(gfx: Phaser.GameObjects.Graphics, x: number, y: number, r: number, color: number): void {
    gfx.fillStyle(color, 0.2);
    gfx.fillCircle(x, y, r + 3);
    gfx.fillStyle(color, 0.85);
    gfx.fillCircle(x - r * 0.45, y - r * 0.2, r * 0.55);
    gfx.fillCircle(x + r * 0.45, y - r * 0.2, r * 0.55);
    gfx.fillTriangle(
      x - r, y + r * 0.05,
      x + r, y + r * 0.05,
      x, y + r * 0.85,
    );
    gfx.fillStyle(0xffffff, 0.3);
    gfx.fillCircle(x - r * 0.5, y - r * 0.3, r * 0.25);
  }

  private drawSpeedPill(bgX?: number): void {
    const x = bgX ?? this.scale.width - 72;
    this.speedBg.clear();
    const intensity = this.currentSpeed === 1 ? 0.1 : this.currentSpeed === 2 ? 0.15 : 0.22;
    this.speedBg.fillStyle(COLORS.ACCENT_CYAN, intensity);
    this.speedBg.fillRoundedRect(x, 12, 40, 24, 6);
    this.speedBg.lineStyle(1, COLORS.ACCENT_CYAN, intensity + 0.15);
    this.speedBg.strokeRoundedRect(x, 12, 40, 24, 6);
  }

  private drawAutoPill(bgX?: number): void {
    const x = bgX ?? this.scale.width - 134;
    this.autoBg.clear();
    const color = this.autoStartEnabled ? COLORS.SUCCESS : COLORS.ACCENT_CYAN;
    const fillAlpha = this.autoStartEnabled ? 0.18 : 0.06;
    const strokeAlpha = this.autoStartEnabled ? 0.7 : 0.2;
    this.autoBg.fillStyle(color, fillAlpha);
    this.autoBg.fillRoundedRect(x, 12, 54, 24, 6);
    this.autoBg.lineStyle(1, color, strokeAlpha);
    this.autoBg.strokeRoundedRect(x, 12, 54, 24, 6);
  }

  private drawFsPill(bgX?: number): void {
    const x = bgX ?? this.scale.width - 176;
    const y = 12;
    const w = 34;
    const h = 24;
    const active = this.scale.isFullscreen;
    const color = active ? COLORS.SUCCESS : COLORS.ACCENT_CYAN;
    const fillAlpha = active ? 0.18 : 0.06;
    const strokeAlpha = active ? 0.7 : 0.2;

    this.fsBg.clear();
    this.fsBg.fillStyle(color, fillAlpha);
    this.fsBg.fillRoundedRect(x, y, w, h, 6);
    this.fsBg.lineStyle(1, color, strokeAlpha);
    this.fsBg.strokeRoundedRect(x, y, w, h, 6);

    this.fsIconGfx.clear();
    const cx = x + w / 2;
    const cy = y + h / 2;
    const r = 6;
    const l = 3;
    const strokeW = 1.5;
    const sign = active ? -1 : 1;
    this.fsIconGfx.lineStyle(strokeW, color, 1);
    // Four corner brackets (inward when fullscreen, outward otherwise).
    this.fsIconGfx.lineBetween(cx - r, cy - r, cx - r + sign * l, cy - r);
    this.fsIconGfx.lineBetween(cx - r, cy - r, cx - r, cy - r + sign * l);
    this.fsIconGfx.lineBetween(cx + r, cy - r, cx + r - sign * l, cy - r);
    this.fsIconGfx.lineBetween(cx + r, cy - r, cx + r, cy - r + sign * l);
    this.fsIconGfx.lineBetween(cx - r, cy + r, cx - r + sign * l, cy + r);
    this.fsIconGfx.lineBetween(cx - r, cy + r, cx - r, cy + r - sign * l);
    this.fsIconGfx.lineBetween(cx + r, cy + r, cx + r - sign * l, cy + r);
    this.fsIconGfx.lineBetween(cx + r, cy + r, cx + r, cy + r - sign * l);
  }

  private refreshAutoVisual(): void {
    this.drawAutoPill();
    this.autoText.setColor(this.autoStartEnabled ? '#4ade80' : '#6a6a80');
  }

  setAutoStart(enabled: boolean): void {
    if (this.autoStartEnabled === enabled) return;
    this.autoStartEnabled = enabled;
    this.refreshAutoVisual();
  }

  updateWaveDisplay(current: number, total: number): void {
    if (!Number.isFinite(total)) {
      this.waveText.setText(`Wave ${current}`);
    } else {
      this.waveText.setText(`Wave ${current}/${total}`);
    }
  }

  updateWavePreview(wave: WaveDefinition | undefined): void {
    this.wavePreview.showWave(wave);
  }

  showStartButton(visible: boolean): void {
    this.startWaveBtn.setVisible(visible);
  }
}
