import Phaser from 'phaser';
import { GAME } from '../constants';

/**
 * Attach a "stage camera" to a scene: configures `scene.cameras.main`
 * so its viewport is the 1280×720 design space scaled + centered to
 * fit the actual viewport, preserving aspect ratio. Resizes follow
 * `scale.resize` automatically and are cleaned up on scene shutdown.
 *
 * Scenes that use this helper can keep all their internal positioning
 * in 1280×720 design coordinates — the camera handles scaling + letter-
 * boxing for any screen. Pixels outside the camera viewport show the
 * canvas / body background.
 *
 * GameScene does NOT use this helper; it has a three-camera setup so
 * the atmospheric background can fill the full viewport.
 */
export function setupStageCamera(scene: Phaser.Scene): void {
  const cam = scene.cameras.main;
  cam.setOrigin(0, 0);

  const layout = (): void => {
    const vw = scene.scale.width;
    const vh = scene.scale.height;
    const scale = Math.min(vw / GAME.WIDTH, vh / GAME.HEIGHT);
    const renderedW = GAME.WIDTH * scale;
    const renderedH = GAME.HEIGHT * scale;
    const offsetX = (vw - renderedW) / 2;
    const offsetY = (vh - renderedH) / 2;
    cam.setViewport(offsetX, offsetY, renderedW, renderedH);
    cam.setZoom(scale);
    cam.setScroll(0, 0);
  };

  layout();
  scene.scale.on('resize', layout);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.scale.off('resize', layout);
  });
}
