import Phaser from 'phaser';
import { GRID } from '../../constants';
import type { TowerConfig, GameEvents } from '../../types';
import { ElementSystem } from '../../systems/ElementSystem';
import { ShapeRenderer } from '../../rendering/ShapeRenderer';
import { distance } from '../../utils/MathUtils';
import { EventBus } from '../../utils/EventBus';
import { BaseEnemy } from '../enemies/BaseEnemy';
import { Projectile } from './Projectile';

export class BaseTower extends Phaser.GameObjects.Container {
  readonly config: TowerConfig;
  readonly gridRow: number;
  readonly gridCol: number;

  private currentDamage: number;
  private currentRange: number;
  private currentAttackSpeed: number;
  private lastFireTime = 0;
  private towerGraphics: Phaser.GameObjects.Graphics;
  private projectiles: Projectile[] = [];
  private upgradeBranch = -1;
  private upgradeLevel = 0;
  private totalInvested: number;
  private towerSize = 18;
  private glowGraphics: Phaser.GameObjects.Graphics;
  private muzzleFlashGraphics: Phaser.GameObjects.Graphics;
  private amplifierAuraAngle = 0;
  private extractorParticleTimer = 0;
  private gameEvents: EventBus<GameEvents> | null = null;

  /** Amplifier buff: multiplier applied to this tower's damage by nearby amplifiers */
  private buffMultiplier = 1;

  /**
   * Permanent global damage bonus from unlock-tree passive bonuses
   * (e.g. Arsenal I +5%, Damage Mastery +N%). Read once from the scene
   * registry at construction — these are set by GameScene before any tower exists.
   */
  private globalDamageBonus = 0;

  constructor(
    scene: Phaser.Scene,
    config: TowerConfig,
    row: number,
    col: number,
    worldX: number,
    worldY: number,
  ) {
    super(scene, worldX, worldY);
    this.config = config;
    this.gridRow = row;
    this.gridCol = col;
    this.currentDamage = config.baseDamage;
    this.currentRange = config.baseRange;
    this.currentAttackSpeed = config.attackSpeed;
    this.totalInvested = config.baseCost;
    this.globalDamageBonus = (scene.registry.get('globalDamageBonus') as number | undefined) ?? 0;

    const color = ElementSystem.getColor(config.element);

    // Outer glow layer (ADD blend for neon effect)
    this.glowGraphics = scene.add.graphics();
    this.glowGraphics.setBlendMode(Phaser.BlendModes.ADD);
    this.add(this.glowGraphics);

    // Main shape layer
    this.towerGraphics = scene.add.graphics();
    this.add(this.towerGraphics);

    // Draw with glow
    ShapeRenderer.drawTowerShapeWithGlow(this.glowGraphics, this.towerGraphics, 0, 0, config.shape, this.towerSize, color);

    // Muzzle flash layer (hidden by default)
    this.muzzleFlashGraphics = scene.add.graphics();
    this.muzzleFlashGraphics.setBlendMode(Phaser.BlendModes.ADD);
    this.muzzleFlashGraphics.setVisible(false);
    this.add(this.muzzleFlashGraphics);

    this.setDepth(3);
    scene.add.existing(this);
  }

  setGameEvents(events: EventBus<GameEvents>): void {
    this.gameEvents = events;
  }

