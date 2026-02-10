import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  FlatList,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { THEME_COLORS, EVENT_CATEGORIES } from '../../config';
import ApiService from '../../services/ApiService';
import DateTimePicker from '@react-native-community/datetimepicker';

const EventFormScreen = ({ route, navigation }) => {
  const { event } = route.params || {};
  const isEdit = !!event;

  const [formData, setFormData] = useState({
    event_name: event?.event_name || '',
    description: event?.description || '',
    category: event?.category || '',
    node_id: event?.node_id || null,
    start_datetime: event?.start_datetime ? new Date(event.start_datetime) : null,
    end_datetime: event?.end_datetime ? new Date(event.end_datetime) : null,
    is_active: event?.is_active !== undefined ? event.is_active : true,
    is_featured: event?.is_featured !== undefined ? event.is_featured : false,
  });

  const [selectedLocation, setSelectedLocation] = useState(event?.location || null);
  const [nodes, setNodes] = useState([]);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [locationSearch, setLocationSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // Date/Time picker states
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  useEffect(() => {
    loadNodes();
  }, []);

  const loadNodes = async () => {
    try {
      const response = await ApiService.getNodes();
      if (response.success) {
        setNodes(response.nodes);
      }
    } catch (error) {
      console.error('Failed to load nodes:', error);
    }
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleLocationSelect = (node) => {
    setSelectedLocation(node);
    setFormData((prev) => ({ ...prev, node_id: node.node_id }));
    setShowLocationPicker(false);
    setLocationSearch('');
  };

  const handleCategorySelect = (category) => {
    setFormData((prev) => ({ ...prev, category }));
    setShowCategoryPicker(false);
  };

  const handleDateChange = (event, selectedDate, type) => {
    console.log('DatePicker onChange:', { event, selectedDate, type });
    
    // On Android, picker auto-dismisses
    if (Platform.OS === 'android') {
      setShowStartDatePicker(false);
      setShowStartTimePicker(false);
      setShowEndDatePicker(false);
      setShowEndTimePicker(false);
    }

    // Check if user dismissed the picker (with defensive check)
    if (event && event.type === 'dismissed') {
      // User cancelled - don't update the date
      console.log('User dismissed the picker');
      return;
    }

    // Update the date only if one was selected
    if (selectedDate) {
      console.log('Updating date:', type, selectedDate);
      setFormData((prev) => ({ ...prev, [type]: selectedDate }));
    }
  };

  const clearStartDateTime = () => {
    setFormData((prev) => ({ ...prev, start_datetime: null }));
  };

  const clearEndDateTime = () => {
    setFormData((prev) => ({ ...prev, end_datetime: null }));
  };

  const formatDateTime = (date) => {
    if (!date) return 'Not set';
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleSubmit = async () => {
    if (!formData.event_name || !formData.node_id) {
      Alert.alert('Error', 'Please fill in event name and select a location');
      return;
    }

    // Validate dates
    if (formData.start_datetime && formData.end_datetime) {
      if (formData.start_datetime >= formData.end_datetime) {
        Alert.alert('Error', 'Start time must be before end time');
        return;
      }
    }

    try {
      setLoading(true);

      const payload = {
        event_name: formData.event_name,
        description: formData.description || null,
        category: formData.category || null,
        node_id: formData.node_id,
        start_datetime: formData.start_datetime ? formData.start_datetime.toISOString() : null,
        end_datetime: formData.end_datetime ? formData.end_datetime.toISOString() : null,
        is_active: formData.is_active,
        is_featured: formData.is_featured,
      };

      let response;
      if (isEdit) {
        response = await ApiService.updateEvent(event.event_id, payload);
      } else {
        response = await ApiService.createEvent(payload);
      }

      if (response.success) {
        Alert.alert('Success', `Event ${isEdit ? 'updated' : 'created'} successfully`);
        navigation.goBack();
      } else {
        Alert.alert('Error', response.error || 'Operation failed');
      }
    } catch (error) {
      Alert.alert('Error', error.error || error.message || 'Failed to save event');
    } finally {
      setLoading(false);
    }
  };

  const filteredNodes = locationSearch.trim() === ''
    ? nodes
    : nodes.filter((node) =>
        node.name.toLowerCase().includes(locationSearch.toLowerCase()) ||
        node.node_code.toLowerCase().includes(locationSearch.toLowerCase()) ||
        node.building.toLowerCase().includes(locationSearch.toLowerCase())
      );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>‹ Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEdit ? '✏️ Edit Event' : '➕ Add Event'}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Basic Information */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>📋</Text>
            <View>
              <Text style={styles.sectionTitle}>Basic Information</Text>
              <Text style={styles.sectionSubtitle}>Event details and description</Text>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Event Name <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Career Fair 2024"
              value={formData.event_name}
              onChangeText={(value) => handleChange('event_name', value)}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Brief description of the event..."
              value={formData.description}
              onChangeText={(value) => handleChange('description', value)}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Category</Text>
            <TouchableOpacity
              style={styles.picker}
              onPress={() => setShowCategoryPicker(true)}
            >
              <Text style={formData.category ? styles.pickerText : styles.pickerPlaceholder}>
                {formData.category || 'Select Category'}
              </Text>
              <Text style={styles.pickerIcon}>▼</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Location */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>📍</Text>
            <View>
              <Text style={styles.sectionTitle}>Location</Text>
              <Text style={styles.sectionSubtitle}>Where the event will take place</Text>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Event Location <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity
              style={styles.locationPicker}
              onPress={() => setShowLocationPicker(true)}
            >
              {selectedLocation ? (
                <View>
                  <Text style={styles.locationName}>{selectedLocation.name}</Text>
                  <Text style={styles.locationDetails}>
                    {selectedLocation.building} • Floor {selectedLocation.floor_level} • {selectedLocation.node_code}
                  </Text>
                </View>
              ) : (
                <Text style={styles.locationPlaceholder}>Tap to select location</Text>
              )}
              <Text style={styles.pickerIcon}>›</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Date & Time */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>📅</Text>
            <View>
              <Text style={styles.sectionTitle}>Date & Time</Text>
              <Text style={styles.sectionSubtitle}>When the event happens</Text>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Start Date & Time</Text>
            <View style={styles.dateTimeRow}>
              <TouchableOpacity
                style={styles.dateTimeButton}
                onPress={() => setShowStartDatePicker(true)}
              >
                <Text style={styles.dateTimeText}>
                  {formData.start_datetime ? formatDateTime(formData.start_datetime) : 'Set start time'}
                </Text>
              </TouchableOpacity>
              {formData.start_datetime && (
                <TouchableOpacity onPress={clearStartDateTime} style={styles.clearButton}>
                  <Text style={styles.clearButtonText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>End Date & Time</Text>
            <View style={styles.dateTimeRow}>
              <TouchableOpacity
                style={styles.dateTimeButton}
                onPress={() => setShowEndDatePicker(true)}
              >
                <Text style={styles.dateTimeText}>
                  {formData.end_datetime ? formatDateTime(formData.end_datetime) : 'Set end time'}
                </Text>
              </TouchableOpacity>
              {formData.end_datetime && (
                <TouchableOpacity onPress={clearEndDateTime} style={styles.clearButton}>
                  <Text style={styles.clearButtonText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* Settings */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>⚙️</Text>
            <View>
              <Text style={styles.sectionTitle}>Settings</Text>
              <Text style={styles.sectionSubtitle}>Visibility and status</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.switchRow}
            onPress={() => handleChange('is_active', !formData.is_active)}
          >
            <View>
              <Text style={styles.switchLabel}>Active</Text>
              <Text style={styles.switchDescription}>
                {formData.is_active ? 'Event is visible to users' : 'Event is hidden from users'}
              </Text>
            </View>
            <View style={[styles.switch, formData.is_active && styles.switchOn]}>
              <View style={[styles.switchThumb, formData.is_active && styles.switchThumbOn]} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchRow}
            onPress={() => handleChange('is_featured', !formData.is_featured)}
          >
            <View>
              <Text style={styles.switchLabel}>Featured</Text>
              <Text style={styles.switchDescription}>
                {formData.is_featured ? 'Highlighted for users' : 'Regular event listing'}
              </Text>
            </View>
            <View style={[styles.switch, formData.is_featured && styles.switchOn]}>
              <View style={[styles.switchThumb, formData.is_featured && styles.switchThumbOn]} />
            </View>
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Submit Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.submitButtonText}>
            {loading ? 'Saving...' : isEdit ? 'Update Event' : 'Create Event'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Location Picker Modal */}
      <Modal visible={showLocationPicker} animationType="slide" transparent={true}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Location</Text>
              <TouchableOpacity onPress={() => setShowLocationPicker(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalSearch}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search locations..."
                value={locationSearch}
                onChangeText={setLocationSearch}
                autoFocus
              />
            </View>

            <FlatList
              data={filteredNodes}
              keyExtractor={(item) => item.node_id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.locationItem}
                  onPress={() => handleLocationSelect(item)}
                >
                  <View>
                    <Text style={styles.locationItemName}>{item.name}</Text>
                    <Text style={styles.locationItemDetails}>
                      {item.building} • Floor {item.floor_level} • {item.node_code}
                    </Text>
                  </View>
                  <Text style={styles.locationItemIcon}>›</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No locations found</Text>
              }
            />
          </View>
        </View>
      </Modal>

      {/* Category Picker Modal */}
      <Modal visible={showCategoryPicker} animationType="fade" transparent={true}>
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, styles.categoryModal]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Category</Text>
              <TouchableOpacity onPress={() => setShowCategoryPicker(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={EVENT_CATEGORIES}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.categoryItem}
                  onPress={() => handleCategorySelect(item)}
                >
                  <Text style={styles.categoryItemText}>{item}</Text>
                  {formData.category === item && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Date/Time Pickers */}
      {Platform.OS === 'ios' ? (
        <>
          {/* iOS Date Pickers in Modal */}
          {showStartDatePicker && (
            <Modal visible={showStartDatePicker} animationType="slide" transparent={true}>
              <View style={styles.datePickerModalContainer}>
                <View style={styles.datePickerModal}>
                  <View style={styles.datePickerHeader}>
                    <TouchableOpacity onPress={() => setShowStartDatePicker(false)}>
                      <Text style={styles.datePickerDone}>Done</Text>
                    </TouchableOpacity>
                  </View>
                  <DateTimePicker
                    value={formData.start_datetime || new Date()}
                    mode="datetime"
                    display="spinner"
                    onChange={(event, date) => handleDateChange(event, date, 'start_datetime')}
                    minimumDate={new Date()}
                    textColor={THEME_COLORS.text}
                  />
                </View>
              </View>
            </Modal>
          )}

          {showEndDatePicker && (
            <Modal visible={showEndDatePicker} animationType="slide" transparent={true}>
              <View style={styles.datePickerModalContainer}>
                <View style={styles.datePickerModal}>
                  <View style={styles.datePickerHeader}>
                    <TouchableOpacity onPress={() => setShowEndDatePicker(false)}>
                      <Text style={styles.datePickerDone}>Done</Text>
                    </TouchableOpacity>
                  </View>
                  <DateTimePicker
                    value={formData.end_datetime || formData.start_datetime || new Date()}
                    mode="datetime"
                    display="spinner"
                    onChange={(event, date) => handleDateChange(event, date, 'end_datetime')}
                    minimumDate={formData.start_datetime || new Date()}
                    textColor={THEME_COLORS.text}
                  />
                </View>
              </View>
            </Modal>
          )}
        </>
      ) : (
        <>
          {/* Android Date Pickers - mode="date" only (datetime not supported) */}
          {showStartDatePicker && (
            <DateTimePicker
              value={formData.start_datetime || new Date()}
              mode="date"
              display="default"
              onChange={(event, date) => handleDateChange(event, date, 'start_datetime')}
              minimumDate={new Date()}
            />
          )}

          {showEndDatePicker && (
            <DateTimePicker
              value={formData.end_datetime || formData.start_datetime || new Date()}
              mode="date"
              display="default"
              onChange={(event, date) => handleDateChange(event, date, 'end_datetime')}
              minimumDate={formData.start_datetime || new Date()}
            />
          )}
        </>
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
    width: 70,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 70,
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginVertical: 10,
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: THEME_COLORS.text,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: THEME_COLORS.textSecondary,
    marginTop: 2,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME_COLORS.text,
    marginBottom: 8,
  },
  required: {
    color: THEME_COLORS.error,
  },
  input: {
    backgroundColor: THEME_COLORS.background,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 15,
  },
  picker: {
    backgroundColor: THEME_COLORS.background,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerText: {
    fontSize: 16,
    color: THEME_COLORS.text,
  },
  pickerPlaceholder: {
    fontSize: 16,
    color: THEME_COLORS.textSecondary,
  },
  pickerIcon: {
    fontSize: 12,
    color: THEME_COLORS.textSecondary,
  },
  locationPicker: {
    backgroundColor: THEME_COLORS.background,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  locationName: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME_COLORS.text,
    marginBottom: 4,
  },
  locationDetails: {
    fontSize: 13,
    color: THEME_COLORS.textSecondary,
  },
  locationPlaceholder: {
    fontSize: 16,
    color: THEME_COLORS.textSecondary,
  },
  dateTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateTimeButton: {
    flex: 1,
    backgroundColor: THEME_COLORS.background,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    padding: 15,
  },
  dateTimeText: {
    fontSize: 16,
    color: THEME_COLORS.text,
  },
  clearButton: {
    marginLeft: 10,
    width: 40,
    height: 48,
    backgroundColor: THEME_COLORS.error,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME_COLORS.text,
    marginBottom: 4,
  },
  switchDescription: {
    fontSize: 13,
    color: THEME_COLORS.textSecondary,
  },
  switch: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#CCCCCC',
    padding: 2,
    justifyContent: 'center',
  },
  switchOn: {
    backgroundColor: THEME_COLORS.primary,
  },
  switchThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
  },
  switchThumbOn: {
    alignSelf: 'flex-end',
  },
  footer: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  submitButton: {
    backgroundColor: THEME_COLORS.primary,
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  categoryModal: {
    maxHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: THEME_COLORS.text,
  },
  modalClose: {
    fontSize: 24,
    color: THEME_COLORS.textSecondary,
  },
  modalSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME_COLORS.background,
    margin: 15,
    paddingHorizontal: 15,
    borderRadius: 10,
  },
  searchIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  modalSearchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
  locationItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  locationItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME_COLORS.text,
    marginBottom: 4,
  },
  locationItemDetails: {
    fontSize: 13,
    color: THEME_COLORS.textSecondary,
  },
  locationItemIcon: {
    fontSize: 24,
    color: THEME_COLORS.textSecondary,
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  categoryItemText: {
    fontSize: 16,
    color: THEME_COLORS.text,
  },
  checkmark: {
    fontSize: 20,
    color: THEME_COLORS.primary,
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    padding: 40,
    fontSize: 16,
    color: THEME_COLORS.textSecondary,
  },
  datePickerModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  datePickerModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  datePickerDone: {
    fontSize: 17,
    fontWeight: '600',
    color: THEME_COLORS.primary,
  },
});

export default EventFormScreen;
