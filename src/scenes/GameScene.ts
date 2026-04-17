import Phaser from 'phaser';
import { SCENES, COLORS, GAME } from '../constants';
import type { GameEvents } from '../types';
import type { PersistentState } from '../roguelite/PersistentState';
import { EventBus } from '../utils/EventBus';
import { GridManager } from '../systems/GridManager';
import { PathfindingManager } from '../systems/PathfindingManager';
import { EconomyManager } from '../systems/EconomyManager';
import { WaveManager } from '../systems/WaveManager';
import { RunManager } from '../systems/RunManager';
import { GridRenderer } from '../rendering/GridRenderer';
import { ElementSystem } from '../systems/ElementSystem';
import { BackgroundRenderer } from '../rendering/BackgroundRenderer';
import { audioManager } from '../systems/AudioManager';
import { playPlacementEffect, showWaveAnnouncement, showWaveComplete, playRejectionEffect } from '../rendering/GameEffects';
import { TowerManager } from '../entities/towers/TowerManager';
import { EnemyManager } from '../entities/enemies/EnemyManager';
import { TowerInfoPanel } from '../ui/TowerInfoPanel';
import { TOWER_CONFIGS } from '../data/towers';
import { ENEMY_CONFIGS } from '../data/enemies';
import { WAVE_DEFINITIONS } from '../data/waves';
import type { ChallengeConfig, LayoutType, LevelConfig, WaveDefinition } from '../types';
import { LevelGenerator } from '../systems/LevelGenerator';
import { WORLD_CONFIGS } from '../data/worldMap';
import { SeededRNG } from '../data/levelLayouts';

interface GameSceneData {
  mode?: 'endless' | 'campaign' | 'challenge';
  difficulty?: number;
  isBoss?: boolean;
  levelConfig?: import('../types').LevelConfig;
  isElite?: boolean;
  maxWaves?: number;
  challenge?: ChallengeConfig;
}

export class GameScene extends Phaser.Scene {
  private gameEvents!: EventBus<GameEvents>;
  private gridManager!: GridManager;
  private pathfinding!: PathfindingManager;
  private economy!: EconomyManager;
  private waveManager!: WaveManager;
  private runManager!: RunManager;
  private gridRenderer!: GridRenderer;
  private towerManager!: TowerManager;
  private enemyManager!: EnemyManager;
  private towerInfoPanel!: TowerInfoPanel;
  private selectedTowerId: string | null = null;
  private gameSpeed = 1;
  private activeWaves: import('../types').WaveDefinition[] = [];
  private paused = false;
  private pauseOverlay?: Phaser.GameObjects.Container;
  private activeChallenge?: ChallengeConfig;
  private towerLimit = Infinity;
  private goldMultiplier = 1;
  private sellingAllowed = true;
  private upgradesAllowed = true;
  private endlessMode = false;
  private endlessRng?: SeededRNG;
  private autoStartWaves = false;
  private autoStartTimer?: Phaser.Time.TimerEvent;
  private gameOverTriggered = false;

  // --- RESIZE / multi-camera layout ---
  // Atmospheric background renders full-viewport via `bgCam`.
  // Gameplay renders via the default main camera, zoomed + centered on
  // the 1280×720 design space.
  // `overlayCam` sits on top for pause / fullscreen overlays.
  private bgLayer!: Phaser.GameObjects.Layer;
  private gameLayer!: Phaser.GameObjects.Layer;
  private overlayLayer!: Phaser.GameObjects.Layer;
  private bgCam!: Phaser.Cameras.Scene2D.Camera;
  private overlayCam!: Phaser.Cameras.Scene2D.Camera;
  private resizeHandler?: () => void;

  constructor() {
    super(SCENES.GAME);
  }

