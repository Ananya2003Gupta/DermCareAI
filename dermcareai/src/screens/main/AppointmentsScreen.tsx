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
  FAB,
  Portal,
  Dialog,
  IconButton,
} from 'react-native-paper';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { collection, query, where, getDocs, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import { Calendar } from 'react-native-calendars';
import { format, isSameDay } from 'date-fns';
import { Appointment, AppointmentStatus } from '../../navigation/types';

type AppointmentsScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

const AppointmentsScreen: React.FC<AppointmentsScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);

  const fetchAppointments = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const appointmentsRef = collection(db, 'appointments');
      const appointmentsQuery = query(
        appointmentsRef,
        where('doctorId', '==', userId),
        orderBy('date', 'asc')
      );

      const appointmentsSnapshot = await getDocs(appointmentsQuery);
      const allAppointments = appointmentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Appointment[];

      // Filter future appointments in memory
      const futureAppointments = allAppointments.filter(apt => 
        new Date(apt.date) >= new Date()
      );

      setAppointments(futureAppointments);
    } catch (error) {
      console.error('Error fetching appointments:', error);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAppointments();
    setRefreshing(false);
  };

  const handleDeleteAppointment = async () => {
    if (!selectedAppointment) return;

    try {
      await deleteDoc(doc(db, 'appointments', selectedAppointment.id));
      setAppointments(appointments.filter(a => a.id !== selectedAppointment.id));
      setDeleteDialogVisible(false);
      setSelectedAppointment(null);
    } catch (error) {
      console.error('Error deleting appointment:', error);
    }
  };

  const filteredAppointments = appointments.filter(appointment =>
    isSameDay(new Date(appointment.date), selectedDate)
  );

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

  const getMarkedDates = () => {
    const marked: any = {};
    appointments.forEach(appointment => {
      const dateStr = format(new Date(appointment.date), 'yyyy-MM-dd');
      marked[dateStr] = {
        marked: true,
        dotColor: theme.colors.primary,
        selected: selectedDate && isSameDay(new Date(appointment.date), selectedDate),
        selectedColor: theme.colors.primaryContainer,
      };
    });
    
    if (selectedDate) {
      const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
      if (!marked[selectedDateStr]) {
        marked[selectedDateStr] = {
          selected: true,
          selectedColor: theme.colors.primaryContainer,
        };
      }
    }
    
    return marked;
  };

  const renderAppointmentCard = (appointment: Appointment) => (
    <Card 
      key={appointment.id} 
      style={styles.appointmentCard}
      onPress={() => navigation.navigate('AppointmentDetails', { appointment })}
    >
      <Card.Content>
        <View style={styles.appointmentHeader}>
          <View>
            <Text style={styles.patientName}>{appointment.patientName}</Text>
            <Text style={styles.appointmentTime}>
              {format(new Date(appointment.date), 'h:mm a')}
            </Text>
          </View>
          <IconButton
            icon="chevron-right"
            size={20}
            onPress={() => navigation.navigate('AppointmentDetails', { appointment })}
          />
        </View>
        <View style={styles.appointmentFooter}>
          <Text style={styles.appointmentType}>{appointment.type}</Text>
          <Text
            style={[
              styles.status,
              { color: getStatusColor(appointment.status) },
            ]}
          >
            {appointment.status.toUpperCase()}
          </Text>
        </View>
      </Card.Content>
    </Card>
  );

  return (
    <View style={styles.container}>
      <Calendar
        style={styles.calendar}
        theme={{
          backgroundColor: theme.colors.surface,
          calendarBackground: theme.colors.surface,
          textSectionTitleColor: theme.colors.onSurface,
          selectedDayBackgroundColor: theme.colors.primary,
          selectedDayTextColor: theme.colors.onPrimary,
          todayTextColor: theme.colors.primary,
          dayTextColor: theme.colors.onSurface,
          textDisabledColor: theme.colors.outline,
          dotColor: theme.colors.primary,
          selectedDotColor: theme.colors.onPrimary,
          arrowColor: theme.colors.primary,
          monthTextColor: theme.colors.onSurface,
          textMonthFontSize: 16,
          textDayFontSize: 14,
          textDayHeaderFontSize: 14
        }}
        current={format(selectedDate, 'yyyy-MM-dd')}
        minDate={format(new Date(), 'yyyy-MM-dd')}
        maxDate={format(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')}
        onDayPress={(day: any) => setSelectedDate(new Date(day.dateString))} 
        markedDates={getMarkedDates()}
        enableSwipeMonths={true}
      />

      <ScrollView
        style={styles.appointmentsList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {filteredAppointments.length === 0 ? (
          <Text style={styles.noAppointments}>
            No appointments for {format(selectedDate, 'MMMM d, yyyy')}
          </Text>
        ) : (
          filteredAppointments.map(renderAppointmentCard)
        )}
      </ScrollView>

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

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => navigation.navigate('NewAppointment')}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  appointmentsList: {
    flex: 1,
  },
  appointmentCard: {
    margin: 16,
    marginTop: 0,
    elevation: 2,
  },
  appointmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  patientName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  appointmentTime: {
    fontSize: 14,
    opacity: 0.7,
    marginTop: 4,
  },
  appointmentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  appointmentType: {
    fontSize: 14,
    opacity: 0.7,
  },
  status: {
    fontSize: 14,
    fontWeight: '500',
  },
  noAppointments: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
    marginTop: 20,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
  calendar: {
    marginBottom: 10,
    borderRadius: 10,
    elevation: 4,
    margin: 16,
  },
});

export default AppointmentsScreen; 