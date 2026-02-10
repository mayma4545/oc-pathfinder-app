import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { THEME_COLORS } from '../../config';
import ApiService from '../../services/ApiService';
import { useFocusEffect } from '@react-navigation/native';

const EventsListScreen = ({ navigation }) => {
  const [events, setEvents] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadEvents();
    }, [])
  );

  useEffect(() => {
    filterEvents();
  }, [searchQuery, events]);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const response = await ApiService.getAllEvents();
      if (response.success) {
        setEvents(response.events);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  const filterEvents = () => {
    if (searchQuery.trim() === '') {
      setFilteredEvents(events);
    } else {
      const filtered = events.filter(
        (event) =>
          event.event_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          event.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          event.location?.building.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredEvents(filtered);
    }
  };

  const handleDelete = (event) => {
    Alert.alert(
      'Delete Event',
      `Are you sure you want to delete "${event.event_name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await ApiService.deleteEvent(event.event_id);
              Alert.alert('Success', 'Event deleted successfully');
              loadEvents();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete event');
            }
          },
        },
      ]
    );
  };

  const formatDate = (datetime) => {
    if (!datetime) return 'No date';
    const date = new Date(datetime);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (datetime) => {
    if (!datetime) return '';
    const date = new Date(datetime);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const isEventPast = (event) => {
    if (!event.end_datetime) return false;
    return new Date(event.end_datetime) < new Date();
  };

  const renderEventItem = ({ item }) => {
    const isPast = isEventPast(item);
    
    return (
      <View style={[styles.eventItem, isPast && styles.eventItemPast]}>
        <View style={styles.eventInfo}>
          <View style={styles.eventHeader}>
            <Text style={[styles.eventName, isPast && styles.eventNamePast]}>
              {item.event_name}
            </Text>
            {isPast && (
              <View style={styles.pastBadge}>
                <Text style={styles.pastBadgeText}>PAST</Text>
              </View>
            )}
            {!item.is_active && (
              <View style={styles.inactiveBadge}>
                <Text style={styles.inactiveBadgeText}>INACTIVE</Text>
              </View>
            )}
          </View>
          
          {item.category && (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{item.category}</Text>
            </View>
          )}
          
          <Text style={styles.eventLocation}>
            📍 {item.location?.name || 'Unknown Location'}
          </Text>
          <Text style={styles.eventDetails}>
            {item.location?.building} • Floor {item.location?.floor_level}
          </Text>
          
          {item.start_datetime && (
            <Text style={styles.eventDate}>
              📅 {formatDate(item.start_datetime)}
              {item.start_datetime && ` at ${formatTime(item.start_datetime)}`}
            </Text>
          )}
        </View>
        
        <View style={styles.eventActions}>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => navigation.navigate('EventForm', { event: item })}
          >
            <Text style={styles.editButtonText}>✏️</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDelete(item)}
          >
            <Text style={styles.deleteButtonText}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manage Events</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search events..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Add Button */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate('EventForm', { event: null })}
      >
        <Text style={styles.addButtonText}>+ Add New Event</Text>
      </TouchableOpacity>

      {/* Events List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={THEME_COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredEvents}
          renderItem={renderEventItem}
          keyExtractor={(item) => item.event_id.toString()}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🎉</Text>
              <Text style={styles.emptyText}>No events found</Text>
              <Text style={styles.emptySubtext}>
                {searchQuery ? 'Try a different search term' : 'Tap the button above to create your first event'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME_COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: THEME_COLORS.primary,
  },
  backButton: {
    color: '#FFFFFF',
    fontSize: 18,
    width: 60,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 60,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    margin: 15,
    marginBottom: 10,
    paddingHorizontal: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  searchIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
  addButton: {
    backgroundColor: THEME_COLORS.primary,
    marginHorizontal: 15,
    marginBottom: 15,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 15,
    paddingBottom: 20,
  },
  eventItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  eventItemPast: {
    opacity: 0.6,
    backgroundColor: '#F5F5F5',
  },
  eventInfo: {
    flex: 1,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  eventName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: THEME_COLORS.text,
    marginRight: 8,
  },
  eventNamePast: {
    color: THEME_COLORS.textSecondary,
  },
  pastBadge: {
    backgroundColor: THEME_COLORS.textSecondary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 6,
  },
  pastBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  inactiveBadge: {
    backgroundColor: THEME_COLORS.error,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  inactiveBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  categoryBadge: {
    backgroundColor: THEME_COLORS.secondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  categoryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  eventLocation: {
    fontSize: 14,
    color: THEME_COLORS.text,
    marginBottom: 4,
    fontWeight: '500',
  },
  eventDetails: {
    fontSize: 13,
    color: THEME_COLORS.textSecondary,
    marginBottom: 6,
  },
  eventDate: {
    fontSize: 13,
    color: THEME_COLORS.primary,
    fontWeight: '500',
  },
  eventActions: {
    flexDirection: 'column',
    marginLeft: 10,
  },
  editButton: {
    padding: 8,
    marginBottom: 8,
  },
  editButtonText: {
    fontSize: 20,
  },
  deleteButton: {
    padding: 8,
  },
  deleteButtonText: {
    fontSize: 20,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 15,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: THEME_COLORS.textSecondary,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: THEME_COLORS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});

export default EventsListScreen;
