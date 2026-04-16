import Phaser from 'phaser';
import type { EnemyConfig } from '../../types';
import { Element } from '../../constants';
import { ElementSystem } from '../../systems/ElementSystem';
import { StatusEffectManager } from '../../systems/StatusEffectManager';
import type { StatusEffect } from '../../systems/StatusEffectManager';
import { ShapeRenderer } from '../../rendering/ShapeRenderer';
import { distance } from '../../utils/MathUtils';

export class BaseEnemy extends Phaser.GameObjects.Container {
  readonly config: EnemyConfig;
  readonly element: Element;
  readonly statusEffects: StatusEffectManager;

  private currentHP: number;
  private maxHP: number;
  private baseSpeed: number;
  private pathWaypoints: { x: number; y: number }[] = [];
  private pathIndex = 0;
  private alive = true;
  private shapeGraphics: Phaser.GameObjects.Graphics;
  private hpBar: Phaser.GameObjects.Graphics;
  private statusBar: Phaser.GameObjects.Graphics;
  private enemySize = 10;
  private glowGraphics: Phaser.GameObjects.Graphics;
  private hitFlashGraphics: Phaser.GameObjects.Graphics;
  private stunStarsAngle = 0;
  private wasSlowed = false;

  // Boss-specific state
  private bossShieldTimer = 0;
  private bossShieldActive = false;
  private bossEmpTimer = 0;
  private readonly BOSS_SHIELD_INTERVAL = 8000;
  private readonly BOSS_SHIELD_DURATION = 1500;
  private readonly BOSS_EMP_INTERVAL = 5000;

  constructor(
    scene: Phaser.Scene,
    config: EnemyConfig,
    element: Element,
    waveMultiplier: number,
    speedMultiplier: number = 1,
  ) {
    super(scene, 0, 0);
    this.config = config;
    this.element = element;
    this.maxHP = Math.floor(config.baseHP * waveMultiplier);
    this.currentHP = this.maxHP;
    this.baseSpeed = config.baseSpeed * speedMultiplier;
    this.statusEffects = new StatusEffectManager();

    // Bosses are larger
    if (config.special === 'boss') {
      this.enemySize = 18;
    }

    // Outer glow (ADD blend)
    this.glowGraphics = scene.add.graphics();
    this.glowGraphics.setBlendMode(Phaser.BlendModes.ADD);
    this.add(this.glowGraphics);

    // Draw shape
    this.shapeGraphics = scene.add.graphics();
    const color = ElementSystem.getColor(element);
    ShapeRenderer.drawEnemyShapeWithGlow(this.glowGraphics, this.shapeGraphics, 0, 0, config.shape, this.enemySize, color);
    this.add(this.shapeGraphics);

    // HP bar
    this.hpBar = scene.add.graphics();
    this.add(this.hpBar);
    this.updateHPBar();

    // Status effect indicators
    this.statusBar = scene.add.graphics();
    this.add(this.statusBar);

    this.hitFlashGraphics = scene.add.graphics();
    this.add(this.hitFlashGraphics);

    this.setDepth(5);
    scene.add.existing(this);
  }

  setPath(waypoints: { x: number; y: number }[]): void {
    this.pathWaypoints = waypoints;
    this.pathIndex = 0;
    if (waypoints.length > 0) {
      this.setPosition(waypoints[0]!.x, waypoints[0]!.y);
    }
  }

