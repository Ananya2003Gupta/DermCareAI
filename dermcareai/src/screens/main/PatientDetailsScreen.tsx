import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import {
  Text,
  Card,
  Button,
  useTheme,
  IconButton,
  Portal,
  Dialog,
  List,
  Divider,
} from 'react-native-paper';
import { NavigationProps, Patient, Appointment, ScreeningReport } from '../../navigation/types';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, orderBy, writeBatch, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import { format } from 'date-fns';

interface ScreeningSection {
  screenings: ScreeningReport[];
  loading: boolean;
}

const PatientDetailsScreen: React.FC<NavigationProps<'PatientDetails'>> = ({
  navigation,
  route,
}) => {
  const theme = useTheme();
  const { patient: initialPatient } = route.params;
  const [patient, setPatient] = useState<Patient>(initialPatient);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [screeningSection, setScreeningSection] = useState<ScreeningSection>({
    screenings: [],
    loading: true
  });

  const fetchPatientData = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      // Fetch updated patient data
      const patientDoc = await getDoc(doc(db, 'patients', patient.id));
      if (patientDoc.exists()) {
        setPatient({ id: patientDoc.id, ...patientDoc.data() } as Patient);
      }

      // Fetch patient appointments
      const appointmentsRef = collection(db, 'appointments');
      const appointmentsQuery = query(
        appointmentsRef,
        where('patientId', '==', patient.id),
        where('doctorId', '==', userId)
      );
      const appointmentsSnapshot = await getDocs(appointmentsQuery);
      const appointmentsData = appointmentsSnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }) as Appointment)
        .sort((a, b) => {
          const aDate = new Date(a.date).getTime();
          const bDate = new Date(b.date).getTime();
          const now = Date.now();
          
          // If both dates are in the future or both are in the past, sort by date
          if ((aDate > now && bDate > now) || (aDate <= now && bDate <= now)) {
            return aDate - bDate; // ascending order
          }
          // If one is in the future and one is in the past, show future first
          return aDate > now ? -1 : 1;
        });

      setAppointments(appointmentsData);
    } catch (error) {
      console.error('Error fetching patient data:', error);
    }
  };

  const fetchScreenings = async () => {
    try {
      const screeningsRef = collection(db, 'screeningReports');
      const screeningsQuery = query(
        screeningsRef,
        where('patientId', '==', patient.id),
        orderBy('date', 'desc')
      );
      
      const screeningsSnapshot = await getDocs(screeningsQuery);
      const screeningsData = screeningsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as ScreeningReport[];

      setScreeningSection({
        screenings: screeningsData,
        loading: false,
      });
    } catch (error) {
      console.error('Error fetching screenings:', error);
      setScreeningSection(prev => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    fetchPatientData();
    fetchScreenings();
  }, [patient.id]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchScreenings();
      fetchPatientData();
    });

    return unsubscribe;
  }, [navigation]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPatientData();
    setRefreshing(false);
  };

  const handleDeletePatient = async () => {
    try {
      // Reference to the patient's appointments
      const appointmentsRef = collection(db, 'appointments');
      const appointmentsQuery = query(
        appointmentsRef,
        where('patientId', '==', patient.id)
      );
  
      const appointmentsSnapshot = await getDocs(appointmentsQuery);
      const batch = writeBatch(db);
  
      // Delete all appointments for the patient
      appointmentsSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
  
      // Commit the batch deletion
      await batch.commit();
  
      // Mark the patient as deleted (soft delete)
      const patientRef = doc(db, 'patients', patient.id);
      await updateDoc(patientRef, {
        deleted: true,
        deletedAt: new Date().toISOString(),
      });

      // Delete patient (hard delete)
      await deleteDoc(patientRef);

      // Navigate back after deletion
      navigation.goBack();
    } catch (error) {
      console.error('Error deleting patient and appointments:', error);
    }
  };  

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.header}>
            <View>
              <Text style={styles.name}>{patient.name}</Text>
              <Text style={styles.info}>
                {patient.age} years • {patient.gender}
              </Text>
            </View>
            <IconButton
              icon="dots-vertical"
              size={20}
              onPress={() => setDeleteDialogVisible(true)}
            />
          </View>

          <Divider style={styles.divider} />

          <List.Section>
            <List.Subheader>Contact Information</List.Subheader>
            <List.Item
              title="Phone"
              description={patient.phone || 'Not provided'}
              left={props => <List.Icon {...props} icon="phone" />}
            />
            <List.Item
              title="Email"
              description={patient.email || 'Not provided'}
              left={props => <List.Icon {...props} icon="email" />}
            />
            <List.Item
              title="Address"
              description={patient.address || 'Not provided'}
              left={props => <List.Icon {...props} icon="map-marker" />}
            />
          </List.Section>

          <Divider style={styles.divider} />

          <List.Section>
            <List.Subheader>Medical Information</List.Subheader>
            <List.Item
              title="Medical History"
              description={patient.medicalHistory || 'No medical history'}
              left={props => <List.Icon {...props} icon="medical-bag" />}
            />
            <List.Item
              title="Allergies"
              description={patient.allergies || 'No allergies'}
              left={props => <List.Icon {...props} icon="alert-circle" />}
            />
            <List.Item
              title="Current Medications"
              description={patient.currentMedications || 'No medications'}
              left={props => <List.Icon {...props} icon="pill" />}
            />
          </List.Section>

          <Divider style={styles.divider} />

          <List.Section>
            <List.Subheader>Appointments</List.Subheader>
            {appointments.length === 0 ? (
              <Text style={styles.noAppointments}>No appointments found</Text>
            ) : (
              appointments.map(appointment => (
                <List.Item
                  key={appointment.id}
                  title={format(new Date(appointment.date), 'MMM d, yyyy')}
                  description={appointment.diagnosis}
                  left={props => <List.Icon {...props} icon="calendar" />}
                  onPress={() => navigation.navigate('AppointmentDetails', { appointment })}
                />
              ))
            )}
          </List.Section>
        </Card.Content>
      </Card>

      <Card style={styles.section}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Skin Screenings</Text>
          {screeningSection.loading ? (
            <ActivityIndicator />
          ) : screeningSection.screenings.length > 0 ? (
            screeningSection.screenings.map((screening: ScreeningReport) => (
              <Card key={screening.id} style={styles.screeningCard}>
                <Card.Content>
                  <Text style={styles.date}>
                    {format(new Date(screening.date), 'MMMM d, yyyy')}
                  </Text>
                  <Text>Condition: {screening.condition}</Text>
                  <Text>Confidence: {(screening.confidence * 100).toFixed(1)}%</Text>
                  <Button
                    mode="contained"
                    onPress={() => navigation.navigate('ScreeningReport', { report: screening })}
                    style={styles.viewButton}
                  >
                    View Report
                  </Button>
                </Card.Content>
              </Card>
            ))
          ) : (
            <Text>No screenings recorded</Text>
          )}
        </Card.Content>
      </Card>

      <View style={styles.actionButtonsContainer}>
        <Button
          mode="contained"
          onPress={() => navigation.navigate('NewAppointment', { patient })}
          style={styles.actionButton}
        >
          New Appointment
        </Button>
        <Button
          mode="contained"
          onPress={() => navigation.navigate('EditPatient', { patient })}
          style={styles.actionButton}
        >
          Edit Patient
        </Button>
      </View>

      <Portal>
        <Dialog visible={deleteDialogVisible} onDismiss={() => setDeleteDialogVisible(false)}>
          <Dialog.Title>Delete Patient</Dialog.Title>
          <Dialog.Content>
            <Text>Are you sure you want to delete {patient.name}?</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteDialogVisible(false)}>Cancel</Button>
            <Button onPress={handleDeletePatient} textColor={theme.colors.error}>
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  card: {
    margin: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  info: {
    fontSize: 16,
    opacity: 0.7,
    marginTop: 4,
  },
  divider: {
    marginVertical: 16,
  },
  noAppointments: {
    textAlign: 'center',
    opacity: 0.7,
    marginTop: 8,
  },
  actionButtonsContainer: {
    padding: 16,
    gap: 12,
  },
  actionButton: {
    width: '90%',
    alignSelf: 'center',
  },
  section: {
    margin: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  screeningCard: {
    marginBottom: 8,
  },
  date: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  viewButton: {
    marginTop: 8,
  },
});

export default PatientDetailsScreen; 