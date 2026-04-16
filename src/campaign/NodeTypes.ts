import type { NodeType } from '../types';
import { COLORS } from '../constants';

export interface NodeTypeConfig {
  type: NodeType;
  icon: string;
  color: number;
  label: string;
  description: string;
}

export const NODE_TYPE_CONFIGS: Record<NodeType, NodeTypeConfig> = {
  battle: {
    type: 'battle',
    icon: '⚔',
    color: COLORS.ACCENT_PINK,
    label: 'BATTLE',
    description: 'Fight waves of enemies',
  },
  shop: {
    type: 'shop',
    icon: '$',
    color: COLORS.GOLD,
    label: 'SHOP',
    description: 'Buy upgrades and items',
  },
  elite: {
    type: 'elite',
    icon: '★',
    color: COLORS.ACCENT_PURPLE,
    label: 'ELITE',
    description: 'Harder battle, better rewards',
  },
  boss: {
    type: 'boss',
    icon: '☠',
    color: COLORS.LIGHTNING,
    label: 'BOSS',
    description: 'Defeat the world boss',
  },
  event: {
    type: 'event',
    icon: '?',
    color: COLORS.ACCENT_CYAN,
    label: 'EVENT',
    description: 'A random encounter',
  },
  rest: {
    type: 'rest',
    icon: '♥',
    color: COLORS.SUCCESS,
    label: 'REST',
    description: 'Restore HP',
  },
};
