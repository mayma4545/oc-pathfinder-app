# Event Search Feature Implementation Plan

## Project Context
**App:** OC-PATHFINDER - Campus Navigation Mobile App  
**Framework:** React Native with Expo  
**Backend:** Express.js + MySQL (Sequelize ORM)  
**Current State:** Location-based navigation system with nodes, edges, and pathfinding

---

## Feature Overview

### Objective
Add event search functionality to the campus navigation app, allowing users to search for events by name or keywords. When users don't know the specific destination name, they can search for events happening at various locations on campus.

### User Story
*"As a student, I want to search for events by name (e.g., 'Career Fair') so that I can navigate to the event location even if I don't know the building or room name."*

---

## Requirements Summary

Based on project analysis and stakeholder input:

### Core Requirements
1. **Event-Node Relationship:** One event → One node (1:1 relationship)
2. **Event Fields:**
   - Event name (required)
   - Description
   - Event category/type
3. **Search Integration:** Mixed search (events + nodes in same search bar)
4. **Time Filtering:** Show only active/upcoming events
5. **Access Control:** Admin-only event management
6. **Selection Behavior:** Auto-fill destination when event is selected
7. **Offline Support:** Cache events for offline search
8. **UI Integration:** Search integration only (no separate events screen)

### Additional Features
- Event notifications/reminders (push notifications)
- Map view with event pins (visual markers on campus map)

---

## Technical Architecture

### 1. Database Schema

#### New Table: `events`

```sql
CREATE TABLE events (
  event_id INT PRIMARY KEY AUTO_INCREMENT,
  event_name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  node_id INT NOT NULL,
  
  -- Time-based fields for filtering
  start_datetime DATETIME,
  end_datetime DATETIME,
  
  -- Status and visibility
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Foreign key constraint
  FOREIGN KEY (node_id) REFERENCES nodes(node_id) ON DELETE CASCADE,
  
  -- Indexes for performance
  INDEX idx_event_name (event_name),
  INDEX idx_category (category),
  INDEX idx_start_datetime (start_datetime),
  INDEX idx_node_id (node_id),
  INDEX idx_is_active (is_active)
);
```

#### Event Categories (Enum/Constants)
```javascript
EVENT_CATEGORIES = [
  'Academic',
  'Social',
  'Sports',
  'Career',
  'Workshop',
  'Conference',
  'Cultural',
  'Other'
]
```

---

### 2. Backend Implementation

#### A. Sequelize Model (`src/models/Event.js`)

```javascript
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Event = sequelize.define('Event', {
    event_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    event_name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    category: {
      type: DataTypes.STRING(100),
      allowNull: true,
      validate: {
        isIn: [['Academic', 'Social', 'Sports', 'Career', 'Workshop', 'Conference', 'Cultural', 'Other']]
      }
    },
    node_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'nodes',
        key: 'node_id'
      }
    },
    start_datetime: {
      type: DataTypes.DATE,
      allowNull: true
    },
    end_datetime: {
      type: DataTypes.DATE,
      allowNull: true
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    is_featured: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  }, {
    tableName: 'events',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  // Define associations
  Event.associate = (models) => {
    Event.belongsTo(models.Node, {
      foreignKey: 'node_id',
      as: 'location'
    });
  };

  return Event;
};
```

#### B. API Endpoints

**New Public Endpoints:**

| Method | Endpoint | Description | Query Params |
|--------|----------|-------------|--------------|
| GET | `/api/mobile/events` | List active/upcoming events | `?search=`, `?category=`, `?from_date=`, `?to_date=` |
| GET | `/api/mobile/events/:id` | Get event details with node info | - |
| GET | `/api/mobile/events/search` | Combined search (events + nodes) | `?query=` |

**New Admin Endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/mobile/admin/events/create` | Create new event |
| PUT | `/api/mobile/admin/events/:id/update` | Update existing event |
| DELETE | `/api/mobile/admin/events/:id/delete` | Delete event |
| GET | `/api/mobile/admin/events/all` | Get all events (including past/inactive) |

#### C. Service Layer (`src/services/EventService.js`)

```javascript
const { Event, Node } = require('../models');
const { Op } = require('sequelize');

