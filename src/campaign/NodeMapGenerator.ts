import type { NodeMapNode, NodeType } from '../types';
import type { WorldConfig } from '../data/worldMap';
import { SeededRNG } from '../data/levelLayouts';

/**
 * Generates a branching node map similar to Slay the Spire.
 *
 * IMPORTANT: the generation is fully deterministic given a seed.
 * The world map regenerates every time WorldMapScene.create() runs
 * (e.g. after clicking a non-battle node, or returning from a
 * battle). If the map weren't deterministic, the set of connections
 * and node types would change between runs, which orphaned the
 * visited-path green lines and made the map appear "broken".
 */
export class NodeMapGenerator {
  static generate(
    config: WorldConfig,
    mapWidth: number,
    mapHeight: number,
    seed = 0,
  ): NodeMapNode[] {
    const rng = new SeededRNG(seed || 1);
    const nodes: NodeMapNode[] = [];
    const layerNodes: string[][] = [];
    let nodeCount = 0;

    // Top margin must clear the 72px header bar plus the largest node radius
    // (~28 for boss) + its label (~28) + jitter (~8) + safety. Bottom margin
    // only needs to clear the node radius + jitter, so it stays smaller.
    const marginX = 60;
    const marginTop = 120;
    const marginBottom = 50;
    const usableWidth = mapWidth - marginX * 2;
    const usableHeight = mapHeight - marginTop - marginBottom;

    for (let layer = 0; layer < config.layers; layer++) {
      const count = config.nodesPerLayer[layer] ?? 2;
      const currentIds: string[] = [];

      for (let i = 0; i < count; i++) {
        const isStart = layer === 0;
        const isBoss = layer === config.layers - 1;
        const nodeId = isStart ? 'start' : `node_${nodeCount++}`;

        const type = isBoss
          ? 'boss'
          : isStart
            ? 'battle'
            : this.pickNodeType(config.nodeWeights, layer, config.layers, rng);

        const x = marginX + (layer / (config.layers - 1)) * usableWidth;
        const ySpread = count > 1 ? usableHeight / (count - 1) : 0;
        const baseY = marginTop + (count === 1 ? usableHeight / 2 : i * ySpread);
        const y = baseY + (rng.next() * 16 - 8);

        nodes.push({
          id: nodeId,
          type,
          connections: [],
          x: x + (rng.next() * 16 - 8),
          y,
          difficulty: config.difficulty + layer * 0.5,
        });

        currentIds.push(nodeId);
      }

      // Connect to previous layer — each previous node gets AT LEAST
      // 2 forward options (when possible) so the player rarely feels
      // railroaded into a single choice.
      if (layer > 0 && layerNodes.length > 0) {
        const prevIds = layerNodes[layer - 1]!;

        for (const prevId of prevIds) {
          const prevNode = nodes.find(n => n.id === prevId)!;
          const maxConn = Math.min(currentIds.length, 3);
          const minConn = Math.min(2, currentIds.length);
          const connectCount = rng.intRange(minConn, maxConn);
          // Seeded shuffle: Fisher-Yates with the RNG.
          const shuffled = [...currentIds];
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(rng.next() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
          }
          for (let c = 0; c < connectCount; c++) {
            const targetId = shuffled[c]!;
            if (!prevNode.connections.includes(targetId)) {
              prevNode.connections.push(targetId);
            }
          }
        }

        // Ensure every current node has at least one incoming connection
        for (const currId of currentIds) {
          const hasIncoming = nodes.some(n => n.connections.includes(currId));
          if (!hasIncoming) {
            const randomPrev = prevIds[rng.intRange(0, prevIds.length - 1)]!;
            const prevNode = nodes.find(n => n.id === randomPrev)!;
            prevNode.connections.push(currId);
          }
        }
      }

      layerNodes.push(currentIds);
    }

    // Post-processing: enforce map quality rules
    this.ensureShopBeforeBoss(nodes, layerNodes);
    this.ensureRestNearBoss(nodes, layerNodes);
    this.preventConsecutiveElites(nodes, layerNodes);

    return nodes;
  }

  private static pickNodeType(
    weights: Record<NodeType, number>,
    layer: number,
    totalLayers: number,
    rng: SeededRNG,
  ): NodeType {
    const adjustedWeights = { ...weights };

    // No elites in first 2 layers
    if (layer < 2) {
      adjustedWeights.elite = 0;
    }
    // No rest or shop in first 3 layers — earn your pit stops
    if (layer < 3) {
      adjustedWeights.shop = 0;
      adjustedWeights.rest = 0;
    }
    // Boost rest chance in layer before boss
    if (layer === totalLayers - 2) {
      adjustedWeights.rest *= 2;
      adjustedWeights.shop *= 2;
    }
    // Boss weight is always 0 (boss assigned by isBoss check)
    adjustedWeights.boss = 0;

    const entries = Object.entries(adjustedWeights) as [NodeType, number][];
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    if (total <= 0) return 'battle';

    let roll = rng.next() * total;
    for (const [type, weight] of entries) {
      roll -= weight;
      if (roll <= 0) return type;
    }

    return 'battle';
  }

  private static ensureShopBeforeBoss(nodes: NodeMapNode[], layerNodes: string[][]): void {
    if (layerNodes.length < 3) return;

    const penultimateLayer = layerNodes[layerNodes.length - 2]!;
    const hasShop = penultimateLayer.some(id =>
      nodes.find(n => n.id === id)?.type === 'shop',
    );

    if (!hasShop && penultimateLayer.length > 0) {
      const battleNode = nodes.find(n =>
        penultimateLayer.includes(n.id) && n.type === 'battle',
      );
      if (battleNode) battleNode.type = 'shop';
    }
  }

  private static ensureRestNearBoss(nodes: NodeMapNode[], layerNodes: string[][]): void {
    if (layerNodes.length < 3) return;

    // Check layers -2 and -3 for a rest node
    const nearBossLayers = [
      layerNodes[layerNodes.length - 2],
      layerNodes[layerNodes.length - 3],
    ].filter(Boolean) as string[][];

    const hasRest = nearBossLayers.some(layer =>
      layer.some(id => nodes.find(n => n.id === id)?.type === 'rest'),
    );

    if (!hasRest) {
      // Convert an event node near boss to rest, or a battle node
      for (const layer of nearBossLayers) {
        const candidate = nodes.find(n =>
          layer.includes(n.id) && (n.type === 'event' || n.type === 'battle'),
        );
        if (candidate) {
          candidate.type = 'rest';
          return;
        }
      }
    }
  }

  private static preventConsecutiveElites(nodes: NodeMapNode[], layerNodes: string[][]): void {
    // For each layer, if ALL nodes are elite, convert one to battle
    for (let l = 1; l < layerNodes.length - 1; l++) {
      const layer = layerNodes[l]!;
      const layerNodeObjs = layer.map(id => nodes.find(n => n.id === id)!);
      const allElite = layerNodeObjs.every(n => n.type === 'elite');
      if (allElite && layerNodeObjs.length > 1) {
        layerNodeObjs[0]!.type = 'battle';
      }
    }
  }
}