  update(time: number, _delta: number, enemies: BaseEnemy[], allTowers?: BaseTower[]): void {
    // Handle passive towers
    if (this.config.id === 'amplifier') {
      // Rotating visual aura for amplifier
      this.amplifierAuraAngle += _delta * 0.001;
      const auraGfx = this.glowGraphics;
      auraGfx.clear();
      const auraRadius = this.currentRange * GRID.CELL_SIZE;
      const dashCount = 12;
      for (let i = 0; i < dashCount; i++) {
        const startA = this.amplifierAuraAngle + (Math.PI * 2 / dashCount) * i;
        const endA = startA + (Math.PI / dashCount) * 0.7;
        auraGfx.lineStyle(1.5, 0xaaaaaa, 0.25);
        auraGfx.beginPath();
        auraGfx.arc(0, 0, auraRadius, startA, endA, false);
        auraGfx.strokePath();
      }

      this.updateAmplifierAura(allTowers ?? []);
      return;
    }
    if (this.config.id === 'gold_extractor') {
      this.extractorParticleTimer += _delta;
      if (this.extractorParticleTimer > 800) {
        this.extractorParticleTimer = 0;
        const g = this.scene.add.graphics();
        g.fillStyle(0xffd700, 0.6);
        g.fillCircle(0, 0, 1.5);
        g.setPosition(this.x + Phaser.Math.FloatBetween(-8, 8), this.y);
        g.setBlendMode(Phaser.BlendModes.ADD);
        this.scene.tweens.add({
          targets: g, y: g.y - 20, alpha: 0, duration: 600,
          ease: 'Quad.easeOut', onComplete: () => g.destroy(),
        });
      }
      return;
    }

    if (this.currentAttackSpeed <= 0) return;

    const fireInterval = 1000 / this.currentAttackSpeed;
    if (time - this.lastFireTime < fireInterval) return;

    const target = this.findTarget(enemies);
    if (target) {
      this.performAttack(target, enemies);
      this.lastFireTime = time;
    }
  }

