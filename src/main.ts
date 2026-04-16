import Phaser from 'phaser';
import { COLORS } from './constants';
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
  // RESIZE mode: canvas matches the actual viewport pixel-for-pixel.
  // Each scene handles its own layout:
  //   - Menu scenes use `this.scale.width/height` for centering.
  //   - GameScene uses a two-camera setup (bg cam spans full viewport,
  //     gameplay cam is zoomed + centered on the 1280×720 design space).
  //   - HUD/TowerBar render full-bleed bars with anchored content.
  // The initial width/height are overwritten immediately by the scale
  // manager based on the parent container size.
  width: window.innerWidth,
  height: window.innerHeight,
  parent: 'game-container',
  backgroundColor: '#' + COLORS.BG.toString(16).padStart(6, '0'),
  scale: {
    mode: Phaser.Scale.RESIZE,
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
