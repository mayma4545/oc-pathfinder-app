import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import EventsListScreen from '../EventsListScreen';
import ApiService from '../../../services/ApiService';
import { Alert } from 'react-native';

// Mock dependencies
jest.mock('../../../services/ApiService');
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback) => {
    callback();
  },
}));

// Mock navigation
const mockNavigation = {
  goBack: jest.fn(),
  navigate: jest.fn(),
};

// Spy on Alert.alert
jest.spyOn(Alert, 'alert');

// Mock event data
const mockEvents = [
  {
    event_id: 1,
    event_name: 'Career Fair 2024',
    description: 'Annual career fair',
    category: 'Career',
    node_id: 1,
    start_datetime: '2024-12-01T09:00:00',
    end_datetime: '2024-12-01T17:00:00',
    is_active: true,
    is_featured: false,
    location: {
      node_id: 1,
      name: 'Main Hall',
      building: 'Building A',
      floor_level: 1,
    },
  },
  {
    event_id: 2,
    event_name: 'Workshop on AI',
    description: 'Machine Learning workshop',
    category: 'Workshop',
    node_id: 2,
    start_datetime: '2024-11-15T14:00:00',
    end_datetime: '2024-11-15T16:00:00',
    is_active: true,
    is_featured: true,
    location: {
      node_id: 2,
      name: 'Lab 101',
      building: 'Building B',
      floor_level: 2,
    },
  },
  {
    event_id: 3,
    event_name: 'Past Event',
    description: 'This event has ended',
    category: 'Social',
    node_id: 3,
    start_datetime: '2023-01-01T10:00:00',
    end_datetime: '2023-01-01T12:00:00',
    is_active: true,
    is_featured: false,
    location: {
      node_id: 3,
      name: 'Cafeteria',
      building: 'Building C',
      floor_level: 1,
    },
  },
  {
    event_id: 4,
    event_name: 'Inactive Event',
    description: 'Not visible to users',
    category: 'Other',
    node_id: 4,
    start_datetime: '2024-12-10T10:00:00',
    end_datetime: '2024-12-10T12:00:00',
    is_active: false,
    is_featured: false,
    location: {
      node_id: 4,
      name: 'Room 202',
      building: 'Building D',
      floor_level: 2,
    },
  },
];

