/**
 * Pathfinding Algorithm Unit Tests
 * 
 * Tests for the client-side A* pathfinding implementation.
 * Run with: node scripts/testPathfinding.js
 * 
 * This file tests the pathfinding utility independently,
 * without React Native dependencies.
 */

// Import the pathfinding utilities directly (mock ESM for Node)
// For actual usage, the utils/pathfinding.js uses ES modules

console.log('🧭 OC-PATHFINDER Pathfinding Algorithm Tests');
console.log('=============================================\n');

// ============================================
// MinHeap Implementation (copied for testing)
// ============================================

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

// ============================================
// PathFinder Implementation (copied for testing)
// ============================================

class PathFinder {
  constructor() {
    this.nodesCache = new Map();
    this.nodesByCode = new Map();
    this.graph = new Map();
    this.initialized = false;
  }

  buildGraph(nodes, edges) {
    this.nodesCache.clear();
    this.nodesByCode.clear();
    this.graph.clear();

    if (!nodes || !edges) {
      throw new Error('Nodes and edges are required to build graph');
    }

    for (const node of nodes) {
      this.nodesCache.set(node.node_id, node);
      this.nodesByCode.set(node.node_code, node);
      this.graph.set(node.node_id, []);
    }

    for (const edge of edges) {
      if (edge.is_active === false) continue;

      const fromId = edge.from_node_id;
      const toId = edge.to_node_id;

      if (this.graph.has(fromId)) {
        this.graph.get(fromId).push({
          to: toId,
          distance: parseFloat(edge.distance) || 0,
          compass_angle: parseFloat(edge.compass_angle) || 0,
          is_staircase: edge.is_staircase === true,
          edge_id: edge.edge_id
        });
      }

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

  heuristic(nodeAId, nodeBId) {
    const nodeA = this.nodesCache.get(nodeAId);
    const nodeB = this.nodesCache.get(nodeBId);

    if (!nodeA || !nodeB) return 0.0;

    const floorLevelA = parseFloat(nodeA.floor_level) || 0;
    const floorLevelB = parseFloat(nodeB.floor_level) || 0;
    const floorDiff = Math.abs(floorLevelA - floorLevelB);
    return floorDiff * 4.0;
  }

  getNodeByCode(nodeCode) {
    return this.nodesByCode.get(nodeCode) || null;
  }

  findPath(startCode, goalCode, avoidStairs = false) {
    if (!this.initialized) {
      return { success: false, error: 'PathFinder not initialized. Call buildGraph() first.' };
    }

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
          distance_from_prev: 0,
          compass_angle: null,
          is_staircase: false
        }],
        total_distance: 0,
        num_nodes: 1
      };
    }

    const openSet = new MinHeap();
    openSet.push(0, startId);

    const cameFrom = new Map();
    const gScore = new Map([[startId, 0]]);
    const fScore = new Map([[startId, this.heuristic(startId, goalId)]]);
    const visited = new Set();

    while (!openSet.isEmpty()) {
      const { value: currentId } = openSet.pop();

      if (visited.has(currentId)) continue;
      visited.add(currentId);

      if (currentId === goalId) {
        return this.reconstructPath(cameFrom, startId, goalId, gScore.get(goalId));
      }

      const neighbors = this.graph.get(currentId) || [];
      for (const edgeInfo of neighbors) {
        const neighborId = edgeInfo.to;

        if (avoidStairs && edgeInfo.is_staircase) continue;

        const tentativeG = gScore.get(currentId) + edgeInfo.distance;

        if (!gScore.has(neighborId) || tentativeG < gScore.get(neighborId)) {
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
        distance_from_prev: edge.distance,
        compass_angle: edge.compass_angle,
        is_staircase: edge.is_staircase
      });

      currentId = prev;
    }

    const startNode = this.nodesCache.get(startId);
    path.push({
      node_id: startNode.node_id,
      node_code: startNode.node_code,
      name: startNode.name,
      building: startNode.building,
      floor_level: startNode.floor_level,
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

  reset() {
    this.initialized = false;
    this.nodesCache.clear();
    this.nodesByCode.clear();
    this.graph.clear();
  }

  isInitialized() {
    return this.initialized;
  }

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
      edges: edgeCount / 2,
      initialized: true
    };
  }
}

