import Phaser from 'phaser';
import { Element } from '../../constants';
import type { EnemyConfig } from '../../types';
import { BaseEnemy } from './BaseEnemy';

export class EnemyFactory {
  static create(
    scene: Phaser.Scene,
    config: EnemyConfig,
    element: Element,
    waveMultiplier = 1,
    speedMultiplier = 1,
  ): BaseEnemy {
    return new BaseEnemy(scene, config, element, waveMultiplier, speedMultiplier);
  }

  static createSplit(
    scene: Phaser.Scene,
    parentConfig: EnemyConfig,
    parentElement: Element,
    waveMultiplier: number,
  ): BaseEnemy {
    // Splits are weaker versions
    const splitConfig: EnemyConfig = {
      ...parentConfig,
      id: parentConfig.id + '_split',
      name: parentConfig.name + ' Split',
      baseHP: Math.floor(parentConfig.baseHP * 0.4),
      baseSpeed: parentConfig.baseSpeed * 1.2,
      reward: Math.floor(parentConfig.reward * 0.3),
      special: undefined, // Splits don't split again
    };
    return new BaseEnemy(scene, splitConfig, parentElement, waveMultiplier);
  }
}
