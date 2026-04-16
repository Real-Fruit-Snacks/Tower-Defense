import type { GameEvents, GridPosition } from '../../types';
import { EventBus } from '../../utils/EventBus';
import { distance } from '../../utils/MathUtils';
import { BaseEnemy } from './BaseEnemy';
import { EnemyFactory } from './EnemyFactory';
import { GridRenderer } from '../../rendering/GridRenderer';
import { playDeathEffect } from '../../rendering/GameEffects';
import { ElementSystem } from '../../systems/ElementSystem';

const HEAL_AURA_RANGE = 80; // pixels
const HEAL_AURA_AMOUNT = 5; // HP per tick
const HEAL_AURA_INTERVAL = 1000; // ms between heals

export class EnemyManager {
  private scene: Phaser.Scene;
  private events: EventBus<GameEvents>;
  private gridRenderer: GridRenderer;
  private activeEnemies: BaseEnemy[] = [];
  private totalKilled = 0;
  private healTimer = 0;

  constructor(
    scene: Phaser.Scene,
    events: EventBus<GameEvents>,
    gridRenderer: GridRenderer,
  ) {
    this.scene = scene;
    this.events = events;
    this.gridRenderer = gridRenderer;
  }

  addEnemy(enemy: BaseEnemy, pathWaypoints: GridPosition[]): void {
    // Convert grid positions to world positions
    const worldWaypoints = pathWaypoints.map(wp =>
      this.gridRenderer.gridToWorld(wp.row, wp.col),
    );
    enemy.setPath(worldWaypoints);
    this.activeEnemies.push(enemy);
  }

  update(_time: number, delta: number): void {
    for (let i = this.activeEnemies.length - 1; i >= 0; i--) {
      const enemy = this.activeEnemies[i]!;

      if (enemy.isDead()) {
        this.totalKilled++;

        // Death visual effect
        playDeathEffect(this.scene, enemy.x, enemy.y, ElementSystem.getColor(enemy.element));

        this.events.emit('ENEMY_KILLED', {
          enemyId: enemy.config.id,
          reward: enemy.config.reward,
          element: enemy.element,
          isBoss: enemy.isBoss(),
        });

        // Handle splitting enemies: spawn 2 weaker copies at death position
        if (enemy.shouldSplit()) {
          const remainingPath = enemy.getRemainingPath();
          for (let s = 0; s < 2; s++) {
            const split = EnemyFactory.createSplit(
              this.scene, enemy.config, enemy.element, 1,
            );
            // Set position to parent's death location and give remaining path
            const offsetX = (s === 0 ? -8 : 8);
            const splitPath = [
              { x: enemy.x + offsetX, y: enemy.y },
              ...remainingPath,
            ];
            split.setPath(splitPath);
            this.activeEnemies.push(split);
          }
        }

        enemy.cleanup();
        this.activeEnemies.splice(i, 1);
        continue;
      }

      const leaked = enemy.update(_time, delta);
      if (leaked) {
        this.events.emit('ENEMY_LEAKED', { damage: enemy.getLeakDamage() });
        enemy.cleanup();
        this.activeEnemies.splice(i, 1);
      }
    }

    // Boss EMP: periodically buffs nearby enemies with speed boost
    for (const enemy of this.activeEnemies) {
      if (enemy.isDead() || !enemy.isBoss()) continue;
      if (enemy.consumeBossEmp()) {
        // Buff all enemies in range with a speed boost
        for (const ally of this.activeEnemies) {
          if (ally === enemy || ally.isDead()) continue;
          if (distance(enemy.x, enemy.y, ally.x, ally.y) <= 120) {
            ally.applyStatus({
              type: 'slow', // Using slow with magnitude > 1 = speed boost
              magnitude: 1.5,
              duration: 2000,
              maxDuration: 2000,
              sourceId: 'boss_emp',
            });
          }
        }
      }
    }

    // Healer aura: healers periodically heal nearby enemies
    this.healTimer += delta;
    if (this.healTimer >= HEAL_AURA_INTERVAL) {
      this.healTimer -= HEAL_AURA_INTERVAL;
      for (const enemy of this.activeEnemies) {
        if (enemy.isDead() || enemy.config.special !== 'heal_aura') continue;
        // Heal all nearby non-healer allies
        for (const ally of this.activeEnemies) {
          if (ally === enemy || ally.isDead()) continue;
          if (distance(enemy.x, enemy.y, ally.x, ally.y) <= HEAL_AURA_RANGE) {
            ally.heal(HEAL_AURA_AMOUNT);
          }
        }
      }
    }
  }

  getActiveEnemies(): BaseEnemy[] {
    return this.activeEnemies;
  }

  getEnemyCount(): number {
    return this.activeEnemies.length;
  }

  getTotalKilled(): number {
    return this.totalKilled;
  }

  clearAll(): void {
    for (const enemy of this.activeEnemies) {
      enemy.cleanup();
    }
    this.activeEnemies = [];
  }
}
