import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  Platform,
} from 'react-native';
import {
  Text,
  Button,
  Surface,
  useTheme,
  IconButton,
  Card,
  ActivityIndicator,
  Searchbar,
  MD3Theme,
} from 'react-native-paper';
import { NavigationProps, Patient, ScreeningReport, Appointment } from '../../navigation/types';
import * as ImagePicker from 'expo-image-picker';
import { Camera, PermissionResponse } from 'expo-camera';
import { api } from '../../services/api';
import { uploadImage } from '../../config/cloudinary';
import { collection, query, where, getDocs, addDoc, FirestoreError, QuerySnapshot, DocumentData, orderBy, limit } from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import { format } from 'date-fns';
import { useIsFocused } from '@react-navigation/native';

interface AnalysisResult {
  condition: string;
  confidence: number;
  model: string;
  recommendations: string[];
  imageUrl: string;
}

interface ApiResponse {
  class_name: string;
  confidence: number;
  model_used: string;
  visualization: string;
}

const ScreeningScreen: React.FC<NavigationProps<'Screening'>> = ({ navigation, route }) => {
  const isFocused = useIsFocused();
  const theme = useTheme<MD3Theme>();
  const [image, setImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(
    route?.params?.patient || null
  );
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [doctorNotes, setDoctorNotes] = useState<string>('');
  const [upcomingAppointment, setUpcomingAppointment] = useState<Appointment | null>(null);

  useEffect(() => {
    fetchPatients();
  }, []);

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

  const requestPermissions = async (): Promise<boolean> => {
    if (Platform.OS !== 'web') {
      const mediaLibraryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (mediaLibraryPermission.status !== 'granted') {
        alert('Sorry, we need camera roll permissions to make this work!');
        return false;
      }
      const cameraPermission: PermissionResponse = await Camera.requestCameraPermissionsAsync();
      if (cameraPermission.status !== 'granted') {
        alert('Sorry, we need camera permissions to make this work!');
        return false;
      }
    }
    return true;
  };

  const takePhoto = async (): Promise<void> => {
    if (!selectedPatient) {
      alert('Please select a patient first');
      return;
    }

    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });

      if (!result.canceled) {
        setImage(result.assets[0].uri);
        await analyzeImage(result.assets[0].uri);
      }
    } catch (error) {
      const pickerError = error as Error;
      console.error('Error taking photo:', pickerError.message);
      alert('Error taking photo. Please try again.');
    }
  };

  const pickImage = async (): Promise<void> => {
    if (!selectedPatient) {
      alert('Please select a patient first');
      return;
    }

    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });

      if (!result.canceled) {
        setImage(result.assets[0].uri);
        await analyzeImage(result.assets[0].uri);
      }
    } catch (error) {
      const pickerError = error as Error;
      console.error('Error picking image:', pickerError.message);
      alert('Error selecting image. Please try again.');
    }
  };

  const generateImageName = (patientId: string): string => {
    const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
    return `${patientId}_${timestamp}`;
  };

  const resetScreeningState = () => {
    setImage(null);
    setProcessedImage(null);
    setResult(null);
    setDoctorNotes('');
    setSelectedPatient(null);
    setUpcomingAppointment(null);
    setSearchQuery('');
  };

  useEffect(() => {
    if (isFocused && route.params?.patient) {
      handlePatientSelect(route.params.patient);
    } else if (!isFocused) {
      resetScreeningState();
    }
  }, [isFocused, route.params?.patient]);

  const analyzeImage = async (imageUri: string): Promise<void> => {
    if (!imageUri) {
      console.error('No image URI provided');
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      console.log('Analyzing image with URI:', imageUri);
      const result = await api.analyzeSkinImage(imageUri);

      if (!result || !result.visualization) {
        throw new Error('Invalid response from analysis API');
      }

      const processedImageUrl = `data:image/png;base64,${result.visualization}`;
      setProcessedImage(processedImageUrl);

      if (!result.class_name) {
        throw new Error('No condition detected in the image');
      }

      const recommendations = api.getRecommendations(result.class_name);

      const analysisResult: AnalysisResult = {
        condition: result.class_name,
        confidence: result.confidence,
        model: result.model_used,
        recommendations,
        imageUrl: imageUri
      };

      setResult(analysisResult);

      // Save the screening report
      const userId = auth.currentUser?.uid;
      if (!userId) throw new Error('User not authenticated');

      const reportData: Omit<ScreeningReport, 'id'> = {
        patientId: selectedPatient?.id || '',
        patientName: selectedPatient?.name || '',
        date: new Date().toISOString(),
        imageUrl: imageUri,
        processedImageUrl: processedImageUrl,
        condition: result.class_name,
        confidence: result.confidence,
        model: result.model_used,
        recommendations: recommendations,
        doctorNotes: doctorNotes
      };

      const reportRef = await addDoc(collection(db, 'screeningReports'), {
        ...reportData,
        doctorId: userId,
      });

      // Reset state before navigation
      resetScreeningState();

      // Navigate to the report screen
      navigation.navigate('ScreeningReport', {
        report: {
          id: reportRef.id,
          ...reportData
        }
      });
    } catch (error) {
      console.error('Error in analyzeImage:', error);
      const analysisError = error as Error;
      alert(analysisError.message || 'Error analyzing image. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchUpcomingAppointment = async (patientId: string) => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const appointmentsRef = collection(db, 'appointments');
      const appointmentsQuery = query(
        appointmentsRef,
        where('doctorId', '==', userId),
        orderBy('date', 'asc')
      );

      const appointmentSnapshot = await getDocs(appointmentsQuery);

      const upcomingAppointments = appointmentSnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Appointment))
        .filter(apt =>
          apt.patientId === patientId &&
          new Date(apt.date) >= new Date() &&
          apt.status === 'scheduled'
        )
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      if (upcomingAppointments.length > 0) {
        setUpcomingAppointment(upcomingAppointments[0]);
      } else {
        setUpcomingAppointment(null);
      }
    } catch (error) {
      console.error('Error fetching upcoming appointment:', error);
      setUpcomingAppointment(null);
    }
  };

  const handlePatientSelect = (patient: Patient) => {
    setSelectedPatient(patient);
    fetchUpcomingAppointment(patient.id);
  };

  const filteredPatients = patients.filter(patient =>
    patient.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <ScrollView style={styles.container}>
      <Surface style={styles.surface}>
        <Text style={styles.title}>Skin Condition Screening</Text>
        <Text style={[styles.disclaimer, styles.warning]}>
          ⚠️ Disclaimer: This is a research prototype, not clinically validated, and should not replace clinical judgment or be the sole basis for decisions.
        </Text>

        {/* Patient Selection */}
        <Card style={styles.patientCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Select Patient</Text>
            <Searchbar
              placeholder="Search patients"
              onChangeText={setSearchQuery}
              value={searchQuery}
              style={styles.searchBar}
            />
            <ScrollView style={styles.patientList}>
              {filteredPatients.map(patient => (
                <Button
                  key={patient.id}
                  mode={selectedPatient?.id === patient.id ? 'contained' : 'outlined'}
                  onPress={() => handlePatientSelect(patient)}
                  style={styles.patientButton}
                >
                  {patient.name}
                </Button>
              ))}
            </ScrollView>
          </Card.Content>
        </Card>

        {selectedPatient && (
          <>
            <View style={styles.imageActions}>
              <Button
                mode="contained"
                onPress={takePhoto}
                style={styles.button}
                icon="camera"
                disabled={loading}
              >
                Take Photo
              </Button>
              <Button
                mode="contained"
                onPress={pickImage}
                style={styles.button}
                icon="image"
                disabled={loading}
              >
                Pick Image
              </Button>
            </View>

            {image && (
              <Card style={styles.imageCard}>
                <Card.Content>
                  <Text style={styles.imageLabel}>Screening Image:</Text>
                  <Image source={{ uri: image }} style={styles.image} />
                  {processedImage && (
                    <>
                      <Text style={[styles.imageLabel, { marginTop: 16 }]}>
                        AI Focus Map:
                      </Text>
                      <Image source={{ uri: processedImage }} style={styles.image} />
                      <Text style={styles.disclaimer}>
                        ⚠️ This AI-generated focus map is part of the research prototype and is not clinically validated. It should not be used as the sole basis for diagnosis or treatment.
                      </Text>
                    </>
                  )}
                </Card.Content>
              </Card>
            )}

            {loading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={styles.analyzing}>
                  Analyzing image...
                </Text>
              </View>
            )}

            {selectedPatient && upcomingAppointment && (
              <Card style={styles.upcomingAppointmentCard}>
                <Card.Content>
                  <Text style={styles.upcomingAppointmentTitle}>Upcoming Appointment</Text>
                  <Text>
                    {format(new Date(upcomingAppointment.date), 'MMMM d, yyyy')} at{' '}
                    {upcomingAppointment.time}
                  </Text>
                  <Text>Type: {upcomingAppointment.type}</Text>
                  <Button
                    mode="outlined"
                    onPress={() => navigation.navigate('AppointmentDetails', {
                      appointment: upcomingAppointment
                    })}
                    style={styles.viewAppointmentButton}
                  >
                    View Appointment
                  </Button>
                </Card.Content>
              </Card>
            )}
          </>
        )}
      </Surface>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  surface: {
    padding: 16,
    margin: 16,
    borderRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  disclaimer: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
    marginVertical: 10,
  },
  warning: {
    fontWeight: 'bold',
    color: '#D9534F',
  },
  patientCard: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  searchBar: {
    marginBottom: 12,
  },
  patientList: {
    maxHeight: 200,
  },
  patientButton: {
    marginBottom: 8,
  },
  imageActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  button: {
    flex: 1,
    marginHorizontal: 8,
  },
  imageCard: {
    marginVertical: 16,
  },
  imageLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  image: {
    width: '100%',
    height: 300,
    resizeMode: 'cover',
    borderRadius: 8,
  },
  loadingContainer: {
    alignItems: 'center',
    marginVertical: 24,
  },
  analyzing: {
    marginTop: 16,
    fontSize: 16,
    fontStyle: 'italic',
  },
  upcomingAppointmentCard: {
    marginVertical: 10,
  },
  upcomingAppointmentTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  viewAppointmentButton: {
    marginTop: 8,
  },
  screeningCard: {
    marginVertical: 8,
  },
  viewButton: {
    marginTop: 8,
  },
  date: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 4,
  },
});

export default ScreeningScreen; 