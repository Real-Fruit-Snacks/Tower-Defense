import Phaser from 'phaser';
import { SCENES, COLORS, GAME } from '../constants';
import type { GameEvents, WaveDefinition } from '../types';
import { EventBus } from '../utils/EventBus';
import { UI } from './UIConstants';
import { WavePreview } from './WavePreview';

export class HudScene extends Phaser.Scene {
  private gameEvents!: EventBus<GameEvents>;
  private goldText!: Phaser.GameObjects.Text;
  private hpText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private startWaveBtn!: Phaser.GameObjects.Text;
  private speedText!: Phaser.GameObjects.Text;
  private speedBg!: Phaser.GameObjects.Graphics;
  private separatorLine!: Phaser.GameObjects.Graphics;
  private wavePreview!: WavePreview;
  private startWavePulse?: Phaser.Tweens.Tween;
  private currentSpeed = 1;
  private onStartWave?: () => void;
  private onSetSpeed?: (speed: number) => void;
  private initialTotalWaves = 0;

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
  }): void {
    this.gameEvents = data.events;
    this.onStartWave = data.onStartWave;
    this.onSetSpeed = data.onSetSpeed;
    this.initialTotalWaves = data.totalWaves;
  }

  create(): void {
    // Gradient background bar
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0e0e1a, 0x0e0e1a, 0x08080f, 0x08080f, 0.95, 0.95, 0.85, 0.85);
    bg.fillRect(0, 0, GAME.WIDTH, GAME.HUD_HEIGHT);

    // Animated separator line (pulsing neon)
    this.separatorLine = this.add.graphics();
    this.separatorLine.setBlendMode(Phaser.BlendModes.ADD);

    // Gold icon (drawn hexagon)
    const goldIcon = this.add.graphics();
    goldIcon.setBlendMode(Phaser.BlendModes.ADD);
    this.drawHexIcon(goldIcon, 28, 22, 8, COLORS.GOLD);

    // Gold number
    this.goldText = this.add.text(42, 14, '200', {
      fontFamily: UI.FONT_FAMILY,
      fontSize: 16,
      color: '#ffd700',
      fontStyle: 'bold',
    });

    // HP icon (drawn heart via triangle shape)
    const hpIcon = this.add.graphics();
    hpIcon.setBlendMode(Phaser.BlendModes.ADD);
    this.drawHeartIcon(hpIcon, 158, 22, 7, COLORS.HP_RED);

    // HP number
    this.hpText = this.add.text(170, 14, '20', {
      fontFamily: UI.FONT_FAMILY,
      fontSize: 16,
      color: '#ff4444',
      fontStyle: 'bold',
    });

    // Wave counter
    const initialLabel = Number.isFinite(this.initialTotalWaves)
      ? `Wave 1/${this.initialTotalWaves}`
      : 'Wave 1';
    this.waveText = this.add.text(GAME.WIDTH / 2, 12, initialLabel, {
      fontFamily: UI.FONT_FAMILY,
      fontSize: 14,
      color: '#00ffff',
    }).setOrigin(0.5, 0);

    // Wave preview (right of wave counter, in the empty HUD space)
    this.wavePreview = new WavePreview(this, GAME.WIDTH / 2 + 80, 22);

    // Start wave button with pulsing glow
    this.startWaveBtn = this.add.text(GAME.WIDTH / 2, 30, '▶ START WAVE', {
      fontFamily: UI.FONT_FAMILY,
      fontSize: 11,
      color: '#4ade80',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });

    this.startWaveBtn.on('pointerdown', () => this.onStartWave?.());
    this.startWaveBtn.on('pointerover', () => this.startWaveBtn.setScale(1.1));
    this.startWaveBtn.on('pointerout', () => this.startWaveBtn.setScale(1));

    // Pulsing glow on start wave button
    this.startWavePulse = this.tweens.add({
      targets: this.startWaveBtn,
      alpha: { from: 1, to: 0.4 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Speed control with neon pill background
    this.speedBg = this.add.graphics();
    this.drawSpeedPill();

    this.speedText = this.add.text(GAME.WIDTH - 52, 15, '1x', {
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

  update(time: number, _delta: number): void {
    // Animated pulsing separator line
    this.separatorLine.clear();
    const pulseAlpha = 0.25 + Math.sin(time * 0.003) * 0.12;
    this.separatorLine.lineStyle(1.5, COLORS.ACCENT_CYAN, pulseAlpha);
    this.separatorLine.lineBetween(0, GAME.HUD_HEIGHT, GAME.WIDTH, GAME.HUD_HEIGHT);
    // Faint second line for depth
    this.separatorLine.lineStyle(0.5, COLORS.ACCENT_CYAN, pulseAlpha * 0.3);
    this.separatorLine.lineBetween(0, GAME.HUD_HEIGHT + 1, GAME.WIDTH, GAME.HUD_HEIGHT + 1);
  }

  private drawHexIcon(gfx: Phaser.GameObjects.Graphics, x: number, y: number, r: number, color: number): void {
    // Outer glow
    gfx.fillStyle(color, 0.2);
    gfx.fillCircle(x, y, r + 3);

    // Hexagon
    const points: Phaser.Geom.Point[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      points.push(new Phaser.Geom.Point(x + r * Math.cos(angle), y + r * Math.sin(angle)));
    }
    gfx.fillStyle(color, 0.5);
    gfx.fillPoints(points, true);
    gfx.lineStyle(1.5, color, 1);
    gfx.strokePoints(points, true);

    // Inner dot
    gfx.fillStyle(0xffffff, 0.4);
    gfx.fillCircle(x, y, r * 0.3);
  }

  private drawHeartIcon(gfx: Phaser.GameObjects.Graphics, x: number, y: number, r: number, color: number): void {
    // Outer glow
    gfx.fillStyle(color, 0.2);
    gfx.fillCircle(x, y, r + 3);

    // Simple heart shape built from two arcs + a triangle bottom
    gfx.fillStyle(color, 0.85);
    // Left lobe
    gfx.fillCircle(x - r * 0.45, y - r * 0.2, r * 0.55);
    // Right lobe
    gfx.fillCircle(x + r * 0.45, y - r * 0.2, r * 0.55);
    // Bottom triangle
    gfx.fillTriangle(
      x - r, y + r * 0.05,
      x + r, y + r * 0.05,
      x, y + r * 0.85,
    );

    // Inner highlight
    gfx.fillStyle(0xffffff, 0.3);
    gfx.fillCircle(x - r * 0.5, y - r * 0.3, r * 0.25);
  }

  private drawSpeedPill(): void {
    this.speedBg.clear();
    const intensity = this.currentSpeed === 1 ? 0.1 : this.currentSpeed === 2 ? 0.15 : 0.22;
    this.speedBg.fillStyle(COLORS.ACCENT_CYAN, intensity);
    this.speedBg.fillRoundedRect(GAME.WIDTH - 72, 12, 40, 24, 6);
    this.speedBg.lineStyle(1, COLORS.ACCENT_CYAN, intensity + 0.15);
    this.speedBg.strokeRoundedRect(GAME.WIDTH - 72, 12, 40, 24, 6);
  }

  updateWaveDisplay(current: number, total: number): void {
    if (!Number.isFinite(total)) {
      // Endless mode — no denominator
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
