import { SaveManager } from '../systems/SaveManager';
import { ShardTracker } from './ShardTracker';
import { UnlockTreeManager } from './UnlockTreeManager';

/**
 * Aggregates all persistent state into a single access point.
 * Loaded at boot time, persists across runs.
 */
export class PersistentState {
  readonly saveManager: SaveManager;
  readonly shardTracker: ShardTracker;
  readonly unlockTree: UnlockTreeManager;

  constructor() {
    this.saveManager = new SaveManager();
    this.shardTracker = new ShardTracker(this.saveManager);
    this.unlockTree = new UnlockTreeManager(this.saveManager);
  }
}
