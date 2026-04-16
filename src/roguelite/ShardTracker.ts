import { SaveManager } from '../systems/SaveManager';

export class ShardTracker {
  private saveManager: SaveManager;

  constructor(saveManager: SaveManager) {
    this.saveManager = saveManager;
  }

  getShards(): number {
    return this.saveManager.getShards();
  }

  addShards(amount: number): void {
    this.saveManager.addShards(amount);
  }

  spendShards(amount: number): boolean {
    return this.saveManager.spendShards(amount);
  }

  canAfford(amount: number): boolean {
    return this.saveManager.getShards() >= amount;
  }
}
