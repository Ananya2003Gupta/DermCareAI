import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
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
import DateTimePicker from '@react-native-community/datetimepicker';
import { NavigationProps, Patient, AppointmentStatus, Appointment } from '../../navigation/types';
import { collection, query, where, getDocs, addDoc, orderBy, doc, getDoc, updateDoc} from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import { format } from 'date-fns';

const NewAppointmentScreen: React.FC<NavigationProps<'NewAppointment'>> = ({
  navigation,
  route,
}) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(
    route?.params?.patient || null
  );
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [typeMenuVisible, setTypeMenuVisible] = useState(false);
  const [selectedTime, setSelectedTime] = useState('');
  const [formData, setFormData] = useState({
    type: 'consultation',
    notes: '',
    diagnosis: '',
    prescription: '',
    status: 'scheduled' as AppointmentStatus
  });

  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const patientsRef = collection(db, 'patients');
      const patientsQuery = query(patientsRef, where('doctorId', '==', userId));
      const patientsSnapshot = await getDocs(patientsQuery);
      const patientsData = patientsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Patient[];

      setPatients(patientsData);
    } catch (error) {
      console.error('Error fetching patients:', error);
    }
  };

  const handleSubmit = async () => {
    if (!selectedPatient || !selectedDate || !selectedTime) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const userId = auth.currentUser?.uid;
      if (!userId) throw new Error('User not authenticated');

      const appointmentDate = new Date(selectedDate);
      const [hours, minutes] = selectedTime.split(':');
      appointmentDate.setHours(parseInt(hours), parseInt(minutes), 0);

      const now = new Date().toISOString();

      const appointmentData: Omit<Appointment, 'id'> = {
        patientId: selectedPatient.id,
        patientName: selectedPatient.name,
        doctorId: userId,
        date: appointmentDate.toISOString(),
        time: selectedTime,
        type: formData.type,
        notes: formData.notes,
        diagnosis: formData.diagnosis || '',
        prescription: formData.prescription || '',
        status: 'scheduled',
        createdAt: now,
        updatedAt: now
      };

      await addDoc(collection(db, 'appointments'), appointmentData);

      const patientRef = doc(db, 'patients', selectedPatient.id);
      const patientSnapshot = await getDoc(patientRef);

      if (patientSnapshot.exists()) {
        const patientData = patientSnapshot.data();
        if (!patientData.upcomingVisit) {
          await updateDoc(patientRef, { upcomingVisit: appointmentDate.toISOString() });
        }
      }

      navigation.goBack();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredPatients = patients.filter(patient =>
    patient.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const timeSlots = Array.from({ length: 24 }, (_, i) => {
    const hour = i.toString().padStart(2, '0');
    return `${hour}:00`;
  });

  const onDateChange = (event: any, date?: Date) => {
    setShowDatePicker(false);
    if (date) {
      setSelectedDate(date);
    }
  };

  const checkExistingAppointments = async (selectedDate: Date) => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return [];

      const selectedDateStr = selectedDate.toISOString().split('T')[0];

      const appointmentsRef = collection(db, 'appointments');
      const appointmentsQuery = query(
        appointmentsRef,
        where('doctorId', '==', userId),
        orderBy('date', 'asc')
      );

      const snapshot = await getDocs(appointmentsQuery);
      return snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Appointment))
        .filter(apt => {
          const aptDateStr = new Date(apt.date).toISOString().split('T')[0];
          return aptDateStr === selectedDateStr;
        });
    } catch (error) {
      console.error('Error checking existing appointments:', error);
      return [];
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
          <Text style={styles.title}>Schedule New Appointment</Text>

          <Searchbar
            placeholder="Search patients"
            onChangeText={setSearchQuery}
            value={searchQuery}
            style={styles.searchBar}
          />

          <View style={styles.patientList}>
            {filteredPatients.map(patient => (
              <Button
                key={patient.id}
                mode={selectedPatient?.id === patient.id ? 'contained' : 'outlined'}
                onPress={() => setSelectedPatient(patient)}
                style={styles.patientButton}
              >
                {patient.name}
              </Button>
            ))}
          </View>

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
            Schedule Appointment
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
    marginBottom: 24,
    textAlign: 'center',
  },
  searchBar: {
    marginBottom: 16,
  },
  patientList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  patientButton: {
    marginRight: 8,
    marginBottom: 8,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    marginTop: 16,
  },
  timeSlots: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  timeButton: {
    marginRight: 8,
    marginBottom: 8,
  },
  segmentedButtons: {
    marginBottom: 16,
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

export default NewAppointmentScreen; 