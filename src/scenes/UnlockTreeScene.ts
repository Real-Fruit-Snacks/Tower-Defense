import Phaser from 'phaser';
import { SCENES, COLORS, GAME } from '../constants';
import { createGlowText, drawNeonRect } from '../rendering/NeonEffects';
import { ShapeRenderer } from '../rendering/ShapeRenderer';
import { PersistentState } from '../roguelite/PersistentState';
import { setupStageCamera } from '../utils/StageCamera';
import { UNLOCK_TREE } from '../data/unlockTree';
import type { UnlockNode, UnlockEffect } from '../types';
import { randomRange } from '../utils/MathUtils';

interface LayoutNode {
  node: UnlockNode;
  x: number;
  y: number;
  tier: number;
}

interface NodeVisual {
  container: Phaser.GameObjects.Container;
  glowGfx: Phaser.GameObjects.Graphics;
  mainGfx: Phaser.GameObjects.Graphics;
  pulseGfx?: Phaser.GameObjects.Graphics;
}

interface BgParticle {
  gfx: Phaser.GameObjects.Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: number;
}

const FONT_FAMILY = 'Segoe UI, system-ui, sans-serif';
const FONT_MONO = 'monospace';
const NODE_RADIUS = 22;
const TIER_SPACING = 180;
const LEFT_MARGIN = 140;
const TOP_MARGIN = 110;
const HEADER_HEIGHT = 80;

// Shape/visual config per effect type
type NodeShape = 'triangle' | 'hexagon' | 'star' | 'diamond' | 'circle' | 'octagon';

function getNodeShape(node: UnlockNode): NodeShape {
  if (node.id === 'start') return 'circle';
  // Repeatable mastery nodes get a distinct octagon silhouette.
  if (node.repeatable) return 'octagon';
  switch (node.effect.type) {
    case 'unlock_tower': return 'triangle';
    case 'passive_bonus': return 'hexagon';
    case 'unlock_mode': return 'star';
    case 'unlock_upgrade': return 'diamond';
    default: return 'circle';
  }
}

function getNodeAccentColor(node: UnlockNode): number {
  if (node.id === 'start') return COLORS.ACCENT_CYAN;
  // Repeatable/mastery → gold (prestige/sink color).
  if (node.repeatable) return COLORS.GOLD;
  switch (node.effect.type) {
    case 'unlock_tower': return COLORS.ACCENT_PINK;
    case 'passive_bonus': return COLORS.WIND; // mint green
    case 'unlock_mode': return COLORS.LIGHTNING; // gold-orange
    case 'unlock_upgrade': return COLORS.ACCENT_PURPLE;
    default: return COLORS.ACCENT_CYAN;
  }
}

/** Derive high-level visual state for a node (handles repeatable semantics). */
function computeNodeState(
  node: UnlockNode,
  unlockTree: { isUnlocked: (id: string) => boolean; isMaxed: (id: string) => boolean; canUnlock: (id: string) => boolean; getLevel: (id: string) => number },
): 'locked' | 'available' | 'owned' {
  if (node.repeatable) {
    if (unlockTree.isMaxed(node.id)) return 'owned';
    const prereqsMet = node.prereqs.every(p => unlockTree.isUnlocked(p));
    if (prereqsMet) return 'available';
    return 'locked';
  }
  if (unlockTree.isUnlocked(node.id)) return 'owned';
  if (unlockTree.canUnlock(node.id)) return 'available';
  const prereqsMet = node.prereqs.every(p => unlockTree.isUnlocked(p));
  return prereqsMet ? 'available' : 'locked';
}

export class UnlockTreeScene extends Phaser.Scene {
  private persistentState!: PersistentState;
  private layoutNodes: LayoutNode[] = [];
  private nodeVisuals: Map<string, NodeVisual> = new Map();
  private lineGraphics!: Phaser.GameObjects.Graphics;
  private connectionGlowGfx!: Phaser.GameObjects.Graphics;
  private tooltipContainer!: Phaser.GameObjects.Container;
  private scrollContainer!: Phaser.GameObjects.Container;
  private bgParticles: BgParticle[] = [];

  // Header elements
  private shardText!: Phaser.GameObjects.Text;
  private progressText!: Phaser.GameObjects.Text;
  private progressBarFill!: Phaser.GameObjects.Graphics;
  private headerSeparator!: Phaser.GameObjects.Graphics;

  // State
  private scrollOffset = 0;
  private maxScrollX = 0;
  private isDragging = false;
  private dragStartX = 0;
  private dragStartScroll = 0;
  private hoverNodeId: string | null = null;
  private dashOffset = 0;

  constructor() {
    super(SCENES.UNLOCK_TREE_SCENE);
  }

  create(): void {
    setupStageCamera(this);
    this.persistentState = this.game.registry.get('persistentState') as PersistentState;
    this.cameras.main.setBackgroundColor(COLORS.BG);

    // Reset state
    this.layoutNodes = [];
    this.nodeVisuals.clear();
    this.bgParticles = [];
    this.scrollOffset = 0;
    this.dashOffset = 0;
    this.hoverNodeId = null;

    this.createBackground();
    this.computeLayout();
    this.buildHeader();
    this.buildTree();
    this.buildTooltip();
    this.buildLegend();
    this.setupScrolling();
  }

  // ============ Atmospheric Background ============

