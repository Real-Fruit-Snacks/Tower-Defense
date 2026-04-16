import Phaser from 'phaser';
import { SCENES, COLORS, GAME } from '../constants';
import { createGlowText, drawNeonRect } from '../rendering/NeonEffects';
import type { PersistentState } from '../roguelite/PersistentState';

interface ShopItem {
  name: string;
  description: string;
  cost: number; // shards
  color: number;
  apply: (persistent: PersistentState) => void;
}

export class ShopScene extends Phaser.Scene {
  private persistent!: PersistentState;

  constructor() {
    super(SCENES.SHOP);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.BG);
    this.persistent = this.game.registry.get('persistentState') as PersistentState;

    createGlowText(this, GAME.WIDTH / 2, 50, 'SHOP', COLORS.GOLD, 32);

    // Shard balance display
    const shardText = this.add.text(GAME.WIDTH / 2, 85, `◈ ${this.persistent.shardTracker.getShards()} shards`, {
      fontFamily: 'Segoe UI, system-ui, sans-serif',
      fontSize: 14,
      color: '#a855f7',
    }).setOrigin(0.5);

    const items: ShopItem[] = [
      {
        name: 'Repair Kit',
        description: 'Restore 5 HP for campaign run',
        cost: 30,
        color: COLORS.SUCCESS,
        apply: (p) => {
          const data = p.saveManager.getData();
          data.campaignProgress.hp = Math.min(data.campaignProgress.hp + 5, 25);
          p.saveManager.save();
        },
      },
      {
        name: 'Gold Cache',
        description: 'Gain 50 shards immediately',
        cost: 0,
        color: COLORS.GOLD,
        apply: (p) => { p.shardTracker.addShards(50); },
      },
      {
        name: 'Shard Doubler',
        description: 'Next run earns double shards',
        cost: 80,
        color: COLORS.ACCENT_PURPLE,
        apply: () => { /* TODO: flag double shards for next run */ },
      },
      {
        name: 'Full Heal',
        description: 'Restore all HP for campaign',
        cost: 60,
        color: COLORS.ACCENT_CYAN,
        apply: (p) => {
          const data = p.saveManager.getData();
          data.campaignProgress.hp = 25;
          p.saveManager.save();
        },
      },
    ];

    items.forEach((item, i) => {
      const x = 140 + (i % 2) * (GAME.WIDTH / 2 - 40);
      const y = 120 + Math.floor(i / 2) * 170;
      this.createShopCard(x, y, item, shardText);
    });

    // Continue button
    const continueBtn = this.add.text(GAME.WIDTH / 2, GAME.HEIGHT - 50, 'CONTINUE →', {
      fontFamily: 'Segoe UI, system-ui, sans-serif',
      fontSize: 18,
      color: '#00ffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    continueBtn.on('pointerdown', () => this.scene.start(SCENES.WORLD_MAP));
    continueBtn.on('pointerover', () => continueBtn.setAlpha(0.7));
    continueBtn.on('pointerout', () => continueBtn.setAlpha(1));
  }

  private createShopCard(x: number, y: number, item: ShopItem, shardText: Phaser.GameObjects.Text): void {
    const w = GAME.WIDTH / 2 - 80;
    const h = 130;
    const canAfford = item.cost === 0 || this.persistent.shardTracker.canAfford(item.cost);

    const gfx = this.add.graphics();
    drawNeonRect(gfx, x, y, w, h, item.color, canAfford ? 0.06 : 0.02, 8);

    this.add.text(x + 20, y + 18, item.name, {
      fontFamily: 'Segoe UI, system-ui, sans-serif',
      fontSize: 16,
      color: canAfford ? '#fff' : '#555',
      fontStyle: 'bold',
    });

    this.add.text(x + 20, y + 44, item.description, {
      fontFamily: 'Segoe UI, system-ui, sans-serif',
      fontSize: 12,
      color: '#888',
    });

    if (item.cost > 0) {
      this.add.text(x + 20, y + h - 32, `◈ ${item.cost}`, {
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontSize: 14,
        color: canAfford ? '#a855f7' : '#444',
        fontStyle: 'bold',
      });
    } else {
      this.add.text(x + 20, y + h - 32, 'FREE', {
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontSize: 14,
        color: '#4ade80',
        fontStyle: 'bold',
      });
    }

    const buyBtn = this.add.text(x + w - 20, y + h - 32, canAfford ? 'BUY' : 'LOCKED', {
      fontFamily: 'Segoe UI, system-ui, sans-serif',
      fontSize: 13,
      color: canAfford ? '#' + item.color.toString(16).padStart(6, '0') : '#444',
      fontStyle: 'bold',
    }).setOrigin(1, 0);

    if (canAfford) {
      buyBtn.setInteractive({ useHandCursor: true });
      buyBtn.on('pointerdown', () => {
        if (item.cost > 0 && !this.persistent.shardTracker.canAfford(item.cost)) return;
        if (item.cost > 0) this.persistent.shardTracker.spendShards(item.cost);
        item.apply(this.persistent);
        buyBtn.setText('SOLD');
        buyBtn.setColor('#555');
        buyBtn.disableInteractive();
        shardText.setText(`◈ ${this.persistent.shardTracker.getShards()} shards`);
      });
      buyBtn.on('pointerover', () => buyBtn.setAlpha(0.7));
      buyBtn.on('pointerout', () => buyBtn.setAlpha(1));
    }
  }
}
