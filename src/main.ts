import Phaser from 'phaser';
import { GAME, COLORS } from './constants';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { GameScene } from './scenes/GameScene';
import { GameOverScene } from './scenes/GameOverScene';
import { WorldMapScene } from './scenes/WorldMapScene';
import { ShopScene } from './scenes/ShopScene';
import { HudScene } from './ui/HudScene';
import { TowerBarScene } from './ui/TowerBarScene';
import { UnlockTreeScene } from './scenes/UnlockTreeScene';
import { ChallengeSelectScene } from './scenes/ChallengeSelectScene';
import { PersistentState } from './roguelite/PersistentState';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  // Fixed design resolution, FIT-scaled to the viewport. This is the
  // standard approach for fixed-aspect (16:9) browser games — gameplay
  // stays pixel-perfect across devices and the letterbox bars are
  // painted the game's background color via `backgroundColor` below +
  // the matching CSS `html/body { background }` in index.html, so they
  // blend into the atmosphere rather than looking like black voids.
  width: GAME.WIDTH,
  height: GAME.HEIGHT,
  parent: 'game-container',
  backgroundColor: '#' + COLORS.BG.toString(16).padStart(6, '0'),
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [
    BootScene,
    PreloadScene,
    MainMenuScene,
    GameScene,
    GameOverScene,
    WorldMapScene,
    ShopScene,
    HudScene,
    TowerBarScene,
    UnlockTreeScene,
    ChallengeSelectScene,
  ],
};

const game = new Phaser.Game(config);

// Initialize persistent state and store on registry for all scenes to access
const persistentState = new PersistentState();
game.registry.set('persistentState', persistentState);