  private createBackground(): void {
    // Vignette
    const vignette = this.add.graphics().setDepth(-2);
    for (let i = 0; i < 12; i++) {
      const inset = i * 15;
      const alpha = 0.3 * (1 - i / 12);
      vignette.fillStyle(0x000000, alpha);
      vignette.fillRect(0, inset, GAME.WIDTH, GAME.HEIGHT - inset * 2);
      vignette.fillRect(inset, 0, GAME.WIDTH - inset * 2, GAME.HEIGHT);
    }

    // Subtle grid
    const gridGfx = this.add.graphics().setDepth(-1);
    gridGfx.lineStyle(0.5, COLORS.ACCENT_CYAN, 0.03);
    for (let x = 0; x < GAME.WIDTH; x += 50) {
      gridGfx.lineBetween(x, 0, x, GAME.HEIGHT);
    }
    for (let y = 0; y < GAME.HEIGHT; y += 50) {
      gridGfx.lineBetween(0, y, GAME.WIDTH, y);
    }

    // Floating particles
    const colors = [COLORS.ACCENT_CYAN, COLORS.ACCENT_PINK, COLORS.ACCENT_PURPLE, COLORS.GOLD, COLORS.WIND];
    for (let i = 0; i < 25; i++) {
      const gfx = this.add.graphics().setDepth(-1);
      gfx.setBlendMode(Phaser.BlendModes.ADD);
      const color = colors[Math.floor(Math.random() * colors.length)] ?? COLORS.ACCENT_CYAN;
      const alpha = randomRange(0.03, 0.08);
      const size = randomRange(1, 2.5);
      gfx.fillStyle(color, alpha);
      gfx.fillCircle(0, 0, size);

      const x = randomRange(0, GAME.WIDTH);
      const y = randomRange(HEADER_HEIGHT, GAME.HEIGHT);
      gfx.setPosition(x, y);

      this.bgParticles.push({
        gfx, x, y,
        vx: randomRange(-10, 10),
        vy: randomRange(-6, 6),
        color,
      });
    }
  }

  // ============ Layout Computation ============

  private computeLayout(): void {
    const tree = UNLOCK_TREE;
    const tierMap = new Map<string, number>();

    const computeTier = (node: UnlockNode): number => {
      if (tierMap.has(node.id)) return tierMap.get(node.id)!;
      if (node.prereqs.length === 0) {
        tierMap.set(node.id, 0);
        return 0;
      }
      let maxPrereqTier = 0;
      for (const prereqId of node.prereqs) {
        const prereqNode = tree.find(n => n.id === prereqId);
        if (prereqNode) {
          maxPrereqTier = Math.max(maxPrereqTier, computeTier(prereqNode));
        }
      }
      const tier = maxPrereqTier + 1;
      tierMap.set(node.id, tier);
      return tier;
    };

    for (const node of tree) {
      computeTier(node);
    }

    const tiers = new Map<number, UnlockNode[]>();
    for (const node of tree) {
      const tier = tierMap.get(node.id)!;
      if (!tiers.has(tier)) tiers.set(tier, []);
      tiers.get(tier)!.push(node);
    }

    const maxTier = Math.max(...tiers.keys());
    const availableHeight = GAME.HEIGHT - TOP_MARGIN - 100;

    for (let t = 0; t <= maxTier; t++) {
      const nodesInTier = tiers.get(t) ?? [];
      const count = nodesInTier.length;
      const spacing = Math.min(75, availableHeight / Math.max(count, 1));
      const totalHeight = spacing * (count - 1);
      const startY = TOP_MARGIN + (availableHeight - totalHeight) / 2;

      for (let i = 0; i < count; i++) {
        this.layoutNodes.push({
          node: nodesInTier[i]!,
          x: LEFT_MARGIN + t * TIER_SPACING,
          y: startY + i * spacing,
          tier: t,
        });
      }
    }

    const maxX = Math.max(...this.layoutNodes.map(ln => ln.x));
    this.maxScrollX = Math.max(0, maxX + NODE_RADIUS + 80 - GAME.WIDTH);
  }

  // ============ Header ============