// ============================================
// Test Utilities
// ============================================

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    testsPassed++;
    console.log(`  ✅ ${message}`);
    return true;
  } else {
    testsFailed++;
    console.log(`  ❌ ${message}`);
    return false;
  }
}

function assertEqual(actual, expected, message) {
  const passed = actual === expected;
  if (passed) {
    testsPassed++;
    console.log(`  ✅ ${message}`);
  } else {
    testsFailed++;
    console.log(`  ❌ ${message}`);
    console.log(`     Expected: ${expected}`);
    console.log(`     Actual: ${actual}`);
  }
  return passed;
}

function assertApproxEqual(actual, expected, tolerance, message) {
  const passed = Math.abs(actual - expected) <= tolerance;
  if (passed) {
    testsPassed++;
    console.log(`  ✅ ${message}`);
  } else {
    testsFailed++;
    console.log(`  ❌ ${message}`);
    console.log(`     Expected: ${expected} (±${tolerance})`);
    console.log(`     Actual: ${actual}`);
  }
  return passed;
}

// ============================================
// Test Data
// ============================================

// Simple linear graph: A -- B -- C
const linearNodes = [
  { node_id: 1, node_code: 'A', name: 'Node A', building: 'Main', floor_level: 1 },
  { node_id: 2, node_code: 'B', name: 'Node B', building: 'Main', floor_level: 1 },
  { node_id: 3, node_code: 'C', name: 'Node C', building: 'Main', floor_level: 1 }
];

const linearEdges = [
  { edge_id: 1, from_node_id: 1, to_node_id: 2, distance: 10, compass_angle: 90, is_staircase: false, is_active: true },
  { edge_id: 2, from_node_id: 2, to_node_id: 3, distance: 15, compass_angle: 90, is_staircase: false, is_active: true }
];

// Diamond graph with multiple paths
//       B
//      / \
//     A   D
//      \ /
//       C
const diamondNodes = [
  { node_id: 1, node_code: 'A', name: 'Start', building: 'Main', floor_level: 1 },
  { node_id: 2, node_code: 'B', name: 'Upper', building: 'Main', floor_level: 1 },
  { node_id: 3, node_code: 'C', name: 'Lower', building: 'Main', floor_level: 1 },
  { node_id: 4, node_code: 'D', name: 'End', building: 'Main', floor_level: 1 }
];

const diamondEdges = [
  { edge_id: 1, from_node_id: 1, to_node_id: 2, distance: 10, compass_angle: 45, is_staircase: false, is_active: true },
  { edge_id: 2, from_node_id: 1, to_node_id: 3, distance: 5, compass_angle: 315, is_staircase: false, is_active: true },
  { edge_id: 3, from_node_id: 2, to_node_id: 4, distance: 10, compass_angle: 135, is_staircase: false, is_active: true },
  { edge_id: 4, from_node_id: 3, to_node_id: 4, distance: 5, compass_angle: 45, is_staircase: false, is_active: true }
];

// Multi-floor graph with stairs
const multiFloorNodes = [
  { node_id: 1, node_code: 'F1-A', name: 'Floor 1 Entrance', building: 'Main', floor_level: 1 },
  { node_id: 2, node_code: 'F1-B', name: 'Floor 1 Stairs', building: 'Main', floor_level: 1 },
  { node_id: 3, node_code: 'F2-A', name: 'Floor 2 Stairs', building: 'Main', floor_level: 2 },
  { node_id: 4, node_code: 'F2-B', name: 'Floor 2 Office', building: 'Main', floor_level: 2 },
  { node_id: 5, node_code: 'F1-ELEV', name: 'Floor 1 Elevator', building: 'Main', floor_level: 1 },
  { node_id: 6, node_code: 'F2-ELEV', name: 'Floor 2 Elevator', building: 'Main', floor_level: 2 }
];

