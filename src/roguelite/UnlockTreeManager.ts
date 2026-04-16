import type { UnlockNode } from '../types';
import { UNLOCK_TREE } from '../data/unlockTree';
import { SaveManager } from '../systems/SaveManager';

export class UnlockTreeManager {
  private saveManager: SaveManager;
  private tree: UnlockNode[];

  constructor(saveManager: SaveManager) {
    this.saveManager = saveManager;
    this.tree = UNLOCK_TREE;
  }

  getTree(): UnlockNode[] {
    return this.tree;
  }

  /** "Unlocked" means owned at least once. For repeatable nodes, level >= 1. */
  isUnlocked(nodeId: string): boolean {
    if (this.saveManager.isNodeUnlocked(nodeId)) return true;
    return this.getLevel(nodeId) > 0;
  }

  /** Current purchase level for repeatable nodes. One-shot nodes return 0 or 1. */
  getLevel(nodeId: string): number {
    return this.saveManager.getNodeLevel(nodeId);
  }

  /** True when a repeatable node has hit its maxLevel (never true for infinite sinks). */
  isMaxed(nodeId: string): boolean {
    const node = this.tree.find(n => n.id === nodeId);
    if (!node) return false;
    if (!node.repeatable) return this.isUnlocked(nodeId);
    if (node.maxLevel === undefined) return false;
    return this.getLevel(nodeId) >= node.maxLevel;
  }

  /** Shard cost to purchase the NEXT level of this node (current price shown to the player). */
  getCurrentCost(nodeId: string): number {
    const node = this.tree.find(n => n.id === nodeId);
    if (!node) return 0;
    if (!node.repeatable) return node.cost;
    const level = this.getLevel(nodeId);
    const step = node.costStep ?? node.cost;
    return node.cost + level * step;
  }

  canUnlock(nodeId: string): boolean {
    const node = this.tree.find(n => n.id === nodeId);
    if (!node) return false;
    if (this.isMaxed(nodeId)) return false;
    if (!node.repeatable && this.isUnlocked(nodeId)) return false;
    if (this.saveManager.getShards() < this.getCurrentCost(nodeId)) return false;
    return node.prereqs.every(prereqId => this.isUnlocked(prereqId));
  }

  unlock(nodeId: string): boolean {
    const node = this.tree.find(n => n.id === nodeId);
    if (!node || !this.canUnlock(nodeId)) return false;

    const cost = this.getCurrentCost(nodeId);
    if (!this.saveManager.spendShards(cost)) return false;

    if (node.repeatable) {
      this.saveManager.incrementNodeLevel(nodeId);
    } else {
      this.saveManager.unlockNode(nodeId);
    }
    return true;
  }

  /** Get all tower IDs that are unlocked */
  getUnlockedTowerIds(): string[] {
    const ids: string[] = [];
    for (const node of this.tree) {
      if (!this.isUnlocked(node.id)) continue;
      if (node.effect.type === 'unlock_tower') {
        ids.push(node.effect.towerId);
      }
    }
    return ids;
  }

  /** True when the named mode is unlocked. Campaign is always available. */
  isModeUnlocked(mode: string): boolean {
    if (mode === 'campaign') return true;
    for (const node of this.tree) {
      if (node.effect.type !== 'unlock_mode') continue;
      if (node.effect.mode !== mode) continue;
      if (this.isUnlocked(node.id)) return true;
    }
    return false;
  }

  /**
   * Accumulated passive bonuses, summed across all unlocked nodes.
   * For repeatable nodes, the stored value is multiplied by the purchase count.
   */
  getPassiveBonuses(): Record<string, number> {
    const bonuses: Record<string, number> = {};
    for (const node of this.tree) {
      if (node.effect.type !== 'passive_bonus') continue;
      if (!this.isUnlocked(node.id)) continue;
      const stat = node.effect.stat;
      if (stat === 'none') continue;
      const multiplier = node.repeatable ? this.getLevel(node.id) : 1;
      bonuses[stat] = (bonuses[stat] ?? 0) + node.effect.value * multiplier;
    }
    return bonuses;
  }
}