class EventService {
  /**
   * Get active/upcoming events
   */
  static async getActiveEvents(filters = {}) {
    const where = {
      is_active: true,
      [Op.or]: [
        { end_datetime: null },
        { end_datetime: { [Op.gte]: new Date() } }
      ]
    };

    if (filters.search) {
      where.event_name = { [Op.like]: `%${filters.search}%` };
    }

    if (filters.category) {
      where.category = filters.category;
    }

    if (filters.from_date) {
      where.start_datetime = { [Op.gte]: new Date(filters.from_date) };
    }

    const events = await Event.findAll({
      where,
      include: [{
        model: Node,
        as: 'location',
        attributes: ['node_id', 'node_code', 'name', 'building', 'floor_level', 'map_x', 'map_y']
      }],
      order: [['start_datetime', 'ASC']]
    });

    return events;
  }

  /**
   * Combined search (events + nodes)
   */
  static async combinedSearch(query) {
    // Search events
    const events = await Event.findAll({
      where: {
        is_active: true,
        event_name: { [Op.like]: `%${query}%` },
        [Op.or]: [
          { end_datetime: null },
          { end_datetime: { [Op.gte]: new Date() } }
        ]
      },
      include: [{
        model: Node,
        as: 'location',
        attributes: ['node_id', 'node_code', 'name', 'building', 'floor_level']
      }],
      limit: 10
    });

    // Search nodes
    const nodes = await Node.findAll({
      where: {
        [Op.or]: [
          { name: { [Op.like]: `%${query}%` } },
          { node_code: { [Op.like]: `%${query}%` } },
          { building: { [Op.like]: `%${query}%` } }
        ]
      },
      limit: 10
    });

    return {
      events: events.map(e => ({
        type: 'event',
        event_id: e.event_id,
        event_name: e.event_name,
        category: e.category,
        start_datetime: e.start_datetime,
        node: e.location
      })),
      nodes: nodes.map(n => ({
        type: 'node',
        node_id: n.node_id,
        node_code: n.node_code,
        name: n.name,
        building: n.building,
        floor_level: n.floor_level
      }))
    };
  }

  /**
   * Create event (admin only)
   */
  static async createEvent(eventData) {
    const event = await Event.create(eventData);
    return event;
  }

  /**
   * Update event (admin only)
   */
  static async updateEvent(eventId, eventData) {
    const event = await Event.findByPk(eventId);
    if (!event) throw new Error('Event not found');
    await event.update(eventData);
    return event;
  }

  /**
   * Delete event (admin only)
   */
  static async deleteEvent(eventId) {
    const event = await Event.findByPk(eventId);
    if (!event) throw new Error('Event not found');
    await event.destroy();
    return { success: true };
  }
}

