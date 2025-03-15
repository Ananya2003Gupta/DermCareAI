import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  ListRenderItem,
} from 'react-native';
import {
  Text,
  Searchbar,
  Card,
  IconButton,
  FAB,
  useTheme,
  Portal,
  Dialog,
  Button,
  MD3Theme,
} from 'react-native-paper';
import { collection, query, where, getDocs, deleteDoc, doc, FirestoreError, QuerySnapshot, DocumentData, writeBatch, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { CompositeNavigationProp } from '@react-navigation/native';
import { RootStackParamList } from '../../navigation/types';

interface Patient {
  id: string;
  name: string;
  age: number;
  gender: string;
  upcomingVisit: string;
  condition: string;
  doctorId: string;
}

type TabParamList = {
  Dashboard: undefined;
  Patients: undefined;
  Appointments: undefined;
  Screening: undefined;
  Profile: undefined;
};

type PatientsScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'Patients'>,
  NativeStackNavigationProp<RootStackParamList>
>;

interface PatientsScreenProps {
  navigation: PatientsScreenNavigationProp;
}

const PatientsScreen: React.FC<PatientsScreenProps> = ({ navigation }) => {
  const theme = useTheme<MD3Theme>();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState<boolean>(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  const fetchPatients = async (): Promise<void> => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const patientsRef = collection(db, 'patients');
      const patientsQuery = query(patientsRef, where('doctorId', '==', userId));
      const patientsSnapshot: QuerySnapshot<DocumentData> = await getDocs(patientsQuery);
      const patientsData = patientsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Patient[];

      setPatients(patientsData);
    } catch (error) {
      const firestoreError = error as FirestoreError;
      console.error('Error fetching patients:', firestoreError.message);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  const onRefresh = async (): Promise<void> => {
    setRefreshing(true);
    await fetchPatients();
    setRefreshing(false);
  };

  const handleDeletePatient = async (): Promise<void> => {
    if (!selectedPatient) return;

      try {
        // Reference to the patient's appointments
        const appointmentsRef = collection(db, 'appointments');
        const appointmentsQuery = query(
          appointmentsRef,
          where('patientId', '==', selectedPatient.id)
        );
    
        const appointmentsSnapshot = await getDocs(appointmentsQuery);
        const batch = writeBatch(db);
    
        // Delete all appointments for the patient
        appointmentsSnapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });
    
        // Commit the batch deletion
        await batch.commit();
    
        // Mark the patient as deleted first (soft delete)
        const patientRef = doc(db, 'patients', selectedPatient.id);
        await updateDoc(patientRef, {
          deleted: true,
          deletedAt: new Date().toISOString(),
        });
      
      // Delete patient (hard delete)  
      await deleteDoc(patientRef);
      setPatients(prev => prev.filter(p => p.id !== selectedPatient.id));
      setDeleteDialogVisible(false);
      setSelectedPatient(null);

      } catch (error) {
        console.error('Error deleting patient and appointments:', error);
      }
    };

  const filteredPatients = patients.filter(patient =>
    patient.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderPatientCard: ListRenderItem<Patient> = ({ item }) => (
    <Card style={styles.patientCard} onPress={() => navigation.navigate('PatientDetails', { patient: item })}>
      <Card.Content>
        <View style={styles.patientHeader}>
          <View>
            <Text style={styles.patientName}>{item.name}</Text>
            <Text style={styles.patientInfo}>
              {item.age} years • {item.gender}
            </Text>
          </View>
          <IconButton
            icon="dots-vertical"
            size={20}
            onPress={() => {
              setSelectedPatient(item);
              setDeleteDialogVisible(true);
            }}
          />
        </View>
        <View style={styles.patientFooter}>
          <Text style={styles.upcomingVisit}>
            Upcoming Visit: {item.upcomingVisit ? new Date(item.upcomingVisit).toLocaleDateString() : "No Upcoming Visits"}
          </Text>
          <Text style={styles.condition}>{item.condition}</Text>
        </View>
      </Card.Content>
    </Card>
  );

  return (
    <View style={styles.container}>
      <Searchbar
        placeholder="Search patients"
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchBar}
      />

      <FlatList
        data={filteredPatients}
        renderItem={renderPatientCard}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />

      <Portal>
        <Dialog visible={deleteDialogVisible} onDismiss={() => setDeleteDialogVisible(false)}>
          <Dialog.Title>Delete Patient</Dialog.Title>
          <Dialog.Content>
            <Text>Are you sure you want to delete {selectedPatient?.name}?</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteDialogVisible(false)}>Cancel</Button>
            <Button onPress={handleDeletePatient} textColor={theme.colors.error}>
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => navigation.navigate('AddPatient')}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchBar: {
    margin: 16,
  },
  listContent: {
    padding: 16,
  },
  patientCard: {
    marginBottom: 12,
  },
  patientHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  patientName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  patientInfo: {
    fontSize: 14,
    opacity: 0.7,
    marginTop: 4,
  },
  patientFooter: {
    marginTop: 8,
  },
  upcomingVisit: {
    fontSize: 14,
    opacity: 0.7,
  },
  condition: {
    fontSize: 14,
    marginTop: 4,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
});

export default PatientsScreen; 