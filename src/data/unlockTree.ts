import type { UnlockNode } from '../types';

export const UNLOCK_TREE: UnlockNode[] = [
  // Tier 1: Starting unlocks (cheap, 50-100 shards)
  { id: 'start', name: 'Begin', description: 'Starting node', cost: 0, prereqs: [], effect: { type: 'passive_bonus', stat: 'none', value: 0 } },
  { id: 'unlock_gale', name: 'Wind Affinity', description: 'Unlock Gale Arrow tower', cost: 50, prereqs: ['start'], effect: { type: 'unlock_tower', towerId: 'gale_arrow' } },
  { id: 'unlock_frost', name: 'Ice Affinity', description: 'Unlock Frost Beam tower', cost: 50, prereqs: ['start'], effect: { type: 'unlock_tower', towerId: 'frost_beam' } },
  { id: 'bonus_gold_1', name: 'Gold Stash I', description: '+25 starting gold', cost: 75, prereqs: ['start'], effect: { type: 'passive_bonus', stat: 'starting_gold', value: 25 } },

  // Tier 2: Mid-tier (100-300 shards)
  { id: 'unlock_spark', name: 'Storm Affinity', description: 'Unlock Spark Coil tower', cost: 100, prereqs: ['unlock_gale'], effect: { type: 'unlock_tower', towerId: 'spark_coil' } },
  { id: 'unlock_stone', name: 'Earth Affinity', description: 'Unlock Stone Pillar tower', cost: 100, prereqs: ['unlock_frost'], effect: { type: 'unlock_tower', towerId: 'stone_pillar' } },
  { id: 'unlock_rift', name: 'Void Affinity', description: 'Unlock Rift Siphon tower', cost: 150, prereqs: ['unlock_spark', 'unlock_stone'], effect: { type: 'unlock_tower', towerId: 'rift_siphon' } },
  { id: 'bonus_hp_1', name: 'Fortify I', description: '+3 max HP', cost: 120, prereqs: ['bonus_gold_1'], effect: { type: 'passive_bonus', stat: 'max_hp', value: 3 } },
  { id: 'unlock_cyclone', name: 'Cyclone Control', description: 'Unlock Cyclone Trap tower', cost: 100, prereqs: ['unlock_gale'], effect: { type: 'unlock_tower', towerId: 'cyclone_trap' } },
  { id: 'unlock_tidal', name: 'Tidal Control', description: 'Unlock Tidal Pulse tower', cost: 100, prereqs: ['unlock_frost'], effect: { type: 'unlock_tower', towerId: 'tidal_pulse' } },
  { id: 'bonus_sell', name: 'Better Deals', description: '+10% sell value', cost: 200, prereqs: ['bonus_gold_1'], effect: { type: 'passive_bonus', stat: 'sell_ratio', value: 0.1 } },

  // Tier 3: Advanced (300-600 shards)
  { id: 'unlock_inferno', name: 'Inferno Mastery', description: 'Unlock Inferno Ring tower', cost: 200, prereqs: ['start'], effect: { type: 'unlock_tower', towerId: 'inferno_ring' } },
  { id: 'unlock_quake', name: 'Quake Mastery', description: 'Unlock Quake Drum tower', cost: 200, prereqs: ['unlock_stone'], effect: { type: 'unlock_tower', towerId: 'quake_drum' } },
  { id: 'unlock_thunder', name: 'Thunder Mastery', description: 'Unlock Thunder Spire tower', cost: 300, prereqs: ['unlock_spark'], effect: { type: 'unlock_tower', towerId: 'thunder_spire' } },
  { id: 'unlock_null', name: 'Void Mastery', description: 'Unlock Null Field tower', cost: 300, prereqs: ['unlock_rift'], effect: { type: 'unlock_tower', towerId: 'null_field' } },
  { id: 'bonus_gold_2', name: 'Gold Stash II', description: '+50 starting gold', cost: 250, prereqs: ['bonus_gold_1'], effect: { type: 'passive_bonus', stat: 'starting_gold', value: 50 } },
  { id: 'bonus_hp_2', name: 'Fortify II', description: '+5 max HP', cost: 350, prereqs: ['bonus_hp_1'], effect: { type: 'passive_bonus', stat: 'max_hp', value: 5 } },

  // Tier 4: Utility and endgame (400-600 shards)
  { id: 'unlock_amplifier', name: 'Amplifier Tech', description: 'Unlock Amplifier Pylon', cost: 400, prereqs: ['bonus_sell'], effect: { type: 'unlock_tower', towerId: 'amplifier' } },
  { id: 'unlock_extractor', name: 'Mining Tech', description: 'Unlock Gold Extractor', cost: 500, prereqs: ['bonus_gold_2'], effect: { type: 'unlock_tower', towerId: 'gold_extractor' } },
  { id: 'unlock_endless', name: 'Endless Mode', description: 'Unlock Endless game mode', cost: 300, prereqs: ['bonus_hp_1'], effect: { type: 'unlock_mode', mode: 'endless' } },
  { id: 'unlock_challenges', name: 'Challenge Mode', description: 'Unlock Challenges', cost: 600, prereqs: ['unlock_endless'], effect: { type: 'unlock_mode', mode: 'challenges' } },
  { id: 'bonus_damage', name: 'Arsenal I', description: '+5% global damage', cost: 400, prereqs: ['unlock_thunder', 'unlock_null'], effect: { type: 'passive_bonus', stat: 'global_damage', value: 0.05 } },

  // ============================================================
  // Mastery gate + infinite shard sinks.
  // Once the main tree is fully unlocked, shards continue flowing in from
  // every run. Mastery nodes turn those shards into small permanent edges,
  // giving players something meaningful to spend on forever.
  //
  // All masteries live behind the `ascension` gate so they form their own
  // dedicated "prestige" tier (uncrowded & visually separated).
  // ============================================================
  {
    id: 'ascension',
    name: 'Ascension',
    description: 'Opens the path to infinite masteries.',
    cost: 500,
    prereqs: ['bonus_damage', 'unlock_extractor'],
    effect: { type: 'passive_bonus', stat: 'none', value: 0 },
  },
  {
    id: 'mastery_damage',
    name: 'Damage Mastery',
    description: '+1% global tower damage. Stacks infinitely.',
    cost: 250,
    costStep: 150,
    prereqs: ['ascension'],
    repeatable: true,
    effect: { type: 'passive_bonus', stat: 'global_damage', value: 0.01 },
  },
  {
    id: 'mastery_slow',
    name: 'Slowing Aura',
    description: '-0.5% enemy speed per level (max 40 = -20%).',
    cost: 300,
    costStep: 125,
    maxLevel: 40,
    prereqs: ['ascension'],
    repeatable: true,
    effect: { type: 'passive_bonus', stat: 'enemy_speed_reduction', value: 0.005 },
  },
  {
    id: 'mastery_gold',
    name: 'Greedy Strike',
    description: '+1% gold from kills & waves. Stacks infinitely.',
    cost: 200,
    costStep: 100,
    prereqs: ['ascension'],
    repeatable: true,
    effect: { type: 'passive_bonus', stat: 'gold_gain_mult', value: 0.01 },
  },
  {
    id: 'mastery_hp',
    name: 'Vitality',
    description: '+1 max HP. Stacks infinitely.',
    cost: 220,
    costStep: 120,
    prereqs: ['ascension'],
    repeatable: true,
    effect: { type: 'passive_bonus', stat: 'max_hp', value: 1 },
  },
  {
    id: 'mastery_sell',
    name: 'Broker',
    description: '+1% sell refund per level (max 30 = +30%).',
    cost: 180,
    costStep: 90,
    maxLevel: 30,
    prereqs: ['ascension'],
    repeatable: true,
    effect: { type: 'passive_bonus', stat: 'sell_ratio', value: 0.01 },
  },
  {
    id: 'mastery_starting_gold',
    name: 'War Chest',
    description: '+5 starting gold per level. Stacks infinitely.',
    cost: 200,
    costStep: 110,
    prereqs: ['ascension'],
    repeatable: true,
    effect: { type: 'passive_bonus', stat: 'starting_gold', value: 5 },
  },
];