  update(_time: number, delta: number): boolean {
    if (!this.alive || this.pathWaypoints.length === 0) return false;

    // Update status effects
    this.statusEffects.update(delta);

    // Apply DoT damage
    const dotDps = this.statusEffects.getDotDamagePerSecond();
    if (dotDps > 0) {
      this.currentHP -= dotDps * (delta / 1000);
      this.updateHPBar();
      if (this.currentHP <= 0) {
        this.alive = false;
        return false;
      }
    }

    // Track slow state and change glow color
    const isSlowed = this.statusEffects.hasEffect('slow');
    if (isSlowed !== this.wasSlowed) {
      this.wasSlowed = isSlowed;
      this.glowGraphics.clear();
      const glowColor = isSlowed ? 0x00aaff : ElementSystem.getColor(this.element);
      this.glowGraphics.fillStyle(glowColor, 0.1);
      this.glowGraphics.fillCircle(0, 0, this.enemySize * 1.7);
    }

    // Boss abilities: periodic shield + EMP pulse
    if (this.config.special === 'boss') {
      this.bossShieldTimer += delta;
      this.bossEmpTimer += delta;

      // Shield phase: periodically become immune
      if (!this.bossShieldActive && this.bossShieldTimer >= this.BOSS_SHIELD_INTERVAL) {
        this.bossShieldActive = true;
        this.bossShieldTimer = 0;
      }
      if (this.bossShieldActive && this.bossShieldTimer >= this.BOSS_SHIELD_DURATION) {
        this.bossShieldActive = false;
        this.bossShieldTimer = 0;
      }
    }

    // Apply knockback (move backward along path)
    const knockback = this.statusEffects.consumeKnockback();
    if (knockback > 0) {
      // Move backward along path
      this.pathIndex = Math.max(0, this.pathIndex - Math.ceil(knockback));
      const wp = this.pathWaypoints[this.pathIndex];
      if (wp) this.setPosition(wp.x, wp.y);
    }

    // Don't move if stunned
    if (this.statusEffects.isStunned()) {
      this.updateStatusIndicators();
      return false;
    }

    // Movement with slow applied
    const speedMultiplier = this.statusEffects.getSpeedMultiplier();
    const effectiveSpeed = this.baseSpeed * speedMultiplier;

    const target = this.pathWaypoints[this.pathIndex];
    if (!target) return true; // reached end

    const dist = distance(this.x, this.y, target.x, target.y);
    const step = effectiveSpeed * (delta / 1000);

    if (dist <= step) {
      this.setPosition(target.x, target.y);
      this.pathIndex++;
      if (this.pathIndex >= this.pathWaypoints.length) {
        return true; // leaked
      }
    } else {
      const angle = Math.atan2(target.y - this.y, target.x - this.x);
      this.x += Math.cos(angle) * step;
      this.y += Math.sin(angle) * step;
    }

    this.updateStatusIndicators();
    return false;
  }

  takeDamage(amount: number, attackElement: Element | null): void {
    // Boss shield phase: immune to damage
    if (this.bossShieldActive) return;

    const elementMultiplier = ElementSystem.getEffectiveness(attackElement, this.element);
    const damageAmp = this.statusEffects.getDamageAmplification();

    let finalDamage = amount * elementMultiplier * damageAmp;

    // Shield special: 50% damage reduction above half HP
    if (this.config.special === 'shield_50' && this.currentHP > this.maxHP * 0.5) {
      finalDamage *= 0.5;
    }

    this.currentHP = Math.max(0, this.currentHP - finalDamage);
    this.updateHPBar();

    // Hit flash
    this.hitFlashGraphics.clear();
    this.hitFlashGraphics.fillStyle(0xffffff, 0.5);
    this.hitFlashGraphics.fillCircle(0, 0, this.enemySize);
    this.scene.time.delayedCall(50, () => this.hitFlashGraphics?.clear());

    if (this.currentHP <= 0) {
      this.alive = false;
    }
  }

  /** Apply a status effect to this enemy */
  applyStatus(effect: StatusEffect): void {
    this.statusEffects.apply(effect);
  }

  /** Heal this enemy by a flat amount */
  heal(amount: number): void {
    if (!this.alive) return;
    this.currentHP = Math.min(this.maxHP, this.currentHP + amount);
    this.updateHPBar();
  }

  isDead(): boolean {
    return !this.alive;
  }

  getHP(): number {
    return this.currentHP;
  }

  getMaxHP(): number {
    return this.maxHP;
  }

