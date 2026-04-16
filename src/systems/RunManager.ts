import type { GameEvents, GameState } from '../types';
import { GAME } from '../constants';
import { EventBus } from '../utils/EventBus';

export class RunManager {
  private events: EventBus<GameEvents>;
  private hp: number;
  private wavesCleared = 0;
  private enemiesKilled = 0;
  private goldEarned = 0;
  private gameState: GameState = 'build';

  constructor(events: EventBus<GameEvents>, startingHP: number = GAME.STARTING_HP) {
    this.events = events;
    this.hp = startingHP;

    this.events.on('ENEMY_KILLED', ({ reward }) => {
      this.enemiesKilled++;
      this.goldEarned += reward;
    });

    this.events.on('ENEMY_LEAKED', ({ damage }) => {
      this.takeDamage(damage);
    });

    this.events.on('WAVE_END', () => {
      this.wavesCleared++;
    });
  }

  takeDamage(amount: number): void {
    this.hp = Math.max(0, this.hp - amount);
    this.events.emit('HP_CHANGED', { hp: this.hp, delta: -amount });

    if (this.hp <= 0) {
      this.gameState = 'gameover';
      this.events.emit('GAME_STATE_CHANGED', { state: 'gameover' });
    }
  }

  getHP(): number {
    return this.hp;
  }

  getState(): GameState {
    return this.gameState;
  }

  setState(state: GameState): void {
    this.gameState = state;
    this.events.emit('GAME_STATE_CHANGED', { state });
  }

  getStats(victory = false) {
    const baseShardsFromWaves = this.wavesCleared * 5;
    const baseShardsFromKills = Math.floor(this.enemiesKilled * 0.5);
    const victoryBonus = victory ? 50 : 0;
    return {
      wavesCleared: this.wavesCleared,
      enemiesKilled: this.enemiesKilled,
      goldEarned: this.goldEarned,
      shardsEarned: baseShardsFromWaves + baseShardsFromKills + victoryBonus,
      victory,
    };
  }

  isGameOver(): boolean {
    return this.hp <= 0;
  }
}
