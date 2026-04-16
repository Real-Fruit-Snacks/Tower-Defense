import type { ChallengeConfig } from '../types';
import { Element } from '../constants';

/**
 * Hand-crafted challenges with unique modifier combinations.
 * Difficulty 1 = warmup, 5 = extreme.
 */
export const CHALLENGES: ChallengeConfig[] = [
  {
    id: 'glass_cannon',
    name: 'GLASS CANNON',
    description: 'Just 1 HP. Not a single enemy can leak. Towers start extra powerful with +50% gold.',
    modifiers: [
      { type: 'starting_hp', value: 1 },
      { type: 'starting_gold', value: 400 },
      { type: 'gold_mult', value: 1.5 },
    ],
    difficulty: 3,
    shardReward: 150,
  },
  {
    id: 'speed_demon',
    name: 'SPEED DEMON',
    description: 'All enemies move at 2x speed. Hope your reflexes are sharp.',
    modifiers: [
      { type: 'enemy_speed_mult', value: 2.0 },
      { type: 'starting_gold', value: 300 },
    ],
    difficulty: 4,
    shardReward: 200,
  },
  {
    id: 'frugal',
    name: 'FRUGAL',
    description: 'Half starting gold, half gold per kill. Every coin matters.',
    modifiers: [
      { type: 'starting_gold', value: 100 },
      { type: 'gold_mult', value: 0.5 },
    ],
    difficulty: 4,
    shardReward: 180,
  },
  {
    id: 'fire_only',
    name: 'FIRE STORM',
    description: 'Only fire element towers allowed. Element coverage is overrated.',
    modifiers: [
      { type: 'only_element', element: Element.Fire },
      { type: 'starting_gold', value: 300 },
    ],
    difficulty: 3,
    shardReward: 160,
  },
  {
    id: 'void_mastery',
    name: 'VOID MASTERY',
    description: 'Only void element towers. The darkness consumes all.',
    modifiers: [
      { type: 'only_element', element: Element.Void },
      { type: 'starting_gold', value: 350 },
    ],
    difficulty: 4,
    shardReward: 200,
  },
  {
    id: 'no_selling',
    name: 'NO REFUNDS',
    description: 'Towers cannot be sold. Place wisely.',
    modifiers: [
      { type: 'no_sell' },
      { type: 'starting_gold', value: 250 },
    ],
    difficulty: 2,
    shardReward: 100,
  },
  {
    id: 'minimalist',
    name: 'MINIMALIST',
    description: 'Maximum 8 towers on the field at once. No upgrades allowed.',
    modifiers: [
      { type: 'tower_limit', value: 8 },
      { type: 'no_upgrades' },
      { type: 'starting_gold', value: 400 },
    ],
    difficulty: 4,
    shardReward: 220,
  },
  {
    id: 'tough_crowd',
    name: 'TOUGH CROWD',
    description: 'Enemies have 2x HP. Bring the DPS.',
    modifiers: [
      { type: 'enemy_hp_mult', value: 2.0 },
      { type: 'starting_gold', value: 300 },
    ],
    difficulty: 3,
    shardReward: 160,
  },
  {
    id: 'fortress_gauntlet',
    name: 'FORTRESS GAUNTLET',
    description: 'Locked in the fortress. Force-spawned in a tight chokepoint map.',
    modifiers: [
      { type: 'force_layout', layout: 'fortress' },
      { type: 'enemy_hp_mult', value: 1.5 },
      { type: 'starting_gold', value: 250 },
    ],
    difficulty: 3,
    shardReward: 170,
  },
  {
    id: 'nightmare',
    name: 'NIGHTMARE',
    description: 'Everything is harder. 1 HP, fast tough enemies, no cheap escape.',
    modifiers: [
      { type: 'starting_hp', value: 1 },
      { type: 'enemy_hp_mult', value: 1.5 },
      { type: 'enemy_speed_mult', value: 1.5 },
      { type: 'starting_gold', value: 350 },
      { type: 'no_sell' },
    ],
    difficulty: 5,
    shardReward: 400,
  },
];

export function getChallenge(id: string): ChallengeConfig | undefined {
  return CHALLENGES.find(c => c.id === id);
}
