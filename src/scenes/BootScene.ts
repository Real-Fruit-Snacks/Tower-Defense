import Phaser from 'phaser';
import { SCENES, COLORS } from '../constants';

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENES.BOOT);
  }

  create(): void {
    // Set background color
    this.cameras.main.setBackgroundColor(COLORS.BG);

    // Transition to preload
    this.scene.start(SCENES.PRELOAD);
  }
}