  updateProjectiles(_time: number, delta: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i]!;
      const done = proj.update(_time, delta);
      if (done) {
        this.projectiles.splice(i, 1);
      }
    }
  }

  private findTarget(enemies: BaseEnemy[]): BaseEnemy | null {
    const rangePixels = this.currentRange * GRID.CELL_SIZE;
    let closest: BaseEnemy | null = null;
    let closestDist = Infinity;

    for (const enemy of enemies) {
      if (enemy.isDead()) continue;
      const dist = distance(this.x, this.y, enemy.x, enemy.y);
      if (dist <= rangePixels && dist < closestDist) {
        closest = enemy;
        closestDist = dist;
      }
    }

    return closest;
  }

  private findEnemiesInRange(enemies: BaseEnemy[]): BaseEnemy[] {
    const rangePixels = this.currentRange * GRID.CELL_SIZE;
    return enemies.filter(e =>
      !e.isDead() && distance(this.x, this.y, e.x, e.y) <= rangePixels,
    );
  }

  private performAttack(target: BaseEnemy, allEnemies: BaseEnemy[]): void {
    const effectiveDamage = this.currentDamage * this.buffMultiplier * (1 + this.globalDamageBonus);

    switch (this.config.id) {
      case 'spark_coil':
        this.attackChainLightning(target, allEnemies, effectiveDamage);
        break;
      case 'frost_beam':
        this.attackWithSlow(target, effectiveDamage, 0.4, 2000);
        break;
      case 'cyclone_trap':
        this.attackAreaSlow(allEnemies, effectiveDamage, 0.5, 2500);
        break;
      case 'tidal_pulse':
        this.attackWithKnockback(target, effectiveDamage, 2);
        break;
      case 'null_field':
        this.attackAreaDebuff(allEnemies, effectiveDamage, 1.3, 3000);
        break;
      case 'rift_siphon':
        this.attackDrain(target, effectiveDamage);
        break;
      case 'inferno_ring':
      case 'quake_drum':
        this.attackArea(allEnemies, effectiveDamage);
        break;
      default:
        this.fireProjectile(target, effectiveDamage);
        break;
    }

    this.triggerFireAnim(target.x, target.y);
  }

  private triggerFireAnim(targetX: number, targetY: number): void {
    // Scale pulse
    this.setScale(1.1);
    this.scene.tweens.add({
      targets: this, scaleX: 1, scaleY: 1, duration: 100, ease: 'Quad.easeOut',
    });

    // Muzzle flash toward target
    const angle = Math.atan2(targetY - this.y, targetX - this.x);
    const flashDist = this.towerSize * 0.7;
    const fx = Math.cos(angle) * flashDist;
    const fy = Math.sin(angle) * flashDist;
    const color = ElementSystem.getColor(this.config.element);

    this.muzzleFlashGraphics.clear();
    this.muzzleFlashGraphics.fillStyle(color, 0.9);
    this.muzzleFlashGraphics.fillCircle(fx, fy, 4);
    this.muzzleFlashGraphics.fillStyle(0xffffff, 0.6);
    this.muzzleFlashGraphics.fillCircle(fx, fy, 2);
    this.muzzleFlashGraphics.setVisible(true);

    this.scene.time.delayedCall(60, () => {
      this.muzzleFlashGraphics.setVisible(false);
      this.muzzleFlashGraphics.clear();
    });
  }

  /** Standard single-target projectile */
  private fireProjectile(target: BaseEnemy, damage: number): void {
    const proj = new Projectile(
      this.scene, this.x, this.y, target, damage, this.config.element,
    );
    this.projectiles.push(proj);
  }

  /** Chain lightning: hits primary target + chains to N nearby enemies */
  private attackChainLightning(target: BaseEnemy, allEnemies: BaseEnemy[], damage: number): void {
    const chainCount = 2 + this.upgradeLevel; // 2-5 targets based on upgrade
    this.fireProjectile(target, damage);

    // Find chain targets near the primary target
    const chainRange = GRID.CELL_SIZE * 2;
    let lastTarget = target;
    const hit = new Set<BaseEnemy>([target]);

    for (let i = 0; i < chainCount; i++) {
      let nearestDist = Infinity;
      let nearest: BaseEnemy | null = null;
      for (const enemy of allEnemies) {
        if (enemy.isDead() || hit.has(enemy)) continue;
        const d = distance(lastTarget.x, lastTarget.y, enemy.x, enemy.y);
        if (d < chainRange && d < nearestDist) {
          nearestDist = d;
          nearest = enemy;
        }
      }
      if (nearest) {
        hit.add(nearest);
        // Chain does 70% of original damage
        nearest.takeDamage(damage * 0.7, this.config.element);
        // Visual: draw a brief line
        this.drawChainLine(lastTarget, nearest);
        lastTarget = nearest;
      }
    }
  }

  private drawChainLine(from: BaseEnemy, to: BaseEnemy): void {
    const gfx = this.scene.add.graphics();
    const color = ElementSystem.getColor(this.config.element);
    gfx.lineStyle(1.5, color, 0.7);
    gfx.lineBetween(from.x, from.y, to.x, to.y);
    gfx.setDepth(7);
    this.scene.tweens.add({
      targets: gfx,
      alpha: 0,
      duration: 200,
      onComplete: () => gfx.destroy(),
    });
  }

  /** Fire projectile + apply slow to target */
  private attackWithSlow(target: BaseEnemy, damage: number, slowAmount: number, duration: number): void {
    this.fireProjectile(target, damage);
    target.applyStatus({
      type: 'slow',
      magnitude: slowAmount,
      duration,
      maxDuration: duration,
      sourceId: `${this.config.id}_${this.gridRow}_${this.gridCol}`,
    });
  }

  /** AoE attack that slows all enemies in range */
  private attackAreaSlow(allEnemies: BaseEnemy[], damage: number, slowAmount: number, duration: number): void {
    const inRange = this.findEnemiesInRange(allEnemies);
    const sourceId = `${this.config.id}_${this.gridRow}_${this.gridCol}`;
    for (const enemy of inRange) {
      enemy.takeDamage(damage, this.config.element);
      enemy.applyStatus({
        type: 'slow', magnitude: slowAmount, duration, maxDuration: duration, sourceId,
      });
    }
  }

  /** Fire projectile + apply knockback */
  private attackWithKnockback(target: BaseEnemy, damage: number, pushCells: number): void {
    this.fireProjectile(target, damage);
    target.applyStatus({
      type: 'knockback',
      magnitude: pushCells,
      duration: 0,
      maxDuration: 0,
    });
  }

  /** AoE debuff: increases damage taken by enemies in range */
  private attackAreaDebuff(allEnemies: BaseEnemy[], damage: number, ampAmount: number, duration: number): void {
    const inRange = this.findEnemiesInRange(allEnemies);
    const sourceId = `${this.config.id}_${this.gridRow}_${this.gridCol}`;
    for (const enemy of inRange) {
      enemy.takeDamage(damage, this.config.element);
      enemy.applyStatus({
        type: 'damage_amp', magnitude: ampAmount, duration, maxDuration: duration, sourceId,
      });
    }
  }

  /** Drain: deals % max HP damage, heals player 1 HP per kill assist */
  private attackDrain(target: BaseEnemy, damage: number): void {
    const drainDamage = Math.max(damage, target.getMaxHP() * 0.03);
    this.fireProjectile(target, drainDamage);
  }

  /** AoE damage to all enemies in range */
  private attackArea(allEnemies: BaseEnemy[], damage: number): void {
    const inRange = this.findEnemiesInRange(allEnemies);
    for (const enemy of inRange) {
      enemy.takeDamage(damage, this.config.element);
    }
  }

  /** Amplifier aura: buff nearby towers' damage */
  private updateAmplifierAura(allTowers: BaseTower[]): void {
    const auraRange = this.currentRange * GRID.CELL_SIZE;
    const buffAmount = 1.2 + this.upgradeLevel * 0.1; // 20-50% buff based on level

    for (const tower of allTowers) {
      if (tower === this) continue;
      const dist = distance(this.x, this.y, tower.x, tower.y);
      if (dist <= auraRange) {
        tower.setBuffMultiplier(buffAmount);
      }
    }
  }

  /** Called by amplifier to set buff multiplier */
  setBuffMultiplier(mult: number): void {
    this.buffMultiplier = Math.max(this.buffMultiplier, mult);
  }

  /** Reset buff each frame (recalculated by amplifiers) */
  resetBuffMultiplier(): void {
    this.buffMultiplier = 1;
  }

  /** Gold Extractor: returns gold generated per wave (called by wave end handler) */
  getGoldGeneration(): number {
    if (this.config.id !== 'gold_extractor') return 0;
    return 15 + this.upgradeLevel * 15; // 15/30/45/60 gold per wave
  }

  applyUpgrade(damageBoost: number, rangeBoost: number, speedBoost: number, cost: number, branch: number, level: number): void {
    this.currentDamage = this.config.baseDamage * (1 + damageBoost);
    this.currentRange = this.config.baseRange * (1 + rangeBoost);
    this.currentAttackSpeed = this.config.attackSpeed * (1 + speedBoost);
    this.totalInvested += cost;
    this.upgradeBranch = branch;
    this.upgradeLevel = level;

    // Redraw tower shape slightly larger per level
    this.glowGraphics.clear();
    this.towerGraphics.clear();
    const color = ElementSystem.getColor(this.config.element);
    const upgradedSize = this.towerSize + level * 2;
    ShapeRenderer.drawTowerShapeWithGlow(this.glowGraphics, this.towerGraphics, 0, 0, this.config.shape, upgradedSize, color);

    this.setScale(1.3);
    this.scene.tweens.add({
      targets: this,
      scaleX: 1,
      scaleY: 1,
      duration: 200,
      ease: 'Back.easeOut',
    });
  }

  getDamage(): number { return this.currentDamage; }
  getRange(): number { return this.currentRange; }
  getAttackSpeed(): number { return this.currentAttackSpeed; }
  getUpgradeBranch(): number { return this.upgradeBranch; }
  getUpgradeLevel(): number { return this.upgradeLevel; }
  getTotalInvested(): number { return this.totalInvested; }

  cleanup(): void {
    for (const proj of this.projectiles) {
      if (proj.active) proj.destroy();
    }
    this.projectiles = [];
    this.glowGraphics.destroy();
    this.muzzleFlashGraphics.destroy();
    this.towerGraphics.destroy();
    this.destroy();
  }
}
