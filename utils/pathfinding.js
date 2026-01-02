/**
 * Client-side A* Pathfinding Algorithm for Campus Navigation
 * Ported from server-side pathfinding.js for offline route computation
 * 
 * Features:
 * - Edge distances (actual cost)
 * - Compass angles for directional awareness
 * - Staircase detection (is_staircase flag)
 * - Active/inactive edges (is_active flag)
 * - Works with cached nodes/edges from OfflineService
 */

/**
 * Min Heap implementation for priority queue
 * Used by A* algorithm for efficient node selection
 */
class MinHeap {
  constructor() {
    this.heap = [];
  }

  push(priority, value) {
    this.heap.push({ priority, value });
    this.bubbleUp(this.heap.length - 1);
  }

  pop() {
    if (this.heap.length === 0) return null;
    if (this.heap.length === 1) return this.heap.pop();

    const min = this.heap[0];
    this.heap[0] = this.heap.pop();
    this.bubbleDown(0);
    return min;
  }

  isEmpty() {
    return this.heap.length === 0;
  }

  bubbleUp(index) {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.heap[parentIndex].priority <= this.heap[index].priority) break;
      [this.heap[parentIndex], this.heap[index]] = [this.heap[index], this.heap[parentIndex]];
      index = parentIndex;
    }
  }

  bubbleDown(index) {
    while (true) {
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;
      let smallest = index;

      if (leftChild < this.heap.length && this.heap[leftChild].priority < this.heap[smallest].priority) {
        smallest = leftChild;
      }
      if (rightChild < this.heap.length && this.heap[rightChild].priority < this.heap[smallest].priority) {
        smallest = rightChild;
      }

      if (smallest === index) break;
      [this.heap[smallest], this.heap[index]] = [this.heap[index], this.heap[smallest]];
      index = smallest;
    }
  }
}

/**
 * PathFinder class for client-side route computation
 */
class PathFinder {
  constructor() {
    this.nodesCache = new Map();
    this.nodesByCode = new Map();
    this.graph = new Map();
    this.initialized = false;
  }

  /**
   * Build adjacency list from provided nodes and edges data
   * @param {Array} nodes - Array of node objects from OfflineService
   * @param {Array} edges - Array of edge objects from OfflineService
   */
  buildGraph(nodes, edges) {
    this.nodesCache.clear();
    this.nodesByCode.clear();
    this.graph.clear();

    if (!nodes || !edges) {
      throw new Error('Nodes and edges are required to build graph');
    }

    // Cache all nodes by ID and code
    for (const node of nodes) {
      this.nodesCache.set(node.node_id, node);
      this.nodesByCode.set(node.node_code, node);
      this.graph.set(node.node_id, []);
    }

    // Build adjacency list from active edges
    for (const edge of edges) {
      // Skip inactive edges
      if (edge.is_active === false) continue;

      // Handle both API formats:
      // Format 1: from_node_id and to_node_id (direct IDs)
      // Format 2: from_node and to_node (nested objects with node_id)
      const fromId = edge.from_node_id || edge.from_node?.node_id;
      const toId = edge.to_node_id || edge.to_node?.node_id;

      // Skip edges with missing node IDs
      if (!fromId || !toId) {
        console.warn('Skipping edge with missing node IDs:', edge);
        continue;
      }

      // Add forward edge
      if (this.graph.has(fromId)) {
        this.graph.get(fromId).push({
          to: toId,
          distance: parseFloat(edge.distance) || 0,
          compass_angle: parseFloat(edge.compass_angle) || 0,
          is_staircase: edge.is_staircase === true,
          edge_id: edge.edge_id
        });
      }

      // Add reverse edge (bidirectional)
      const reverseAngle = ((parseFloat(edge.compass_angle) || 0) + 180) % 360;
      if (this.graph.has(toId)) {
        this.graph.get(toId).push({
          to: fromId,
          distance: parseFloat(edge.distance) || 0,
          compass_angle: reverseAngle,
          is_staircase: edge.is_staircase === true,
          edge_id: edge.edge_id
        });
      }
    }

    this.initialized = true;
  }

  /**
   * Get IDs of nearby nodes within a specified radius (hops)
   * @param {number} nodeId - Center node ID
   * @param {number} radius - Number of hops (default 1)
   * @returns {Array} Array of node IDs
   */
  getNearbyNodeIds(nodeId, radius = 1) {
    if (!this.graph.has(nodeId)) return [];

    const nearbyIds = new Set();
    const queue = [{ id: nodeId, dist: 0 }];
    const visited = new Set([nodeId]);

    while (queue.length > 0) {
      const { id, dist } = queue.shift();

      if (dist >= radius) continue;

      const neighbors = this.graph.get(id) || [];
      for (const edge of neighbors) {
        if (!visited.has(edge.to)) {
          visited.add(edge.to);
          nearbyIds.add(edge.to);
          queue.push({ id: edge.to, dist: dist + 1 });
        }
      }
    }

    return Array.from(nearbyIds);
  }

