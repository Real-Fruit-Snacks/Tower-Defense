import { Element } from '../constants';
import type { NodeType, LayoutType } from '../types';

export interface WorldConfig {
  id: number;
  name: string;
  color: number;
  layers: number;
  nodesPerLayer: number[];
  nodeWeights: Record<NodeType, number>;
  difficulty: number;
  layoutWeights: Record<LayoutType, number>;
  elementWeights: Record<Element, number>;
  baseThreatBudget: number;
  baseWaveRange: [number, number];
  startingGold: number;
  enemyPool: string[];
  bossElement: Element;
}

export const WORLD_CONFIGS: WorldConfig[] = [
  {
    id: 1,
    name: 'THE CORE',
    color: 0xff0055,
    layers: 7,
    nodesPerLayer: [1, 3, 4, 4, 4, 3, 1],
    //                      ↑ More mid-game nodes for path variety
    nodeWeights: { battle: 35, shop: 12, elite: 8, boss: 0, event: 25, rest: 20 },
    //             Events & rest are common ↑, elites rare in world 1
    difficulty: 1,
    layoutWeights: {
      open_field: 40, island: 35, corridors: 15,
      split_path: 10, gauntlet: 0, fortress: 0,
    },
    elementWeights: {
      [Element.Fire]: 35, [Element.Wind]: 30, [Element.Earth]: 15,
      [Element.Lightning]: 10, [Element.Water]: 10, [Element.Void]: 0,
    },
    baseThreatBudget: 5,
    baseWaveRange: [3, 5],
    startingGold: 250,
    enemyPool: ['runner', 'tank', 'striker', 'shielded'],
    bossElement: Element.Fire,
  },
  {
    id: 2,
    name: 'THE STORM',
    color: 0xffaa00,
    layers: 8,
    nodesPerLayer: [1, 3, 4, 5, 5, 4, 3, 1],
    nodeWeights: { battle: 30, shop: 10, elite: 18, boss: 0, event: 22, rest: 20 },
    difficulty: 2,
    layoutWeights: {
      open_field: 10, island: 25, corridors: 30,
      split_path: 20, gauntlet: 10, fortress: 5,
    },
    elementWeights: {
      [Element.Fire]: 10, [Element.Wind]: 10, [Element.Earth]: 10,
      [Element.Lightning]: 30, [Element.Water]: 25, [Element.Void]: 15,
    },
    baseThreatBudget: 8,
    baseWaveRange: [5, 7],
    startingGold: 200,
    enemyPool: ['runner', 'tank', 'striker', 'shielded', 'splitter', 'healer', 'elite'],
    bossElement: Element.Lightning,
  },
  {
    id: 3,
    name: 'THE VOID',
    color: 0xaa55ff,
    layers: 9,
    nodesPerLayer: [1, 3, 4, 5, 5, 5, 4, 3, 1],
    nodeWeights: { battle: 25, shop: 8, elite: 25, boss: 0, event: 22, rest: 20 },
    difficulty: 3,
    layoutWeights: {
      open_field: 0, island: 10, corridors: 15,
      split_path: 25, gauntlet: 25, fortress: 25,
    },
    elementWeights: {
      [Element.Fire]: 10, [Element.Wind]: 10, [Element.Earth]: 20,
      [Element.Lightning]: 10, [Element.Water]: 10, [Element.Void]: 40,
    },
    baseThreatBudget: 12,
    baseWaveRange: [7, 10],
    startingGold: 175,
    enemyPool: ['runner', 'tank', 'striker', 'shielded', 'splitter', 'healer', 'elite'],
    bossElement: Element.Void,
  },
];

export function getWorldConfig(worldId: number): WorldConfig | undefined {
  return WORLD_CONFIGS.find(w => w.id === worldId);
}