module.exports = EventService;
```

#### D. Route Handlers (`src/routes/mobileApi.js`)

```javascript
// Public endpoints
router.get('/events', async (req, res) => {
  try {
    const { search, category, from_date, to_date } = req.query;
    const events = await EventService.getActiveEvents({ search, category, from_date, to_date });
    res.json({ success: true, events });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/events/search', async (req, res) => {
  try {
    const { query } = req.query;
    const results = await EventService.combinedSearch(query);
    res.json({ success: true, ...results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin endpoints (with authentication middleware)
router.post('/admin/events/create', authenticateAdmin, async (req, res) => {
  try {
    const event = await EventService.createEvent(req.body);
    res.json({ success: true, event });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

---

### 3. Frontend Implementation (React Native)

#### A. API Service Updates (`services/ApiService.js`)

```javascript
// Add to ApiService
getEvents: async (params = {}, options = {}) => {
  const { offlineOnly = false } = options;

  if (offlineOnly) {
    const offlineEvents = await OfflineService.getEvents();
    if (offlineEvents) {
      return { success: true, events: offlineEvents, offline: true };
    }
    return { success: false, error: 'No offline data available', offline: true };
  }

  try {
    const response = await api.get(API_ENDPOINTS.EVENTS_LIST, { params });

    // Background sync
    OfflineService.isOfflineEnabled().then(async (enabled) => {
      if (enabled && response.data.success) {
        await OfflineService.saveEvents(response.data.events);
      }
    }).catch(err => console.warn('Background event cache update failed:', err));

    return { ...response.data, offline: false };
  } catch (error) {
    const isNetworkError = !error.response || error.code === 'ECONNABORTED';
    
    if (isNetworkError) {
      const offlineEvents = await OfflineService.getEvents();
      if (offlineEvents && offlineEvents.length > 0) {
        return { success: true, events: offlineEvents, offline: true };
      }
    }
    throw error.response?.data || error;
  }
},

combinedSearch: async (query, options = {}) => {
  const { offlineOnly = false } = options;

  if (offlineOnly) {
    const results = await OfflineService.combinedSearch(query);
    return { success: true, ...results, offline: true };
  }

  try {
    const response = await api.get(API_ENDPOINTS.EVENTS_SEARCH, { params: { query } });
    return { ...response.data, offline: false };
  } catch (error) {
    const isNetworkError = !error.response || error.code === 'ECONNABORTED';
    
    if (isNetworkError) {
      const results = await OfflineService.combinedSearch(query);
      return { success: true, ...results, offline: true };
    }
    throw error.response?.data || error;
  }
},

// Admin endpoints
createEvent: async (eventData) => {
  const response = await api.post(API_ENDPOINTS.EVENT_CREATE, eventData);
  return response.data;
},

updateEvent: async (eventId, eventData) => {
  const response = await api.put(`${API_ENDPOINTS.EVENT_UPDATE}${eventId}/update/`, eventData);
  return response.data;
},

deleteEvent: async (eventId) => {
  const response = await api.delete(`${API_ENDPOINTS.EVENT_DELETE}${eventId}/delete/`);
  return response.data;
}
```

#### B. Config Updates (`config.js`)

```javascript
export const API_ENDPOINTS = {
  // ... existing endpoints
  
  // Event endpoints
  EVENTS_LIST: '/api/mobile/events/',
  EVENTS_SEARCH: '/api/mobile/events/search/',
  EVENT_CREATE: '/api/mobile/admin/events/create/',
  EVENT_UPDATE: '/api/mobile/admin/events/',
  EVENT_DELETE: '/api/mobile/admin/events/',
};

export const EVENT_CATEGORIES = [
  'Academic',
  'Social',
  'Sports',
  'Career',
  'Workshop',
  'Conference',
  'Cultural',
  'Other'
];
```

#### C. Offline Service Updates (`services/OfflineService.js`)

```javascript
// Add to OfflineService
const EVENTS_CACHE_KEY = 'offline_events';

// Save events to offline cache
saveEvents: async (events) => {
  try {
    await AsyncStorage.setItem(EVENTS_CACHE_KEY, JSON.stringify(events));
    console.log('Events cached for offline use');
  } catch (error) {
    console.error('Error caching events:', error);
  }
},

// Get events from offline cache
getEvents: async () => {
  try {
    const cachedEvents = await AsyncStorage.getItem(EVENTS_CACHE_KEY);
    if (!cachedEvents) return null;

    const events = JSON.parse(cachedEvents);
    const now = new Date();

    // Filter to show only active/upcoming events
    const activeEvents = events.filter(event => {
      if (!event.end_datetime) return true;
      return new Date(event.end_datetime) >= now;
    });

    return activeEvents;
  } catch (error) {
    console.error('Error loading cached events:', error);
    return null;
  }
},

// Combined search (events + nodes) offline
combinedSearch: async (query) => {
  try {
    const lowerQuery = query.toLowerCase();

    // Search events
    const cachedEvents = await OfflineService.getEvents();
    const matchedEvents = cachedEvents
      ? cachedEvents.filter(e => 
          e.event_name.toLowerCase().includes(lowerQuery)
        )
      : [];

    // Search nodes
    const cachedNodes = await OfflineService.getNodes();
    const matchedNodes = cachedNodes
      ? cachedNodes.filter(n =>
          n.name.toLowerCase().includes(lowerQuery) ||
          n.node_code.toLowerCase().includes(lowerQuery) ||
          n.building.toLowerCase().includes(lowerQuery)
        )
      : [];

    return {
      events: matchedEvents.map(e => ({ ...e, type: 'event' })),
      nodes: matchedNodes.map(n => ({ ...n, type: 'node' }))
    };
  } catch (error) {
    console.error('Error in offline combined search:', error);
    return { events: [], nodes: [] };
  }
}
```

#### D. Point Selection Screen Updates (`screens/PointSelectionScreen.js`)

**Key Changes:**

1. **Update state to handle combined search results:**
```javascript
const [searchResults, setSearchResults] = useState({ events: [], nodes: [] });
const [showingEvents, setShowingEvents] = useState(false);
```

2. **Modify loadNodes to also load events:**
```javascript
const loadNodesAndEvents = async () => {
  try {
    setLoading(true);
    
    // Load nodes
    const nodesResponse = await ApiService.getNodes();
    if (nodesResponse.success) {
      setNodes(nodesResponse.nodes);
    }

    // Load active events
    const eventsResponse = await ApiService.getEvents();
    if (eventsResponse.success) {
      setEvents(eventsResponse.events);
    }
  } catch (error) {
    console.error('Error loading data:', error);
    Alert.alert('Error', 'Failed to load data');
  } finally {
    setLoading(false);
  }
};
```

3. **Update search filter to use combined search:**
```javascript
useEffect(() => {
  const performSearch = async () => {
    if (searchQuery.trim() === '') {
      setSearchResults({ events: [], nodes: nodes });
      return;
    }

    try {
      const results = await ApiService.combinedSearch(searchQuery);
      if (results.success) {
        setSearchResults({
          events: results.events || [],
          nodes: results.nodes || []
        });
      }
    } catch (error) {
      console.error('Search error:', error);
      // Fallback to local filtering
      const filtered = nodes.filter(node =>
        node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        node.node_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        node.building.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setSearchResults({ events: [], nodes: filtered });
    }
  };

  performSearch();
}, [searchQuery, nodes]);
```

4. **Update FlatList to display both events and nodes:**
```javascript
const renderItem = ({ item }) => {
  if (item.type === 'event') {
    return (
      <TouchableOpacity
        style={styles.nodeItem}
        onPress={() => selectEvent(item)}
        activeOpacity={0.7}
      >
        <View style={styles.nodeInfo}>
          <View style={styles.eventBadge}>
            <Text style={styles.eventBadgeText}>🎉 EVENT</Text>
          </View>
          <Text style={styles.nodeName}>{item.event_name}</Text>
          <Text style={styles.nodeDetails}>
            {item.category} • {item.node.building} • Floor {item.node.floor_level}
          </Text>
          {item.start_datetime && (
            <Text style={styles.eventTime}>
              📅 {new Date(item.start_datetime).toLocaleDateString()}
            </Text>
          )}
        </View>
        <Text style={styles.selectIcon}>›</Text>
      </TouchableOpacity>
    );
  } else {
    return renderNodeItem({ item });
  }
};

const selectEvent = (event) => {
  // Auto-fill destination with event's node
  if (selectingType === 'start') {
    setStartPoint(event.node);
  } else {
    setEndPoint(event.node);
  }
  setModalVisible(false);
  setSearchQuery('');
};

// Combine events and nodes for FlatList
const combinedData = [
  ...searchResults.events.map(e => ({ ...e, type: 'event' })),
  ...searchResults.nodes.map(n => ({ ...n, type: 'node' }))
];

<FlatList
  data={combinedData}
  renderItem={renderItem}
  keyExtractor={(item) => 
    item.type === 'event' 
      ? `event-${item.event_id}` 
      : `node-${item.node_id}`
  }
  // ... rest of FlatList props
/>
```

5. **Add styling for event items:**
```javascript
eventBadge: {
  backgroundColor: THEME_COLORS.secondary,
  paddingHorizontal: 8,
  paddingVertical: 4,
  borderRadius: 4,
  alignSelf: 'flex-start',
  marginBottom: 6,
},
eventBadgeText: {
  color: '#FFFFFF',
  fontSize: 11,
  fontWeight: '700',
},
eventTime: {
  fontSize: 12,
  color: THEME_COLORS.primary,
  marginTop: 4,
  fontWeight: '500',
},
```

---

### 4. Admin Dashboard Implementation

#### A. New Admin Screen: Event Management (`screens/admin/EventsListScreen.js`)

```javascript
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ApiService from '../../services/ApiService';
import { THEME_COLORS } from '../../config';

const EventsListScreen = ({ navigation }) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const response = await ApiService.getEvents();
      if (response.success) {
        setEvents(response.events);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (eventId) => {
    Alert.alert(
      'Delete Event',
      'Are you sure you want to delete this event?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await ApiService.deleteEvent(eventId);
              Alert.alert('Success', 'Event deleted');
              loadEvents();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete event');
            }
          }
        }
      ]
    );
  };

  const renderEventItem = ({ item }) => (
    <TouchableOpacity
      style={styles.eventItem}
      onPress={() => navigation.navigate('EventForm', { event: item })}
    >
      <View style={styles.eventInfo}>
        <Text style={styles.eventName}>{item.event_name}</Text>
        <Text style={styles.eventDetails}>
          {item.category} • {item.location.name}
        </Text>
        {item.start_datetime && (
          <Text style={styles.eventDate}>
            {new Date(item.start_datetime).toLocaleDateString()}
          </Text>
        )}
      </View>
      <TouchableOpacity
        onPress={() => handleDelete(item.event_id)}
        style={styles.deleteButton}
      >
        <Text style={styles.deleteText}>🗑️</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Events</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('EventForm')}
          style={styles.addButton}
        >
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={THEME_COLORS.primary} />
      ) : (
        <FlatList
          data={events}
          renderItem={renderEventItem}
          keyExtractor={(item) => item.event_id.toString()}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No events found</Text>
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
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  addButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  eventItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  eventInfo: {
    flex: 1,
  },
  eventName: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME_COLORS.text,
    marginBottom: 5,
  },
  eventDetails: {
    fontSize: 14,
    color: THEME_COLORS.textSecondary,
  },
  eventDate: {
    fontSize: 12,
    color: THEME_COLORS.primary,
    marginTop: 4,
  },
  deleteButton: {
    padding: 10,
  },
  deleteText: {
    fontSize: 20,
  },
  emptyText: {
    textAlign: 'center',
    color: THEME_COLORS.textSecondary,
    marginTop: 40,
    fontSize: 16,
  },
});

export default EventsListScreen;
```

#### B. Event Form Screen (`screens/admin/EventFormScreen.js`)

Similar structure to NodeFormScreen.js but with event-specific fields (event_name, description, category, node selection, date/time pickers).

---

## Implementation Phases

### Phase 1: Backend Foundation (Week 1)
**Priority: High**

1. **Database Setup**
   - [ ] Create `events` table with migration script
   - [ ] Add seed data (5-10 sample events for testing)
   - [ ] Set up foreign key constraints

2. **Backend Models & Services**
   - [ ] Create `Event` Sequelize model
   - [ ] Set up model associations (Event ↔ Node)
   - [ ] Implement `EventService.js` with CRUD operations
   - [ ] Add time-based filtering logic

3. **API Endpoints**
   - [ ] Public: `GET /api/mobile/events`
   - [ ] Public: `GET /api/mobile/events/search` (combined search)
   - [ ] Admin: `POST /api/mobile/admin/events/create`
   - [ ] Admin: `PUT /api/mobile/admin/events/:id/update`
   - [ ] Admin: `DELETE /api/mobile/admin/events/:id/delete`

4. **Testing**
   - [ ] Test API endpoints with Postman/Insomnia
   - [ ] Verify time filtering (show only upcoming events)
   - [ ] Test combined search returns both events and nodes

---

### Phase 2: Frontend Integration (Week 2)
**Priority: High**

1. **API Service Updates**
   - [ ] Add `getEvents()` to `ApiService.js`
   - [ ] Add `combinedSearch()` to `ApiService.js`
   - [ ] Add admin event CRUD methods
   - [ ] Update `config.js` with new endpoints

2. **Offline Support**
   - [ ] Add event caching to `OfflineService.js`
   - [ ] Implement `saveEvents()` and `getEvents()`
   - [ ] Add `combinedSearch()` for offline mode
   - [ ] Update download flow to include events

3. **Point Selection Screen**
   - [ ] Modify search to use `combinedSearch()` API
   - [ ] Update FlatList to render both events and nodes
   - [ ] Add event item styling (badge, date display)
   - [ ] Implement `selectEvent()` to auto-fill destination
   - [ ] Test offline event search

4. **Testing**
   - [ ] Test event search in online mode
   - [ ] Test event search in offline mode
   - [ ] Verify selecting event auto-fills destination
   - [ ] Test combined search results display correctly

---

### Phase 3: Admin Dashboard (Week 3)
**Priority: Medium**

1. **Event Management Screens**
   - [ ] Create `EventsListScreen.js` (list all events)
   - [ ] Create `EventFormScreen.js` (create/edit events)
   - [ ] Add date/time pickers for event scheduling
   - [ ] Implement category dropdown selection
   - [ ] Add node selector for event location

2. **Navigation Updates**
   - [ ] Add "Events" link to Admin Dashboard
   - [ ] Set up navigation routes for event screens

3. **Testing**
   - [ ] Test creating new events
   - [ ] Test editing existing events
   - [ ] Test deleting events
   - [ ] Verify admin-only access control

---

### Phase 4: Additional Features (Week 4)
**Priority: Low (Nice-to-have)**

1. **Event Notifications/Reminders**
   - [ ] Install Expo Notifications package
   - [ ] Set up push notification permissions
   - [ ] Create notification scheduling service
   - [ ] Allow users to subscribe to event reminders
   - [ ] Send notification 1 hour before event starts

2. **Map View with Event Pins**
   - [ ] Add event markers to `SvgMap.js`
   - [ ] Use different icon/color for event nodes
   - [ ] Add tap handler to event pins to show event details
   - [ ] Display mini event card on map when pin is tapped

3. **Testing**
   - [ ] Test notification scheduling
   - [ ] Test event pins display on map
   - [ ] Test tap interaction on event markers

---

## Database Migration Script

```sql
-- Migration: Add events table
-- Run this on production database

CREATE TABLE IF NOT EXISTS events (
  event_id INT PRIMARY KEY AUTO_INCREMENT,
  event_name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  node_id INT NOT NULL,
  start_datetime DATETIME,
  end_datetime DATETIME,
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (node_id) REFERENCES nodes(node_id) ON DELETE CASCADE,
  
  INDEX idx_event_name (event_name),
  INDEX idx_category (category),
  INDEX idx_start_datetime (start_datetime),
  INDEX idx_node_id (node_id),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insert sample events for testing
INSERT INTO events (event_name, description, category, node_id, start_datetime, end_datetime) VALUES
  ('Career Fair 2024', 'Annual career fair with 50+ employers', 'Career', 1, '2024-03-15 09:00:00', '2024-03-15 17:00:00'),
  ('Computer Science Workshop', 'Introduction to Machine Learning', 'Workshop', 5, '2024-03-20 14:00:00', '2024-03-20 16:00:00'),
  ('Basketball Tournament', 'Inter-department basketball competition', 'Sports', 8, '2024-03-25 10:00:00', '2024-03-25 15:00:00');
```

---

## Success Metrics

### User Experience
- [ ] Users can search for events by name in find path screen
- [ ] Search results display events with visual distinction (badge)
- [ ] Selecting an event auto-fills the destination node
- [ ] Offline search works for cached events
- [ ] Only active/upcoming events are displayed

### Performance
- [ ] Combined search returns results in < 500ms
- [ ] Offline search works instantly
- [ ] Event caching completes during offline data download

### Admin Experience
- [ ] Admins can create/edit/delete events easily
- [ ] Event form validates required fields
- [ ] Event list shows all events with filtering options

---

## Testing Checklist

### Backend
- [ ] Create event with all fields
- [ ] Create event with minimal fields (name + node_id)
- [ ] Get active events (should exclude past events)
- [ ] Combined search returns both events and nodes
- [ ] Update event details
- [ ] Delete event (verify cascade doesn't delete node)
- [ ] Deleting node deletes associated events

### Frontend
- [ ] Search for event by name
- [ ] Select event to auto-fill destination
- [ ] Download offline data includes events
- [ ] Search events in offline mode
- [ ] Event badge displays correctly
- [ ] Event date formats correctly
- [ ] Admin can create/edit events
- [ ] Non-admin users cannot access event management

---

## Potential Edge Cases & Solutions

### 1. Event at Deleted Node
**Problem:** Node is deleted but event still exists  
**Solution:** ON DELETE CASCADE in foreign key constraint automatically deletes events when node is deleted

### 2. Past Events in Cache
**Problem:** Offline cache shows expired events  
**Solution:** Filter cached events by `end_datetime` when retrieving from cache

### 3. Event Without End Time
**Problem:** Events with no `end_datetime` (ongoing events)  
**Solution:** Treat `null` end_datetime as "always active" (e.g., permanent exhibits)

### 4. Duplicate Event Names
**Problem:** Multiple events with same name at different times  
**Solution:** Display date/time in search results to differentiate

### 5. Search Priority
**Problem:** Should events or nodes appear first in search?  
**Solution:** Events appear first (as requested), followed by nodes

---

## Security Considerations

1. **Admin-Only Access**
   - Event CRUD endpoints require JWT authentication
   - Use `authenticateAdmin` middleware on all admin routes

2. **Input Validation**
   - Validate event_name length (max 255 chars)
   - Validate category is from allowed list
   - Validate dates (start_datetime < end_datetime)
   - Sanitize description field to prevent XSS

3. **SQL Injection Prevention**
   - Use Sequelize parameterized queries (automatic)
   - Never concatenate user input in raw SQL

---

## Performance Optimization

1. **Database Indexing**
   - Index on `event_name` for fast text search
   - Index on `start_datetime` for date filtering
   - Composite index on `(is_active, start_datetime)` for common query

2. **Caching Strategy**
   - Cache active events for 15 minutes (Redis or in-memory)
   - Invalidate cache on event create/update/delete

3. **Pagination**
   - Add pagination to event list (50 events per page)
   - Use cursor-based pagination for mobile scroll

4. **Mobile Data Usage**
   - Compress event images (if added later)
   - Send minimal fields in search results
   - Use lazy loading for event details

---

## Future Enhancements (Post-MVP)

1. **Event Tags/Keywords**
   - Add searchable tags (e.g., 'free food', 'networking')
   - Allow multiple tags per event

2. **Event Images/Posters**
   - Upload event banner image (Cloudinary)
   - Display in search results and event details

3. **RSVP/Registration**
   - Add attendance tracking
   - Send confirmation emails
   - Show capacity limits

4. **Recurring Events**
   - Support weekly/monthly recurring events
   - Use recurrence rules (RRULE format)

5. **Event Organizer Profiles**
   - Link events to departments/clubs
   - Show organizer contact info

6. **Analytics Dashboard**
   - Track event views and navigation requests
   - Show popular events to admins

---

## Best Practices Applied

Based on research and industry standards:

### ✅ Search Optimization
- **Mixed search results:** Events and nodes in same interface reduces cognitive load
- **Visual distinction:** Event badge makes it clear which results are events
- **Contextual information:** Display location, date, and category in results

### ✅ Time-Aware UX
- **Auto-filter past events:** Only show relevant upcoming events
- **Date formatting:** Use locale-specific date formatting
- **Timezone handling:** Store UTC, display local time

### ✅ Offline-First Design
- **Cache events locally:** Works without internet
- **Background sync:** Update cache when online
- **Graceful degradation:** App remains functional offline

### ✅ Accessibility
- **Clear labels:** Event badge is easily distinguishable
- **Semantic structure:** Proper heading hierarchy
- **Touch targets:** Minimum 44x44pt tap areas

### ✅ Performance
- **Database indexes:** Fast search queries
- **Pagination:** Prevent overwhelming data loads
- **Lazy loading:** Load details on demand

---

## Conclusion

This plan provides a comprehensive roadmap for implementing event search functionality in the OC-PATHFINDER app. The phased approach allows for incremental development and testing, ensuring each component works correctly before moving to the next.

**Estimated Timeline:** 3-4 weeks for core features (Phases 1-3)  
**Additional Time:** 1 week for optional features (Phase 4)

**Next Steps:**
1. Review and approve this plan
2. Set up development environment (database access)
3. Begin Phase 1: Backend implementation
4. Regular testing and iteration

---

*Document Version: 1.0*  
*Last Updated: January 31, 2026*  
*Author: AI Assistant*
