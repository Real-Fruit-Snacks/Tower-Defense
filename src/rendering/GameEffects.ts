import Phaser from 'phaser';
import { distance } from '../utils/MathUtils';

/**
 * Death explosion — burst of small particles radiating outward.
 * Used when an enemy is killed.
 */
export function playDeathEffect(
  scene: Phaser.Scene,
  x: number,
  y: number,
  color: number,
): void {
  const count = Phaser.Math.Between(8, 12);

  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Phaser.Math.FloatBetween(-0.2, 0.2);
    const speed = Phaser.Math.FloatBetween(30, 60);
    const radius = Phaser.Math.FloatBetween(2, 3);

    const g = scene.add.graphics();
    g.fillStyle(color, 1);
    g.fillCircle(0, 0, radius);
    g.setPosition(x, y);

    scene.tweens.add({
      targets: g,
      x: x + Math.cos(angle) * speed,
      y: y + Math.sin(angle) * speed,
      alpha: 0,
      scaleX: 0,
      scaleY: 0,
      duration: 300,
      ease: 'Quad.easeOut',
      onComplete: () => g.destroy(),
    });
  }
}

/**
 * Floating damage number that drifts upward and fades out.
 */
export function showDamageNumber(
  scene: Phaser.Scene,
  x: number,
  y: number,
  damage: number,
  color: number,
  isStrong?: boolean,
): void {
  const label = isStrong ? `${damage}!` : `${damage}`;
  const fontSize = isStrong ? 18 : 14;
  const colorStr = '#' + color.toString(16).padStart(6, '0');

  const text = scene.add.text(x, y, label, {
    fontFamily: 'Segoe UI, system-ui, sans-serif',
    fontSize,
    color: colorStr,
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 2,
  });
  text.setOrigin(0.5, 0.5);
  text.setDepth(15);

  scene.tweens.add({
    targets: text,
    y: y - 30,
    alpha: 0,
    duration: 600,
    ease: 'Quad.easeOut',
    onComplete: () => text.destroy(),
  });
}

/**
 * Tower placement pulse — an expanding ring that fades out.
 */
export function playPlacementEffect(
  scene: Phaser.Scene,
  x: number,
  y: number,
  color: number,
): void {
  const ring = scene.add.graphics();

  const startRadius = 10;
  const endRadius = 40;
  const progress = { t: 0 };

  const draw = () => {
    ring.clear();
    const r = Phaser.Math.Linear(startRadius, endRadius, progress.t);
    const alpha = Phaser.Math.Linear(0.6, 0, progress.t);
    ring.lineStyle(2, color, alpha);
    ring.strokeCircle(x, y, r);
  };

  draw();

  scene.tweens.add({
    targets: progress,
    t: 1,
    duration: 300,
    ease: 'Quad.easeOut',
    onUpdate: draw,
    onComplete: () => ring.destroy(),
  });
}

/**
 * Wave announcement — large centered text with bounce-in and fade-out.
 */
export function showWaveAnnouncement(
  scene: Phaser.Scene,
  waveNumber: number,
  isBoss: boolean,
): void {
  const label = isBoss ? 'BOSS WAVE' : `WAVE ${waveNumber}`;
  const color = isBoss ? '#ff4444' : '#00ffff';

  const cx = scene.cameras.main.centerX;
  const cy = scene.cameras.main.centerY;

  const text = scene.add.text(cx, cy, label, {
    fontFamily: 'Segoe UI, system-ui, sans-serif',
    fontSize: 48,
    color,
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 4,
  });
  text.setOrigin(0.5, 0.5);
  text.setDepth(50);
  text.setScale(0);
  text.setAlpha(1);

  // Scale in with bounce
  scene.tweens.add({
    targets: text,
    scaleX: 1,
    scaleY: 1,
    duration: 400,
    ease: 'Back.easeOut',
    onComplete: () => {
      // Hold, then fade out
      scene.time.delayedCall(800, () => {
        scene.tweens.add({
          targets: text,
          alpha: 0,
          duration: 400,
          ease: 'Quad.easeIn',
          onComplete: () => text.destroy(),
        });
      });
    },
  });
}

/**
 * Wave complete text — "WAVE CLEAR" with bonus gold indicator.
 */