  create(data: GameSceneData): void {
    this.cameras.main.setBackgroundColor(COLORS.BG);
    this.gameEvents = new EventBus<GameEvents>();

    this.activeChallenge = data.challenge;
    this.towerLimit = Infinity;
    this.goldMultiplier = 1;
    this.sellingAllowed = true;
    this.upgradesAllowed = true;
    this.endlessMode = data.mode === 'endless';
    this.endlessRng = undefined;
    this.gameOverTriggered = false;
    this.paused = false;
    this.autoStartTimer = undefined;

    // --- Layer + camera setup (must come before any other game objects) ---
    this.setupLayersAndCameras();

    // Read accumulated passive bonuses from the unlock tree. These are
    // additive/multiplicative perks the player earned across runs.
    const persistentForBonuses = this.game.registry.get('persistentState') as PersistentState | undefined;
    const bonuses = persistentForBonuses?.unlockTree.getPassiveBonuses() ?? {};
    const bonusStartingGold = bonuses.starting_gold ?? 0;
    const bonusMaxHp = bonuses.max_hp ?? 0;
    const bonusSellRatio = bonuses.sell_ratio ?? 0;
    const bonusGlobalDamage = bonuses.global_damage ?? 0;
    // Speed reduction is clamped at 50% to keep the game solvable at extreme mastery.
    const bonusSpeedReduction = Math.min(Math.max(bonuses.enemy_speed_reduction ?? 0, 0), 0.5);
    const bonusGoldGain = bonuses.gold_gain_mult ?? 0;

    // Expose global damage to towers via scene registry.
    this.registry.set('globalDamageBonus', bonusGlobalDamage);

    // Resolve the level config based on mode
    let levelConfig: LevelConfig | undefined = data.levelConfig;

    // Endless mode: generate a fixed procedural map, waves are lazy
    if (data.mode === 'endless' && !levelConfig) {
      const endlessSeed = Date.now();
      levelConfig = LevelGenerator.generateEndlessLevel(endlessSeed);
      // Separate RNG drives wave generation for the full run
      this.endlessRng = new SeededRNG(endlessSeed + 17);
    }

    // Challenge mode: generate a fresh LevelConfig per attempt
    if (data.mode === 'challenge' && this.activeChallenge && !levelConfig) {
      levelConfig = this.generateChallengeLevelConfig(this.activeChallenge);
    }

    // Base configuration
    let waves: WaveDefinition[];
    let waveMultiplier: number;
    let startingGold: number;
    let startingHP: number = GAME.STARTING_HP;

    if (levelConfig) {
      waves = levelConfig.waves;
      waveMultiplier = 1;
      startingGold = levelConfig.startingGold;
    } else {
      const difficulty = data.difficulty ?? 1;
      waveMultiplier = 1 + (difficulty - 1) * 0.3;
      startingGold = GAME.STARTING_GOLD;

      waves = WAVE_DEFINITIONS;
      if (data.isBoss) {
        waves = WAVE_DEFINITIONS.slice(-1);
      } else if (data.isElite) {
        waves = WAVE_DEFINITIONS.slice(8, 14);
      } else if (data.maxWaves) {
        waves = WAVE_DEFINITIONS.slice(0, data.maxWaves);
      }
    }

    // Apply passive bonuses (before challenge overrides so challenges can still
    // cap starting gold/HP if they want to — e.g. "1 HP" overrides the bonus).
    startingGold += bonusStartingGold;
    startingHP += bonusMaxHp;
    if (bonusGoldGain > 0) this.goldMultiplier *= (1 + bonusGoldGain);

    // Apply challenge modifiers
    if (this.activeChallenge) {
      for (const mod of this.activeChallenge.modifiers) {
        switch (mod.type) {
          case 'starting_gold':
            startingGold = mod.value;
            break;
          case 'starting_hp':
            startingHP = mod.value;
            break;
          case 'enemy_hp_mult':
            waveMultiplier *= mod.value;
            break;
          case 'gold_mult':
            this.goldMultiplier = mod.value;
            break;
          case 'tower_limit':
            this.towerLimit = mod.value;
            break;
          case 'no_sell':
            this.sellingAllowed = false;
            break;
          case 'no_upgrades':
            this.upgradesAllowed = false;
            break;
          case 'wave_count':
            if (waves.length > mod.value) waves = waves.slice(0, mod.value);
            break;
          // enemy_speed_mult, ban_tower, ban_element, only_element, force_layout
          // are applied elsewhere (enemy spawn, tower filter, level gen)
        }
      }
    }

    // Atmospheric background renders via the bg camera across the full
    // viewport. All its graphics go into `bgLayer` which `bgCam` owns.
    new BackgroundRenderer(this, this.bgLayer);

    // Core systems
    this.gridManager = new GridManager(levelConfig);
    this.gridRenderer = new GridRenderer(this);
    this.pathfinding = new PathfindingManager(this.gridManager);
    this.economy = new EconomyManager(this.gameEvents, startingGold);
    this.economy.setEarnMultiplier(this.goldMultiplier);
    this.runManager = new RunManager(this.gameEvents, startingHP);
    this.enemyManager = new EnemyManager(this, this.gameEvents, this.gridRenderer);
    this.towerManager = new TowerManager(
      this, this.gameEvents, this.gridManager, this.pathfinding, this.economy, this.gridRenderer,
    );
    // Endless mode uses a lazy wave provider for infinite waves
    const waveProvider = this.endlessMode && this.endlessRng
      ? (index: number) => LevelGenerator.generateEndlessWave(index, this.endlessRng!)
      : waves;

    this.waveManager = new WaveManager(
      this, this.gameEvents, this.enemyManager,
      ENEMY_CONFIGS, waveProvider,
      (entryIndex = 0) => this.pathfinding.getPathForEntry(entryIndex),
    );
    this.waveManager.setWaveMultiplier(waveMultiplier);

    // Apply enemy speed modifier from challenge
    let enemySpeedMult = 1;
    if (this.activeChallenge) {
      for (const mod of this.activeChallenge.modifiers) {
        if (mod.type === 'enemy_speed_mult') enemySpeedMult = mod.value;
      }
    }
    // Stack the passive "Slowing Aura" mastery on top of any challenge speed mult.
    if (bonusSpeedReduction > 0) enemySpeedMult *= (1 - bonusSpeedReduction);
    this.waveManager.setSpeedMultiplier(enemySpeedMult);

    // Apply sell-ratio mastery (stacks additively with the base 60% refund).
    if (bonusSellRatio > 0) this.economy.setSellBonus(bonusSellRatio);

    this.activeWaves = waves;

    // Draw grid
    this.gridRenderer.drawGrid();
    this.gridRenderer.drawEntryExit(this.gridManager.entries, this.gridManager.exits);
    if (levelConfig?.gridObstacles.length) {
      this.gridRenderer.drawObstacles(levelConfig.gridObstacles);
    }
    this.gridRenderer.drawPath(this.pathfinding.getPath());

    // Read auto-start preference from persisted settings
    this.autoStartWaves = persistentForBonuses?.saveManager.getData().settings.autoStartWaves ?? false;

    // UI overlays
    this.scene.launch(SCENES.HUD, {
      events: this.gameEvents,
      gold: startingGold,
      hp: startingHP,
      wave: 1,
      totalWaves: this.endlessMode ? Infinity : waves.length,
      onStartWave: () => this.startWave(),
      onSetSpeed: (speed: number) => this.setGameSpeed(speed),
      onToggleAutoStart: (enabled: boolean) => {
        this.autoStartWaves = enabled;
        persistentForBonuses?.saveManager.updateSettings({ autoStartWaves: enabled });
        // If turning off mid-countdown, cancel the pending start.
        if (!enabled && this.autoStartTimer) {
          this.autoStartTimer.remove(false);
          this.autoStartTimer = undefined;
        }
      },
      // Mobile-accessible pause — there is no ESC key on touch devices,
      // so the HUD pause pill is the only way to open the Resume /
      // Restart / Quit overlay on phones and tablets.
      onTogglePause: () => this.togglePause(),
      autoStart: this.autoStartWaves,
    });

    // Filter towers by unlocks
    const persistent = this.game.registry.get('persistentState') as PersistentState | undefined;
    const unlockedTowerIds = persistent?.unlockTree.getUnlockedTowerIds() ?? [];
    const defaultTowers = ['ember_bolt'];
    let availableTowers = TOWER_CONFIGS.filter(t =>
      defaultTowers.includes(t.id) || unlockedTowerIds.includes(t.id),
    );

    // Apply challenge tower restrictions
    if (this.activeChallenge) {
      for (const mod of this.activeChallenge.modifiers) {
        if (mod.type === 'ban_tower') {
          availableTowers = availableTowers.filter(t => t.id !== mod.towerId);
        } else if (mod.type === 'only_element') {
          availableTowers = availableTowers.filter(t => t.element === mod.element);
        } else if (mod.type === 'ban_element') {
          availableTowers = availableTowers.filter(t => t.element !== mod.element);
        }
      }
    }

    this.scene.launch(SCENES.TOWER_BAR, {
      events: this.gameEvents,
      towerConfigs: availableTowers,
      gold: startingGold,
    });

    // Tower info panel
    this.towerInfoPanel = new TowerInfoPanel(
      this,
      this.gameEvents,
      (tower) => {
        if (!this.sellingAllowed) return;
        this.towerManager.sellTower(tower);
      },
      (tower, branchIndex) => {
        if (!this.upgradesAllowed) return;
        this.towerManager.upgradeTower(tower, branchIndex);
      },
    );

    // Initial wave preview in HUD (wait for HUD scene to be ready)
    const initialWave = this.waveManager.peekWave(0);
    this.time.delayedCall(50, () => {
      const hudScene = this.scene.get(SCENES.HUD) as unknown as import('../ui/HudScene').HudScene;
      hudScene?.updateWavePreview(initialWave);
    });

    // Input: grid clicks + hover highlights.
    //
    // We can't use pointer.worldX/Y here because Phaser updates those by
    // iterating every camera in the scene that contains the pointer, and
    // the LAST one wins. Our overlayCam / bgCam both cover the full
    // viewport at zoom 1, so they'd overwrite the gameplay cam's
    // projection with raw screen coords and every click would land in
    // the wrong grid cell. Project through the gameplay cam explicitly.
    const projectPointer = (pointer: Phaser.Input.Pointer): Phaser.Math.Vector2 => {
      return this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    };

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const world = projectPointer(pointer);
      this.handleGridClick(world.x, world.y);
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      const world = projectPointer(pointer);
      this.handleGridHover(world.x, world.y);
    });

    // Listen for tower selection from bar
    this.gameEvents.on('TOWER_SELECTED', ({ towerId }) => {
      this.selectedTowerId = towerId;
      this.towerInfoPanel.hide();
      audioManager.playSFX('ui_click');
    });

    // Tower placed: visual + audio
    this.gameEvents.on('TOWER_PLACED', ({ row, col }) => {
      const { x, y } = this.gridRenderer.gridToWorld(row, col);
      const towerAtPos = this.towerManager.getTowerAt(row, col);
      const color = towerAtPos ? ElementSystem.getColor(towerAtPos.config.element) : COLORS.ACCENT_CYAN;
      playPlacementEffect(this, x, y, color);
      audioManager.playSFX('tower_place');
      this.cameras.main.shake(50, 0.001);
    });

    // Tower sold: audio
    this.gameEvents.on('TOWER_SOLD', () => {
      audioManager.playSFX('tower_sell');
    });

    // Tower upgraded: audio
    this.gameEvents.on('TOWER_UPGRADED', () => {
      audioManager.playSFX('upgrade');
    });

    // Placement rejected: visual + audio
    this.gameEvents.on('PLACEMENT_REJECTED', ({ row, col }) => {
      const { x, y } = this.gridRenderer.gridToWorld(row, col);
      playRejectionEffect(this, x, y);
      audioManager.playSFX('rejection');
    });

    // Enemy killed: audio + damage number
    this.gameEvents.on('ENEMY_KILLED', ({ isBoss }) => {
      audioManager.playSFX('enemy_kill');
      if (isBoss) {
        this.cameras.main.shake(400, 0.012); // big shake for boss
      } else {
        this.cameras.main.shake(60, 0.001); // tiny shake for normal
      }
    });

    // Enemy leaked: audio
    this.gameEvents.on('ENEMY_LEAKED', () => {
      audioManager.playSFX('enemy_leak');
      this.cameras.main.flash(150, 255, 50, 50);
      this.cameras.main.shake(120, 0.004);
    });

    // Listen for path updates
    this.gameEvents.on('PATH_UPDATED', ({ waypoints }) => {
      this.gridRenderer.drawPath(waypoints);
    });

    // Listen for game state
    this.gameEvents.on('GAME_STATE_CHANGED', ({ state }) => {
      audioManager.setGameState(state);
      if (state === 'gameover') {
        this.handleGameOver(false);
      }
    });

    // Wave start: announcement + audio
    this.gameEvents.on('WAVE_START', ({ waveNumber }) => {
      // Endless mode: scale enemy HP per wave (waveNumber is 1-based; waveIndex is 0-based)
      if (this.endlessMode) {
        const waveIndex = waveNumber - 1;
        const hpMult = LevelGenerator.endlessHpMultiplier(waveIndex);
        // Preserve any challenge multiplier (not applicable in endless, but safe)
        this.waveManager.setWaveMultiplier(hpMult);
      }

      // Boss wave detection
      const isBossWave = this.endlessMode
        ? waveNumber % 10 === 0
        : waveNumber === this.activeWaves.length;

      showWaveAnnouncement(this, waveNumber, isBossWave);
      audioManager.playSFX(isBossWave ? 'boss_alert' : 'wave_start');
    });

    // Listen for wave end
    this.gameEvents.on('WAVE_END', ({ waveNumber, bonusGold }) => {
      const hudScene = this.scene.get(SCENES.HUD) as unknown as import('../ui/HudScene').HudScene;
      const totalWaves = this.endlessMode ? Infinity : this.activeWaves.length;
      hudScene.updateWaveDisplay(waveNumber + 1, totalWaves);

      // Wave clear announcement
      showWaveComplete(this, bonusGold);
      audioManager.playSFX('wave_clear');

      // Show next wave preview (works for both array + lazy providers)
      hudScene.updateWavePreview(this.waveManager.peekWave(waveNumber));

      // Gold Extractor passive income
      const extractorGold = this.towerManager.getWaveGoldGeneration();
      if (extractorGold > 0) {
        this.economy.addGold(extractorGold);
      }

      // Check victory
      if (this.waveManager.isAllWavesComplete()) {
        this.handleGameOver(true);
        return;
      }

      // Schedule auto-start of the next wave if the toggle is on.
      if (this.autoStartWaves) {
        this.autoStartTimer?.remove(false);
        this.autoStartTimer = this.time.delayedCall(GAME.AUTO_START_DELAY, () => {
          this.autoStartTimer = undefined;
          // Re-check the flag in case the player toggled off during the countdown.
          if (this.autoStartWaves && this.waveManager.getState() === 'idle') {
            this.startWave();
          }
        });
      }
    });

    // Any WAVE_START cancels a pending auto-start (player clicked manually).
    this.gameEvents.on('WAVE_START', () => {
      this.autoStartTimer?.remove(false);
      this.autoStartTimer = undefined;
    });

    // Pause on ESC
    this.input.keyboard?.on('keydown-ESC', () => this.togglePause());

    this.runManager.setState('build');
  }

  private togglePause(): void {
    if (this.paused) {
      this.resumeGame();
    } else {
      this.pauseGame();
    }
  }

  private pauseGame(): void {
    this.paused = true;
    this.scene.pause(SCENES.HUD);
    this.scene.pause(SCENES.TOWER_BAR);

    // The pause UI is drawn by `overlayCam` which covers the full viewport
    // so the dim + buttons extend past the centered gameplay region.
    const vw = this.scale.width;
    const vh = this.scale.height;
    const container = this.add.container(0, 0);
    this.overlayLayer.add(container);

    // Full-screen dim
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.7);
    bg.fillRect(0, 0, vw, vh);
    container.add(bg);

    // Centered text column
    const cx = vw / 2;
    const cy = vh / 2;

    const title = this.add.text(cx, cy - 110, 'PAUSED', {
      fontFamily: 'Segoe UI, system-ui, sans-serif',
      fontSize: 36,
      color: '#00ffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    container.add(title);

    const resume = this.add.text(cx, cy - 20, 'RESUME', {
      fontFamily: 'Segoe UI, system-ui, sans-serif',
      fontSize: 20,
      color: '#4ade80',
      fontStyle: 'bold',
      padding: { x: 20, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    resume.on('pointerdown', () => this.resumeGame());
    resume.on('pointerover', () => resume.setAlpha(0.7));
    resume.on('pointerout', () => resume.setAlpha(1));
    container.add(resume);

    const restart = this.add.text(cx, cy + 40, 'RESTART', {
      fontFamily: 'Segoe UI, system-ui, sans-serif',
      fontSize: 20,
      color: '#ffaa00',
      fontStyle: 'bold',
      padding: { x: 20, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    restart.on('pointerdown', () => {
      this.resumeGame();
      this.scene.stop(SCENES.HUD);
      this.scene.stop(SCENES.TOWER_BAR);
      this.scene.restart();
    });
    restart.on('pointerover', () => restart.setAlpha(0.7));
    restart.on('pointerout', () => restart.setAlpha(1));
    container.add(restart);

    const quit = this.add.text(cx, cy + 100, 'QUIT TO MENU', {
      fontFamily: 'Segoe UI, system-ui, sans-serif',
      fontSize: 20,
      color: '#f87171',
      fontStyle: 'bold',
      padding: { x: 20, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    quit.on('pointerdown', () => {
      this.resumeGame();
      this.handleGameOver(false);
    });
    quit.on('pointerover', () => quit.setAlpha(0.7));
    quit.on('pointerout', () => quit.setAlpha(1));
    container.add(quit);

    this.pauseOverlay = container;
  }

  private resumeGame(): void {
    this.paused = false;
    this.pauseOverlay?.destroy(true);
    this.pauseOverlay = undefined;
    this.scene.resume(SCENES.HUD);
    this.scene.resume(SCENES.TOWER_BAR);
  }

  update(time: number, delta: number): void {
    if (this.paused) return;

    const scaledDelta = delta * this.gameSpeed;

    this.gridRenderer.update(time, scaledDelta);
    this.waveManager.update(time, scaledDelta);
    this.enemyManager.update(time, scaledDelta);
    this.towerManager.update(time, scaledDelta, this.enemyManager.getActiveEnemies());
  }

  /**
   * Create three layers (bg / game / overlay) and three cameras so the
   * gameplay renders at a zoomed+centered viewport while the background
   * fills the full screen and overlays sit on top.
   *
   * Render order (cameras render in insertion index order):
   *   1. bgCam       — full viewport, shows `bgLayer`
   *   2. mainCam     — zoomed + centered, shows `gameLayer`
   *   3. overlayCam  — full viewport, shows `overlayLayer`
   *
   * New GameObjects added via `scene.add.*` are auto-routed to
   * `gameLayer` so the bg/overlay cameras never see gameplay content.
   * BackgroundRenderer is given `bgLayer` explicitly; pause UI is added
   * to `overlayLayer` explicitly.
   */
  private setupLayersAndCameras(): void {
    this.bgLayer = this.add.layer().setDepth(-100);
    this.gameLayer = this.add.layer().setDepth(0);
    this.overlayLayer = this.add.layer().setDepth(1000);

    // Route any future scene-root addition into gameLayer. BackgroundRenderer
    // and pause UI bypass this by calling layer.add() manually before their
    // objects hit the scene root.
    const onAddedToScene = (obj: Phaser.GameObjects.GameObject): void => {
      // Layers are themselves GameObjects but we never want to re-parent them.
      const asAny = obj as unknown as Phaser.GameObjects.Layer;
      if (asAny === this.bgLayer || asAny === this.gameLayer || asAny === this.overlayLayer) return;
      // Skip objects that already have a parent (a Layer's .add already ran).
      if (obj.parentContainer) return;
      const go = obj as unknown as { displayList?: unknown };
      if (go.displayList !== this.children) return;
      this.gameLayer.add(obj);
    };
    this.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, onAddedToScene);

    // bgCam: full viewport, bg-only.
    this.bgCam = this.cameras.add(0, 0, this.scale.width, this.scale.height, false, 'bg');
    this.bgCam.ignore([this.gameLayer, this.overlayLayer]);

    // overlayCam: full viewport, overlay-only (pause UI, fullscreen fade).
    this.overlayCam = this.cameras.add(0, 0, this.scale.width, this.scale.height, false, 'overlay');
    this.overlayCam.ignore([this.bgLayer, this.gameLayer]);

    // Main cam = gameplay. Zooms + centers the 1280×720 design space.
    this.cameras.main.setName('gameplay');
    this.cameras.main.setOrigin(0, 0);
    this.cameras.main.ignore([this.bgLayer, this.overlayLayer]);

    // Re-order cameras so bgCam renders first (beneath gameplay), then
    // mainCam (gameplay), then overlayCam (on top). `cameras.cameras` is
    // the render-order list.
    const list = this.cameras.cameras;
    const desired = [this.bgCam, this.cameras.main, this.overlayCam];
    list.length = 0;
    list.push(...desired);

    // Compute viewport / zoom for the initial window size.
    this.layout();

    // Resize listener — recompute every camera viewport on window resize
    // or orientation change.
    this.resizeHandler = (): void => this.layout();
    this.scale.on('resize', this.resizeHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.resizeHandler) this.scale.off('resize', this.resizeHandler);
      this.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, onAddedToScene);
    });
  }

  /**
   * Size/position the three cameras against the current viewport.
   * - bgCam + overlayCam: full viewport
   * - mainCam: 1280×720 design space scaled to fit inside the viewport
   *   (preserving aspect), centered.
   */
  private layout(): void {
    const vw = this.scale.width;
    const vh = this.scale.height;

    // Scale gameplay to fit the viewport while preserving the 16:9 aspect.
    const scale = Math.min(vw / GAME.WIDTH, vh / GAME.HEIGHT);
    const renderedW = GAME.WIDTH * scale;
    const renderedH = GAME.HEIGHT * scale;
    const offsetX = (vw - renderedW) / 2;
    const offsetY = (vh - renderedH) / 2;

    this.cameras.main.setViewport(offsetX, offsetY, renderedW, renderedH);
    this.cameras.main.setZoom(scale);
    this.cameras.main.setScroll(0, 0);

    this.bgCam.setViewport(0, 0, vw, vh);
    this.overlayCam.setViewport(0, 0, vw, vh);
  }

  /**
   * Build a LevelConfig for a challenge attempt.
   * Uses world 2 (THE STORM) as the base config; applies force_layout + wave_count modifiers.
   * Seed is derived from challenge id + timestamp so each attempt is unique.
   */
  private generateChallengeLevelConfig(challenge: ChallengeConfig): LevelConfig {
    // Stable hash of the challenge id for deterministic variation per challenge
    let hash = 0;
    for (let i = 0; i < challenge.id.length; i++) {
      hash = (hash * 31 + challenge.id.charCodeAt(i)) | 0;
    }
    const seed = (Date.now() ^ hash) >>> 0;

    // Find force_layout + wave_count if set
    let forceLayout: LayoutType | undefined;
    let forceWaveCount: number | undefined;
    for (const mod of challenge.modifiers) {
      if (mod.type === 'force_layout') forceLayout = mod.layout;
      if (mod.type === 'wave_count') forceWaveCount = mod.value;
    }

    // Default ~10 waves for challenges unless overridden
    const waveCount = forceWaveCount ?? 10;

    // Use world 2 (THE STORM) as mid-difficulty base for challenges
    const worldConfig = WORLD_CONFIGS[1]!;

    return LevelGenerator.generate({
      seed,
      worldId: worldConfig.id,
      nodeDifficulty: worldConfig.difficulty,
      nodeType: 'battle',
      worldConfig,
      forceLayout,
      forceWaveCount: waveCount,
    });
  }

  private handleGridClick(worldX: number, worldY: number): void {
    const cell = this.gridRenderer.worldToGrid(worldX, worldY);
    if (!cell) return;

    // Priority 1: Clicking an existing tower always opens its info panel
    const existingTower = this.towerManager.getTowerAt(cell.row, cell.col);
    if (existingTower) {
      // Deselect any bar tower so placement mode exits
      if (this.selectedTowerId) {
        this.selectedTowerId = null;
        this.gameEvents.emit('TOWER_SELECTED', { towerId: null });
      }
      this.towerInfoPanel.show(existingTower, this.economy.getGold());
      return;
    }

    // Priority 2: If we have a tower selected from the bar, try to place it
    if (this.selectedTowerId) {
      if (this.towerManager.getTowers().length >= this.towerLimit) {
        this.gameEvents.emit('PLACEMENT_REJECTED', {
          row: cell.row, col: cell.col, reason: 'Tower limit reached',
        });
        return;
      }
      const config = TOWER_CONFIGS.find(t => t.id === this.selectedTowerId);
      if (config) {
        this.towerManager.placeTower(config, cell.row, cell.col);
      }
      return;
    }

    // Priority 3: Clicking an empty cell with nothing selected → close panel
    this.towerInfoPanel.hide();
  }

  private handleGridHover(worldX: number, worldY: number): void {
    const cell = this.gridRenderer.worldToGrid(worldX, worldY);
    if (!cell) {
      this.gridRenderer.clearHighlight();
      return;
    }

    // Hovering an existing tower always shows its range + highlight (clickable to inspect)
    const existingTower = this.towerManager.getTowerAt(cell.row, cell.col);
    if (existingTower) {
      this.gridRenderer.highlightCell(cell.row, cell.col, COLORS.ACCENT_CYAN, 0.12);
      this.gridRenderer.drawRangeCircle(cell.row, cell.col, existingTower.getRange(), ElementSystem.getColor(existingTower.config.element));
      return;
    }

    // Otherwise, if we have a tower selected from the bar, show placement preview
    if (this.selectedTowerId) {
      const buildable = this.gridManager.isCellBuildable(cell.row, cell.col);
      const color = buildable ? COLORS.SUCCESS : COLORS.DANGER;
      this.gridRenderer.highlightCell(cell.row, cell.col, color, 0.15);

      if (buildable) {
        const config = TOWER_CONFIGS.find(t => t.id === this.selectedTowerId);
        if (config) {
          this.gridRenderer.drawRangeCircle(cell.row, cell.col, config.baseRange, COLORS.ACCENT_CYAN);
        }
      }
    } else {
      this.gridRenderer.clearHighlight();
    }
  }

  private startWave(): void {
    this.waveManager.startWave();
  }

  private setGameSpeed(speed: number): void {
    this.gameSpeed = speed;
  }

  private handleGameOver(victory: boolean): void {
    // Idempotent guard — prevents multi-leak bursts or stacked events from
    // triggering the transition twice (which would stop scenes repeatedly
    // and schedule multiple GAME_OVER starts).
    if (this.gameOverTriggered) return;
    this.gameOverTriggered = true;

    // Freeze the game loop so enemies can't keep moving/leaking and towers
    // can't keep firing during the 500ms transition.
    this.paused = true;

    // Cancel any pending auto-start timer so it doesn't fire mid-transition.
    this.autoStartTimer?.remove(false);
    this.autoStartTimer = undefined;

    const stats = this.runManager.getStats(victory);

    // Stop overlay scenes
    this.scene.stop(SCENES.HUD);
    this.scene.stop(SCENES.TOWER_BAR);

    this.time.delayedCall(500, () => {
      this.scene.start(SCENES.GAME_OVER, {
        ...stats,
        victory,
      });
    });
  }

  shutdown(): void {
    // Cancel any pending auto-start timer explicitly. Phaser auto-cleans
    // TimerEvents on scene shutdown, but leaning on that means a timer
    // scheduled seconds earlier could briefly fire against a torn-down
    // scene if the timing lines up with a restart.
    this.autoStartTimer?.remove(false);
    this.autoStartTimer = undefined;

    // Clear all listeners on the shared event bus — GameScene owns this
    // bus and HudScene + TowerBarScene both read it. Clearing here stops
    // any in-flight events from reaching torn-down overlay scenes.
    this.gameEvents.removeAll();

    this.towerManager.clearAll();
    this.enemyManager.clearAll();
    this.gridRenderer.destroy();
  }
}