describe('EventsListScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ApiService.getAllEvents.mockResolvedValue({
      success: true,
      events: mockEvents,
    });
  });

  it('renders correctly and loads events', async () => {
    const { getByText } = render(
      <EventsListScreen navigation={mockNavigation} />
    );

    await waitFor(() => {
      expect(getByText('Manage Events')).toBeTruthy();
      expect(getByText('+ Add New Event')).toBeTruthy();
    });

    expect(ApiService.getAllEvents).toHaveBeenCalled();
  });

  it('displays all events from API', async () => {
    const { getByText } = render(
      <EventsListScreen navigation={mockNavigation} />
    );

    await waitFor(() => {
      expect(getByText('Career Fair 2024')).toBeTruthy();
      expect(getByText('Workshop on AI')).toBeTruthy();
      expect(getByText('Past Event')).toBeTruthy();
      expect(getByText('Inactive Event')).toBeTruthy();
    });
  });

  it('shows past event badge for events that have ended', async () => {
    const { getAllByText } = render(
      <EventsListScreen navigation={mockNavigation} />
    );

    await waitFor(() => {
      const pastBadges = getAllByText('PAST');
      expect(pastBadges.length).toBeGreaterThan(0);
    });
  });

  it('shows inactive badge for inactive events', async () => {
    const { getAllByText } = render(
      <EventsListScreen navigation={mockNavigation} />
    );

    await waitFor(() => {
      const inactiveBadges = getAllByText('INACTIVE');
      expect(inactiveBadges.length).toBeGreaterThan(0);
    });
  });

  it('displays event categories', async () => {
    const { getByText } = render(
      <EventsListScreen navigation={mockNavigation} />
    );

    await waitFor(() => {
      expect(getByText('Career')).toBeTruthy();
      expect(getByText('Workshop')).toBeTruthy();
      expect(getByText('Social')).toBeTruthy();
    });
  });

  it('displays event locations', async () => {
    const { getByText } = render(
      <EventsListScreen navigation={mockNavigation} />
    );

    await waitFor(() => {
      expect(getByText('📍 Main Hall')).toBeTruthy();
      expect(getByText('📍 Lab 101')).toBeTruthy();
    });
  });

  it('filters events by search query', async () => {
    const { getByPlaceholderText, getByText, queryByText } = render(
      <EventsListScreen navigation={mockNavigation} />
    );

    await waitFor(() => {
      expect(getByText('Career Fair 2024')).toBeTruthy();
    });

    const searchInput = getByPlaceholderText('Search events...');
    fireEvent.changeText(searchInput, 'Career');

    await waitFor(() => {
      expect(getByText('Career Fair 2024')).toBeTruthy();
      expect(queryByText('Workshop on AI')).toBeNull();
    });
  });

  it('filters events by category', async () => {
    const { getByPlaceholderText, getByText, queryByText } = render(
      <EventsListScreen navigation={mockNavigation} />
    );

    await waitFor(() => {
      expect(getByText('Career Fair 2024')).toBeTruthy();
    });

    const searchInput = getByPlaceholderText('Search events...');
    fireEvent.changeText(searchInput, 'Workshop');

    await waitFor(() => {
      expect(getByText('Workshop on AI')).toBeTruthy();
      expect(queryByText('Career Fair 2024')).toBeNull();
    });
  });

  it('filters events by building', async () => {
    const { getByPlaceholderText, getByText, queryByText } = render(
      <EventsListScreen navigation={mockNavigation} />
    );

    await waitFor(() => {
      expect(getByText('Career Fair 2024')).toBeTruthy();
    });

    const searchInput = getByPlaceholderText('Search events...');
    fireEvent.changeText(searchInput, 'Building B');

    await waitFor(() => {
      expect(getByText('Workshop on AI')).toBeTruthy();
      expect(queryByText('Career Fair 2024')).toBeNull();
    });
  });

  it('shows empty state when no events found', async () => {
    ApiService.getAllEvents.mockResolvedValue({
      success: true,
      events: [],
    });

    const { getByText } = render(
      <EventsListScreen navigation={mockNavigation} />
    );

    await waitFor(() => {
      expect(getByText('No events found')).toBeTruthy();
      expect(getByText('Tap the button above to create your first event')).toBeTruthy();
    });
  });

  it('shows empty state with search message when search returns no results', async () => {
    const { getByPlaceholderText, getByText } = render(
      <EventsListScreen navigation={mockNavigation} />
    );

    await waitFor(() => {
      expect(getByText('Career Fair 2024')).toBeTruthy();
    });

    const searchInput = getByPlaceholderText('Search events...');
    fireEvent.changeText(searchInput, 'NonExistentEvent');

    await waitFor(() => {
      expect(getByText('No events found')).toBeTruthy();
      expect(getByText('Try a different search term')).toBeTruthy();
    });
  });

  it('navigates to event form when add button is pressed', async () => {
    const { getByText } = render(
      <EventsListScreen navigation={mockNavigation} />
    );

    await waitFor(() => {
      expect(getByText('+ Add New Event')).toBeTruthy();
    });

    fireEvent.press(getByText('+ Add New Event'));

    expect(mockNavigation.navigate).toHaveBeenCalledWith('EventForm', {
      event: null,
    });
  });

  it('navigates to event form with event data when edit button is pressed', async () => {
    const { getAllByText } = render(
      <EventsListScreen navigation={mockNavigation} />
    );

    await waitFor(() => {
      const editButtons = getAllByText('✏️');
      expect(editButtons.length).toBeGreaterThan(0);
      fireEvent.press(editButtons[0]);
    });

    expect(mockNavigation.navigate).toHaveBeenCalledWith('EventForm', {
      event: expect.objectContaining({
        event_id: expect.any(Number),
        event_name: expect.any(String),
      }),
    });
  });

  it('shows delete confirmation dialog when delete button is pressed', async () => {
    const { getAllByText } = render(
      <EventsListScreen navigation={mockNavigation} />
    );

    await waitFor(() => {
      const deleteButtons = getAllByText('🗑️');
      expect(deleteButtons.length).toBeGreaterThan(0);
      fireEvent.press(deleteButtons[0]);
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Delete Event',
      expect.stringContaining('Are you sure you want to delete'),
      expect.any(Array)
    );
  });

  it('deletes event when confirmed', async () => {
    ApiService.deleteEvent.mockResolvedValue({ success: true });

    const { getAllByText } = render(
      <EventsListScreen navigation={mockNavigation} />
    );

    await waitFor(() => {
      const deleteButtons = getAllByText('🗑️');
      fireEvent.press(deleteButtons[0]);
    });

    // Get the confirmation callback from Alert.alert
    const deleteConfirmCallback = Alert.alert.mock.calls[0][2][1].onPress;
    await deleteConfirmCallback();

    expect(ApiService.deleteEvent).toHaveBeenCalledWith(1);
    expect(Alert.alert).toHaveBeenCalledWith('Success', 'Event deleted successfully');
  });

  it('shows error when delete fails', async () => {
    ApiService.deleteEvent.mockRejectedValue(new Error('Delete failed'));

    const { getAllByText } = render(
      <EventsListScreen navigation={mockNavigation} />
    );

    await waitFor(() => {
      const deleteButtons = getAllByText('🗑️');
      fireEvent.press(deleteButtons[0]);
    });

    const deleteConfirmCallback = Alert.alert.mock.calls[0][2][1].onPress;
    await deleteConfirmCallback();

    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to delete event');
  });

  it('navigates back when back button is pressed', async () => {
    const { getByText } = render(
      <EventsListScreen navigation={mockNavigation} />
    );

    await waitFor(() => {
      expect(getByText('‹ Back')).toBeTruthy();
    });

    fireEvent.press(getByText('‹ Back'));

    expect(mockNavigation.goBack).toHaveBeenCalled();
  });

  it('handles API errors gracefully', async () => {
    ApiService.getAllEvents.mockRejectedValue(new Error('Network error'));

    const { getByText } = render(
      <EventsListScreen navigation={mockNavigation} />
    );

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to load events');
    });
  });

  it('reloads events when screen gains focus', async () => {
    const { rerender } = render(
      <EventsListScreen navigation={mockNavigation} />
    );

    await waitFor(() => {
      expect(ApiService.getAllEvents).toHaveBeenCalledTimes(1);
    });

    // Simulate screen refocus
    rerender(<EventsListScreen navigation={mockNavigation} />);

    await waitFor(() => {
      expect(ApiService.getAllEvents).toHaveBeenCalledTimes(2);
    });
  });
});