export function showWaveComplete(
  scene: Phaser.Scene,
  bonusGold: number,
): void {
  const cx = scene.cameras.main.centerX;
  const cy = scene.cameras.main.centerY;

  const clearText = scene.add.text(cx, cy - 16, 'WAVE CLEAR', {
    fontFamily: 'Segoe UI, system-ui, sans-serif',
    fontSize: 36,
    color: '#4ade80',
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 3,
  });
  clearText.setOrigin(0.5, 0.5);
  clearText.setDepth(50);
  clearText.setAlpha(0);

  const goldText = scene.add.text(cx, cy + 24, `\u2B21 +${bonusGold}`, {
    fontFamily: 'Segoe UI, system-ui, sans-serif',
    fontSize: 24,
    color: '#ffd700',
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 2,
  });
  goldText.setOrigin(0.5, 0.5);
  goldText.setDepth(50);
  goldText.setAlpha(0);

  const targets = [clearText, goldText];

  // Fade in
  scene.tweens.add({
    targets,
    alpha: 1,
    duration: 200,
    ease: 'Quad.easeOut',
    onComplete: () => {
      // Hold, then fade out
      scene.time.delayedCall(600, () => {
        scene.tweens.add({
          targets,
          alpha: 0,
          duration: 300,
          ease: 'Quad.easeIn',
          onComplete: () => {
            clearText.destroy();
            goldText.destroy();
          },
        });
      });
    },
  });
}

/**
 * Gold change flash — briefly scales and tints a text object to
 * indicate a gold gain or loss.
 */
export function flashGoldChange(
  scene: Phaser.Scene,
  textObj: Phaser.GameObjects.Text,
  positive: boolean,
): void {
  const flashColor = positive ? '#4ade80' : '#f87171';
  const originalColor = '#ffd700';

  // Flash the color
  textObj.setColor(flashColor);

  // Scale up then back down
  scene.tweens.add({
    targets: textObj,
    scaleX: 1.3,
    scaleY: 1.3,
    duration: 100,
    yoyo: true,
    ease: 'Quad.easeOut',
    onComplete: () => {
      textObj.setColor(originalColor);
    },
  });
}

/**
 * Placement rejection flash — red X and red cell flash
 * when attempting an invalid tower placement.
 */
export function playRejectionEffect(
  scene: Phaser.Scene,
  x: number,
  y: number,
): void {
  // Red "X" text
  const xText = scene.add.text(x, y, 'X', {
    fontFamily: 'Segoe UI, system-ui, sans-serif',
    fontSize: 24,
    color: '#ff4444',
    fontStyle: 'bold',
  });
  xText.setOrigin(0.5, 0.5);
  xText.setDepth(15);

  scene.tweens.add({
    targets: xText,
    alpha: 0,
    duration: 300,
    ease: 'Quad.easeIn',
    onComplete: () => xText.destroy(),
  });

  // Red flash rectangle over the grid cell
  const flash = scene.add.graphics();
  flash.fillStyle(0xff4444, 0.4);
  flash.fillRect(x - 24, y - 24, 48, 48);
  flash.setDepth(14);

  scene.tweens.add({
    targets: flash,
    alpha: 0,
    duration: 200,
    ease: 'Quad.easeIn',
    onComplete: () => flash.destroy(),
  });
}

/**
 * Animated path preview dots — draws pulsing dots along a waypoint path.
 * Returns the Graphics object so the caller can destroy it when done.
 */
export function animatePathDots(
  scene: Phaser.Scene,
  waypoints: { x: number; y: number }[],
  color: number,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();

  if (waypoints.length < 2) {
    return g;
  }

  // Compute total path length and cumulative distances
  const segments: number[] = [];
  let totalLength = 0;
  for (let i = 1; i < waypoints.length; i++) {
    const prev = waypoints[i - 1]!;
    const curr = waypoints[i]!;
    const d = distance(prev.x, prev.y, curr.x, curr.y);
    segments.push(d);
    totalLength += d;
  }

  const dotCount = 8;
  const dotRadius = 3;

  const getPointAt = (frac: number): { x: number; y: number } => {
    const targetDist = frac * totalLength;
    let accumulated = 0;

    for (let i = 0; i < segments.length; i++) {
      const segLen = segments[i]!;
      if (accumulated + segLen >= targetDist) {
        const segFrac = segLen > 0 ? (targetDist - accumulated) / segLen : 0;
        const from = waypoints[i]!;
        const to = waypoints[i + 1]!;
        return {
          x: from.x + (to.x - from.x) * segFrac,
          y: from.y + (to.y - from.y) * segFrac,
        };
      }
      accumulated += segLen;
    }

    return waypoints[waypoints.length - 1]!;
  };

  // Animate with a tween driving a progress value for pulsing alpha
  const pulse = { t: 0 };

  const draw = () => {
    g.clear();
    for (let i = 0; i < dotCount; i++) {
      const frac = i / dotCount;
      const pt = getPointAt(frac);
      // Offset each dot's phase so they pulse in a wave
      const phase = (frac + pulse.t) * Math.PI * 2;
      const alpha = 0.3 + 0.7 * ((Math.sin(phase) + 1) / 2);
      g.fillStyle(color, alpha);
      g.fillCircle(pt.x, pt.y, dotRadius);
    }
  };

  draw();

  scene.tweens.add({
    targets: pulse,
    t: 1,
    duration: 1500,
    repeat: -1,
    ease: 'Linear',
    onUpdate: draw,
  });

  return g;
}
