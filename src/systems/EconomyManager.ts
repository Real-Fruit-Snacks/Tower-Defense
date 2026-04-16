import type { GameEvents } from '../types';
import { GAME } from '../constants';
import { EventBus } from '../utils/EventBus';

export class EconomyManager {
  private gold: number;
  private totalEarned = 0;
  private events: EventBus<GameEvents>;
  private earnMultiplier = 1;
  private sellBonus = 0;

  constructor(events: EventBus<GameEvents>, startingGold: number = GAME.STARTING_GOLD) {
    this.events = events;
    this.gold = startingGold;

    // Listen for kill rewards (affected by earnMultiplier)
    this.events.on('ENEMY_KILLED', ({ reward }) => {
      this.addGold(Math.floor(reward * this.earnMultiplier));
    });

    // Listen for wave bonuses (affected by earnMultiplier)
    this.events.on('WAVE_END', ({ bonusGold }) => {
      if (bonusGold > 0) this.addGold(Math.floor(bonusGold * this.earnMultiplier));
    });

    // Listen for tower sales (full refund, not affected)
    this.events.on('TOWER_SOLD', ({ refund }) => {
      this.addGold(refund);
    });
  }

  setEarnMultiplier(mult: number): void {
    this.earnMultiplier = mult;
  }

  /**
   * Additive bonus to the base sell refund ratio (0.6). Comes from the
   * "Better Deals" and "Broker" mastery unlocks. Clamped so players can
   * never refund above the original invested amount.
   */
  setSellBonus(bonus: number): void {
    this.sellBonus = Math.max(0, bonus);
  }

  getGold(): number {
    return this.gold;
  }

  getTotalEarned(): number {
    return this.totalEarned;
  }

  addGold(amount: number): void {
    this.gold += amount;
    this.totalEarned += amount;
    this.events.emit('GOLD_CHANGED', { gold: this.gold, delta: amount });
  }

  spendGold(amount: number): boolean {
    if (this.gold < amount) return false;
    this.gold -= amount;
    this.events.emit('GOLD_CHANGED', { gold: this.gold, delta: -amount });
    return true;
  }

  canAfford(amount: number): boolean {
    return this.gold >= amount;
  }

  getSellValue(baseCost: number): number {
    const ratio = Math.min(1, GAME.SELL_REFUND_RATIO + this.sellBonus);
    return Math.floor(baseCost * ratio);
  }
}