const multiFloorEdges = [
  { edge_id: 1, from_node_id: 1, to_node_id: 2, distance: 20, compass_angle: 90, is_staircase: false, is_active: true },
  { edge_id: 2, from_node_id: 2, to_node_id: 3, distance: 5, compass_angle: 0, is_staircase: true, is_active: true },
  { edge_id: 3, from_node_id: 3, to_node_id: 4, distance: 15, compass_angle: 90, is_staircase: false, is_active: true },
  { edge_id: 4, from_node_id: 1, to_node_id: 5, distance: 30, compass_angle: 180, is_staircase: false, is_active: true },
  { edge_id: 5, from_node_id: 5, to_node_id: 6, distance: 2, compass_angle: 0, is_staircase: false, is_active: true },
  { edge_id: 6, from_node_id: 6, to_node_id: 4, distance: 10, compass_angle: 270, is_staircase: false, is_active: true }
];

// Graph with inactive edges
const inactiveEdgeNodes = [
  { node_id: 1, node_code: 'A', name: 'Start', building: 'Main', floor_level: 1 },
  { node_id: 2, node_code: 'B', name: 'Middle', building: 'Main', floor_level: 1 },
  { node_id: 3, node_code: 'C', name: 'End', building: 'Main', floor_level: 1 }
];

const inactiveEdges = [
  { edge_id: 1, from_node_id: 1, to_node_id: 2, distance: 5, compass_angle: 90, is_staircase: false, is_active: true },
  { edge_id: 2, from_node_id: 2, to_node_id: 3, distance: 5, compass_angle: 90, is_staircase: false, is_active: false },
  { edge_id: 3, from_node_id: 1, to_node_id: 3, distance: 20, compass_angle: 45, is_staircase: false, is_active: true }
];

// Disconnected graph
const disconnectedNodes = [
  { node_id: 1, node_code: 'A', name: 'Island 1', building: 'Main', floor_level: 1 },
  { node_id: 2, node_code: 'B', name: 'Island 2', building: 'Main', floor_level: 1 }
];

const disconnectedEdges = [];

// ============================================
// Test Cases
// ============================================

function testMinHeap() {
  console.log('\n📦 MinHeap Tests');
  console.log('------------------');

  const heap = new MinHeap();

  // Test 1: Empty heap
  assert(heap.isEmpty(), 'New heap should be empty');

  // Test 2: Push and pop single element
  heap.push(5, 'five');
  assert(!heap.isEmpty(), 'Heap should not be empty after push');
  const item = heap.pop();
  assertEqual(item.value, 'five', 'Pop should return correct value');
  assertEqual(item.priority, 5, 'Pop should return correct priority');
  assert(heap.isEmpty(), 'Heap should be empty after pop');

  // Test 3: Priority ordering
  heap.push(5, 'five');
  heap.push(1, 'one');
  heap.push(3, 'three');
  heap.push(2, 'two');
  heap.push(4, 'four');

  const order = [];
  while (!heap.isEmpty()) {
    order.push(heap.pop().value);
  }
  assertEqual(order.join(','), 'one,two,three,four,five', 'Items should be popped in priority order');

  // Test 4: Same priorities
  heap.push(1, 'a');
  heap.push(1, 'b');
  heap.push(1, 'c');
  const first = heap.pop();
  assertEqual(first.priority, 1, 'Same priority items should work');
  assert(heap.pop() !== null, 'Should be able to pop second item');
  assert(heap.pop() !== null, 'Should be able to pop third item');
  assert(heap.isEmpty(), 'Heap should be empty after popping all');
}

function testPathFinderInitialization() {
  console.log('\n🏗️ PathFinder Initialization Tests');
  console.log('------------------------------------');

  const pf = new PathFinder();

  // Test 1: Initial state
  assert(!pf.isInitialized(), 'PathFinder should not be initialized initially');

  // Test 2: Build graph
  pf.buildGraph(linearNodes, linearEdges);
  assert(pf.isInitialized(), 'PathFinder should be initialized after buildGraph');

  // Test 3: Stats
  const stats = pf.getStats();
  assertEqual(stats.nodes, 3, 'Should have 3 nodes');
  assertEqual(stats.edges, 2, 'Should have 2 edges');

  // Test 4: Reset
  pf.reset();
  assert(!pf.isInitialized(), 'PathFinder should not be initialized after reset');

  // Test 5: Missing data
  let errorThrown = false;
  try {
    pf.buildGraph(null, null);
  } catch (e) {
    errorThrown = true;
  }
  assert(errorThrown, 'buildGraph should throw error with null data');
}

