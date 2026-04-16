export const GRID = {
  COLS: 20,
  ROWS: 12,
  CELL_SIZE: 48,
} as const;

export enum Element {
  Fire = 'fire',
  Wind = 'wind',
  Earth = 'earth',
  Lightning = 'lightning',
  Water = 'water',
  Void = 'void',
}

/** Element wheel order — each beats the next clockwise */
export const ELEMENT_WHEEL: readonly Element[] = [
  Element.Fire,
  Element.Wind,
  Element.Earth,
  Element.Lightning,
  Element.Water,
  Element.Void,
];

export const COLORS = {
  BG: 0x08080f,
  FIRE: 0xff0055,
  WIND: 0x55ffaa,
  EARTH: 0xaa8844,
  LIGHTNING: 0xffaa00,
  WATER: 0x00aaff,
  VOID: 0xaa55ff,
  ACCENT_CYAN: 0x00ffff,
  ACCENT_PINK: 0xff0055,
  ACCENT_PURPLE: 0xa855f7,
  UI_BG: 0x0e0e18,
  UI_BORDER: 0x1e1e2e,
  UI_TEXT: 0xe0e0e0,
  GOLD: 0xffd700,
  HP_RED: 0xff4444,
  SUCCESS: 0x4ade80,
  DANGER: 0xf87171,
  GRID_LINE: 0xffffff,
  PATH: 0xffff00,
} as const;

export const ELEMENT_COLORS: Record<Element, number> = {
  [Element.Fire]: COLORS.FIRE,
  [Element.Wind]: COLORS.WIND,
  [Element.Earth]: COLORS.EARTH,
  [Element.Lightning]: COLORS.LIGHTNING,
  [Element.Water]: COLORS.WATER,
  [Element.Void]: COLORS.VOID,
};

export const GAME = {
  WIDTH: 1280,
  HEIGHT: 720,
  STARTING_GOLD: 200,
  STARTING_HP: 20,
  SELL_REFUND_RATIO: 0.6,
  MAX_SPEED: 3,
  WAVE_AUTO_START_DELAY: 5000,
  HUD_HEIGHT: 48,
  TOWER_BAR_HEIGHT: 80,
} as const;

export const EFFECTIVENESS = {
  STRONG: 1.5,
  NEUTRAL: 1.0,
  WEAK: 0.5,
} as const;

export const SCENES = {
  BOOT: 'BootScene',
  PRELOAD: 'PreloadScene',
  MAIN_MENU: 'MainMenuScene',
  GAME: 'GameScene',
  GAME_OVER: 'GameOverScene',
  WORLD_MAP: 'WorldMapScene',
  SHOP: 'ShopScene',
  HUD: 'HudScene',
  TOWER_BAR: 'TowerBarScene',
  UNLOCK_TREE_SCENE: 'UnlockTreeScene',
  CHALLENGE_SELECT: 'ChallengeSelectScene',
} as const;
