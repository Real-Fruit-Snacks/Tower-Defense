import { WaveDefinition } from '../types';
import { Element } from '../constants';

export const WAVE_DEFINITIONS: WaveDefinition[] = [
  // === Waves 1-5: Simple, single element, basic enemies ===
  {
    waveNumber: 1,
    groups: [
      { enemyId: 'runner', element: Element.Fire, count: 5, interval: 1500, delay: 0 },
    ],
    bonusGold: 20,
  },
  {
    waveNumber: 2,
    groups: [
      { enemyId: 'runner', element: Element.Wind, count: 6, interval: 1400, delay: 0 },
    ],
    bonusGold: 20,
  },
  {
    waveNumber: 3,
    groups: [
      { enemyId: 'runner', element: Element.Earth, count: 5, interval: 1200, delay: 0 },
      { enemyId: 'tank', element: Element.Earth, count: 2, interval: 2000, delay: 3000 },
    ],
    bonusGold: 25,
  },
  {
    waveNumber: 4,
    groups: [
      { enemyId: 'tank', element: Element.Lightning, count: 4, interval: 1800, delay: 0 },
      { enemyId: 'runner', element: Element.Lightning, count: 6, interval: 1000, delay: 3000 },
    ],
    bonusGold: 30,
  },
  {
    waveNumber: 5,
    groups: [
      { enemyId: 'runner', element: Element.Water, count: 8, interval: 1000, delay: 0 },
      { enemyId: 'tank', element: Element.Water, count: 3, interval: 1800, delay: 4000 },
    ],
    bonusGold: 40,
  },

  // === Waves 6-10: Mixed elements, introduce strikers and shielded ===
  {
    waveNumber: 6,
    groups: [
      { enemyId: 'runner', element: Element.Fire, count: 6, interval: 1000, delay: 0 },
      { enemyId: 'striker', element: Element.Wind, count: 4, interval: 1200, delay: 3000 },
    ],
    bonusGold: 40,
  },
  {
    waveNumber: 7,
    groups: [
      { enemyId: 'shielded', element: Element.Earth, count: 4, interval: 1500, delay: 0 },
      { enemyId: 'runner', element: Element.Lightning, count: 8, interval: 900, delay: 2500 },
    ],
    bonusGold: 45,
  },
  {
    waveNumber: 8,
    groups: [
      { enemyId: 'striker', element: Element.Void, count: 5, interval: 1100, delay: 0 },
      { enemyId: 'shielded', element: Element.Fire, count: 3, interval: 1600, delay: 3000 },
      { enemyId: 'tank', element: Element.Water, count: 4, interval: 1800, delay: 5000 },
    ],
    bonusGold: 50,
  },
  {
    waveNumber: 9,
    groups: [
      { enemyId: 'runner', element: Element.Wind, count: 10, interval: 800, delay: 0 },
      { enemyId: 'striker', element: Element.Lightning, count: 5, interval: 1200, delay: 2000 },
      { enemyId: 'shielded', element: Element.Earth, count: 3, interval: 1500, delay: 4000 },
    ],
    bonusGold: 60,
  },
  {
    waveNumber: 10,
    groups: [
      { enemyId: 'elite', element: Element.Void, count: 1, interval: 1000, delay: 0 },
      { enemyId: 'shielded', element: Element.Fire, count: 5, interval: 1200, delay: 3000 },
      { enemyId: 'striker', element: Element.Wind, count: 6, interval: 1000, delay: 5000 },
    ],
    bonusGold: 100,
  },

  // === Waves 11-15: All elements, splitters and healers appear ===
  {
    waveNumber: 11,
    groups: [
      { enemyId: 'splitter', element: Element.Water, count: 6, interval: 1200, delay: 0 },
      { enemyId: 'runner', element: Element.Fire, count: 8, interval: 900, delay: 3000 },
    ],
    bonusGold: 60,
  },
  {
    waveNumber: 12,
    groups: [
      { enemyId: 'healer', element: Element.Earth, count: 3, interval: 1500, delay: 0 },
      { enemyId: 'tank', element: Element.Earth, count: 5, interval: 1400, delay: 2000 },
      { enemyId: 'striker', element: Element.Lightning, count: 6, interval: 1000, delay: 4000 },
    ],
    bonusGold: 65,
  },
  {
    waveNumber: 13,
    groups: [
      { enemyId: 'splitter', element: Element.Void, count: 8, interval: 1100, delay: 0 },
      { enemyId: 'healer', element: Element.Wind, count: 3, interval: 1600, delay: 3000 },
      { enemyId: 'shielded', element: Element.Water, count: 5, interval: 1300, delay: 5000 },
    ],
    bonusGold: 70,
  },
  {
    waveNumber: 14,
    groups: [
      { enemyId: 'runner', element: Element.Lightning, count: 12, interval: 800, delay: 0 },
      { enemyId: 'healer', element: Element.Fire, count: 4, interval: 1400, delay: 2500 },
      { enemyId: 'splitter', element: Element.Earth, count: 6, interval: 1200, delay: 4500 },
    ],
    bonusGold: 75,
  },
  {
    waveNumber: 15,
    groups: [
      { enemyId: 'shielded', element: Element.Void, count: 6, interval: 1200, delay: 0 },
      { enemyId: 'healer', element: Element.Water, count: 4, interval: 1500, delay: 2000 },
      { enemyId: 'splitter', element: Element.Wind, count: 8, interval: 1000, delay: 4000 },
      { enemyId: 'tank', element: Element.Fire, count: 4, interval: 1800, delay: 5000 },
    ],
    bonusGold: 80,
  },

  // === Waves 16-19: Heavy multi-element waves, elites mixed in ===
  {
    waveNumber: 16,
    groups: [
      { enemyId: 'elite', element: Element.Earth, count: 2, interval: 2000, delay: 0 },
      { enemyId: 'striker', element: Element.Lightning, count: 8, interval: 900, delay: 2000 },
      { enemyId: 'splitter', element: Element.Water, count: 7, interval: 1100, delay: 4000 },
    ],
    bonusGold: 80,
  },
  {
    waveNumber: 17,
    groups: [
      { enemyId: 'healer', element: Element.Wind, count: 5, interval: 1300, delay: 0 },
      { enemyId: 'shielded', element: Element.Void, count: 8, interval: 1000, delay: 2500 },
      { enemyId: 'elite', element: Element.Fire, count: 2, interval: 2000, delay: 4500 },
      { enemyId: 'runner', element: Element.Water, count: 10, interval: 800, delay: 3000 },
    ],
    bonusGold: 90,
  },
  {
    waveNumber: 18,
    groups: [
      { enemyId: 'elite', element: Element.Lightning, count: 3, interval: 1800, delay: 0 },
      { enemyId: 'splitter', element: Element.Fire, count: 8, interval: 1000, delay: 2000 },
      { enemyId: 'healer', element: Element.Earth, count: 5, interval: 1200, delay: 4000 },
      { enemyId: 'shielded', element: Element.Wind, count: 6, interval: 1100, delay: 3500 },
    ],
    bonusGold: 95,
  },
  {
    waveNumber: 19,
    groups: [
      { enemyId: 'tank', element: Element.Void, count: 8, interval: 1200, delay: 0 },
      { enemyId: 'elite', element: Element.Water, count: 3, interval: 1800, delay: 2000 },
      { enemyId: 'striker', element: Element.Fire, count: 10, interval: 800, delay: 3500 },
      { enemyId: 'healer', element: Element.Lightning, count: 4, interval: 1400, delay: 5000 },
    ],
    bonusGold: 100,
  },

  // === Wave 20: Final boss wave ===
  {
    waveNumber: 20,
    groups: [
      { enemyId: 'boss', element: Element.Void, count: 1, interval: 1000, delay: 0 },
      { enemyId: 'elite', element: Element.Fire, count: 2, interval: 2000, delay: 3000 },
      { enemyId: 'elite', element: Element.Water, count: 2, interval: 2000, delay: 5000 },
      { enemyId: 'shielded', element: Element.Lightning, count: 6, interval: 1000, delay: 4000 },
      { enemyId: 'healer', element: Element.Earth, count: 4, interval: 1200, delay: 4500 },
      { enemyId: 'striker', element: Element.Wind, count: 8, interval: 900, delay: 3500 },
    ],
    bonusGold: 200,
  },
];
