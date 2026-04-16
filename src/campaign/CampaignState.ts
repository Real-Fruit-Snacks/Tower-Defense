import type { NodeMapNode, LevelConfig } from '../types';
import { SaveManager } from '../systems/SaveManager';
import { WORLD_CONFIGS, getWorldConfig } from '../data/worldMap';
import type { WorldConfig } from '../data/worldMap';
import { NodeMapGenerator } from './NodeMapGenerator';
import { LevelGenerator } from '../systems/LevelGenerator';
import { GAME } from '../constants';

export class CampaignState {
  private saveManager: SaveManager;
  private currentNodes: NodeMapNode[] = [];
  private currentNodeId = 'start';
  private visitedIds: Set<string> = new Set(['start']);
  private hp: number;
  private currentWorldId: number;
  private mapSeed: number;

  constructor(saveManager: SaveManager) {
    this.saveManager = saveManager;
    const data = saveManager.getData();
    this.hp = data.campaignProgress.hp;
    this.currentWorldId = data.campaignProgress.currentWorld;
    this.mapSeed = data.campaignProgress.mapSeed;
  }

  /** Start a fresh campaign run — new seed, reset HP, world 1 */
  startNewRun(): void {
    this.mapSeed = Date.now();
    this.currentWorldId = 1;
    this.hp = GAME.STARTING_HP;
    this.currentNodeId = 'start';
    this.visitedIds = new Set(['start']);
    this.currentNodes = [];

    const data = this.saveManager.getData();
    data.campaignProgress.mapSeed = this.mapSeed;
    data.campaignProgress.currentWorld = 1;
    data.campaignProgress.hp = this.hp;
    data.campaignProgress.currentNodeId = 'start';
    data.campaignProgress.visitedNodeIds = ['start'];
    data.campaignProgress.runActive = true;
    this.saveManager.save();
  }

  /** Generate the branching map for the current world */
  generateMapForCurrentWorld(): NodeMapNode[] {
    const config = this.getWorldConfig();
    if (!config) return [];

    // Use world-specific seed for deterministic map generation
    const worldSeed = this.mapSeed * 31 + this.currentWorldId * 97;
    this.currentNodes = NodeMapGenerator.generate(config, GAME.WIDTH, GAME.HEIGHT);

    // Assign seeds and worldId to each node for level generation
    this.currentNodes.forEach((node, index) => {
      node.worldId = this.currentWorldId;
      node.seed = worldSeed * 13 + index * 41;
    });

    return this.currentNodes;
  }

  /** Generate the LevelConfig for a specific battle node */
  getLevelConfigForNode(node: NodeMapNode): LevelConfig {
    const worldConfig = this.getWorldConfig();
    if (!worldConfig) {
      // Fallback: use world 1 config
      return LevelGenerator.generate({
        seed: node.seed ?? Date.now(),
        worldId: 1,
        nodeDifficulty: node.difficulty ?? 1,
        nodeType: node.type,
        worldConfig: WORLD_CONFIGS[0]!,
      });
    }

    return LevelGenerator.generate({
      seed: node.seed ?? Date.now(),
      worldId: this.currentWorldId,
      nodeDifficulty: node.difficulty ?? worldConfig.difficulty,
      nodeType: node.type,
      worldConfig,
    });
  }

  /** Advance to the next world after beating the boss. Returns false if campaign complete */
  advanceToNextWorld(): boolean {
    const data = this.saveManager.getData();
    if (!data.campaignProgress.completedWorlds.includes(this.currentWorldId)) {
      data.campaignProgress.completedWorlds.push(this.currentWorldId);
    }

    if (this.currentWorldId >= WORLD_CONFIGS.length) {
      // All worlds complete!
      data.campaignProgress.runActive = false;
      this.saveManager.save();
      return false;
    }

    this.currentWorldId++;
    this.currentNodeId = 'start';
    this.visitedIds = new Set(['start']);
    this.currentNodes = [];

    data.campaignProgress.currentWorld = this.currentWorldId;
    data.campaignProgress.currentNodeId = 'start';
    data.campaignProgress.visitedNodeIds = ['start'];
    this.saveManager.save();

    return true;
  }

  setMap(nodes: NodeMapNode[]): void {
    this.currentNodes = nodes;
  }

  getCurrentNodeId(): string {
    return this.currentNodeId;
  }

  getCurrentWorldId(): number {
    return this.currentWorldId;
  }

  getWorldConfig(): WorldConfig | undefined {
    return getWorldConfig(this.currentWorldId);
  }

  getHP(): number {
    return this.hp;
  }

  heal(amount: number): void {
    this.hp = Math.min(this.hp + amount, GAME.STARTING_HP + 5);
  }

  takeDamage(amount: number): void {
    this.hp = Math.max(0, this.hp - amount);
  }

  isNodeAccessible(nodeId: string): boolean {
    const currentNode = this.currentNodes.find(n => n.id === this.currentNodeId);
    return currentNode?.connections.includes(nodeId) ?? false;
  }

  advanceToNode(nodeId: string): boolean {
    if (!this.isNodeAccessible(nodeId)) return false;
    this.currentNodeId = nodeId;
    this.visitedIds.add(nodeId);
    return true;
  }

  isVisited(nodeId: string): boolean {
    return this.visitedIds.has(nodeId);
  }

  isRunComplete(): boolean {
    return this.currentWorldId > WORLD_CONFIGS.length;
  }

  isRunActive(): boolean {
    return this.saveManager.getData().campaignProgress.runActive;
  }

  save(): void {
    const data = this.saveManager.getData();
    data.campaignProgress.currentNodeId = this.currentNodeId;
    data.campaignProgress.visitedNodeIds = [...this.visitedIds];
    data.campaignProgress.hp = this.hp;
    data.campaignProgress.currentWorld = this.currentWorldId;
    this.saveManager.save();
  }
}
