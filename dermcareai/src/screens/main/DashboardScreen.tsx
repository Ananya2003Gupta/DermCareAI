import React, { useEffect, useState } from 'react';
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
  Surface,
  IconButton,
  MD3Theme,
} from 'react-native-paper';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import { format, parseISO, isAfter } from 'date-fns';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, Appointment, AppointmentStatus } from '../../navigation/types';

type DashboardStats = {
  totalPatients: number;
  todayAppointments: number;
  pendingFollowUps: number;
};

// Add type for navigation
type DashboardScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const DashboardScreen = () => {
  const theme = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalPatients: 0,
    todayAppointments: 0,
    pendingFollowUps: 0,
  });
  const navigation = useNavigation<DashboardScreenNavigationProp>();

  const styles = makeStyles(theme);

  const getStatusColor = (status: AppointmentStatus): string => {
    switch (status) {
      case 'completed':
        return theme.colors.tertiary;
      case 'cancelled':
        return theme.colors.error;
      case 'no-show':
        return theme.colors.error;
      default:
        return theme.colors.primary;
    }
  };

  const getAppointmentTypeLabel = (type: string): string => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  const fetchDashboardData = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      // Get today's date range
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Fetch all appointments with single query structure
      const appointmentsRef = collection(db, 'appointments');
      const appointmentsQuery = query(
        appointmentsRef,
        where('doctorId', '==', userId),
        orderBy('date', 'asc')  // Single orderBy
      );

      const appointmentsSnapshot = await getDocs(appointmentsQuery);
      const allAppointments = appointmentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Appointment[];

      // Filter in memory for different needs
      const todayAppointments = allAppointments.filter(apt => {
        const aptDate = new Date(apt.date);
        return aptDate >= today && aptDate < tomorrow;
      });

      const pendingFollowUps = allAppointments.filter(apt => 
        apt.type === 'follow-up' && 
        apt.status === 'scheduled' &&
        new Date(apt.date) >= today
      );

      // Sort today's appointments by time
      const sortedTodayAppointments = todayAppointments.sort((a, b) => 
        a.time.localeCompare(b.time)
      );

      setAppointments(sortedTodayAppointments);

      // Get patients count
      const patientsRef = collection(db, 'patients');
      const patientsQuery = query(patientsRef, where('doctorId', '==', userId));
      const patientsSnapshot = await getDocs(patientsQuery);

      setStats({
        totalPatients: patientsSnapshot.size,
        todayAppointments: todayAppointments.length,
        pendingFollowUps: pendingFollowUps.length,
      });

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  };

  const handleAppointmentPress = (appointment: Appointment) => {
    navigation.navigate('AppointmentDetails', { appointment });
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Surface style={styles.header}>
        <Text style={styles.welcomeText}>Welcome, Doctor!</Text>
        <Text style={styles.dateText}>
          {format(new Date(), 'EEEE, MMMM d, yyyy')}
        </Text>
      </Surface>

      <View style={styles.statsContainer}>
        <Card style={styles.statsCard}>
          <Card.Content>
            <Text style={styles.statsNumber}>{stats.totalPatients}</Text>
            <Text style={styles.statsLabel}>Total Patients</Text>
          </Card.Content>
        </Card>

        <Card style={styles.statsCard}>
          <Card.Content>
            <Text style={styles.statsNumber}>{stats.todayAppointments}</Text>
            <Text style={styles.statsLabel}>Today's Appointments</Text>
          </Card.Content>
        </Card>

        <Card style={styles.statsCard}>
          <Card.Content>
            <Text style={styles.statsNumber}>{stats.pendingFollowUps}</Text>
            <Text style={styles.statsLabel}>Follow-ups</Text>
          </Card.Content>
        </Card>
      </View>

      <View style={styles.quickActions}>
        <Button
          mode="contained"
          icon="account-plus"
          style={styles.actionButton}
          contentStyle={styles.actionButtonContent}
          onPress={() => navigation.navigate('AddPatient')}
          labelStyle={styles.actionButtonLabel}
        >
          Add Patient
        </Button>
      </View>
      <View style={styles.quickActions}>
        <Button
          mode="contained"
          icon="calendar-plus"
          style={styles.actionButton}
          contentStyle={styles.actionButtonContent}
          onPress={() => navigation.navigate('NewAppointment')}
          labelStyle={styles.actionButtonLabel}
        >
          New Appointment
        </Button>
      </View>

      <View style={styles.appointmentsSection}>
        <Text style={styles.sectionTitle}>Upcoming Appointments Today</Text>
        {appointments.length === 0 ? (
          <Text style={styles.noAppointments}>No more appointments for today</Text>
        ) : (
          appointments.map(appointment => (
            <Card
              key={appointment.id}
              style={styles.appointmentCard}
              onPress={() => handleAppointmentPress(appointment)}
            >
              <Card.Content>
                <View style={styles.appointmentHeader}>
                  <View>
                    <Text style={styles.patientName}>
                      {appointment.patientName}
                    </Text>
                    <Text style={styles.appointmentType}>
                      {getAppointmentTypeLabel(appointment.type)}
                    </Text>
                  </View>
                  <IconButton
                    icon="chevron-right"
                    size={24}
                    iconColor={theme.colors.primary}
                  />
                </View>
                <View style={styles.appointmentFooter}>
                  <Text style={styles.appointmentTime}>
                    {appointment.time}
                  </Text>
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
          ))
        )}
      </View>
    </ScrollView>
  );
};

const makeStyles = (theme: MD3Theme) => StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    elevation: 4,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  dateText: {
    fontSize: 16,
    opacity: 0.7,
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
  },
  statsCard: {
    flex: 1,
    marginHorizontal: 4,
  },
  statsNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  statsLabel: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.7,
  },
  quickActions: {
    padding: 16,
    paddingTop: 0,
  },
  actionButton: {
    width: '100%',
  },
  actionButtonContent: {
    height: 56,
  },
  actionButtonLabel: {
    fontSize: 16,
    textAlign: 'center',
  },
  appointmentsSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  appointmentCard: {
    marginBottom: 12,
    elevation: 2,
  },
  appointmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  patientName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  appointmentType: {
    fontSize: 14,
    opacity: 0.7,
    marginTop: 2,
    color: theme.colors.primary,
  },
  appointmentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  appointmentTime: {
    fontSize: 14,
    opacity: 0.7,
  },
  status: {
    fontSize: 14,
    fontWeight: '500',
  },
  noAppointments: {
    textAlign: 'center',
    opacity: 0.7,
    marginTop: 20,
  },
});

export default DashboardScreen; 