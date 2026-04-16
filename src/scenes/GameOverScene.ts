import Phaser from 'phaser';
import { SCENES, COLORS, GAME } from '../constants';
import { createGlowText, drawNeonRect } from '../rendering/NeonEffects';
import { setupStageCamera } from '../utils/StageCamera';
import type { PersistentState } from '../roguelite/PersistentState';

interface GameOverData {
  wavesCleared: number;
  enemiesKilled: number;
  goldEarned: number;
  shardsEarned: number;
  victory: boolean;
}

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super(SCENES.GAME_OVER);
  }

  create(data: GameOverData): void {
    setupStageCamera(this);
    this.cameras.main.setBackgroundColor(COLORS.BG);

    // Persist run data
    const persistent = this.game.registry.get('persistentState') as PersistentState | undefined;
    if (persistent) {
      persistent.shardTracker.addShards(data.shardsEarned);
      persistent.saveManager.recordRun(data.enemiesKilled, data.wavesCleared);
    }

    const cx = GAME.WIDTH / 2;
    const headerColor = data.victory ? COLORS.SUCCESS : COLORS.DANGER;
    const headerText = data.victory ? 'VICTORY' : 'DEFEATED';

    createGlowText(this, cx, 120, headerText, headerColor, 42);

    // Stats panel
    const panelGfx = this.add.graphics();
    drawNeonRect(panelGfx, cx - 200, 180, 400, 280, COLORS.ACCENT_CYAN, 0.06, 8);

    const totalShards = persistent?.shardTracker.getShards() ?? 0;
    const stats = [
      { label: 'Waves Cleared', value: `${data.wavesCleared}` },
      { label: 'Enemies Killed', value: `${data.enemiesKilled}` },
      { label: 'Gold Earned', value: `${data.goldEarned}` },
      { label: 'Shards Earned', value: `+${data.shardsEarned}`, color: COLORS.ACCENT_PURPLE },
      { label: 'Total Shards', value: `${totalShards}`, color: COLORS.ACCENT_PURPLE },
    ];

    stats.forEach((stat, i) => {
      const y = 205 + i * 44;
      this.add.text(cx - 170, y, stat.label, {
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontSize: 15,
        color: '#888',
      });
      this.add.text(cx + 170, y, stat.value, {
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontSize: 18,
        color: stat.color ? '#' + stat.color.toString(16).padStart(6, '0') : '#fff',
        fontStyle: 'bold',
      }).setOrigin(1, 0);
    });

    // Buttons
    this.createSimpleButton(cx - 100, 510, 'RETRY', COLORS.ACCENT_CYAN, () => {
      this.scene.start(SCENES.GAME, { mode: 'endless' });
    });

    this.createSimpleButton(cx + 100, 510, 'MENU', COLORS.ACCENT_PINK, () => {
      this.scene.start(SCENES.MAIN_MENU);
    });
  }

  private createSimpleButton(x: number, y: number, label: string, color: number, onClick: () => void): void {
    const text = this.add.text(x, y, label, {
      fontFamily: 'Segoe UI, system-ui, sans-serif',
      fontSize: 18,
      color: '#' + color.toString(16).padStart(6, '0'),
      fontStyle: 'bold',
      padding: { x: 20, y: 10 },
    }).setOrigin(0.5);

    text.setInteractive({ useHandCursor: true });
    text.on('pointerover', () => text.setAlpha(0.7));
    text.on('pointerout', () => text.setAlpha(1));
    text.on('pointerdown', onClick);
  }
}
