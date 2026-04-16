/**
 * Status effects that can be applied to enemies.
 * Each effect has a type, magnitude, duration, and source tracking.
 */

export type StatusEffectType = 'slow' | 'knockback' | 'damage_amp' | 'dot' | 'stun';

export interface StatusEffect {
  type: StatusEffectType;
  /** Magnitude of the effect (e.g. 0.5 = 50% slow, 1.5 = 50% damage amp) */
  magnitude: number;
  /** Remaining duration in ms */
  duration: number;
  /** Max duration for refreshing */
  maxDuration: number;
  /** Source tower ID to prevent stacking from same source */
  sourceId?: string;
}

/**
 * Manages status effects on a single entity.
 * Attach one instance per BaseEnemy.
 */
export class StatusEffectManager {
  private effects: StatusEffect[] = [];

  /** Apply a new status effect, refreshing duration if same type+source exists */
  apply(effect: StatusEffect): void {
    // Check if same type from same source already exists — refresh it
    const existing = this.effects.find(
      e => e.type === effect.type && e.sourceId === effect.sourceId,
    );

    if (existing) {
      existing.duration = effect.maxDuration;
      existing.magnitude = Math.max(existing.magnitude, effect.magnitude);
    } else {
      this.effects.push({ ...effect });
    }
  }

  /** Update all effects, removing expired ones */
  update(delta: number): void {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i]!;
      effect.duration -= delta;
      if (effect.duration <= 0) {
        this.effects.splice(i, 1);
      }
    }
  }

  /** Get the combined slow multiplier (0 to 1, where 0.5 means 50% speed) */
  getSpeedMultiplier(): number {
    let multiplier = 1;
    for (const effect of this.effects) {
      if (effect.type === 'slow') {
        // Take the strongest slow, don't stack multiplicatively
        multiplier = Math.min(multiplier, effect.magnitude);
      }
      if (effect.type === 'stun') {
        return 0; // stunned = no movement
      }
    }
    return multiplier;
  }

  /** Get the combined damage amplification multiplier */
  getDamageAmplification(): number {
    let amp = 1;
    for (const effect of this.effects) {
      if (effect.type === 'damage_amp') {
        amp *= effect.magnitude;
      }
    }
    return amp;
  }

  /** Get total DoT damage per second */
  getDotDamagePerSecond(): number {
    let dps = 0;
    for (const effect of this.effects) {
      if (effect.type === 'dot') {
        dps += effect.magnitude;
      }
    }
    return dps;
  }

  /** Check if entity is stunned */
  isStunned(): boolean {
    return this.effects.some(e => e.type === 'stun');
  }

  /** Check if entity has a specific effect type */
  hasEffect(type: StatusEffectType): boolean {
    return this.effects.some(e => e.type === type);
  }

  /** Get all active effects (for UI display) */
  getActiveEffects(): readonly StatusEffect[] {
    return this.effects;
  }

  /** Get pending knockback vector (consumed after application) */
  consumeKnockback(): number {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i]!;
      if (effect.type === 'knockback') {
        const magnitude = effect.magnitude;
        this.effects.splice(i, 1); // knockback is instant, remove after use
        return magnitude;
      }
    }
    return 0;
  }

  clear(): void {
    this.effects.length = 0;
  }
}