function testLinearPath() {
  console.log('\n📏 Linear Path Tests (A -- B -- C)');
  console.log('-----------------------------------');

  const pf = new PathFinder();
  pf.buildGraph(linearNodes, linearEdges);

  // Test 1: Direct path A -> C
  const result = pf.findPath('A', 'C');
  assert(result.success, 'Path A to C should succeed');
  assertEqual(result.num_nodes, 3, 'Path should have 3 nodes');
  assertEqual(result.path[0].node_code, 'A', 'Path should start at A');
  assertEqual(result.path[2].node_code, 'C', 'Path should end at C');
  assertApproxEqual(result.total_distance, 25, 0.1, 'Total distance should be 25m');

  // Test 2: Reverse path C -> A
  const reverse = pf.findPath('C', 'A');
  assert(reverse.success, 'Path C to A should succeed');
  assertEqual(reverse.num_nodes, 3, 'Reverse path should have 3 nodes');
  assertApproxEqual(reverse.total_distance, 25, 0.1, 'Reverse distance should be 25m');

  // Test 3: Adjacent nodes A -> B
  const adjacent = pf.findPath('A', 'B');
  assert(adjacent.success, 'Path A to B should succeed');
  assertEqual(adjacent.num_nodes, 2, 'Adjacent path should have 2 nodes');
  assertApproxEqual(adjacent.total_distance, 10, 0.1, 'Adjacent distance should be 10m');
}

function testSameNodePath() {
  console.log('\n🔄 Same Node Path Tests');
  console.log('------------------------');

  const pf = new PathFinder();
  pf.buildGraph(linearNodes, linearEdges);

  // Test: Path from node to itself
  const result = pf.findPath('A', 'A');
  assert(result.success, 'Path A to A should succeed');
  assertEqual(result.num_nodes, 1, 'Same node path should have 1 node');
  assertEqual(result.total_distance, 0, 'Same node distance should be 0');
}

function testDiamondPath() {
  console.log('\n💎 Diamond Graph Tests (multiple paths)');
  console.log('-----------------------------------------');

  const pf = new PathFinder();
  pf.buildGraph(diamondNodes, diamondEdges);

  // Test: Should find shortest path (A -> C -> D = 10) not (A -> B -> D = 20)
  const result = pf.findPath('A', 'D');
  assert(result.success, 'Path A to D should succeed');
  assertApproxEqual(result.total_distance, 10, 0.1, 'Should find shortest path (10m via C)');
  assertEqual(result.num_nodes, 3, 'Shortest path should have 3 nodes');
  
  // Verify path goes through C, not B
  const pathCodes = result.path.map(n => n.node_code);
  assert(pathCodes.includes('C'), 'Shortest path should go through C');
  assert(!pathCodes.includes('B'), 'Shortest path should NOT go through B');
}

function testMultiFloorWithStairs() {
  console.log('\n🏢 Multi-Floor Path Tests');
  console.log('--------------------------');

  const pf = new PathFinder();
  pf.buildGraph(multiFloorNodes, multiFloorEdges);

  // Test 1: Path using stairs (shorter)
  const withStairs = pf.findPath('F1-A', 'F2-B', false);
  assert(withStairs.success, 'Path with stairs should succeed');
  // Stairs path: F1-A -> F1-B -> F2-A -> F2-B = 20 + 5 + 15 = 40m
  assertApproxEqual(withStairs.total_distance, 40, 0.1, 'Stairs path should be 40m');

  // Test 2: Path avoiding stairs (elevator)
  const noStairs = pf.findPath('F1-A', 'F2-B', true);
  assert(noStairs.success, 'Path avoiding stairs should succeed');
  // Elevator path: F1-A -> F1-ELEV -> F2-ELEV -> F2-B = 30 + 2 + 10 = 42m
  assertApproxEqual(noStairs.total_distance, 42, 0.1, 'Elevator path should be 42m');

  // Verify no stairs in the path
  const hasStairs = noStairs.path.some(step => step.is_staircase);
  assert(!hasStairs, 'Path avoiding stairs should have no staircase steps');
}

