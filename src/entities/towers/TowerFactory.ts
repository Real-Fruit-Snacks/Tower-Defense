import Phaser from 'phaser';
import type { TowerConfig } from '../../types';
import { BaseTower } from './BaseTower';

export class TowerFactory {
  static create(
    scene: Phaser.Scene,
    config: TowerConfig,
    row: number,
    col: number,
    worldX: number,
    worldY: number,
  ): BaseTower {
    return new BaseTower(scene, config, row, col, worldX, worldY);
  }
}