  private buildHeader(): void {
    // Gradient header bg
    const bg = this.add.graphics().setDepth(20);
    bg.fillGradientStyle(0x0e0e1a, 0x0e0e1a, 0x08080f, 0x08080f, 0.95, 0.95, 0.85, 0.85);
    bg.fillRect(0, 0, GAME.WIDTH, HEADER_HEIGHT);

    // Animated separator line
    this.headerSeparator = this.add.graphics().setDepth(21);
    this.headerSeparator.setBlendMode(Phaser.BlendModes.ADD);

    // Title with glow
    const title = createGlowText(this, GAME.WIDTH / 2, 28, 'UNLOCK TREE', COLORS.ACCENT_CYAN, 24);
    title.setDepth(25);

    // Progress stats underneath title
    const unlockedCount = UNLOCK_TREE.filter(n => this.persistentState.unlockTree.isUnlocked(n.id)).length;
    const totalCount = UNLOCK_TREE.length;
    const percent = Math.floor((unlockedCount / totalCount) * 100);

    this.progressText = this.add.text(GAME.WIDTH / 2, 55, `${unlockedCount}/${totalCount} UNLOCKED · ${percent}%`, {
      fontFamily: FONT_MONO,
      fontSize: 11,
      color: '#888',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(25);

    // Progress bar under the text
    const barX = GAME.WIDTH / 2 - 90;
    const barY = 68;
    const barW = 180;
    const barH = 3;
    const progressBg = this.add.graphics().setDepth(24);
    progressBg.fillStyle(COLORS.UI_BG, 0.8);
    progressBg.fillRect(barX, barY, barW, barH);

    this.progressBarFill = this.add.graphics().setDepth(25);
    this.progressBarFill.setBlendMode(Phaser.BlendModes.ADD);
    this.drawProgressBar(barX, barY, barW, barH, percent / 100);

    // Shard count (right side)
    const shards = this.persistentState.shardTracker.getShards();
    this.shardText = this.add.text(GAME.WIDTH - 30, 40, `◈ ${shards}`, {
      fontFamily: FONT_FAMILY,
      fontSize: 22,
      color: '#a855f7',
      fontStyle: 'bold',
    }).setOrigin(1, 0.5).setDepth(25);

    const shardLabel = this.add.text(GAME.WIDTH - 30, 62, 'SHARDS', {
      fontFamily: FONT_MONO,
      fontSize: 9,
      color: '#a855f7',
      fontStyle: 'bold',
    }).setOrigin(1, 0.5).setDepth(25).setAlpha(0.6);
    shardLabel.setLetterSpacing(2);

    // Back button
    this.createBackButton();
  }

  private drawProgressBar(x: number, y: number, w: number, h: number, percent: number): void {
    this.progressBarFill.clear();
    // Outer glow
    this.progressBarFill.fillStyle(COLORS.ACCENT_CYAN, 0.15);
    this.progressBarFill.fillRect(x - 1, y - 1, w * percent + 2, h + 2);
    // Main fill
    this.progressBarFill.fillStyle(COLORS.ACCENT_CYAN, 0.9);
    this.progressBarFill.fillRect(x, y, w * percent, h);
  }

  private createBackButton(): void {
    const btn = this.add.container(65, 40).setDepth(25);

    const bg = this.add.graphics();
    drawNeonRect(bg, -48, -16, 96, 32, COLORS.ACCENT_PINK, 0.1, 6);
    btn.add(bg);

    const text = this.add.text(0, 0, '← BACK', {
      fontFamily: FONT_FAMILY,
      fontSize: 13,
      color: '#ff0055',
      fontStyle: 'bold',
    }).setOrigin(0.5).setLetterSpacing(2);
    btn.add(text);

    const hitArea = new Phaser.Geom.Rectangle(-48, -16, 96, 32);
    btn.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);

    btn.on('pointerover', () => {
      bg.clear();
      drawNeonRect(bg, -48, -16, 96, 32, COLORS.ACCENT_PINK, 0.25, 6);
      this.tweens.add({ targets: btn, scaleX: 1.05, scaleY: 1.05, duration: 100 });
    });
    btn.on('pointerout', () => {
      bg.clear();
      drawNeonRect(bg, -48, -16, 96, 32, COLORS.ACCENT_PINK, 0.1, 6);
      this.tweens.add({ targets: btn, scaleX: 1, scaleY: 1, duration: 100 });
    });
    btn.on('pointerdown', () => {
      this.scene.start(SCENES.MAIN_MENU);
    });
  }

  // ============ Tree Rendering ============

  private buildTree(): void {
    this.scrollContainer = this.add.container(0, 0);
    this.scrollContainer.setDepth(10);

    // Connection glow layer (ADD blend, behind main lines)
    this.connectionGlowGfx = this.add.graphics();
    this.connectionGlowGfx.setBlendMode(Phaser.BlendModes.ADD);
    this.scrollContainer.add(this.connectionGlowGfx);

    // Main connection lines
    this.lineGraphics = this.add.graphics();
    this.scrollContainer.add(this.lineGraphics);

    // Nodes
    for (const ln of this.layoutNodes) {
      const visual = this.createNodeVisual(ln);
      this.scrollContainer.add(visual.container);
      this.nodeVisuals.set(ln.node.id, visual);
    }

    this.drawConnections();
  }

  private drawConnections(): void {
    this.lineGraphics.clear();
    this.connectionGlowGfx.clear();
    const unlockTree = this.persistentState.unlockTree;

    for (const ln of this.layoutNodes) {
      for (const prereqId of ln.node.prereqs) {
        const prereqLn = this.layoutNodes.find(l => l.node.id === prereqId);
        if (!prereqLn) continue;

        const bothUnlocked = unlockTree.isUnlocked(ln.node.id) && unlockTree.isUnlocked(prereqId);
        const prereqUnlocked = unlockTree.isUnlocked(prereqId);

        // Endpoints offset from node centers
        const x1 = prereqLn.x + NODE_RADIUS;
        const y1 = prereqLn.y;
        const x2 = ln.x - NODE_RADIUS;
        const y2 = ln.y;

        if (bothUnlocked) {
          // Green flowing line with glow
          this.connectionGlowGfx.lineStyle(6, COLORS.SUCCESS, 0.08);
          this.drawCurvedLine(this.connectionGlowGfx, x1, y1, x2, y2);
          this.connectionGlowGfx.lineStyle(3, COLORS.SUCCESS, 0.2);
          this.drawCurvedLine(this.connectionGlowGfx, x1, y1, x2, y2);

          this.lineGraphics.lineStyle(2, COLORS.SUCCESS, 0.85);
          this.drawCurvedLine(this.lineGraphics, x1, y1, x2, y2);
        } else if (prereqUnlocked) {
          // Gold dashed — "you can unlock this next"
          this.connectionGlowGfx.lineStyle(4, COLORS.GOLD, 0.12);
          this.drawCurvedLine(this.connectionGlowGfx, x1, y1, x2, y2);

          this.lineGraphics.lineStyle(2, COLORS.GOLD, 0.7);
          this.drawDashedCurvedLine(this.lineGraphics, x1, y1, x2, y2);
        } else {
          // Locked — dim purple
          this.lineGraphics.lineStyle(1.5, 0x6655aa, 0.2);
          this.drawDashedCurvedLine(this.lineGraphics, x1, y1, x2, y2);
        }
      }
    }

    // Draw flowing dots on active-to-available connections
    for (const ln of this.layoutNodes) {
      for (const prereqId of ln.node.prereqs) {
        const prereqLn = this.layoutNodes.find(l => l.node.id === prereqId);
        if (!prereqLn) continue;

        const prereqUnlocked = unlockTree.isUnlocked(prereqId);
        const bothUnlocked = prereqUnlocked && unlockTree.isUnlocked(ln.node.id);

        if (prereqUnlocked && !bothUnlocked) {
          // 3 dots flowing along the curve
          const x1 = prereqLn.x + NODE_RADIUS;
          const y1 = prereqLn.y;
          const x2 = ln.x - NODE_RADIUS;
          const y2 = ln.y;

          for (let i = 0; i < 3; i++) {
            const baseT = (this.dashOffset * 0.02 + i / 3) % 1;
            const { px, py } = this.pointOnCurve(x1, y1, x2, y2, baseT);
            this.connectionGlowGfx.fillStyle(COLORS.GOLD, 0.7);
            this.connectionGlowGfx.fillCircle(px, py, 2.5);
          }
        }
      }
    }
  }

  private drawCurvedLine(gfx: Phaser.GameObjects.Graphics, x1: number, y1: number, x2: number, y2: number): void {
    const steps = 16;
    gfx.beginPath();
    gfx.moveTo(x1, y1);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const { px, py } = this.pointOnCurve(x1, y1, x2, y2, t);
      gfx.lineTo(px, py);
    }
    gfx.strokePath();
  }

  private drawDashedCurvedLine(gfx: Phaser.GameObjects.Graphics, x1: number, y1: number, x2: number, y2: number): void {
    const steps = 20;
    for (let i = 0; i < steps; i += 2) {
      const t1 = i / steps;
      const t2 = Math.min((i + 1) / steps, 1);
      const p1 = this.pointOnCurve(x1, y1, x2, y2, t1);
      const p2 = this.pointOnCurve(x1, y1, x2, y2, t2);
      gfx.lineBetween(p1.px, p1.py, p2.px, p2.py);
    }
  }

