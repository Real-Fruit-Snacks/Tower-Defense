// Particle configs for Phaser particle emitters
// These return config objects that can be used with scene.add.particles()

export const PARTICLE_CONFIGS = {
  explosion: (color: number) => ({
    speed: { min: 50, max: 150 },
    scale: { start: 0.6, end: 0 },
    alpha: { start: 0.8, end: 0 },
    lifespan: 400,
    quantity: 12,
    tint: color,
    emitting: false,
  }),

  trail: (color: number) => ({
    speed: { min: 5, max: 20 },
    scale: { start: 0.3, end: 0 },
    alpha: { start: 0.5, end: 0 },
    lifespan: 300,
    quantity: 1,
    frequency: 50,
    tint: color,
  }),

  aura: (color: number) => ({
    speed: { min: 10, max: 30 },
    scale: { start: 0.2, end: 0 },
    alpha: { start: 0.3, end: 0 },
    lifespan: 600,
    quantity: 1,
    frequency: 100,
    tint: color,
  }),
} as const;
