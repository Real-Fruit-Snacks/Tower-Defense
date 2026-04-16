import Phaser from 'phaser';
import { setupStageCamera } from '../utils/StageCamera';
import { SCENES, COLORS, GAME } from '../constants';
import { createGlowText, drawNeonRect } from '../rendering/NeonEffects';
import { ShapeRenderer } from '../rendering/ShapeRenderer';
import type { NodeMapNode, NodeType } from '../types';
import { randomInt, randomRange } from '../utils/MathUtils';
import { CampaignState } from '../campaign/CampaignState';
import type { PersistentState } from '../roguelite/PersistentState';

// ============ Node visual config ============

const NODE_COLORS: Record<NodeType, number> = {
  battle: COLORS.ACCENT_PINK,
  shop: COLORS.GOLD,
  elite: COLORS.ACCENT_PURPLE,
  boss: COLORS.LIGHTNING,
  event: COLORS.ACCENT_CYAN,
  rest: COLORS.SUCCESS,
};

const NODE_SHAPES: Record<NodeType, string> = {
  battle: 'hexagon',
  shop: 'diamond',
  elite: 'star',
  boss: 'octagon',
  event: 'pentagon',
  rest: 'circle',
};

const NODE_SIZES: Record<NodeType, number> = {
  battle: 16,
  shop: 16,
  elite: 17,
  boss: 24,
  event: 14,
  rest: 14,
};

const FONT_FAMILY = 'Segoe UI, system-ui, sans-serif';
const FONT_MONO = 'monospace';
const HEADER_HEIGHT = 72;

interface BgParticle {
  gfx: Phaser.GameObjects.Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: number;
  pulsePhase: number;
  baseAlpha: number;
}

interface NodeVisual {
  container: Phaser.GameObjects.Container;
  outerGlow: Phaser.GameObjects.Graphics;
  pulseRing?: Phaser.GameObjects.Graphics;
  size: number;
  color: number;
  state: 'current' | 'accessible' | 'visited' | 'locked';
}

// ============ Scene ============

export class WorldMapScene extends Phaser.Scene {
  private nodes: NodeMapNode[] = [];
  private currentNodeId = 'start';
  private campaignState!: CampaignState;
  /** Idempotent guard so rapid taps only ever trigger one enterNode. */
  private nodeEntryTriggered = false;
  private bgParticles: BgParticle[] = [];

  // Graphics layers
  private connectionGfx!: Phaser.GameObjects.Graphics;
  private connectionFlowGfx!: Phaser.GameObjects.Graphics;
  private glowGfx!: Phaser.GameObjects.Graphics;
  private headerSeparator!: Phaser.GameObjects.Graphics;
  private scanLine!: Phaser.GameObjects.Graphics;
  private scanLineY = 0;

  // Node visuals
  private nodeVisuals: Map<string, NodeVisual> = new Map();

  // Flow animation offset
  private flowOffset = 0;

  // Header display elements
  private shardText!: Phaser.GameObjects.Text;
  private hpText!: Phaser.GameObjects.Text;

  constructor() {
    super(SCENES.WORLD_MAP);
  }

  create(): void {
    setupStageCamera(this);
    this.cameras.main.setBackgroundColor(COLORS.BG);
    this.bgParticles = [];
    this.nodeVisuals.clear();
    this.scanLineY = 0;
    this.flowOffset = 0;
    this.nodeEntryTriggered = false;

    // Initialize campaign state
    const persistent = this.game.registry.get('persistentState') as PersistentState | undefined;
    if (persistent) {
      this.campaignState = new CampaignState(persistent.saveManager);
      if (!this.campaignState.isRunActive()) {
        this.campaignState.startNewRun();
      }
    }

    // Generate map for current world
    this.nodes = this.campaignState?.generateMapForCurrentWorld() ?? this.generateMap();
    this.currentNodeId = this.campaignState?.getCurrentNodeId() ?? 'start';

    // World theme color
    const worldConfig = this.campaignState?.getWorldConfig();
    const worldColor = worldConfig?.color ?? COLORS.ACCENT_CYAN;

    this.createBackground(worldColor);
    this.createHeader(worldColor, persistent);
    this.createConnectionsLayers();
    this.drawConnections();
    this.createNodes();

    // Entrance animation — stagger nodes by layer
    this.animateEntrance();

    // Back button
    this.createBackButton();

    // Flash on entry. Kept short so it doesn't block a node-click flash
    // if the player taps immediately — any in-flight entry flash is also
    // reset inside triggerNodeEntry() as a belt-and-suspenders guard.
    this.cameras.main.flash(180, 0, 255, 255, true, undefined, 0.08);
  }

  // ============ Background ============

  private createBackground(worldColor: number): void {
    // Vignette
    const vignette = this.add.graphics().setDepth(-3);
    for (let i = 0; i < 14; i++) {
      const inset = i * 15;
      const alpha = 0.3 * (1 - i / 14);
      vignette.fillStyle(0x000000, alpha);
      vignette.fillRect(0, inset, GAME.WIDTH, GAME.HEIGHT - inset * 2);
      vignette.fillRect(inset, 0, GAME.WIDTH - inset * 2, GAME.HEIGHT);
    }

    // World-tinted radial glow behind everything
    const worldGlow = this.add.graphics().setDepth(-2);
    worldGlow.setBlendMode(Phaser.BlendModes.ADD);
    worldGlow.fillStyle(worldColor, 0.04);
    worldGlow.fillCircle(GAME.WIDTH / 2, GAME.HEIGHT / 2, 450);
    worldGlow.fillStyle(worldColor, 0.02);
    worldGlow.fillCircle(GAME.WIDTH / 2, GAME.HEIGHT / 2, 350);

    // Subtle grid
    const gridGfx = this.add.graphics().setDepth(-2);
    gridGfx.lineStyle(0.5, COLORS.ACCENT_CYAN, 0.03);
    for (let x = 0; x < GAME.WIDTH; x += 50) {
      gridGfx.lineBetween(x, 0, x, GAME.HEIGHT);
    }
    for (let y = 0; y < GAME.HEIGHT; y += 50) {
      gridGfx.lineBetween(0, y, GAME.WIDTH, y);
    }

    // Static scanlines
    const scanStatic = this.add.graphics().setDepth(-2);
    scanStatic.lineStyle(0.5, 0xffffff, 0.012);
    for (let y = 0; y < GAME.HEIGHT; y += 3) {
      scanStatic.lineBetween(0, y, GAME.WIDTH, y);
    }

    // Moving scan line
    this.scanLine = this.add.graphics().setDepth(-1);
    this.scanLine.setBlendMode(Phaser.BlendModes.ADD);

    // Floating particles — biased toward world color
    const colors = [worldColor, worldColor, COLORS.ACCENT_CYAN, COLORS.ACCENT_PINK, COLORS.ACCENT_PURPLE];
    for (let i = 0; i < 40; i++) {
      const color = colors[Math.floor(Math.random() * colors.length)] ?? worldColor;
      const baseAlpha = randomRange(0.04, 0.10);
      const size = randomRange(1, 3);

      const gfx = this.add.graphics().setDepth(-1);
      gfx.setBlendMode(Phaser.BlendModes.ADD);
      gfx.fillStyle(color, baseAlpha);
      gfx.fillCircle(0, 0, size);

      const x = randomRange(0, GAME.WIDTH);
      const y = randomRange(HEADER_HEIGHT, GAME.HEIGHT);
      gfx.setPosition(x, y);

      this.bgParticles.push({
        gfx, x, y,
        vx: randomRange(-10, 10),
        vy: randomRange(-8, 8),
        color,
        pulsePhase: randomRange(0, Math.PI * 2),
        baseAlpha,
      });
    }
  }