  private pointOnCurve(x1: number, y1: number, x2: number, y2: number, t: number): { px: number; py: number } {
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const curveAmount = Math.abs(dy) * 0.2;
    const cpX = midX + (dy / len) * curveAmount;
    const cpY = midY - (dx / len) * curveAmount;

    const invT = 1 - t;
    const px = invT * invT * x1 + 2 * invT * t * cpX + t * t * x2;
    const py = invT * invT * y1 + 2 * invT * t * cpY + t * t * y2;
    return { px, py };
  }

  private createNodeVisual(ln: LayoutNode): NodeVisual {
    const container = this.add.container(ln.x, ln.y);
    const unlockTree = this.persistentState.unlockTree;
    const state = computeNodeState(ln.node, unlockTree);

    const accentColor = getNodeAccentColor(ln.node);
    const shape = getNodeShape(ln.node);

    // Layer 1: Outer glow (ADD blend)
    const glowGfx = this.add.graphics();
    glowGfx.setBlendMode(Phaser.BlendModes.ADD);
    container.add(glowGfx);

    // Layer 2: Main shape
    const mainGfx = this.add.graphics();
    container.add(mainGfx);

    this.drawNodeShape(glowGfx, mainGfx, shape, accentColor, state);

    // Layer 3: Pulse ring (only for available)
    let pulseGfx: Phaser.GameObjects.Graphics | undefined;
    if (state === 'available') {
      pulseGfx = this.add.graphics();
      pulseGfx.setBlendMode(Phaser.BlendModes.ADD);
      container.add(pulseGfx);
    }

    // NOTE: No inner icons (lock / check / ▶). The shape + color already
    // communicates the category and state — keeps the tree clean.

    // Name label below (for repeatable nodes, append current level)
    const level = unlockTree.getLevel(ln.node.id);
    const isRepeatable = !!ln.node.repeatable;
    const nameColor = state === 'owned'
      ? this.colorToHex(COLORS.SUCCESS)
      : state === 'available'
        ? this.colorToHex(COLORS.GOLD)
        : '#6a6a80';

    const nameLabel = isRepeatable && level > 0
      ? `${ln.node.name} · Lv ${level}${ln.node.maxLevel ? `/${ln.node.maxLevel}` : ''}`
      : ln.node.name;

    const nameText = this.add.text(0, NODE_RADIUS + 5, nameLabel, {
      fontFamily: FONT_FAMILY,
      fontSize: 10,
      color: nameColor,
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5, 0);
    container.add(nameText);

    // NOTE: Cost is intentionally NOT shown on the node itself — it only
    // appears in the tooltip on hover. Keeps the tree visually clean and
    // avoids the pre-click cost badge overlapping neighboring nodes.

    // Interactivity
    const hitArea = new Phaser.Geom.Circle(0, 0, NODE_RADIUS + 4);
    container.setInteractive(hitArea, Phaser.Geom.Circle.Contains);

    container.on('pointerover', () => {
      this.hoverNodeId = ln.node.id;
      this.showTooltip(ln);
      this.tweens.add({
        targets: container,
        scaleX: 1.12,
        scaleY: 1.12,
        duration: 120,
        ease: 'Back.easeOut',
      });
    });

    container.on('pointerout', () => {
      this.hoverNodeId = null;
      this.hideTooltip();
      this.tweens.add({
        targets: container,
        scaleX: 1,
        scaleY: 1,
        duration: 120,
        ease: 'Quad.easeOut',
      });
    });

    container.on('pointerdown', () => {
      if (unlockTree.canUnlock(ln.node.id)) {
        this.purchaseNode(ln);
      }
    });

    return { container, glowGfx, mainGfx, pulseGfx };
  }

  private drawNodeShape(
    glowGfx: Phaser.GameObjects.Graphics,
    mainGfx: Phaser.GameObjects.Graphics,
    shape: string,
    accentColor: number,
    state: 'locked' | 'available' | 'owned',
  ): void {
    glowGfx.clear();
    mainGfx.clear();

    const color = state === 'owned' ? COLORS.SUCCESS : state === 'available' ? COLORS.GOLD : accentColor;
    const outerAlpha = state === 'owned' ? 0.18 : state === 'available' ? 0.15 : 0.04;
    const fillAlpha = state === 'owned' ? 0.4 : state === 'available' ? 0.25 : 0.08;
    const strokeAlpha = state === 'owned' ? 1 : state === 'available' ? 0.85 : 0.3;

    // Outer glow
    glowGfx.fillStyle(color, outerAlpha);
    glowGfx.fillCircle(0, 0, NODE_RADIUS * 1.8);

    // Main shape
    const sides = this.shapeSides(shape);
    if (shape === 'star') {
      ShapeRenderer.drawStar(mainGfx, 0, 0, NODE_RADIUS, color, fillAlpha, color, 2);
    } else if (shape === 'diamond') {
      ShapeRenderer.drawDiamond(mainGfx, 0, 0, NODE_RADIUS, color, fillAlpha, color, 2);
    } else if (shape === 'circle') {
      mainGfx.fillStyle(color, fillAlpha);
      mainGfx.fillCircle(0, 0, NODE_RADIUS);
      mainGfx.lineStyle(2, color, strokeAlpha);
      mainGfx.strokeCircle(0, 0, NODE_RADIUS);
    } else {
      ShapeRenderer.drawPolygon(mainGfx, 0, 0, sides, NODE_RADIUS, color, fillAlpha, color, 2);
    }

    // Apply reduced alpha for locked nodes
    mainGfx.setAlpha(state === 'locked' ? 0.65 : 1);

    // Bright core (only for active states)
    if (state !== 'locked') {
      if (shape === 'star') {
        ShapeRenderer.drawStar(mainGfx, 0, 0, NODE_RADIUS * 0.45, color, 0.7, color, 0);
      } else if (shape === 'diamond') {
        ShapeRenderer.drawDiamond(mainGfx, 0, 0, NODE_RADIUS * 0.45, color, 0.7, color, 0);
      } else if (shape === 'circle') {
        mainGfx.fillStyle(color, 0.7);
        mainGfx.fillCircle(0, 0, NODE_RADIUS * 0.45);
      } else {
        ShapeRenderer.drawPolygon(mainGfx, 0, 0, sides, NODE_RADIUS * 0.45, color, 0.7, color, 0);
      }
    }
  }

  private shapeSides(shape: string): number {
    switch (shape) {
      case 'triangle': return 3;
      case 'square': return 4;
      case 'pentagon': return 5;
      case 'hexagon': return 6;
      case 'octagon': return 8;
      default: return 6;
    }
  }

  // ============ Tooltip ============

  private buildTooltip(): void {
    this.tooltipContainer = this.add.container(0, 0);
    this.tooltipContainer.setDepth(30);
    this.tooltipContainer.setVisible(false);
  }

  private showTooltip(ln: LayoutNode): void {
    this.tooltipContainer.removeAll(true);
    this.tooltipContainer.setVisible(true);

    const node = ln.node;
    const unlockTree = this.persistentState.unlockTree;
    const state = computeNodeState(node, unlockTree);
    const isUnlocked = state === 'owned';
    const canUnlock = unlockTree.canUnlock(node.id);
    const level = unlockTree.getLevel(node.id);
    const isRepeatable = !!node.repeatable;
    const isMaxed = unlockTree.isMaxed(node.id);
    const currentCost = unlockTree.getCurrentCost(node.id);
    const accentColor = getNodeAccentColor(node);

    const panelWidth = 280;
    const panelHeight = this.calculateTooltipHeight(node, state);

    // Position relative to viewport (account for scroll)
    const viewX = ln.x - this.scrollOffset;
    let tx = viewX + NODE_RADIUS + 18;
    let ty = ln.y - panelHeight / 2;

    if (tx + panelWidth > GAME.WIDTH - 10) {
      tx = viewX - NODE_RADIUS - panelWidth - 18;
    }
    ty = Phaser.Math.Clamp(ty, HEADER_HEIGHT + 10, GAME.HEIGHT - panelHeight - 10);
    tx = Phaser.Math.Clamp(tx, 10, GAME.WIDTH - panelWidth - 10);

    this.tooltipContainer.setPosition(tx, ty);

    // Background panel with gradient + glow border
    const borderColor = state === 'owned' ? COLORS.SUCCESS : state === 'available' ? COLORS.GOLD : accentColor;

    // Outer glow
    const bgGlow = this.add.graphics();
    bgGlow.setBlendMode(Phaser.BlendModes.ADD);
    bgGlow.fillStyle(borderColor, 0.08);
    bgGlow.fillRoundedRect(-4, -4, panelWidth + 8, panelHeight + 8, 10);
    this.tooltipContainer.add(bgGlow);

    // Solid background
    const bg = this.add.graphics();
    bg.fillStyle(COLORS.UI_BG, 0.96);
    bg.fillRoundedRect(0, 0, panelWidth, panelHeight, 8);
    // Neon border
    bg.lineStyle(1.5, borderColor, 0.8);
    bg.strokeRoundedRect(0, 0, panelWidth, panelHeight, 8);
    // Inner highlight
    bg.lineStyle(0.5, borderColor, 0.3);
    bg.strokeRoundedRect(2, 2, panelWidth - 4, panelHeight - 4, 7);
    this.tooltipContainer.add(bg);

    // Colored accent bar on the left
    const accentBar = this.add.graphics();
    accentBar.fillStyle(borderColor, 0.9);
    accentBar.fillRect(0, 8, 3, panelHeight - 16);
    this.tooltipContainer.add(accentBar);

    let yCursor = 12;

    // Name
    const nameText = this.add.text(14, yCursor, node.name.toUpperCase(), {
      fontFamily: FONT_FAMILY,
      fontSize: 15,
      color: this.colorToHex(borderColor),
      fontStyle: 'bold',
    }).setLetterSpacing(1);
    this.tooltipContainer.add(nameText);

    // Status badge (right-aligned). Repeatable nodes show level count.
    const statusLabel = isMaxed
      ? 'MAXED'
      : isRepeatable && level > 0
        ? `LV ${level}${node.maxLevel ? `/${node.maxLevel}` : ''}`
        : isUnlocked ? 'OWNED' : canUnlock ? 'AVAILABLE' : 'LOCKED';
    const statusColor = state === 'owned' ? COLORS.SUCCESS : state === 'available' ? COLORS.GOLD : 0x666677;
    const statusBg = this.add.graphics();
    statusBg.fillStyle(statusColor, 0.15);
    statusBg.fillRoundedRect(panelWidth - 80, 10, 68, 18, 4);
    statusBg.lineStyle(1, statusColor, 0.5);
    statusBg.strokeRoundedRect(panelWidth - 80, 10, 68, 18, 4);
    this.tooltipContainer.add(statusBg);

    const statusText = this.add.text(panelWidth - 46, 19, statusLabel, {
      fontFamily: FONT_MONO,
      fontSize: 9,
      color: this.colorToHex(statusColor),
      fontStyle: 'bold',
    }).setOrigin(0.5).setLetterSpacing(1);
    this.tooltipContainer.add(statusText);

    yCursor += 26;

    // Divider line
    const divider = this.add.graphics();
    divider.lineStyle(0.5, borderColor, 0.25);
    divider.lineBetween(14, yCursor, panelWidth - 14, yCursor);
    this.tooltipContainer.add(divider);
    yCursor += 8;

    // Description
    const descText = this.add.text(14, yCursor, node.description, {
      fontFamily: FONT_FAMILY,
      fontSize: 11,
      color: '#cccccc',
      wordWrap: { width: panelWidth - 28 },
      lineSpacing: 2,
    });
    this.tooltipContainer.add(descText);
    yCursor += descText.height + 8;

    // Effect line (per-level for repeatable; accumulated total below if owned)
    const effectStr = this.formatEffect(node.effect);
    const effectText = this.add.text(14, yCursor, effectStr, {
      fontFamily: FONT_FAMILY,
      fontSize: 11,
      color: this.colorToHex(COLORS.ACCENT_CYAN),
      wordWrap: { width: panelWidth - 28 },
    });
    this.tooltipContainer.add(effectText);
    yCursor += effectText.height + 6;

    // Accumulated total for repeatable nodes already leveled up
    if (isRepeatable && level > 0 && node.effect.type === 'passive_bonus') {
      const totalStr = this.formatAccumulatedEffect(node.effect, level);
      if (totalStr) {
        const totalText = this.add.text(14, yCursor, `Currently: ${totalStr}`, {
          fontFamily: FONT_FAMILY,
          fontSize: 10,
          color: this.colorToHex(COLORS.SUCCESS),
          fontStyle: 'bold',
        });
        this.tooltipContainer.add(totalText);
        yCursor += 16;
      }
    }
    yCursor += 4;

    // Cost (if still purchasable)
    const showCost = !isMaxed && (isRepeatable ? true : !isUnlocked) && currentCost > 0;
    if (showCost) {
      const canAfford = this.persistentState.shardTracker.canAfford(currentCost);
      const costColor = canAfford ? COLORS.GOLD : COLORS.DANGER;
      const costLabel = isRepeatable && level > 0
        ? `Next level: ◈ ${currentCost} shards`
        : `◈ ${currentCost} shards`;
      const costText = this.add.text(14, yCursor, costLabel, {
        fontFamily: FONT_FAMILY,
        fontSize: 13,
        color: this.colorToHex(costColor),
        fontStyle: 'bold',
      });
      this.tooltipContainer.add(costText);

      if (!canAfford) {
        const need = currentCost - this.persistentState.shardTracker.getShards();
        const needText = this.add.text(panelWidth - 14, yCursor + 2, `need ${need} more`, {
          fontFamily: FONT_MONO,
          fontSize: 9,
          color: this.colorToHex(COLORS.DANGER),
        }).setOrigin(1, 0);
        this.tooltipContainer.add(needText);
      }
      yCursor += 20;
    }

    // Prereqs
    if (node.prereqs.length > 0 && state !== 'owned') {
      const prereqHeader = this.add.text(14, yCursor, 'REQUIRES', {
        fontFamily: FONT_MONO,
        fontSize: 9,
        color: '#888',
        fontStyle: 'bold',
      }).setLetterSpacing(1);
      this.tooltipContainer.add(prereqHeader);
      yCursor += 14;

      for (const pid of node.prereqs) {
        const pn = UNLOCK_TREE.find(n => n.id === pid);
        const met = unlockTree.isUnlocked(pid);
        const prefix = met ? '✓' : '✗';
        const textColor = met ? COLORS.SUCCESS : COLORS.DANGER;
        const line = this.add.text(18, yCursor, `${prefix}  ${pn?.name ?? pid}`, {
          fontFamily: FONT_FAMILY,
          fontSize: 10,
          color: this.colorToHex(textColor),
        });
        this.tooltipContainer.add(line);
        yCursor += 14;
      }
      yCursor += 4;
    }

    // Purchase hint
    if (canUnlock) {
      const hintBg = this.add.graphics();
      hintBg.fillStyle(COLORS.GOLD, 0.12);
      hintBg.fillRect(0, panelHeight - 22, panelWidth, 22);
      this.tooltipContainer.add(hintBg);

      const hintText = this.add.text(panelWidth / 2, panelHeight - 11, '▶ CLICK TO PURCHASE', {
        fontFamily: FONT_FAMILY,
        fontSize: 10,
        color: this.colorToHex(COLORS.GOLD),
        fontStyle: 'bold',
      }).setOrigin(0.5).setLetterSpacing(2);
      this.tooltipContainer.add(hintText);
    }
  }

  private calculateTooltipHeight(node: UnlockNode, state: 'locked' | 'available' | 'owned'): number {
    let h = 50; // header + divider
    h += 30; // description (approx)
    h += 22; // effect line
    const unlockTree = this.persistentState.unlockTree;
    const isRepeatable = !!node.repeatable;
    const level = unlockTree.getLevel(node.id);
    if (isRepeatable && level > 0) h += 16; // "Currently: …" line
    const isMaxed = unlockTree.isMaxed(node.id);
    const showCost = !isMaxed && (isRepeatable || state !== 'owned') && unlockTree.getCurrentCost(node.id) > 0;
    if (showCost) h += 22;
    if (node.prereqs.length > 0 && state !== 'owned') h += 18 + node.prereqs.length * 14;
    if (unlockTree.canUnlock(node.id)) h += 26;
    return Math.max(h, 90);
  }

  private hideTooltip(): void {
    this.tooltipContainer.setVisible(false);
  }

  private formatEffect(effect: UnlockEffect): string {
    switch (effect.type) {
      case 'unlock_tower':
        return `New tower: ${this.formatIdentifier(effect.towerId)}`;
      case 'unlock_upgrade':
        return `New upgrade for: ${this.formatIdentifier(effect.towerId)}`;
      case 'passive_bonus':
        if (effect.stat === 'none') return 'Journey begins';
        return this.formatPassive(effect.stat, effect.value);
      case 'unlock_mode':
        return `New mode: ${this.formatIdentifier(effect.mode)}`;
      default:
        return '';
    }
  }

  private formatAccumulatedEffect(effect: UnlockEffect, level: number): string {
    if (effect.type !== 'passive_bonus' || effect.stat === 'none') return '';
    return this.formatPassive(effect.stat, effect.value * level);
  }

  private formatPassive(stat: string, value: number): string {
    // Percent-based stats — show as +N% (or -N% for speed reduction)
    const percentStats = ['global_damage', 'sell_ratio', 'gold_gain_mult', 'enemy_speed_reduction'];
    if (percentStats.includes(stat)) {
      const pct = Math.round(value * 1000) / 10; // 1 decimal
      const sign = stat === 'enemy_speed_reduction' ? '-' : '+';
      return `${sign}${pct}% ${this.formatIdentifier(stat)}`;
    }
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value} ${this.formatIdentifier(stat)}`;
  }

  private formatIdentifier(s: string): string {
    return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  private colorToHex(color: number): string {
    return '#' + color.toString(16).padStart(6, '0');
  }

  // ============ Legend ============

  private buildLegend(): void {
    const legendX = 14;
    const legendY = GAME.HEIGHT - 68;
    const legendW = 324;
    const legendH = 58;

    const bg = this.add.graphics().setDepth(22);
    bg.fillStyle(COLORS.UI_BG, 0.9);
    bg.fillRoundedRect(legendX, legendY, legendW, legendH, 6);
    bg.lineStyle(1, COLORS.ACCENT_CYAN, 0.3);
    bg.strokeRoundedRect(legendX, legendY, legendW, legendH, 6);

    const title = this.add.text(legendX + 10, legendY + 6, 'LEGEND', {
      fontFamily: FONT_MONO,
      fontSize: 9,
      color: '#888',
      fontStyle: 'bold',
    }).setDepth(23).setLetterSpacing(2);
    title.setName('legend-title');

    const items: { shape: string; label: string; color: number }[] = [
      { shape: 'triangle', label: 'TOWER', color: COLORS.ACCENT_PINK },
      { shape: 'hexagon', label: 'PASSIVE', color: COLORS.WIND },
      { shape: 'star', label: 'MODE', color: COLORS.LIGHTNING },
      { shape: 'diamond', label: 'UPGRADE', color: COLORS.ACCENT_PURPLE },
      { shape: 'octagon', label: 'MASTERY', color: COLORS.GOLD },
    ];

    items.forEach((item, i) => {
      const ix = legendX + 14 + i * 62;
      const iy = legendY + 34;

      const shapeGfx = this.add.graphics().setDepth(23);
      const sides = this.shapeSides(item.shape);
      if (item.shape === 'star') {
        ShapeRenderer.drawStar(shapeGfx, ix, iy, 7, item.color, 0.4, item.color, 1.5);
      } else if (item.shape === 'diamond') {
        ShapeRenderer.drawDiamond(shapeGfx, ix, iy, 7, item.color, 0.4, item.color, 1.5);
      } else {
        ShapeRenderer.drawPolygon(shapeGfx, ix, iy, sides, 7, item.color, 0.4, item.color, 1.5);
      }

      this.add.text(ix + 11, iy, item.label, {
        fontFamily: FONT_MONO,
        fontSize: 8,
        color: this.colorToHex(item.color),
        fontStyle: 'bold',
      }).setOrigin(0, 0.5).setDepth(23).setLetterSpacing(1);
    });
  }

  // ============ Purchasing ============

  private purchaseNode(ln: LayoutNode): void {
    const node = ln.node;
    const accentColor = getNodeAccentColor(node);
    const success = this.persistentState.unlockTree.unlock(node.id);
    if (!success) return;

    // Camera shake + flash
    this.cameras.main.shake(150, 0.003);
    this.cameras.main.flash(200, 255, 215, 0, false, undefined, 0.2);

    // Particle burst at node position (accounting for scroll)
    const worldX = ln.x - this.scrollOffset;
    const worldY = ln.y;
    this.playPurchaseBurst(worldX, worldY, accentColor);

    // Expanding ring at node
    const ring = this.add.graphics().setDepth(40);
    ring.setBlendMode(Phaser.BlendModes.ADD);
    const progress = { r: NODE_RADIUS, a: 0.8 };
    this.tweens.add({
      targets: progress,
      r: NODE_RADIUS * 4,
      a: 0,
      duration: 500,
      ease: 'Quad.easeOut',
      onUpdate: () => {
        ring.clear();
        ring.lineStyle(3, COLORS.GOLD, progress.a);
        ring.strokeCircle(worldX, worldY, progress.r);
        ring.lineStyle(1, accentColor, progress.a * 0.5);
        ring.strokeCircle(worldX, worldY, progress.r * 0.8);
      },
      onComplete: () => ring.destroy(),
    });

    // Refresh tree after brief delay for effect
    this.time.delayedCall(150, () => this.refreshTree());
  }

  private playPurchaseBurst(x: number, y: number, color: number): void {
    // Burst of particles
    for (let i = 0; i < 16; i++) {
      const angle = (Math.PI * 2 / 16) * i + randomRange(-0.2, 0.2);
      const speed = randomRange(80, 180);
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;

      const p = this.add.graphics().setDepth(41);
      p.setBlendMode(Phaser.BlendModes.ADD);
      p.fillStyle(i % 2 === 0 ? COLORS.GOLD : color, 0.9);
      p.fillCircle(0, 0, randomRange(2, 3.5));
      p.setPosition(x, y);

      this.tweens.add({
        targets: p,
        x: x + vx * 0.5,
        y: y + vy * 0.5,
        alpha: 0,
        duration: randomRange(400, 700),
        ease: 'Quad.easeOut',
        onComplete: () => p.destroy(),
      });
    }
  }

  private refreshTree(): void {
    // Update shard text
    const shards = this.persistentState.shardTracker.getShards();
    this.shardText.setText(`◈ ${shards}`);

    // Update progress
    const unlockedCount = UNLOCK_TREE.filter(n => this.persistentState.unlockTree.isUnlocked(n.id)).length;
    const totalCount = UNLOCK_TREE.length;
    const percent = Math.floor((unlockedCount / totalCount) * 100);
    this.progressText.setText(`${unlockedCount}/${totalCount} UNLOCKED · ${percent}%`);

    const barX = GAME.WIDTH / 2 - 90;
    this.drawProgressBar(barX, 68, 180, 3, percent / 100);

    // Redraw each node in place (preserves interactivity)
    const unlockTree = this.persistentState.unlockTree;
    for (const ln of this.layoutNodes) {
      const visual = this.nodeVisuals.get(ln.node.id);
      if (!visual) continue;

      const accentColor = getNodeAccentColor(ln.node);
      const shape = getNodeShape(ln.node);
      const state = computeNodeState(ln.node, unlockTree);

      // Remove all non-essential children (keep glow + main gfx)
      const toRemove = visual.container.list.filter(
        obj => obj !== visual.glowGfx && obj !== visual.mainGfx,
      );
      toRemove.forEach(obj => obj.destroy());

      // Redraw shape
      this.drawNodeShape(visual.glowGfx, visual.mainGfx, shape, accentColor, state);

      // Re-add extras (cost badges, labels, pulse)
      this.addNodeExtras(visual, ln, state);
    }

    // Redraw connections
    this.drawConnections();
    this.hideTooltip();
  }

  private addNodeExtras(visual: NodeVisual, ln: LayoutNode, state: 'locked' | 'available' | 'owned'): void {
    const container = visual.container;
    const unlockTree = this.persistentState.unlockTree;
    const level = unlockTree.getLevel(ln.node.id);
    const isRepeatable = !!ln.node.repeatable;

    // Pulse ring for available
    if (state === 'available') {
      if (!visual.pulseGfx) {
        const pulseGfx = this.add.graphics();
        pulseGfx.setBlendMode(Phaser.BlendModes.ADD);
        container.add(pulseGfx);
        visual.pulseGfx = pulseGfx;
      }
    } else if (visual.pulseGfx) {
      visual.pulseGfx.destroy();
      visual.pulseGfx = undefined;
    }

    // NOTE: No inner icons. Shape + color carry the state signal.

    // Name label (append level for repeatable nodes)
    const nameColor = state === 'owned'
      ? this.colorToHex(COLORS.SUCCESS)
      : state === 'available'
        ? this.colorToHex(COLORS.GOLD)
        : '#6a6a80';

    const nameLabel = isRepeatable && level > 0
      ? `${ln.node.name} · Lv ${level}${ln.node.maxLevel ? `/${ln.node.maxLevel}` : ''}`
      : ln.node.name;

    const nameText = this.add.text(0, NODE_RADIUS + 5, nameLabel, {
      fontFamily: FONT_FAMILY,
      fontSize: 10,
      color: nameColor,
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5, 0);
    container.add(nameText);

    // No cost badge — cost only shown on hover tooltip.
  }

  // ============ Scrolling ============

  private setupScrolling(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.y < HEADER_HEIGHT + 5) return;
      this.isDragging = true;
      this.dragStartX = pointer.x;
      this.dragStartScroll = this.scrollOffset;
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.isDragging) return;
      const dx = pointer.x - this.dragStartX;
      if (Math.abs(dx) > 3) this.hideTooltip();
      this.scrollOffset = Phaser.Math.Clamp(
        this.dragStartScroll - dx,
        0,
        this.maxScrollX,
      );
      this.scrollContainer.setX(-this.scrollOffset);
    });

    this.input.on('pointerup', () => {
      this.isDragging = false;
    });

    this.input.on('wheel', (_p: Phaser.Input.Pointer, _gos: Phaser.GameObjects.GameObject[], deltaX: number, deltaY: number) => {
      this.scrollOffset = Phaser.Math.Clamp(
        this.scrollOffset + (deltaY || deltaX) * 0.5,
        0,
        this.maxScrollX,
      );
      this.scrollContainer.setX(-this.scrollOffset);
    });
  }

  // ============ Update Loop ============

  update(time: number, delta: number): void {
    // Animate background particles
    for (const p of this.bgParticles) {
      p.x += p.vx * (delta / 1000);
      p.y += p.vy * (delta / 1000);
      if (p.x < -20) p.x = GAME.WIDTH + 20;
      if (p.x > GAME.WIDTH + 20) p.x = -20;
      if (p.y < HEADER_HEIGHT - 20) p.y = GAME.HEIGHT + 20;
      if (p.y > GAME.HEIGHT + 20) p.y = HEADER_HEIGHT - 20;
      p.gfx.setPosition(p.x, p.y);
    }

    // Animated header separator (pulsing cyan)
    this.headerSeparator.clear();
    const pulseAlpha = 0.25 + Math.sin(time * 0.003) * 0.12;
    this.headerSeparator.lineStyle(1.5, COLORS.ACCENT_CYAN, pulseAlpha);
    this.headerSeparator.lineBetween(0, HEADER_HEIGHT, GAME.WIDTH, HEADER_HEIGHT);
    this.headerSeparator.lineStyle(0.5, COLORS.ACCENT_CYAN, pulseAlpha * 0.3);
    this.headerSeparator.lineBetween(0, HEADER_HEIGHT + 1, GAME.WIDTH, HEADER_HEIGHT + 1);

    // Pulse animation for available nodes
    const pulseT = (Math.sin(time * 0.004) + 1) / 2;
    for (const visual of this.nodeVisuals.values()) {
      if (!visual.pulseGfx) continue;
      visual.pulseGfx.clear();
      const r = NODE_RADIUS + 4 + pulseT * 6;
      const a = 0.4 * (1 - pulseT);
      visual.pulseGfx.lineStyle(2, COLORS.GOLD, a);
      visual.pulseGfx.strokeCircle(0, 0, r);
    }

    // Flowing dots along connections
    this.dashOffset += delta;
    if (this.dashOffset > 10000) this.dashOffset -= 10000;
    this.drawConnectionDots();
  }

  private drawConnectionDots(): void {
    // Only redraw the glow-layer dots, keep main lines static
    // (This is called from update loop)
    const unlockTree = this.persistentState.unlockTree;

    // We need to clear + redraw just the flowing dots part
    // For simplicity, we redraw the whole connection glow layer
    this.connectionGlowGfx.clear();

    for (const ln of this.layoutNodes) {
      for (const prereqId of ln.node.prereqs) {
        const prereqLn = this.layoutNodes.find(l => l.node.id === prereqId);
        if (!prereqLn) continue;

        const x1 = prereqLn.x + NODE_RADIUS;
        const y1 = prereqLn.y;
        const x2 = ln.x - NODE_RADIUS;
        const y2 = ln.y;

        const bothUnlocked = unlockTree.isUnlocked(ln.node.id) && unlockTree.isUnlocked(prereqId);
        const prereqUnlocked = unlockTree.isUnlocked(prereqId);

        if (bothUnlocked) {
          // Static glow
          this.connectionGlowGfx.lineStyle(6, COLORS.SUCCESS, 0.08);
          this.drawCurvedLine(this.connectionGlowGfx, x1, y1, x2, y2);
          this.connectionGlowGfx.lineStyle(3, COLORS.SUCCESS, 0.2);
          this.drawCurvedLine(this.connectionGlowGfx, x1, y1, x2, y2);
        } else if (prereqUnlocked) {
          // Glow + flowing dots
          this.connectionGlowGfx.lineStyle(4, COLORS.GOLD, 0.12);
          this.drawCurvedLine(this.connectionGlowGfx, x1, y1, x2, y2);

          for (let i = 0; i < 3; i++) {
            const baseT = ((this.dashOffset * 0.0003) + i / 3) % 1;
            const { px, py } = this.pointOnCurve(x1, y1, x2, y2, baseT);
            this.connectionGlowGfx.fillStyle(COLORS.GOLD, 0.8);
            this.connectionGlowGfx.fillCircle(px, py, 2.5);
            this.connectionGlowGfx.fillStyle(0xffffff, 0.6);
            this.connectionGlowGfx.fillCircle(px, py, 1.2);
          }
        }
      }
    }
  }
}
