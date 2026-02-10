
import { PathFinder } from '../pathfinding';

describe('PathFinder', () => {
  let pathFinder;
  const mockNodes = [
    { node_id: 1, node_code: 'A', name: 'Node A' },
    { node_id: 2, node_code: 'B', name: 'Node B' },
    { node_id: 3, node_code: 'C', name: 'Node C' },
    { node_id: 4, node_code: 'D', name: 'Node D' },
  ];
  const mockEdges = [
    { from_node_id: 1, to_node_id: 2, distance: 10, is_active: true },
    { from_node_id: 2, to_node_id: 3, distance: 10, is_active: true },
    { from_node_id: 2, to_node_id: 4, distance: 10, is_active: true },
  ];

  beforeEach(() => {
    pathFinder = new PathFinder();
    pathFinder.buildGraph(mockNodes, mockEdges);
  });

  describe('getNearbyNodeIds', () => {
    test('should return immediate neighbors (radius 1)', () => {
      const neighbors = pathFinder.getNearbyNodeIds(2);
      // Neighbors of B (2) are A (1), C (3), and D (4)
      expect(neighbors).toContain(1);
      expect(neighbors).toContain(3);
      expect(neighbors).toContain(4);
      expect(neighbors.length).toBe(3);
    });

    test('should return empty array for isolated node', () => {
        // Create an isolated node
        const isolatedNodes = [{ node_id: 5, node_code: 'E', name: 'Node E' }];
        const isolatedEdges = [];
        const isoPathFinder = new PathFinder();
        isoPathFinder.buildGraph(isolatedNodes, isolatedEdges);

        const neighbors = isoPathFinder.getNearbyNodeIds(5);
        expect(neighbors).toEqual([]);
    });

    test('should return distinct neighbors', () => {
         const neighbors = pathFinder.getNearbyNodeIds(2);
         const uniqueNeighbors = [...new Set(neighbors)];
         expect(neighbors.length).toBe(uniqueNeighbors.length);
    });
    
    test('should return empty array if node not found', () => {
        const neighbors = pathFinder.getNearbyNodeIds(999);
        expect(neighbors).toEqual([]);
    });
  });
});