function testInactiveEdges() {
  console.log('\n🚫 Inactive Edge Tests');
  console.log('------------------------');

  const pf = new PathFinder();
  pf.buildGraph(inactiveEdgeNodes, inactiveEdges);

  // Direct path A -> B -> C would be 10m, but B -> C is inactive
  // Should use A -> C directly at 20m
  const result = pf.findPath('A', 'C');
  assert(result.success, 'Path A to C should succeed');
  assertApproxEqual(result.total_distance, 20, 0.1, 'Should use direct A->C (inactive B->C skipped)');
  assertEqual(result.num_nodes, 2, 'Path should be direct A to C');
}

function testDisconnectedGraph() {
  console.log('\n🔌 Disconnected Graph Tests');
  console.log('-----------------------------');

  const pf = new PathFinder();
  pf.buildGraph(disconnectedNodes, disconnectedEdges);

  // Test: No path between disconnected nodes
  const result = pf.findPath('A', 'B');
  assert(!result.success, 'Path between disconnected nodes should fail');
  assert(result.error.includes('No path found'), 'Error should indicate no path found');
}

function testInvalidNodes() {
  console.log('\n❓ Invalid Node Tests');
  console.log('-----------------------');

  const pf = new PathFinder();
  pf.buildGraph(linearNodes, linearEdges);

  // Test 1: Non-existent start node
  const badStart = pf.findPath('X', 'A');
  assert(!badStart.success, 'Path with invalid start should fail');
  assert(badStart.error.includes('Start node not found'), 'Error should mention start node');

  // Test 2: Non-existent goal node
  const badGoal = pf.findPath('A', 'X');
  assert(!badGoal.success, 'Path with invalid goal should fail');
  assert(badGoal.error.includes('Goal node not found'), 'Error should mention goal node');

  // Test 3: Uninitialized pathfinder
  const pf2 = new PathFinder();
  const notInit = pf2.findPath('A', 'B');
  assert(!notInit.success, 'Path on uninitialized pathfinder should fail');
  assert(notInit.error.includes('not initialized'), 'Error should mention initialization');
}

function testCompassDirections() {
  console.log('\n🧭 Compass Direction Tests');
  console.log('----------------------------');

  const pf = new PathFinder();

  // Test compass angle to direction conversion
  assertEqual(pf.compassToDirection(0), 'North', '0° should be North');
  assertEqual(pf.compassToDirection(45), 'Northeast', '45° should be Northeast');
  assertEqual(pf.compassToDirection(90), 'East', '90° should be East');
  assertEqual(pf.compassToDirection(135), 'Southeast', '135° should be Southeast');
  assertEqual(pf.compassToDirection(180), 'South', '180° should be South');
  assertEqual(pf.compassToDirection(225), 'Southwest', '225° should be Southwest');
  assertEqual(pf.compassToDirection(270), 'West', '270° should be West');
  assertEqual(pf.compassToDirection(315), 'Northwest', '315° should be Northwest');
  assertEqual(pf.compassToDirection(360), 'North', '360° should wrap to North');
}