  /**
   * Heuristic for A*: Estimate distance using floor difference
   * Assumes ~4 meters per floor level
   * @param {number} nodeAId - Source node ID
   * @param {number} nodeBId - Target node ID
   * @returns {number} Estimated distance
   */
  heuristic(nodeAId, nodeBId) {
    const nodeA = this.nodesCache.get(nodeAId);
    const nodeB = this.nodesCache.get(nodeBId);

    if (!nodeA || !nodeB) return 0.0;

    const floorLevelA = parseFloat(nodeA.floor_level) || 0;
    const floorLevelB = parseFloat(nodeB.floor_level) || 0;
    const floorDiff = Math.abs(floorLevelA - floorLevelB);
    return floorDiff * 4.0; // Assume 4 meters per floor
  }

  /**
   * Find node by code
   * @param {string} nodeCode - Node code to search for
   * @returns {Object|null} Node object or null
   */
  getNodeByCode(nodeCode) {
    return this.nodesByCode.get(nodeCode) || null;
  }

  /**
   * Find shortest path using A* algorithm
   * @param {string} startCode - Starting node code
   * @param {string} goalCode - Destination node code
   * @param {boolean} avoidStairs - If true, avoid edges with is_staircase=true
   * @returns {Object} Path details or error message
   */
  findPath(startCode, goalCode, avoidStairs = false) {
    if (!this.initialized) {
      return { success: false, error: 'PathFinder not initialized. Call buildGraph() first.' };
    }

    // Find start and goal nodes
    const startNode = this.getNodeByCode(startCode);
    const goalNode = this.getNodeByCode(goalCode);

    if (!startNode) {
      return { success: false, error: `Start node not found: ${startCode}` };
    }
    if (!goalNode) {
      return { success: false, error: `Goal node not found: ${goalCode}` };
    }

    const startId = startNode.node_id;
    const goalId = goalNode.node_id;

    // Same node case
    if (startId === goalId) {
      const node = this.nodesCache.get(startId);
      return {
        success: true,
        path: [{
          node_id: node.node_id,
          node_code: node.node_code,
          name: node.name,
          building: node.building,
          floor_level: node.floor_level,
          type: node.type_of_node || node.type,
          image360: node.image360_url || node.image360 || null,
          map_x: node.map_x !== null && node.map_x !== undefined ? parseFloat(node.map_x) : null,
          map_y: node.map_y !== null && node.map_y !== undefined ? parseFloat(node.map_y) : null,
          distance_from_prev: 0,
          compass_angle: null,
          is_staircase: false
        }],
        total_distance: 0,
        num_nodes: 1,
        start: null,
        goal: null
      };
    }

    // A* data structures
    const openSet = new MinHeap();
    openSet.push(0, startId);

    const cameFrom = new Map(); // {node_id: {prev: previous_node_id, edge: edge_info}}
    const gScore = new Map([[startId, 0]]);
    const fScore = new Map([[startId, this.heuristic(startId, goalId)]]);
    const visited = new Set();

    while (!openSet.isEmpty()) {
      const { value: currentId } = openSet.pop();

      if (visited.has(currentId)) continue;
      visited.add(currentId);

      // Goal reached
      if (currentId === goalId) {
        return this.reconstructPath(cameFrom, startId, goalId, gScore.get(goalId));
      }

      // Explore neighbors
      const neighbors = this.graph.get(currentId) || [];
      for (const edgeInfo of neighbors) {
        const neighborId = edgeInfo.to;

        // Skip stairs if requested
        if (avoidStairs && edgeInfo.is_staircase) continue;

        // Calculate tentative g_score
        const tentativeG = gScore.get(currentId) + edgeInfo.distance;

        if (!gScore.has(neighborId) || tentativeG < gScore.get(neighborId)) {
          // Better path found
          cameFrom.set(neighborId, { prev: currentId, edge: edgeInfo });
          gScore.set(neighborId, tentativeG);
          const f = tentativeG + this.heuristic(neighborId, goalId);
          fScore.set(neighborId, f);
          openSet.push(f, neighborId);
        }
      }
    }

    return { success: false, error: 'No path found between the specified nodes' };
  }

