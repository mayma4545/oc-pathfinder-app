import ApiService from '../../ApiService';

describe('ApiService – Stats fetching', () => {
    it('getDataVersion is defined', () => {
        expect(typeof ApiService.getDataVersion).toBe('function');
    });

    it('getDataVersion fetches stats correctly', async () => {
        // This will fail because getDataVersion is not implemented yet
        const response = await ApiService.getDataVersion();
        expect(response.success).toBe(true);
        expect(response.version).toBeDefined();
        expect(typeof response.version.nodes_count).toBe('number');
    });
});