function testLargeGraph() {
  console.log('\n📈 Large Graph Performance Test');
  console.log('---------------------------------');

  // Generate a 100-node graph
  const nodeCount = 100;
  const nodes = [];
  const edges = [];

  for (let i = 1; i <= nodeCount; i++) {
    nodes.push({
      node_id: i,
      node_code: `N${i}`,
      name: `Node ${i}`,
      building: 'Test',
      floor_level: Math.floor(i / 20) + 1
    });
  }

  // Create a grid-like structure
  let edgeId = 1;
  for (let i = 1; i < nodeCount; i++) {
    // Connect to next node
    edges.push({
      edge_id: edgeId++,
      from_node_id: i,
      to_node_id: i + 1,
      distance: Math.random() * 10 + 5,
      compass_angle: 90,
      is_staircase: false,
      is_active: true
    });

    // Add some cross-connections
    if (i + 10 <= nodeCount) {
      edges.push({
        edge_id: edgeId++,
        from_node_id: i,
        to_node_id: i + 10,
        distance: Math.random() * 15 + 10,
        compass_angle: 180,
        is_staircase: i % 20 === 0,
        is_active: true
      });
    }
  }

  const pf = new PathFinder();
  
  // Measure build time
  const buildStart = Date.now();
  pf.buildGraph(nodes, edges);
  const buildTime = Date.now() - buildStart;
  assert(buildTime < 100, `Graph build should be fast (<100ms, was ${buildTime}ms)`);

  // Measure pathfinding time
  const pathStart = Date.now();
  const result = pf.findPath('N1', 'N100');
  const pathTime = Date.now() - pathStart;
  
  assert(result.success, 'Should find path in large graph');
  assert(pathTime < 100, `Pathfinding should be fast (<100ms, was ${pathTime}ms)`);
  console.log(`  ℹ️ Found path with ${result.num_nodes} nodes in ${pathTime}ms`);
}

function testEdgeCases() {
  console.log('\n🎯 Edge Case Tests');
  console.log('-------------------');

  // Test 1: Empty graph
  const pf = new PathFinder();
  pf.buildGraph([], []);
  const emptyResult = pf.findPath('A', 'B');
  assert(!emptyResult.success, 'Empty graph should return no path');

  // Test 2: Single node
  pf.buildGraph([
    { node_id: 1, node_code: 'ONLY', name: 'Only Node', building: 'Test', floor_level: 1 }
  ], []);
  const singleSame = pf.findPath('ONLY', 'ONLY');
  assert(singleSame.success, 'Single node to itself should succeed');
  
  const singleOther = pf.findPath('ONLY', 'OTHER');
  assert(!singleOther.success, 'Single node to non-existent should fail');

  // Test 3: Numeric string handling
  const numNodes = [
    { node_id: 1, node_code: '001', name: 'Node 1', building: 'Main', floor_level: 1 },
    { node_id: 2, node_code: '002', name: 'Node 2', building: 'Main', floor_level: 1 }
  ];
  const numEdges = [
    { edge_id: 1, from_node_id: 1, to_node_id: 2, distance: '10.5', compass_angle: '90', is_staircase: false, is_active: true }
  ];
  pf.buildGraph(numNodes, numEdges);
  const numResult = pf.findPath('001', '002');
  assert(numResult.success, 'Numeric string codes should work');
  assertApproxEqual(numResult.total_distance, 10.5, 0.1, 'String distance should parse correctly');

  // Test 4: Zero distance edge
  const zeroNodes = [
    { node_id: 1, node_code: 'A', name: 'A', building: 'Main', floor_level: 1 },
    { node_id: 2, node_code: 'B', name: 'B', building: 'Main', floor_level: 1 }
  ];
  const zeroEdges = [
    { edge_id: 1, from_node_id: 1, to_node_id: 2, distance: 0, compass_angle: 90, is_staircase: false, is_active: true }
  ];
  pf.buildGraph(zeroNodes, zeroEdges);
  const zeroResult = pf.findPath('A', 'B');
  assert(zeroResult.success, 'Zero distance edge should work');
  assertEqual(zeroResult.total_distance, 0, 'Zero distance should be preserved');
}

// ============================================
// Run All Tests
// ============================================

function runAllTests() {
  testMinHeap();
  testPathFinderInitialization();
  testLinearPath();
  testSameNodePath();
  testDiamondPath();
  testMultiFloorWithStairs();
  testInactiveEdges();
  testDisconnectedGraph();
  testInvalidNodes();
  testCompassDirections();
  testLargeGraph();
  testEdgeCases();

  console.log('\n=============================================');
  console.log(`📊 Test Results: ${testsPassed} passed, ${testsFailed} failed`);
  console.log('=============================================');

  if (testsFailed > 0) {
    console.log('\n⚠️ Some tests failed! Please review the output above.');
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  }
}

// Run tests
runAllTests();
