import type { UpgradeBranch } from '../types';

/**
 * Upgrade paths for all 14 towers.
 * Each tower has 2-3 branches, each with 3 levels.
 * Stat boosts are cumulative multipliers (e.g. 0.2 = +20% of base).
 */
export const TOWER_UPGRADES: Record<string, UpgradeBranch[]> = {
  ember_bolt: [
    {
      branchName: 'Focused Flame',
      levels: [
        { cost: 60, damageBoost: 0.2, rangeBoost: 0, speedBoost: 0, description: '+20% damage' },
        { cost: 120, damageBoost: 0.5, rangeBoost: 0, speedBoost: 0, description: '+50% damage' },
        { cost: 180, damageBoost: 1.0, rangeBoost: 0.1, speedBoost: 0, description: '+100% damage, +10% range' },
      ],
    },
    {
      branchName: 'Rapid Ignition',
      levels: [
        { cost: 60, damageBoost: 0, rangeBoost: 0, speedBoost: 0.2, description: '+20% speed' },
        { cost: 120, damageBoost: 0.15, rangeBoost: 0, speedBoost: 0.4, description: '+40% speed, +15% damage' },
        { cost: 180, damageBoost: 0.3, rangeBoost: 0, speedBoost: 0.7, description: '+70% speed, +30% damage' },
      ],
    },
  ],

  inferno_ring: [
    {
      branchName: 'Widening Blaze',
      levels: [
        { cost: 75, damageBoost: 0.1, rangeBoost: 0.2, speedBoost: 0, description: '+20% range' },
        { cost: 150, damageBoost: 0.2, rangeBoost: 0.4, speedBoost: 0, description: '+40% range' },
        { cost: 225, damageBoost: 0.3, rangeBoost: 0.7, speedBoost: 0.1, description: '+70% range, +10% speed' },
      ],
    },
    {
      branchName: 'Intensify',
      levels: [
        { cost: 75, damageBoost: 0.3, rangeBoost: 0, speedBoost: 0, description: '+30% damage' },
        { cost: 150, damageBoost: 0.6, rangeBoost: 0, speedBoost: 0.15, description: '+60% damage' },
        { cost: 225, damageBoost: 1.0, rangeBoost: 0, speedBoost: 0.3, description: '+100% damage, +30% speed' },
      ],
    },
  ],

  gale_arrow: [
    {
      branchName: 'Hurricane Shot',
      levels: [
        { cost: 40, damageBoost: 0, rangeBoost: 0, speedBoost: 0.2, description: '+20% speed' },
        { cost: 80, damageBoost: 0.1, rangeBoost: 0, speedBoost: 0.5, description: '+50% speed' },
        { cost: 120, damageBoost: 0.2, rangeBoost: 0.1, speedBoost: 0.8, description: '+80% attack speed' },
      ],
    },
    {
      branchName: 'Piercing Gust',
      levels: [
        { cost: 40, damageBoost: 0.3, rangeBoost: 0, speedBoost: 0, description: '+30% damage' },
        { cost: 80, damageBoost: 0.6, rangeBoost: 0.15, speedBoost: 0, description: '+60% damage' },
        { cost: 120, damageBoost: 1.0, rangeBoost: 0.3, speedBoost: 0, description: '+100% damage, +30% range' },
      ],
    },
  ],

  cyclone_trap: [
    {
      branchName: 'Wider Vortex',
      levels: [
        { cost: 65, damageBoost: 0, rangeBoost: 0.25, speedBoost: 0, description: '+25% range' },
        { cost: 130, damageBoost: 0.2, rangeBoost: 0.5, speedBoost: 0, description: '+50% range' },
        { cost: 195, damageBoost: 0.4, rangeBoost: 0.8, speedBoost: 0.1, description: '+80% range' },
      ],
    },
    {
      branchName: 'Crushing Winds',
      levels: [
        { cost: 65, damageBoost: 0.4, rangeBoost: 0, speedBoost: 0.1, description: '+40% damage' },
        { cost: 130, damageBoost: 0.8, rangeBoost: 0, speedBoost: 0.2, description: '+80% damage' },
        { cost: 195, damageBoost: 1.2, rangeBoost: 0, speedBoost: 0.3, description: '+120% damage' },
      ],
    },
  ],

  stone_pillar: [
    {
      branchName: 'Monolith',
      levels: [
        { cost: 90, damageBoost: 0.25, rangeBoost: 0, speedBoost: 0, description: '+25% damage' },
        { cost: 180, damageBoost: 0.5, rangeBoost: 0.1, speedBoost: 0, description: '+50% damage' },
        { cost: 270, damageBoost: 1.0, rangeBoost: 0.2, speedBoost: 0, description: '+100% damage' },
      ],
    },
    {
      branchName: 'Rapid Strike',
      levels: [
        { cost: 90, damageBoost: 0, rangeBoost: 0, speedBoost: 0.3, description: '+30% speed' },
        { cost: 180, damageBoost: 0.2, rangeBoost: 0, speedBoost: 0.6, description: '+60% speed' },
        { cost: 270, damageBoost: 0.4, rangeBoost: 0.1, speedBoost: 1.0, description: '+100% speed' },
      ],
    },
  ],

  quake_drum: [
    {
      branchName: 'Seismic Wave',
      levels: [
        { cost: 80, damageBoost: 0.15, rangeBoost: 0.2, speedBoost: 0, description: '+20% range' },
        { cost: 160, damageBoost: 0.3, rangeBoost: 0.4, speedBoost: 0, description: '+40% range' },
        { cost: 240, damageBoost: 0.5, rangeBoost: 0.7, speedBoost: 0.1, description: '+70% range' },
      ],
    },
    {
      branchName: 'Tremor',
      levels: [
        { cost: 80, damageBoost: 0.3, rangeBoost: 0, speedBoost: 0.15, description: '+30% damage' },
        { cost: 160, damageBoost: 0.7, rangeBoost: 0, speedBoost: 0.3, description: '+70% damage' },
        { cost: 240, damageBoost: 1.2, rangeBoost: 0, speedBoost: 0.4, description: '+120% damage' },
      ],
    },
  ],

  spark_coil: [
    {
      branchName: 'Chain Mastery',
      levels: [
        { cost: 70, damageBoost: 0.2, rangeBoost: 0.1, speedBoost: 0, description: '+20% damage', special: 'Chains to +1 target' },
        { cost: 140, damageBoost: 0.4, rangeBoost: 0.2, speedBoost: 0, description: '+40% damage', special: 'Chains to +2 targets' },
        { cost: 210, damageBoost: 0.7, rangeBoost: 0.3, speedBoost: 0.1, description: '+70% damage', special: 'Chains to +3 targets' },
      ],
    },
    {
      branchName: 'Overcharge',
      levels: [
        { cost: 70, damageBoost: 0.3, rangeBoost: 0, speedBoost: 0.2, description: '+30% damage, +20% speed' },
        { cost: 140, damageBoost: 0.6, rangeBoost: 0, speedBoost: 0.4, description: '+60% damage, +40% speed' },
        { cost: 210, damageBoost: 1.0, rangeBoost: 0, speedBoost: 0.6, description: '+100% damage, +60% speed' },
      ],
    },
  ],

  thunder_spire: [
    {
      branchName: 'Reach',
      levels: [
        { cost: 100, damageBoost: 0, rangeBoost: 0.15, speedBoost: 0.1, description: '+15% range' },
        { cost: 200, damageBoost: 0.2, rangeBoost: 0.3, speedBoost: 0.2, description: '+30% range' },
        { cost: 300, damageBoost: 0.4, rangeBoost: 0.5, speedBoost: 0.3, description: '+50% range' },
      ],
    },
    {
      branchName: 'Devastation',
      levels: [
        { cost: 100, damageBoost: 0.3, rangeBoost: 0, speedBoost: 0, description: '+30% damage' },
        { cost: 200, damageBoost: 0.7, rangeBoost: 0, speedBoost: 0.1, description: '+70% damage' },
        { cost: 300, damageBoost: 1.2, rangeBoost: 0, speedBoost: 0.2, description: '+120% damage' },
      ],
    },
  ],

  frost_beam: [
    {
      branchName: 'Deep Freeze',
      levels: [
        { cost: 60, damageBoost: 0.2, rangeBoost: 0, speedBoost: 0.1, description: '+20% damage' },
        { cost: 120, damageBoost: 0.4, rangeBoost: 0.1, speedBoost: 0.2, description: '+40% damage' },
        { cost: 180, damageBoost: 0.7, rangeBoost: 0.2, speedBoost: 0.3, description: '+70% damage' },
      ],
    },
    {
      branchName: 'Frost Nova',
      levels: [
        { cost: 60, damageBoost: 0.1, rangeBoost: 0.2, speedBoost: 0, description: '+20% range' },
        { cost: 120, damageBoost: 0.2, rangeBoost: 0.4, speedBoost: 0, description: '+40% range' },
        { cost: 180, damageBoost: 0.3, rangeBoost: 0.7, speedBoost: 0.1, description: '+70% range, AoE slow' },
      ],
    },
  ],

  tidal_pulse: [
    {
      branchName: 'Tsunami',
      levels: [
        { cost: 70, damageBoost: 0.3, rangeBoost: 0.1, speedBoost: 0, description: '+30% damage' },
        { cost: 140, damageBoost: 0.6, rangeBoost: 0.2, speedBoost: 0.1, description: '+60% damage' },
        { cost: 210, damageBoost: 1.0, rangeBoost: 0.3, speedBoost: 0.2, description: '+100% damage' },
      ],
    },
    {
      branchName: 'Undertow',
      levels: [
        { cost: 70, damageBoost: 0.1, rangeBoost: 0, speedBoost: 0.3, description: '+30% speed' },
        { cost: 140, damageBoost: 0.2, rangeBoost: 0.15, speedBoost: 0.6, description: '+60% speed' },
        { cost: 210, damageBoost: 0.3, rangeBoost: 0.3, speedBoost: 1.0, description: '+100% speed' },
      ],
    },
  ],

  rift_siphon: [
    {
      branchName: 'Void Drain',
      levels: [
        { cost: 85, damageBoost: 0.2, rangeBoost: 0.1, speedBoost: 0, description: '+20% damage' },
        { cost: 170, damageBoost: 0.5, rangeBoost: 0.2, speedBoost: 0.1, description: '+50% damage' },
        { cost: 255, damageBoost: 0.9, rangeBoost: 0.3, speedBoost: 0.2, description: '+90% damage' },
      ],
    },
    {
      branchName: 'Life Steal',
      levels: [
        { cost: 85, damageBoost: 0.1, rangeBoost: 0, speedBoost: 0.2, description: '+20% speed', special: 'Heals 1 HP per kill' },
        { cost: 170, damageBoost: 0.2, rangeBoost: 0.1, speedBoost: 0.4, description: '+40% speed', special: 'Heals 2 HP per kill' },
        { cost: 255, damageBoost: 0.4, rangeBoost: 0.2, speedBoost: 0.6, description: '+60% speed', special: 'Heals 3 HP per kill' },
      ],
    },
  ],

  null_field: [
    {
      branchName: 'Entropy',
      levels: [
        { cost: 95, damageBoost: 0.3, rangeBoost: 0.15, speedBoost: 0, description: '+30% damage, +15% range' },
        { cost: 190, damageBoost: 0.6, rangeBoost: 0.3, speedBoost: 0.1, description: '+60% damage, +30% range' },
        { cost: 285, damageBoost: 1.0, rangeBoost: 0.5, speedBoost: 0.2, description: '+100% damage, +50% range' },
      ],
    },
    {
      branchName: 'Suppression',
      levels: [
        { cost: 95, damageBoost: 0, rangeBoost: 0.2, speedBoost: 0.2, description: '+20% range, +20% speed' },
        { cost: 190, damageBoost: 0.2, rangeBoost: 0.4, speedBoost: 0.3, description: '+40% range, +30% speed' },
        { cost: 285, damageBoost: 0.4, rangeBoost: 0.6, speedBoost: 0.5, description: '+60% range, +50% speed' },
      ],
    },
  ],

  amplifier: [
    {
      branchName: 'Power Surge',
      levels: [
        { cost: 100, damageBoost: 0, rangeBoost: 0.3, speedBoost: 0, description: '+30% buff range' },
        { cost: 200, damageBoost: 0, rangeBoost: 0.6, speedBoost: 0, description: '+60% buff range' },
        { cost: 300, damageBoost: 0, rangeBoost: 1.0, speedBoost: 0, description: '+100% buff range' },
      ],
    },
  ],

  gold_extractor: [
    {
      branchName: 'Deep Mining',
      levels: [
        { cost: 125, damageBoost: 0, rangeBoost: 0, speedBoost: 0, description: '+50% gold generation', special: 'gold_bonus_50' },
        { cost: 250, damageBoost: 0, rangeBoost: 0, speedBoost: 0, description: '+100% gold generation', special: 'gold_bonus_100' },
        { cost: 375, damageBoost: 0, rangeBoost: 0, speedBoost: 0, description: '+200% gold generation', special: 'gold_bonus_200' },
      ],
    },
  ],
};