  getLeakDamage(): number {
    return this.config.special === 'double_leak' ? 2 : 1;
  }

  shouldSplit(): boolean {
    return this.config.special === 'split_2';
  }

  getRemainingPath(): { x: number; y: number }[] {
    return this.pathWaypoints.slice(this.pathIndex);
  }

  getSpeed(): number {
    return this.baseSpeed;
  }

  isBoss(): boolean {
    return this.config.special === 'boss';
  }

  isBossShieldActive(): boolean {
    return this.bossShieldActive;
  }

  /** Boss EMP: returns true when EMP should fire, then resets timer */
  consumeBossEmp(): boolean {
    if (this.config.special !== 'boss') return false;
    if (this.bossEmpTimer >= this.BOSS_EMP_INTERVAL) {
      this.bossEmpTimer = 0;
      return true;
    }
    return false;
  }

  private updateHPBar(): void {
    this.hpBar.clear();
    const barWidth = this.enemySize * 2;
    const barHeight = 4;
    const y = -this.enemySize - 6;

    this.hpBar.fillStyle(0x333333, 0.8);
    this.hpBar.fillRect(-barWidth / 2, y, barWidth, barHeight);

    const hpRatio = this.currentHP / this.maxHP;
    const color = hpRatio > 0.5 ? 0x4ade80 : hpRatio > 0.25 ? 0xfbbf24 : 0xf87171;
    this.hpBar.fillStyle(color, 1);
    this.hpBar.fillRect(-barWidth / 2, y, barWidth * hpRatio, barHeight);

    this.hpBar.lineStyle(0.5, 0xffffff, 0.25);
    this.hpBar.strokeRect(-barWidth / 2, y, barWidth, barHeight);
  }

  private updateStatusIndicators(): void {
    this.statusBar.clear();

    // Boss shield visual: rotating arc segments
    if (this.bossShieldActive) {
      const segCount = 6;
      const shieldR = this.enemySize + 6;
      const rot = Date.now() * 0.002;
      for (let i = 0; i < segCount; i++) {
        const startA = rot + (Math.PI * 2 / segCount) * i;
        const endA = startA + (Math.PI / segCount) * 0.6;
        this.statusBar.lineStyle(2.5, 0xffffff, 0.45);
        this.statusBar.beginPath();
        this.statusBar.arc(0, 0, shieldR, startA, endA, false);
        this.statusBar.strokePath();
      }
    }

    if (this.statusEffects.isStunned()) {
      this.stunStarsAngle += 0.05;
      const starY = -this.enemySize - 12;
      for (let i = 0; i < 3; i++) {
        const a = this.stunStarsAngle + (Math.PI * 2 / 3) * i;
        this.statusBar.fillStyle(0xffaa00, 0.8);
        this.statusBar.fillCircle(Math.cos(a) * 8, starY + Math.sin(a) * 3, 1.5);
      }
    }

    const effects = this.statusEffects.getActiveEffects();
    if (effects.length === 0) return;

    // Draw small colored dots below HP bar to indicate active effects
    let dotX = -this.enemySize + 2;
    const dotY = -this.enemySize - 10;

    for (const effect of effects) {
      let color = 0xffffff;
      switch (effect.type) {
        case 'slow': color = 0x00aaff; break;
        case 'stun': color = 0xffaa00; break;
        case 'damage_amp': color = 0xff0055; break;
        case 'dot': color = 0x00ff88; break;
        case 'knockback': color = 0xffffff; break;
      }
      this.statusBar.fillStyle(color, 0.8);
      this.statusBar.fillCircle(dotX, dotY, 1.5);
      dotX += 4;
    }
  }

  cleanup(): void {
    this.statusEffects.clear();
    this.glowGraphics.destroy();
    this.hitFlashGraphics.destroy();
    this.shapeGraphics.destroy();
    this.hpBar.destroy();
    this.statusBar.destroy();
    this.destroy();
  }
}