  /**
   * Reconstruct path from cameFrom map
   * @param {Map} cameFrom - Map of node to {prev, edge}
   * @param {number} startId - Start node ID
   * @param {number} goalId - Goal node ID
   * @param {number} totalDistance - Total path distance
   * @returns {Object} Path result
   */
  reconstructPath(cameFrom, startId, goalId, totalDistance) {
    const path = [];
    let currentId = goalId;

    while (currentId !== startId) {
      if (!cameFrom.has(currentId)) break;

      const { prev, edge } = cameFrom.get(currentId);
      const node = this.nodesCache.get(currentId);

      path.push({
        node_id: node.node_id,
        node_code: node.node_code,
        name: node.name,
        building: node.building,
        floor_level: node.floor_level,
        type: node.type_of_node || node.type,
        image360: node.image360_url || node.image360 || null,
        map_x: node.map_x !== null && node.map_x !== undefined ? parseFloat(node.map_x) : null,
        map_y: node.map_y !== null && node.map_y !== undefined ? parseFloat(node.map_y) : null,
        distance_from_prev: edge.distance,
        compass_angle: edge.compass_angle,
        is_staircase: edge.is_staircase
      });

      currentId = prev;
    }

    // Add start node
    const startNode = this.nodesCache.get(startId);
    path.push({
      node_id: startNode.node_id,
      node_code: startNode.node_code,
      name: startNode.name,
      building: startNode.building,
      floor_level: startNode.floor_level,
      type: startNode.type_of_node || startNode.type,
      image360: startNode.image360_url || startNode.image360 || null,
      map_x: startNode.map_x !== null && startNode.map_x !== undefined ? parseFloat(startNode.map_x) : null,
      map_y: startNode.map_y !== null && startNode.map_y !== undefined ? parseFloat(startNode.map_y) : null,
      distance_from_prev: 0,
      compass_angle: null,
      is_staircase: false
    });

    path.reverse();

    return {
      success: true,
      path,
      total_distance: Math.round(totalDistance * 100) / 100,
      num_nodes: path.length,
      start: path[0],
      goal: path[path.length - 1]
    };
  }

  /**
   * Convert compass angle to human-readable direction
   * @param {number} angle - Compass angle in degrees
   * @returns {string} Direction name
   */
  compassToDirection(angle) {
    const directions = [
      'North', 'North-Northeast', 'Northeast', 'East-Northeast',
      'East', 'East-Southeast', 'Southeast', 'South-Southeast',
      'South', 'South-Southwest', 'Southwest', 'West-Southwest',
      'West', 'West-Northwest', 'Northwest', 'North-Northwest'
    ];
    const index = Math.floor((angle + 11.25) / 22.5) % 16;
    return directions[index];
  }

  /**
   * Get turn-by-turn directions with compass headings
   * @param {string} startCode - Starting node code
   * @param {string} goalCode - Destination node code
   * @param {boolean} avoidStairs - If true, avoid stairs
   * @returns {Object} Path with directions
   */
  getDirections(startCode, goalCode, avoidStairs = false) {
    const result = this.findPath(startCode, goalCode, avoidStairs);

    if (!result.success) return result;

    // Add human-readable directions
    const directions = [];
    for (let i = 0; i < result.path.length; i++) {
      const step = result.path[i];
      if (i === 0) {
        directions.push(`Start at ${step.name} (${step.building}, Floor ${step.floor_level})`);
      } else {
        const compassDir = step.compass_angle !== null
          ? this.compassToDirection(step.compass_angle)
          : 'forward';
        const stairInfo = step.is_staircase ? ' via stairs' : '';
        const angle = step.compass_angle !== null ? step.compass_angle.toFixed(0) : '0';
        directions.push(
          `Go ${compassDir} (${angle}°) for ${step.distance_from_prev.toFixed(1)}m${stairInfo} to ${step.name}`
        );
      }
    }

    result.directions = directions;
    return result;
  }

  /**
   * Reset pathfinder state
   */
  reset() {
    this.initialized = false;
    this.nodesCache.clear();
    this.nodesByCode.clear();
    this.graph.clear();
  }

  /**
   * Check if pathfinder is initialized
   * @returns {boolean}
   */
  isInitialized() {
    return this.initialized;
  }

  /**
   * Get statistics about the loaded graph
   * @returns {Object} Graph statistics
   */
  getStats() {
    if (!this.initialized) {
      return { nodes: 0, edges: 0, initialized: false };
    }

    let edgeCount = 0;
    for (const neighbors of this.graph.values()) {
      edgeCount += neighbors.length;
    }

    return {
      nodes: this.nodesCache.size,
      edges: edgeCount / 2, // Divide by 2 because edges are bidirectional
      initialized: true
    };
  }
}

// Singleton instance for convenience
let pathfinderInstance = null;

/**
 * Get or create the singleton PathFinder instance
 * @returns {PathFinder}
 */
export function getPathfinder() {
  if (!pathfinderInstance) {
    pathfinderInstance = new PathFinder();
  }
  return pathfinderInstance;
}

/**
 * Reset the singleton PathFinder instance
 */
export function resetPathfinder() {
  if (pathfinderInstance) {
    pathfinderInstance.reset();
  }
  pathfinderInstance = null;
}

// Export class and utilities
export { PathFinder, MinHeap };
export default PathFinder;