  // ============ Header ============

  private createHeader(worldColor: number, persistent?: PersistentState): void {
    // Gradient header background
    const headerBg = this.add.graphics().setDepth(19);
    headerBg.fillGradientStyle(0x0e0e1a, 0x0e0e1a, 0x08080f, 0x08080f, 0.95, 0.95, 0.85, 0.85);
    headerBg.fillRect(0, 0, GAME.WIDTH, HEADER_HEIGHT);

    // Animated separator line
    this.headerSeparator = this.add.graphics().setDepth(20);
    this.headerSeparator.setBlendMode(Phaser.BlendModes.ADD);

    // World title
    const worldName = this.campaignState?.getWorldConfig()?.name ?? 'WORLD MAP';
    const worldNum = this.campaignState?.getCurrentWorldId() ?? 1;
    const totalWorlds = 3;

    const title = createGlowText(this, GAME.WIDTH / 2, 22, worldName, worldColor, 22);
    title.setDepth(22);

    // World position indicator dots (e.g. ●○○ for world 1/3)
    const dotsY = 44;
    const dotSpacing = 12;
    const totalDotsW = (totalWorlds - 1) * dotSpacing;
    for (let i = 0; i < totalWorlds; i++) {
      const dotX = GAME.WIDTH / 2 - totalDotsW / 2 + i * dotSpacing;
      const completed = this.campaignState?.getCurrentWorldId() !== undefined
        && i + 1 < this.campaignState.getCurrentWorldId();
      const isCurrent = i + 1 === worldNum;

      const dot = this.add.graphics().setDepth(22);
      dot.setBlendMode(Phaser.BlendModes.ADD);
      if (completed) {
        dot.fillStyle(COLORS.SUCCESS, 0.8);
        dot.fillCircle(dotX, dotsY, 4);
      } else if (isCurrent) {
        dot.fillStyle(worldColor, 0.9);
        dot.fillCircle(dotX, dotsY, 4);
        dot.lineStyle(1, worldColor, 0.5);
        dot.strokeCircle(dotX, dotsY, 6);
      } else {
        dot.lineStyle(1, 0x555555, 0.6);
        dot.strokeCircle(dotX, dotsY, 3.5);
      }
    }

    // Stats on right: shards + HP
    const shards = persistent?.shardTracker.getShards() ?? 0;
    const hp = this.campaignState?.getHP() ?? 20;

    // Shard badge
    const shardX = GAME.WIDTH - 170;
    this.drawStatBadge(shardX, 20, COLORS.ACCENT_PURPLE, 'hexagon');
    this.shardText = this.add.text(shardX + 24, 20, `${shards}`, {
      fontFamily: FONT_FAMILY,
      fontSize: 16,
      color: '#a855f7',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(22);
    this.add.text(shardX + 24, 37, 'SHARDS', {
      fontFamily: FONT_MONO,
      fontSize: 8,
      color: '#a855f7',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(22).setAlpha(0.6).setLetterSpacing(2);

    // HP badge
    const hpX = GAME.WIDTH - 80;
    this.drawStatBadge(hpX, 20, COLORS.DANGER, 'heart');
    this.hpText = this.add.text(hpX + 24, 20, `${hp}`, {
      fontFamily: FONT_FAMILY,
      fontSize: 16,
      color: '#ff4444',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(22);
    this.add.text(hpX + 24, 37, 'HP', {
      fontFamily: FONT_MONO,
      fontSize: 8,
      color: '#ff4444',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(22).setAlpha(0.6).setLetterSpacing(2);
  }

  private drawStatBadge(x: number, y: number, color: number, shape: 'hexagon' | 'heart'): void {
    const gfx = this.add.graphics().setDepth(22);
    gfx.setBlendMode(Phaser.BlendModes.ADD);

    // Glow aura
    gfx.fillStyle(color, 0.2);
    gfx.fillCircle(x + 8, y, 11);

    if (shape === 'hexagon') {
      const points: Phaser.Geom.Point[] = [];
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        points.push(new Phaser.Geom.Point(x + 8 + 7 * Math.cos(angle), y + 7 * Math.sin(angle)));
      }
      gfx.fillStyle(color, 0.5);
      gfx.fillPoints(points, true);
      gfx.lineStyle(1.5, color, 1);
      gfx.strokePoints(points, true);
      // Inner dot
      gfx.fillStyle(0xffffff, 0.4);
      gfx.fillCircle(x + 8, y, 2.5);
    } else {
      // Heart
      gfx.fillStyle(color, 0.85);
      gfx.fillCircle(x + 5, y - 2, 4);
      gfx.fillCircle(x + 11, y - 2, 4);
      gfx.fillTriangle(x + 1, y, x + 15, y, x + 8, y + 7);
      gfx.fillStyle(0xffffff, 0.3);
      gfx.fillCircle(x + 4.5, y - 2.5, 1.5);
    }
  }

  private createBackButton(): void {
    const btn = this.add.container(50, 20).setDepth(25);
    const bg = this.add.graphics();
    drawNeonRect(bg, -40, -14, 80, 28, COLORS.ACCENT_CYAN, 0.1, 5);
    btn.add(bg);

    const text = this.add.text(0, 0, '← BACK', {
      fontFamily: FONT_FAMILY,
      fontSize: 11,
      color: '#00ffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setLetterSpacing(2);
    btn.add(text);

    const hitArea = new Phaser.Geom.Rectangle(-40, -14, 80, 28);
    btn.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);

    btn.on('pointerover', () => {
      this.input.setDefaultCursor('pointer');
      bg.clear();
      drawNeonRect(bg, -40, -14, 80, 28, COLORS.ACCENT_CYAN, 0.25, 5);
      this.tweens.add({ targets: btn, scaleX: 1.05, scaleY: 1.05, duration: 100 });
    });
    btn.on('pointerout', () => {
      this.input.setDefaultCursor('default');
      bg.clear();
      drawNeonRect(bg, -40, -14, 80, 28, COLORS.ACCENT_CYAN, 0.1, 5);
      this.tweens.add({ targets: btn, scaleX: 1, scaleY: 1, duration: 100 });
    });
    btn.on('pointerdown', () => {
      this.cameras.main.fadeOut(200, 8, 8, 15);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start(SCENES.MAIN_MENU);
      });
    });
  }

  // ============ Connections ============

  private createConnectionsLayers(): void {
    this.glowGfx = this.add.graphics().setDepth(0);
    this.glowGfx.setBlendMode(Phaser.BlendModes.ADD);
    this.connectionGfx = this.add.graphics().setDepth(1);
    this.connectionFlowGfx = this.add.graphics().setDepth(2);
    this.connectionFlowGfx.setBlendMode(Phaser.BlendModes.ADD);
  }

  private drawConnections(): void {
    this.connectionGfx.clear();
    this.glowGfx.clear();

    const currentNode = this.nodes.find(n => n.id === this.currentNodeId);
    const accessibleIds = currentNode ? currentNode.connections : [];

    for (const node of this.nodes) {
      for (const connId of node.connections) {
        const target = this.nodes.find(n => n.id === connId);
        if (!target) continue;

        const isVisitedConnection = this.isVisited(node.id) && this.isVisited(target.id);
        const isActivePath = node.id === this.currentNodeId && accessibleIds.includes(target.id);

        const color = NODE_COLORS[target.type];

        if (isVisitedConnection) {
          // Walked path — solid green with soft glow
          this.glowGfx.lineStyle(4, COLORS.SUCCESS, 0.12);
          this.drawCurvedLine(this.glowGfx, node.x, node.y, target.x, target.y);
          this.connectionGfx.lineStyle(2, COLORS.SUCCESS, 0.55);
          this.drawCurvedLine(this.connectionGfx, node.x, node.y, target.x, target.y);
        } else if (isActivePath) {
          // Next-step options — bright colored line with big glow
          this.glowGfx.lineStyle(8, color, 0.1);
          this.drawCurvedLine(this.glowGfx, node.x, node.y, target.x, target.y);
          this.glowGfx.lineStyle(4, color, 0.18);
          this.drawCurvedLine(this.glowGfx, node.x, node.y, target.x, target.y);

          this.connectionGfx.lineStyle(2.5, color, 0.85);
          this.drawCurvedLine(this.connectionGfx, node.x, node.y, target.x, target.y);
        } else {
          // Locked / future paths — dim but visible
          this.connectionGfx.lineStyle(1.2, 0x888888, 0.15);
          this.drawCurvedLine(this.connectionGfx, node.x, node.y, target.x, target.y);
        }
      }
    }
  }

  /** Draw flowing dots along active-path connections — called per frame */
  private drawFlowingDots(): void {
    this.connectionFlowGfx.clear();
    const currentNode = this.nodes.find(n => n.id === this.currentNodeId);
    if (!currentNode) return;

    for (const connId of currentNode.connections) {
      const target = this.nodes.find(n => n.id === connId);
      if (!target) continue;
      const color = NODE_COLORS[target.type];

      // 3 flowing dots
      for (let i = 0; i < 3; i++) {
        const t = ((this.flowOffset * 0.0005 + i / 3) % 1);
        const { px, py } = this.pointOnCurve(currentNode.x, currentNode.y, target.x, target.y, t);
        this.connectionFlowGfx.fillStyle(color, 0.85);
        this.connectionFlowGfx.fillCircle(px, py, 3);
        this.connectionFlowGfx.fillStyle(0xffffff, 0.5);
        this.connectionFlowGfx.fillCircle(px, py, 1.3);
      }
    }
  }

  private drawCurvedLine(gfx: Phaser.GameObjects.Graphics, x1: number, y1: number, x2: number, y2: number): void {
    const steps = 18;
    gfx.beginPath();
    gfx.moveTo(x1, y1);
    for (let i = 1; i <= steps; i++) {
      const { px, py } = this.pointOnCurve(x1, y1, x2, y2, i / steps);
      gfx.lineTo(px, py);
    }
    gfx.strokePath();
  }

  private pointOnCurve(x1: number, y1: number, x2: number, y2: number, t: number): { px: number; py: number } {
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const curveAmount = Math.abs(dy) * 0.15;
    const cpX = midX + (dy / len) * curveAmount;
    const cpY = midY - (dx / len) * curveAmount;
    const invT = 1 - t;
    return {
      px: invT * invT * x1 + 2 * invT * t * cpX + t * t * x2,
      py: invT * invT * y1 + 2 * invT * t * cpY + t * t * y2,
    };
  }

  // ============ Nodes ============

  private createNodes(): void {
    const currentNode = this.nodes.find(n => n.id === this.currentNodeId);
    const accessibleIds = currentNode ? currentNode.connections : [];

    for (const node of this.nodes) {
      const visited = this.isVisited(node.id);
      const isCurrent = node.id === this.currentNodeId;
      const isAccessible = accessibleIds.includes(node.id);

      let state: NodeVisual['state'];
      if (isCurrent) state = 'current';
      else if (isAccessible) state = 'accessible';
      else if (visited) state = 'visited';
      else state = 'locked';

      this.createNode(node, state);
    }
  }

  private createNode(node: NodeMapNode, state: NodeVisual['state']): void {
    // Start and boss get special treatment
    if (node.id === 'start') {
      this.createStartNode(node, state);
      return;
    }
    if (node.type === 'boss') {
      this.createBossNode(node, state);
      return;
    }

    const color = NODE_COLORS[node.type];
    const size = NODE_SIZES[node.type];
    const shape = NODE_SHAPES[node.type];

    const container = this.add.container(node.x, node.y).setDepth(3);

    // ─── Outer glow ───
    const outerGlow = this.add.graphics();
    outerGlow.setBlendMode(Phaser.BlendModes.ADD);
    container.add(outerGlow);
    this.drawOuterGlow(outerGlow, color, size, state);

    // ─── Main shape ───
    const mainGfx = this.add.graphics();
    this.drawMainShape(mainGfx, shape, size, color, state);
    container.add(mainGfx);

    // ─── Core (small bright center for active states) ───
    if (state === 'current' || state === 'accessible') {
      const core = this.add.graphics();
      ShapeRenderer.drawPolygon(core, 0, 0, this.shapeSides(shape), size * 0.4, color, 0.7, color, 0);
      container.add(core);

      const whiteDot = this.add.graphics();
      whiteDot.fillStyle(0xffffff, 0.2);
      whiteDot.fillCircle(0, 0, size * 0.2);
      container.add(whiteDot);
    }

    // ─── Visited checkmark ───
    if (state === 'visited') {
      const check = this.add.graphics();
      check.lineStyle(1.5, COLORS.SUCCESS, 0.85);
      check.lineBetween(-4, 0, -1, 3);
      check.lineBetween(-1, 3, 5, -4);
      container.add(check);
    }

    // ─── Current node indicators ───
    let pulseRing: Phaser.GameObjects.Graphics | undefined;
    if (state === 'current') {
      // Rotating dashed ring
      pulseRing = this.add.graphics();
      pulseRing.setBlendMode(Phaser.BlendModes.ADD);
      container.add(pulseRing);

      // "YOU ARE HERE" indicator — diamond marker floating above
      const markerY = -size - 20;
      const marker = this.add.graphics().setDepth(4);
      marker.setPosition(node.x, node.y);
      marker.setBlendMode(Phaser.BlendModes.ADD);
      marker.fillStyle(0xffffff, 0.9);
      marker.fillTriangle(0, markerY + 4, -5, markerY - 3, 5, markerY - 3);
      marker.fillStyle(COLORS.ACCENT_CYAN, 0.5);
      marker.fillCircle(0, markerY - 1, 4);

      // Bob animation for the marker
      this.tweens.add({
        targets: marker, y: node.y - 4,
        duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    }

    // ─── Accessible: pulsing ring (alpha pulse, not scale) ───
    if (state === 'accessible') {
      pulseRing = this.add.graphics();
      pulseRing.setBlendMode(Phaser.BlendModes.ADD);
      container.add(pulseRing);
    }

    // ─── Accessibility / click handler ───
    if (state === 'accessible') {
      const hitZone = this.add.zone(0, 0, size * 2.8, size * 2.8)
        .setInteractive({ useHandCursor: true });
      container.add(hitZone);

      hitZone.on('pointerover', () => {
        this.input.setDefaultCursor('pointer');
        this.tweens.add({
          targets: container, scaleX: 1.25, scaleY: 1.25,
          duration: 120, ease: 'Back.easeOut',
        });
        outerGlow.clear();
        outerGlow.fillStyle(color, 0.22);
        outerGlow.fillCircle(0, 0, size * 2);
      });

      hitZone.on('pointerout', () => {
        this.input.setDefaultCursor('default');
        this.tweens.add({
          targets: container, scaleX: 1, scaleY: 1,
          duration: 120, ease: 'Quad.easeOut',
        });
        this.drawOuterGlow(outerGlow, color, size, 'accessible');
      });

      hitZone.on('pointerdown', () => {
        // Click feedback is decoupled from navigation. Navigation fires
        // via a time event so it doesn't depend on the feedback tween's
        // onComplete (which was unreliable during the entrance animation
        // that competes for the same scaleX/scaleY properties).
        this.triggerNodeEntry(node, container, color);
      });
    }

    this.nodeVisuals.set(node.id, { container, outerGlow, pulseRing, size, color, state });
  }

  /**
   * Central node-entry dispatcher. Shared by regular and boss nodes.
   *
   * Notes on the `force: true` on every flash here:
   *   Phaser's Camera.flash silently ignores follow-up calls while a
   *   previous flash is still running, UNLESS `force` is true. The
   *   scene's entry flash (cyan, 300ms) would otherwise swallow the
   *   click feedback, so the player sees no response to their tap and
   *   tries again — hitting the idempotent guard and thinking nothing
   *   happened. Forcing the flash guarantees visible click feedback.
   *
   * The transition itself is scheduled on the scene clock so it fires
   * independently of any tween lifecycle or Phaser internal state.
   */
  private triggerNodeEntry(
    node: NodeMapNode,
    container: Phaser.GameObjects.Container,
    color: number,
    isBoss = false,
  ): void {
    if (this.nodeEntryTriggered) return;
    this.nodeEntryTriggered = true;

    // Cancel any in-progress camera fx so our click feedback always wins.
    this.cameras.main.resetFX();

    const r = (color >> 16) & 0xff;
    const g = (color >> 8) & 0xff;
    const b = color & 0xff;
    if (isBoss) {
      this.cameras.main.flash(200, 255, 180, 0, true, undefined, 0.25);
      this.cameras.main.shake(200, 0.008);
    } else {
      this.cameras.main.flash(110, r, g, b, true, undefined, 0.2);
    }

    this.tweens.add({
      targets: container,
      scaleX: isBoss ? 0.88 : 0.9,
      scaleY: isBoss ? 0.88 : 0.9,
      duration: isBoss ? 90 : 70,
      yoyo: true,
    });

    this.time.delayedCall(isBoss ? 160 : 110, () => this.enterNode(node));
  }

  // ============ Start Node (dedicated treatment) ============

  private createStartNode(node: NodeMapNode, state: NodeVisual['state']): void {
    const size = 22;
    const color = COLORS.ACCENT_CYAN; // Always cyan regardless of world
    const container = this.add.container(node.x, node.y).setDepth(3);

    // Outer ambient glow
    const outerGlow = this.add.graphics();
    outerGlow.setBlendMode(Phaser.BlendModes.ADD);
    outerGlow.fillStyle(color, 0.15);
    outerGlow.fillCircle(0, 0, size * 2.2);
    outerGlow.fillStyle(color, 0.08);
    outerGlow.fillCircle(0, 0, size * 3);
    container.add(outerGlow);

    // Launch-pad rings (static base plate feel)
    const padRings = this.add.graphics();
    padRings.setBlendMode(Phaser.BlendModes.ADD);
    padRings.lineStyle(1, color, 0.4);
    padRings.strokeCircle(0, 0, size + 4);
    padRings.lineStyle(0.5, color, 0.25);
    padRings.strokeCircle(0, 0, size + 10);
    padRings.lineStyle(0.5, color, 0.15);
    padRings.strokeCircle(0, 0, size + 16);
    // Dash ticks around outer ring
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 / 12) * i;
      const x1 = Math.cos(angle) * (size + 12);
      const y1 = Math.sin(angle) * (size + 12);
      const x2 = Math.cos(angle) * (size + 16);
      const y2 = Math.sin(angle) * (size + 16);
      padRings.lineStyle(1, color, 0.5);
      padRings.lineBetween(x1, y1, x2, y2);
    }
    container.add(padRings);

    // Hexagonal base with inner hexagon for "base / hub" feel
    const baseHex = this.add.graphics();
    ShapeRenderer.drawPolygon(baseHex, 0, 0, 6, size, color, 0.4, color, 2.5);
    ShapeRenderer.drawPolygon(baseHex, 0, 0, 6, size * 0.6, color, 0.6, color, 1.5);
    container.add(baseHex);

    // Inner bright core + cross crosshair
    const core = this.add.graphics();
    core.fillStyle(color, 0.9);
    core.fillCircle(0, 0, size * 0.25);
    core.fillStyle(0xffffff, 0.5);
    core.fillCircle(0, 0, size * 0.12);
    // Crosshair lines across the center
    core.lineStyle(1, 0xffffff, 0.3);
    core.lineBetween(-size * 0.6, 0, size * 0.6, 0);
    core.lineBetween(0, -size * 0.6, 0, size * 0.6);
    container.add(core);

    // Rotating perimeter arcs
    const rotatingArcs = this.add.graphics();
    rotatingArcs.setBlendMode(Phaser.BlendModes.ADD);
    container.add(rotatingArcs);
    const rotData = { angle: 0 };
    this.tweens.add({
      targets: rotData, angle: Math.PI * 2,
      duration: 6000, repeat: -1,
    });

    // Breathing expand ring (launch pulse effect)
    const breathRing = this.add.graphics();
    breathRing.setBlendMode(Phaser.BlendModes.ADD);
    container.add(breathRing);
    const breathData = { t: 0 };
    this.tweens.add({
      targets: breathData, t: 1,
      duration: 2000, repeat: -1,
      onUpdate: () => {
        breathRing.clear();
        const r = size + 4 + breathData.t * 30;
        const a = 0.5 * (1 - breathData.t);
        breathRing.lineStyle(1.5, color, a);
        breathRing.strokeCircle(0, 0, r);
      },
    });

    // "START" label above
    const label = this.add.text(node.x, node.y - size - 22, 'START', {
      fontFamily: FONT_FAMILY,
      fontSize: 10,
      color: '#00ffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(4).setLetterSpacing(4);

    // Label underline
    const labelLine = this.add.graphics().setDepth(4);
    labelLine.lineStyle(0.5, color, 0.5);
    labelLine.lineBetween(node.x - 18, node.y - size - 15, node.x + 18, node.y - size - 15);

    this.tweens.add({
      targets: label, alpha: { from: 1, to: 0.5 },
      duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // If this is still the current node, add "YOU" indicator
    if (state === 'current') {
      const pulseRing = this.add.graphics();
      pulseRing.setBlendMode(Phaser.BlendModes.ADD);
      container.add(pulseRing);

      const markerY = -size - 40;
      const marker = this.add.graphics().setDepth(4);
      marker.setPosition(node.x, node.y);
      marker.setBlendMode(Phaser.BlendModes.ADD);
      marker.fillStyle(0xffffff, 0.9);
      marker.fillTriangle(0, markerY + 4, -5, markerY - 3, 5, markerY - 3);
      marker.fillStyle(color, 0.5);
      marker.fillCircle(0, markerY - 1, 4);
      this.tweens.add({
        targets: marker, y: node.y - 4,
        duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });

      this.nodeVisuals.set(node.id, { container, outerGlow, pulseRing, size, color, state });
    } else {
      this.nodeVisuals.set(node.id, { container, outerGlow, size, color, state });
    }

    // Store rotData for update loop
    (container as unknown as { _rotData: { angle: number } })._rotData = rotData;
    (container as unknown as { _rotatingArcs: Phaser.GameObjects.Graphics })._rotatingArcs = rotatingArcs;
    (container as unknown as { _isStart: boolean })._isStart = true;
  }

  // ============ Boss Node (dedicated treatment) ============

  private createBossNode(node: NodeMapNode, state: NodeVisual['state']): void {
    const size = 28;
    const worldColor = this.campaignState?.getWorldConfig()?.color ?? COLORS.LIGHTNING;
    const container = this.add.container(node.x, node.y).setDepth(3);

    // Massive outer glow halo
    const outerGlow = this.add.graphics();
    outerGlow.setBlendMode(Phaser.BlendModes.ADD);
    outerGlow.fillStyle(worldColor, 0.12);
    outerGlow.fillCircle(0, 0, size * 2.5);
    outerGlow.fillStyle(worldColor, 0.08);
    outerGlow.fillCircle(0, 0, size * 3.5);
    outerGlow.fillStyle(COLORS.DANGER, 0.05);
    outerGlow.fillCircle(0, 0, size * 4.5);
    container.add(outerGlow);

    // Animated multi-ring danger pulse (3 staggered rings)
    const dangerRings = this.add.graphics();
    dangerRings.setBlendMode(Phaser.BlendModes.ADD);
    dangerRings.setDepth(2);
    dangerRings.setPosition(node.x, node.y);
    const dangerData = { t0: 0, t1: 0.33, t2: 0.66 };
    this.tweens.add({
      targets: dangerData,
      t0: 1, t1: 1.33, t2: 1.66,
      duration: 2200, repeat: -1,
      onUpdate: () => {
        dangerRings.clear();
        for (const t of [dangerData.t0 % 1, dangerData.t1 % 1, dangerData.t2 % 1]) {
          const r = size + 14 + t * 38;
          const a = 0.28 * (1 - t);
          dangerRings.lineStyle(2, worldColor, a);
          dangerRings.strokeCircle(0, 0, r);
          dangerRings.lineStyle(1, COLORS.DANGER, a * 0.6);
          dangerRings.strokeCircle(0, 0, r * 0.8);
        }
      },
    });

    // Main octagon (boss shape) — solid and imposing
    const mainGfx = this.add.graphics();
    // Outer hardened ring
    ShapeRenderer.drawPolygon(mainGfx, 0, 0, 8, size + 3, worldColor, 0.15, worldColor, 1);
    // Main body
    ShapeRenderer.drawPolygon(mainGfx, 0, 0, 8, size, worldColor, 0.6, worldColor, 3);
    // Inner accent layer
    ShapeRenderer.drawPolygon(mainGfx, 0, 0, 8, size * 0.65, worldColor, 0.5, worldColor, 1.5);
    container.add(mainGfx);

    // Hot core (white pulsing center)
    const core = this.add.graphics();
    container.add(core);
    const coreData = { t: 0 };
    this.tweens.add({
      targets: coreData, t: 1,
      duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // Orbiting threat shards (small triangles rotating around the boss)
    const orbitGfx = this.add.graphics();
    orbitGfx.setBlendMode(Phaser.BlendModes.ADD);
    container.add(orbitGfx);
    const orbitData = { angle: 0 };
    this.tweens.add({
      targets: orbitData, angle: Math.PI * 2,
      duration: 5000, repeat: -1,
    });

    // Spike crown (triangles pointing outward at top of boss)
    const crown = this.add.graphics();
    crown.fillStyle(worldColor, 0.85);
    for (let i = 0; i < 5; i++) {
      const angleDeg = -70 + i * 35;
      const a = (angleDeg * Math.PI) / 180;
      const tipR = size + 12;
      const leftR = size + 3;
      const spreadA = 0.12;
      const tipX = Math.cos(a) * tipR;
      const tipY = Math.sin(a) * tipR;
      const leftX = Math.cos(a - spreadA) * leftR;
      const leftY = Math.sin(a - spreadA) * leftR;
      const rightX = Math.cos(a + spreadA) * leftR;
      const rightY = Math.sin(a + spreadA) * leftR;
      crown.fillTriangle(tipX, tipY, leftX, leftY, rightX, rightY);
      crown.lineStyle(1, worldColor, 1);
      crown.strokeTriangle(tipX, tipY, leftX, leftY, rightX, rightY);
    }
    container.add(crown);

    // "FINAL BOSS" label with pulse
    const bossLabel = this.add.text(node.x, node.y - size - 28, 'FINAL BOSS', {
      fontFamily: FONT_FAMILY,
      fontSize: 13,
      color: '#ffaa00',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(4).setLetterSpacing(4);

    // Warning brackets around the label
    const labelBrackets = this.add.graphics().setDepth(4);
    const lw = bossLabel.width;
    const lx = node.x;
    const ly = node.y - size - 28;
    labelBrackets.lineStyle(1.5, COLORS.DANGER, 0.9);
    // Left bracket
    labelBrackets.lineBetween(lx - lw / 2 - 10, ly - 6, lx - lw / 2 - 6, ly - 6);
    labelBrackets.lineBetween(lx - lw / 2 - 10, ly - 6, lx - lw / 2 - 10, ly + 6);
    labelBrackets.lineBetween(lx - lw / 2 - 10, ly + 6, lx - lw / 2 - 6, ly + 6);
    // Right bracket
    labelBrackets.lineBetween(lx + lw / 2 + 10, ly - 6, lx + lw / 2 + 6, ly - 6);
    labelBrackets.lineBetween(lx + lw / 2 + 10, ly - 6, lx + lw / 2 + 10, ly + 6);
    labelBrackets.lineBetween(lx + lw / 2 + 10, ly + 6, lx + lw / 2 + 6, ly + 6);

    this.tweens.add({
      targets: [bossLabel, labelBrackets], alpha: { from: 1, to: 0.45 },
      duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // Danger chevrons (small triangles below label)
    const chevrons = this.add.graphics().setDepth(4);
    for (let i = 0; i < 3; i++) {
      const cx = node.x - 12 + i * 12;
      const cy = node.y - size - 14;
      chevrons.fillStyle(COLORS.DANGER, 0.8);
      chevrons.fillTriangle(cx, cy, cx - 4, cy - 5, cx + 4, cy - 5);
    }
    this.tweens.add({
      targets: chevrons, alpha: { from: 1, to: 0.3 },
      duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // Click handler if accessible
    let pulseRing: Phaser.GameObjects.Graphics | undefined;
    if (state === 'accessible') {
      pulseRing = this.add.graphics();
      pulseRing.setBlendMode(Phaser.BlendModes.ADD);
      container.add(pulseRing);

      const hitZone = this.add.zone(0, 0, size * 3, size * 3)
        .setInteractive({ useHandCursor: true });
      container.add(hitZone);

      hitZone.on('pointerover', () => {
        this.input.setDefaultCursor('pointer');
        this.tweens.add({
          targets: container, scaleX: 1.15, scaleY: 1.15,
          duration: 120, ease: 'Back.easeOut',
        });
        this.cameras.main.shake(80, 0.001);
      });

      hitZone.on('pointerout', () => {
        this.input.setDefaultCursor('default');
        this.tweens.add({
          targets: container, scaleX: 1, scaleY: 1,
          duration: 120, ease: 'Quad.easeOut',
        });
      });

      hitZone.on('pointerdown', () => {
        this.triggerNodeEntry(node, container, worldColor, true);
      });
    }

    this.nodeVisuals.set(node.id, { container, outerGlow, pulseRing, size, color: worldColor, state });

    // Store boss-specific refs for update loop
    (container as unknown as { _bossCore: Phaser.GameObjects.Graphics })._bossCore = core;
    (container as unknown as { _bossCoreData: { t: number } })._bossCoreData = coreData;
    (container as unknown as { _bossOrbit: Phaser.GameObjects.Graphics })._bossOrbit = orbitGfx;
    (container as unknown as { _bossOrbitData: { angle: number } })._bossOrbitData = orbitData;
    (container as unknown as { _bossColor: number })._bossColor = worldColor;
    (container as unknown as { _bossSize: number })._bossSize = size;
  }

  private drawOuterGlow(
    gfx: Phaser.GameObjects.Graphics,
    color: number, size: number, state: NodeVisual['state'],
  ): void {
    gfx.clear();
    let alpha: number;
    let radius: number;
    switch (state) {
      case 'current': alpha = 0.18; radius = size * 2; break;
      case 'accessible': alpha = 0.1; radius = size * 1.8; break;
      case 'visited': alpha = 0.04; radius = size * 1.4; break;
      case 'locked': alpha = 0.02; radius = size * 1.2; break;
    }
    gfx.fillStyle(color, alpha);
    gfx.fillCircle(0, 0, radius);
  }

  private drawMainShape(
    gfx: Phaser.GameObjects.Graphics,
    shape: string, size: number, color: number, state: NodeVisual['state'],
  ): void {
    let fillAlpha: number;
    let strokeAlpha: number;
    let strokeW: number;
    switch (state) {
      case 'current': fillAlpha = 0.55; strokeAlpha = 1; strokeW = 2.5; break;
      case 'accessible': fillAlpha = 0.35; strokeAlpha = 0.9; strokeW = 2; break;
      case 'visited': fillAlpha = 0.2; strokeAlpha = 0.6; strokeW = 1.5; break;
      case 'locked': fillAlpha = 0.05; strokeAlpha = 0.25; strokeW = 1.5; break;
    }

    const sides = this.shapeSides(shape);
    if (shape === 'circle') {
      gfx.fillStyle(color, fillAlpha);
      gfx.fillCircle(0, 0, size);
      gfx.lineStyle(strokeW, color, strokeAlpha);
      gfx.strokeCircle(0, 0, size);
    } else if (shape === 'diamond') {
      ShapeRenderer.drawDiamond(gfx, 0, 0, size, color, fillAlpha, color, strokeW);
      gfx.lineStyle(strokeW, color, strokeAlpha);
    } else if (shape === 'star') {
      ShapeRenderer.drawStar(gfx, 0, 0, size, color, fillAlpha, color, strokeW);
    } else {
      ShapeRenderer.drawPolygon(gfx, 0, 0, sides, size, color, fillAlpha, color, strokeW);
    }
    gfx.setAlpha(state === 'locked' ? 0.6 : 1);
  }

  private shapeSides(shape: string): number {
    switch (shape) {
      case 'triangle': return 3;
      case 'square': return 4;
      case 'pentagon': return 5;
      case 'hexagon': return 6;
      case 'octagon': return 8;
      default: return 32;
    }
  }

  // ============ Entrance Animation ============

  private animateEntrance(): void {
    // Group nodes by column (x position)
    const sorted = [...this.nodes].sort((a, b) => a.x - b.x);
    const columnBuckets = new Map<number, NodeMapNode[]>();
    let currentBucketX = -Infinity;
    for (const node of sorted) {
      if (node.x - currentBucketX > 50) {
        currentBucketX = node.x;
        columnBuckets.set(currentBucketX, []);
      }
      columnBuckets.get(currentBucketX)!.push(node);
    }

    let layerIdx = 0;
    for (const nodesInLayer of columnBuckets.values()) {
      for (const node of nodesInLayer) {
        const visual = this.nodeVisuals.get(node.id);
        if (!visual) continue;
        // Keep containers at full scale so hit areas stay tappable from
        // frame one — otherwise rapid taps on mobile land on a 0.3-scale
        // zone or miss entirely. Only the alpha is animated for the
        // entrance. The click feedback tween handles any size feedback.
        visual.container.setAlpha(0);
        this.tweens.add({
          targets: visual.container,
          alpha: 1,
          duration: 350,
          delay: 100 + layerIdx * 60,
          ease: 'Quad.easeOut',
        });
      }
      layerIdx++;
    }
  }

  // ============ Update Loop ============

  update(time: number, delta: number): void {
    // Animate background particles (with alpha pulse)
    for (const p of this.bgParticles) {
      p.x += p.vx * (delta / 1000);
      p.y += p.vy * (delta / 1000);
      p.pulsePhase += delta / 1000;
      if (p.x < -20) p.x = GAME.WIDTH + 20;
      if (p.x > GAME.WIDTH + 20) p.x = -20;
      if (p.y < HEADER_HEIGHT - 20) p.y = GAME.HEIGHT + 20;
      if (p.y > GAME.HEIGHT + 20) p.y = HEADER_HEIGHT - 20;
      p.gfx.setPosition(p.x, p.y);
      p.gfx.setAlpha(0.6 + Math.sin(p.pulsePhase * 0.8) * 0.4);
    }

    // Sweeping scan line
    this.scanLineY += delta * 0.12;
    if (this.scanLineY > GAME.HEIGHT + 40) this.scanLineY = HEADER_HEIGHT - 40;
    this.scanLine.clear();
    this.scanLine.lineStyle(1.2, COLORS.ACCENT_CYAN, 0.08);
    this.scanLine.lineBetween(0, this.scanLineY, GAME.WIDTH, this.scanLineY);
    this.scanLine.lineStyle(0.6, COLORS.ACCENT_CYAN, 0.03);
    this.scanLine.lineBetween(0, this.scanLineY + 3, GAME.WIDTH, this.scanLineY + 3);

    // Animated header separator
    this.headerSeparator.clear();
    const sepAlpha = 0.25 + Math.sin(time * 0.003) * 0.12;
    const worldColor = this.campaignState?.getWorldConfig()?.color ?? COLORS.ACCENT_CYAN;
    this.headerSeparator.lineStyle(1.5, worldColor, sepAlpha);
    this.headerSeparator.lineBetween(0, HEADER_HEIGHT, GAME.WIDTH, HEADER_HEIGHT);
    this.headerSeparator.lineStyle(0.5, worldColor, sepAlpha * 0.3);
    this.headerSeparator.lineBetween(0, HEADER_HEIGHT + 1, GAME.WIDTH, HEADER_HEIGHT + 1);

    // Flowing dots on active paths
    this.flowOffset += delta;
    this.drawFlowingDots();

    // Pulse rings on accessible/current nodes
    for (const visual of this.nodeVisuals.values()) {
      if (!visual.pulseRing) continue;
      visual.pulseRing.clear();

      if (visual.state === 'accessible') {
        const pulseT = (Math.sin(time * 0.004) + 1) / 2;
        const r = visual.size + 4 + pulseT * 5;
        const a = 0.5 * (1 - pulseT * 0.6);
        visual.pulseRing.lineStyle(1.5, visual.color, a);
        visual.pulseRing.strokeCircle(0, 0, r);
      } else if (visual.state === 'current') {
        const angle = time * 0.0008;
        const ringR = visual.size + 9;
        const segments = 8;
        for (let i = 0; i < segments; i++) {
          const startA = angle + (Math.PI * 2 / segments) * i;
          const endA = startA + (Math.PI / segments) * 0.6;
          visual.pulseRing.lineStyle(1.5, 0xffffff, 0.4);
          visual.pulseRing.beginPath();
          visual.pulseRing.arc(0, 0, ringR, startA, endA, false);
          visual.pulseRing.strokePath();
        }
        const angle2 = -time * 0.0005;
        for (let i = 0; i < 4; i++) {
          const startA = angle2 + (Math.PI / 2) * i;
          const endA = startA + Math.PI / 4;
          visual.pulseRing.lineStyle(1, COLORS.ACCENT_CYAN, 0.4);
          visual.pulseRing.beginPath();
          visual.pulseRing.arc(0, 0, visual.size + 4, startA, endA, false);
          visual.pulseRing.strokePath();
        }
      }
    }

    // Start node: rotating perimeter arcs
    for (const visual of this.nodeVisuals.values()) {
      const c = visual.container as unknown as {
        _isStart?: boolean;
        _rotData?: { angle: number };
        _rotatingArcs?: Phaser.GameObjects.Graphics;
      };
      if (!c._isStart || !c._rotatingArcs || !c._rotData) continue;
      const arcs = c._rotatingArcs;
      const size = visual.size;
      arcs.clear();
      const angle = c._rotData.angle;
      for (let i = 0; i < 3; i++) {
        const startA = angle + (Math.PI * 2 / 3) * i;
        const endA = startA + Math.PI * 0.3;
        arcs.lineStyle(2, COLORS.ACCENT_CYAN, 0.55);
        arcs.beginPath();
        arcs.arc(0, 0, size + 7, startA, endA, false);
        arcs.strokePath();
      }
    }

    // Boss node: pulsing hot core + orbiting threat shards
    for (const visual of this.nodeVisuals.values()) {
      const c = visual.container as unknown as {
        _bossCore?: Phaser.GameObjects.Graphics;
        _bossCoreData?: { t: number };
        _bossOrbit?: Phaser.GameObjects.Graphics;
        _bossOrbitData?: { angle: number };
        _bossColor?: number;
        _bossSize?: number;
      };
      if (!c._bossCore || !c._bossCoreData || !c._bossOrbit || !c._bossOrbitData || !c._bossColor || !c._bossSize) continue;
      const bossColor = c._bossColor;
      const bossSize = c._bossSize;

      // Pulsing hot center
      const core = c._bossCore;
      const ct = c._bossCoreData.t;
      core.clear();
      core.fillStyle(0xffffff, 0.2 + ct * 0.4);
      core.fillCircle(0, 0, bossSize * 0.28 + ct * 2);
      core.fillStyle(bossColor, 0.8);
      core.fillCircle(0, 0, bossSize * 0.18);

      // Orbiting shards — 4 triangles around the boss
      const orbit = c._bossOrbit;
      orbit.clear();
      const baseAngle = c._bossOrbitData.angle;
      for (let i = 0; i < 4; i++) {
        const a = baseAngle + (Math.PI / 2) * i;
        const r = bossSize + 20;
        const ox = Math.cos(a) * r;
        const oy = Math.sin(a) * r;
        // Triangle pointing outward (away from center)
        const tipX = ox + Math.cos(a) * 6;
        const tipY = oy + Math.sin(a) * 6;
        const baseLX = ox + Math.cos(a + Math.PI / 2) * 4;
        const baseLY = oy + Math.sin(a + Math.PI / 2) * 4;
        const baseRX = ox + Math.cos(a - Math.PI / 2) * 4;
        const baseRY = oy + Math.sin(a - Math.PI / 2) * 4;
        orbit.fillStyle(bossColor, 0.85);
        orbit.fillTriangle(tipX, tipY, baseLX, baseLY, baseRX, baseRY);
        orbit.lineStyle(1, bossColor, 1);
        orbit.strokeTriangle(tipX, tipY, baseLX, baseLY, baseRX, baseRY);
        // Small trailing dot
        const trailX = ox - Math.cos(a + 0.3) * 10;
        const trailY = oy - Math.sin(a + 0.3) * 10;
        orbit.fillStyle(bossColor, 0.35);
        orbit.fillCircle(trailX, trailY, 1.5);
      }
    }
  }

  // ============ Helpers ============

  private isVisited(nodeId: string): boolean {
    return this.campaignState?.isVisited(nodeId) ?? nodeId === 'start';
  }

  // ============ Fallback map generation ============

  private generateMap(): NodeMapNode[] {
    const nodes: NodeMapNode[] = [];
    const layers = 7;
    const nodesPerLayer = [1, 3, 4, 4, 4, 3, 1];
    const typesByLayer: NodeType[][] = [
      ['battle'],
      ['battle', 'event', 'battle'],
      ['battle', 'event', 'battle', 'event'],
      ['battle', 'elite', 'shop', 'battle'],
      ['rest', 'battle', 'event', 'elite'],
      ['shop', 'rest', 'battle'],
      ['boss'],
    ];

    let id = 0;
    const layerNodes: string[][] = [];

    for (let layer = 0; layer < layers; layer++) {
      const count = nodesPerLayer[layer]!;
      const types = typesByLayer[layer]!;
      const currentLayerIds: string[] = [];

      for (let i = 0; i < count; i++) {
        const nodeId = layer === 0 ? 'start' : `node_${id++}`;
        const marginX = 60;
        const marginTop = 120;
        const marginBottom = 50;
        const usableW = GAME.WIDTH - marginX * 2;
        const usableH = GAME.HEIGHT - marginTop - marginBottom;
        const x = marginX + layer * (usableW / (layers - 1));
        const ySpread = count > 1 ? usableH / (count - 1) : 0;
        const y = marginTop + (count === 1 ? usableH / 2 : i * ySpread) + randomRange(-8, 8);

        nodes.push({
          id: nodeId,
          type: types[i % types.length]!,
          connections: [],
          x: x + randomRange(-8, 8),
          y,
          difficulty: layer + 1,
        });
        currentLayerIds.push(nodeId);
      }

      if (layer > 0) {
        const prevLayer = layerNodes[layer - 1]!;
        for (const prevId of prevLayer) {
          const prevNode = nodes.find(n => n.id === prevId)!;
          const connectCount = Math.min(currentLayerIds.length, randomInt(1, 2));
          const shuffled = [...currentLayerIds].sort(() => Math.random() - 0.5);
          for (let c = 0; c < connectCount; c++) {
            if (!prevNode.connections.includes(shuffled[c]!)) {
              prevNode.connections.push(shuffled[c]!);
            }
          }
        }
        for (const currId of currentLayerIds) {
          const hasIncoming = nodes.some(n => n.connections.includes(currId));
          if (!hasIncoming) {
            const randomPrev = prevLayer[randomInt(0, prevLayer.length - 1)]!;
            nodes.find(n => n.id === randomPrev)!.connections.push(currId);
          }
        }
      }
      layerNodes.push(currentLayerIds);
    }
    return nodes;
  }

  // ============ Node Actions ============

  private enterNode(node: NodeMapNode): void {
    // Advance campaign state
    this.campaignState?.advanceToNode(node.id);
    this.campaignState?.save();

    switch (node.type) {
      case 'battle':
      case 'elite':
      case 'boss': {
        const levelConfig = this.campaignState?.getLevelConfigForNode(node);
        this.scene.start(SCENES.GAME, {
          mode: 'campaign',
          difficulty: node.difficulty ?? 1,
          isBoss: node.type === 'boss',
          isElite: node.type === 'elite',
          levelConfig,
        });
        break;
      }
      case 'shop':
        this.scene.start(SCENES.SHOP);
        break;
      case 'rest':
        this.campaignState?.heal(5);
        this.campaignState?.save();
        this.scene.restart();
        break;
      case 'event': {
        const persistentEvt = this.game.registry.get('persistentState') as PersistentState | undefined;
        if (persistentEvt) {
          persistentEvt.shardTracker.addShards(15);
        }
        this.scene.restart();
        break;
      }
    }
  }
}
