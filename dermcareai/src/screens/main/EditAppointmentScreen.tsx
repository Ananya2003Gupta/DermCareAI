import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  TextInput,
  Button,
  Text,
  Surface,
  useTheme,
  SegmentedButtons,
  Searchbar,
  List,
  Menu,
} from 'react-native-paper';
import { NavigationProps, Appointment, AppointmentStatus } from '../../navigation/types';
import { doc, updateDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';

const EditAppointmentScreen: React.FC<NavigationProps<'EditAppointment'>> = ({
  navigation,
  route,
}) => {
  const theme = useTheme();
  const { appointment: initialAppointment } = route.params;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date>(
    new Date(initialAppointment.date)
  );
  const [selectedTime, setSelectedTime] = useState(initialAppointment.time);
  const [formData, setFormData] = useState({
    type: initialAppointment.type,
    notes: initialAppointment.notes || '',
    diagnosis: initialAppointment.diagnosis || '',
    prescription: initialAppointment.prescription || '',
    status: initialAppointment.status as AppointmentStatus
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [statusMenuVisible, setStatusMenuVisible] = useState(false);
  const [typeMenuVisible, setTypeMenuVisible] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [upcomingAppointments, setUpcomingAppointments] = useState<Appointment[]>([]);


  const fetchUpcomingAppointments = async (): Promise<Appointment[]> => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return [];

      const appointmentsRef = collection(db, 'appointments');
      const appointmentsQuery = query(
        appointmentsRef,
        where('doctorId', '==', userId),
        orderBy('date', 'asc')
      );

      const snapshot = await getDocs(appointmentsQuery);
      const allAppointments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Appointment[];

      const upcomingAppointments = allAppointments.filter(apt =>
        apt.patientId === initialAppointment.patientId &&
        new Date(apt.date) >= new Date() &&
        apt.status === 'scheduled'
      );
      
      setUpcomingAppointments(upcomingAppointments);
      return upcomingAppointments;
    } catch (error) {
      console.error('Error fetching appointments:', error);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedDate || !selectedTime) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const appointmentDate = new Date(selectedDate);
      const [hours, minutes] = selectedTime.split(':');
      appointmentDate.setHours(parseInt(hours), parseInt(minutes), 0);

      const updateData: Partial<Appointment> = {
        date: appointmentDate.toISOString(),
        time: selectedTime,
        type: formData.type,
        notes: formData.notes,
        diagnosis: formData.diagnosis,
        prescription: formData.prescription,
        status: formData.status,
        updatedAt: new Date().toISOString()
      };

      await updateDoc(doc(db, 'appointments', initialAppointment.id), updateData);

      if (formData.status === 'completed' && initialAppointment.status !== 'completed') {
        // Fetch the upcoming appointments first
        const upcomingAppts = await fetchUpcomingAppointments();
        
        // Find the next appointment (first in the array since they're ordered by date ascending)
        const nextAppointment = upcomingAppts.length > 0 ? upcomingAppts[0] : null;
        
        // Update the patient record with the next appointment date or null if none exists
        await updateDoc(doc(db, 'patients', initialAppointment.patientId), {
          upcomingVisit: nextAppointment ? nextAppointment.date : null,
          updatedAt: new Date().toISOString(),
        });
      }

      navigation.goBack();
    } catch (err) {
      console.error('Error updating appointment:', err);
      setError('Failed to update appointment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleTimeChange = (event: any, selectedTime: Date | undefined) => {
    setShowTimePicker(false);
    if (selectedTime) {
      const hours = selectedTime.getHours().toString().padStart(2, '0');
      const minutes = selectedTime.getMinutes().toString().padStart(2, '0');
      setSelectedTime(`${hours}:${minutes}`);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Surface style={styles.surface}>
          <Text style={styles.title}>Edit Appointment</Text>
          <Text style={styles.subtitle}>
            Patient: {initialAppointment.patientName}
          </Text>

          <Text style={styles.label}>Appointment Status</Text>
          <Menu
            visible={statusMenuVisible}
            onDismiss={() => setStatusMenuVisible(false)}
            anchor={
              <Button
                mode="outlined"
                onPress={() => setStatusMenuVisible(true)}
                style={styles.statusButton}
              >
                {formData.status.charAt(0).toUpperCase() + formData.status.slice(1)}
              </Button>
            }
          >
            <Menu.Item
              onPress={() => {
                setFormData({ ...formData, status: 'scheduled' });
                setStatusMenuVisible(false);
              }}
              title="Scheduled"
            />
            <Menu.Item
              onPress={() => {
                setFormData({ ...formData, status: 'completed' });
                setStatusMenuVisible(false);
              }}
              title="Completed"
            />
            <Menu.Item
              onPress={() => {
                setFormData({ ...formData, status: 'cancelled' });
                setStatusMenuVisible(false);
              }}
              title="Cancelled"
            />
            <Menu.Item
              onPress={() => {
                setFormData({ ...formData, status: 'no-show' });
                setStatusMenuVisible(false);
              }}
              title="No Show"
            />
          </Menu>

          <Text style={styles.label}>Select Date</Text>
          <Button
            mode="outlined"
            onPress={() => setShowDatePicker(true)}
            style={styles.dateButton}
          >
            {format(selectedDate, 'MMMM d, yyyy')}
          </Button>

          {showDatePicker && (
            <DateTimePicker
              value={selectedDate}
              mode="date"
              display="default"
              onChange={(event, date) => {
                setShowDatePicker(false);
                if (date) {
                  setSelectedDate(date);
                }
              }}
              minimumDate={new Date()}
            />
          )}

          <Text style={styles.label}>Select Time</Text>
          <Button
            mode="outlined"
            onPress={() => setShowTimePicker(true)}
            style={styles.dateButton}
          >
            {selectedTime}
          </Button>

          {showTimePicker && (
            <DateTimePicker
              value={(() => {
                const [hours, minutes] = selectedTime.split(':');
                const date = new Date();
                date.setHours(parseInt(hours), parseInt(minutes), 0);
                return date;
              })()}
              mode="time"
              is24Hour={true}
              display="default"
              onChange={handleTimeChange}
            />
          )}

          <Text style={styles.label}>Appointment Type</Text>
          <Menu
            visible={typeMenuVisible}
            onDismiss={() => setTypeMenuVisible(false)}
            anchor={
              <Button
                mode="outlined"
                onPress={() => setTypeMenuVisible(true)}
                style={styles.statusButton}
              >
                {formData.type.charAt(0).toUpperCase() + formData.type.slice(1)}
              </Button>
            }
          >
            <Menu.Item
              onPress={() => {
                setFormData({ ...formData, type: 'consultation' });
                setTypeMenuVisible(false);
              }}
              title="Consultation"
            />
            <Menu.Item
              onPress={() => {
                setFormData({ ...formData, type: 'follow-up' });
                setTypeMenuVisible(false);
              }}
              title="Follow-up"
            />
            <Menu.Item
              onPress={() => {
                setFormData({ ...formData, type: 'procedure' });
                setTypeMenuVisible(false);
              }}
              title="Procedure"
            />
          </Menu>

          <TextInput
            label="Diagnosis"
            value={formData.diagnosis}
            onChangeText={text => setFormData({ ...formData, diagnosis: text })}
            mode="outlined"
            style={styles.input}
            multiline
            numberOfLines={3}
          />

          <TextInput
            label="Prescription"
            value={formData.prescription}
            onChangeText={text => setFormData({ ...formData, prescription: text })}
            mode="outlined"
            style={styles.input}
            multiline
            numberOfLines={3}
          />

          <TextInput
            label="Notes"
            value={formData.notes}
            onChangeText={text => setFormData({ ...formData, notes: text })}
            mode="outlined"
            style={styles.input}
            multiline
            numberOfLines={3}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            mode="contained"
            onPress={handleSubmit}
            style={styles.button}
            loading={loading}
            disabled={loading}
          >
            Save Changes
          </Button>
        </Surface>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  surface: {
    padding: 16,
    borderRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
    marginBottom: 24,
    textAlign: 'center',
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    marginBottom: 16,
  },
  button: {
    marginTop: 8,
    paddingVertical: 8,
  },
  error: {
    color: 'red',
    marginBottom: 16,
    textAlign: 'center',
  },
  dateButton: {
    marginBottom: 16,
  },
  statusButton: {
    marginBottom: 16,
    width: '100%',
  },
});

export default EditAppointmentScreen; 