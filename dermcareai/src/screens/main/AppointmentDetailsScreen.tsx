import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
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
import { NavigationProps } from '../../navigation/types';
import { doc, getDoc, updateDoc, deleteDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import { format } from 'date-fns';
import { Appointment as AppointmentType, AppointmentStatus } from '../../navigation/types';

type Appointment = AppointmentType;

const AppointmentDetailsScreen: React.FC<NavigationProps<'AppointmentDetails'>> = ({
  navigation,
  route,
}) => {
  const theme = useTheme();
  const { appointment: initialAppointment } = route.params;
  const [appointment, setAppointment] = useState<AppointmentType>(initialAppointment);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [loading, setLoading] = useState(false);

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
        return upcomingAppointments;
      } catch (error) {
        console.error('Error fetching appointments:', error);
        return [];
      } finally {
        setLoading(false);
      }
    };

  const fetchAppointmentData = async () => {
    try {
      const appointmentDoc = await getDoc(doc(db, 'appointments', appointment.id));
      if (appointmentDoc.exists()) {
        setAppointment({ id: appointmentDoc.id, ...appointmentDoc.data() } as AppointmentType);
      }
    } catch (error) {
      console.error('Error fetching appointment data:', error);
    }
  };

  useEffect(() => {
    fetchAppointmentData();
  }, [appointment.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAppointmentData();
    setRefreshing(false);
  };

  const handleDeleteAppointment = async () => {
    try {
      await deleteDoc(doc(db, 'appointments', appointment.id));
      navigation.goBack();
    } catch (error) {
      console.error('Error deleting appointment:', error);
    }
  };

  const handleStatusChange = async (newStatus: AppointmentStatus) => {
    try {
      // Update appointment status
      await updateDoc(doc(db, 'appointments', appointment.id), {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      });

      // If appointment is completed, update patient's upcoming visit
      if (newStatus === 'completed') {
        // Fetch the upcoming appointments first
        const upcomingAppts = await fetchUpcomingAppointments();
        // Find the next appointment (first in the array since they're ordered by date ascending)
        const nextAppointment = upcomingAppts.length > 0 ? upcomingAppts[0] : null;

        await updateDoc(doc(db, 'patients', appointment.patientId), {
          upcomingVisit: nextAppointment ? nextAppointment.date : null,
          updatedAt: new Date().toISOString(),
        });
      }

      setAppointment({ ...appointment, status: newStatus });
    } catch (error) {
      console.error('Error updating appointment status:', error);
    }
  };

  const getStatusColor = (status: AppointmentStatus) => {
    switch (status) {
      case 'completed':
        return theme.colors.primary;
      case 'cancelled':
        return theme.colors.error;
      case 'no-show':
        return theme.colors.error;
      default:
        return theme.colors.primary;
    }
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
    patientName: {
      fontSize: 24,
      fontWeight: 'bold',
    },
    dateTime: {
      fontSize: 16,
      opacity: 0.7,
      marginTop: 4,
    },
    divider: {
      marginVertical: 16,
    },
    appointmentActionsContainer: {
      padding: 16,
      gap: 12,
    },
    actionButton: {
      width: '90%',
      alignSelf: 'center',
    },
    cancelButton: {
      backgroundColor: theme.colors.errorContainer,
    },
    status: {
      fontWeight: 'bold',
    },
  });

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
              <Text style={styles.patientName}>{appointment.patientName}</Text>
              <Text style={styles.dateTime}>
                {format(new Date(appointment.date), 'EEEE, MMMM d, yyyy')} at{' '}
                {appointment.time}
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
            <List.Subheader>Appointment Details</List.Subheader>
            <List.Item
              title="Type"
              description={appointment.type}
              left={props => <List.Icon {...props} icon="calendar" />}
            />
            <List.Item
              title="Status"
              description={
                <Text style={[styles.status, { color: getStatusColor(appointment.status as AppointmentStatus) }]}>
                  {appointment.status.toUpperCase()}
                </Text>
              }
              left={props => <List.Icon {...props} icon="information" />}
            />
          </List.Section>

          <Divider style={styles.divider} />

          <List.Section>
            <List.Subheader>Medical Information</List.Subheader>
            <List.Item
              title="Diagnosis"
              description={appointment.diagnosis || 'Not provided'}
              left={props => <List.Icon {...props} icon="medical-bag" />}
            />
            <List.Item
              title="Prescription"
              description={appointment.prescription || 'Not provided'}
              left={props => <List.Icon {...props} icon="pill" />}
            />
            <List.Item
              title="Notes"
              description={appointment.notes || 'No notes'}
              left={props => <List.Icon {...props} icon="note-text" />}
            />
          </List.Section>
        </Card.Content>
      </Card>

      <View style={styles.appointmentActionsContainer}>
        <Button
          mode="contained"
          onPress={() => handleStatusChange('completed')}
          style={styles.actionButton}
        >
          Mark as Complete
        </Button>
        <Button
          mode="contained"
          onPress={() => handleStatusChange('cancelled')}
          style={styles.actionButton}
        >
          Cancel Appointment
        </Button>
        <Button
          mode="contained"
          onPress={() => navigation.navigate('EditAppointment', { appointment })}
          style={styles.actionButton}
        >
          Edit Appointment
        </Button>
      </View>

      <Portal>
        <Dialog visible={deleteDialogVisible} onDismiss={() => setDeleteDialogVisible(false)}>
          <Dialog.Title>Delete Appointment</Dialog.Title>
          <Dialog.Content>
            <Text>Are you sure you want to delete this appointment?</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteDialogVisible(false)}>Cancel</Button>
            <Button onPress={handleDeleteAppointment} textColor={theme.colors.error}>
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
};

export default AppointmentDetailsScreen; 