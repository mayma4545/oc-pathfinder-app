/**
 * NodesListScreen Tests
 * Tests: rendering list, empty state, delete confirmation flow,
 * navigate to edit, error on failed load.
 */

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import NodesListScreen from '../NodesListScreen';
import ApiService from '../../../services/ApiService';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('../../../services/ApiService');
jest.mock('@react-navigation/native', () => ({
    useFocusEffect: (cb) => {
        // Invoke the callback once on mount during tests
        const React = require('react');
        React.useEffect(cb, []);
    },
}));
jest.mock('@react-native-safe-area-context', () => ({
    SafeAreaView: ({ children }) => children,
}));

const mockNavigation = {
    goBack: jest.fn(),
    navigate: jest.fn(),
};

jest.spyOn(Alert, 'alert');

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_NODES = [
    {
        node_id: 1,
        node_code: 'A-001',
        name: 'Main Lobby',
        building: 'Building A',
        floor_level: 1,
        type_of_node: 'entrance',
    },
    {
        node_id: 2,
        node_code: 'A-002',
        name: 'Computer Lab 1',
        building: 'Building A',
        floor_level: 2,
        type_of_node: 'room',
    },
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('NodesListScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders a list of node names from ApiService', async () => {
        ApiService.getNodes.mockResolvedValue({ success: true, nodes: MOCK_NODES });

        const { getByText } = render(
            <NodesListScreen navigation={mockNavigation} />,
        );

        await waitFor(() => {
            expect(getByText('Main Lobby')).toBeTruthy();
            expect(getByText('Computer Lab 1')).toBeTruthy();
        });
    });

    it('shows an error alert when getNodes fails', async () => {
        ApiService.getNodes.mockRejectedValue(new Error('Network Error'));

        render(<NodesListScreen navigation={mockNavigation} />);

        await waitFor(() => {
            expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to load nodes');
        });
    });

    it('shows empty state (no node items) when the list is empty', async () => {
        ApiService.getNodes.mockResolvedValue({ success: true, nodes: [] });

        const { queryByText } = render(
            <NodesListScreen navigation={mockNavigation} />,
        );

        await waitFor(() => {
            // No node names should be rendered
            expect(queryByText('Main Lobby')).toBeNull();
        });
    });

    it('navigates to NodeForm in edit mode when the edit button is pressed', async () => {
        ApiService.getNodes.mockResolvedValue({ success: true, nodes: MOCK_NODES });

        const { getAllByText } = render(
            <NodesListScreen navigation={mockNavigation} />,
        );

        await waitFor(() => getAllByText('✏️'));

        fireEvent.press(getAllByText('✏️')[0]);

        expect(mockNavigation.navigate).toHaveBeenCalledWith('NodeForm', {
            node: MOCK_NODES[0],
        });
    });

    it('calls deleteNode and reloads list after confirming delete', async () => {
        ApiService.getNodes.mockResolvedValue({ success: true, nodes: MOCK_NODES });
        ApiService.deleteNode.mockResolvedValue({ success: true });

        // Intercept Alert.alert so we can simulate pressing "Delete"
        Alert.alert.mockImplementation((title, message, buttons) => {
            const deleteBtn = buttons?.find((b) => b.text === 'Delete');
            if (deleteBtn) deleteBtn.onPress();
        });

        const { getAllByText } = render(
            <NodesListScreen navigation={mockNavigation} />,
        );

        await waitFor(() => getAllByText('🗑️'));

        await act(async () => {
            fireEvent.press(getAllByText('🗑️')[0]);
        });

        await waitFor(() => {
            expect(ApiService.deleteNode).toHaveBeenCalledWith(MOCK_NODES[0].node_id);
            // List should reload after deletion
            expect(ApiService.getNodes).toHaveBeenCalledTimes(2);
        });
    });

    it('shows error alert when deleteNode fails', async () => {
        ApiService.getNodes.mockResolvedValue({ success: true, nodes: MOCK_NODES });
        ApiService.deleteNode.mockRejectedValue({ error: 'Server Error' });

        Alert.alert.mockImplementation((title, message, buttons) => {
            const deleteBtn = buttons?.find((b) => b.text === 'Delete');
            if (deleteBtn) deleteBtn.onPress();
        });

        const { getAllByText } = render(
            <NodesListScreen navigation={mockNavigation} />,
        );

        await waitFor(() => getAllByText('🗑️'));

        await act(async () => {
            fireEvent.press(getAllByText('🗑️')[0]);
        });

        await waitFor(() => {
            expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to delete node');
        });
    });
});
