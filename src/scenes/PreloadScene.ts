import Phaser from 'phaser';
import { SCENES } from '../constants';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SCENES.PRELOAD);
  }

  create(): void {
    // Generate a small white circle texture for particles
    const gfx = this.add.graphics();
    gfx.fillStyle(0xffffff, 1);
    gfx.fillCircle(4, 4, 4);
    gfx.generateTexture('particle', 8, 8);
    gfx.destroy();

    // Loading text
    const text = this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY,
      'INITIALIZING...',
      {
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontSize: 18,
        color: '#00ffff',
      },
    );
    text.setOrigin(0.5);

    // Brief delay for visual feedback, then go to menu
    this.time.delayedCall(400, () => {
      this.scene.start(SCENES.MAIN_MENU);
    });
  }
}
