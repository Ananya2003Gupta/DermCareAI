import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  Share,
  Platform,
  ActivityIndicator,
} from 'react-native';
import {
  Text,
  Button,
  Surface,
  useTheme,
  Card,
  TextInput,
  IconButton,
} from 'react-native-paper';
import { Appointment, NavigationProps } from '../../navigation/types';
import { doc, updateDoc, getDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { format } from 'date-fns';
import * as FileSystem from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { auth } from '../../config/firebase';

const ScreeningReportScreen: React.FC<NavigationProps<'ScreeningReport'>> = ({
  navigation,
  route,
}) => {
  const theme = useTheme();
  const { report } = route.params;
  const [doctorNotes, setDoctorNotes] = useState(report.doctorNotes || '');
  const [saving, setSaving] = useState(false);
  const [upcomingAppointments, setUpcomingAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  const handleSaveNotes = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'screeningReports', report.id), {
        doctorNotes,
      });
    } catch (error) {
      console.error('Error saving notes:', error);
      alert('Error saving notes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const generateHTML = () => {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .header { text-align: center; margin-bottom: 30px; }
            .section { margin-bottom: 20px; }
            .label { font-weight: bold; margin-bottom: 5px; }
            .value { margin-bottom: 15px; }
            .images { display: flex; justify-content: center; margin: 20px 0; }
            .image { width: 100%; }
            img { max-width: 100%; height: auto; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Skin Condition Screening Report</h1>
            <p>Date: ${format(new Date(report.date), 'MMMM d, yyyy')}</p>
          </div>

          <div class="section">
            <div class="label">Patient Name:</div>
            <div class="value">${report.patientName}</div>
          </div>

          <div class="section">
            <div class="label">Image:</div>
            <div class="images">
              <div class="image">
                <img src="${report.imageUrl}" alt="Screening Image" />
              </div>
            </div>
          </div>

          <div class="section">
            <div class="label">Image:</div>
            <div class="images">
              <div class="image">
                <img src="${report.processedImageUrl}" alt="AI Focus Map" />
              </div>
            </div>
          </div>

          <div class="section">
            <div class="label">Analysis Results:</div>
            <div class="value">
              <p>Detected Condition: ${report.condition}</p>
              <p>Confidence: ${(report.confidence * 100).toFixed(1)}%</p>
              <p>Analysis Model: ${report.model}</p>
            </div>
          </div>

          <div class="section">
            <div class="label">Recommendations:</div>
            <div class="value">
              <ul>
                ${report.recommendations.map(rec => `<li>${rec}</li>`).join('')}
              </ul>
            </div>
          </div>

          <div class="section">
            <div class="label">Doctor's Notes:</div>
            <div class="value">${doctorNotes || 'No notes provided'}</div>
          </div>
        </body>
      </html>
    `;
  };

  const shareReport = async () => {
    try {
      const html = generateHTML();
      const { uri } = await Print.printToFileAsync({
        html,
        base64: false
      });
      
      const pdfName = `screening_report_${format(new Date(report.date), 'yyyyMMdd')}.pdf`;
      
      if (Platform.OS === 'android') {
        const pdfPath = `${FileSystem.documentDirectory}${pdfName}`;
        await FileSystem.moveAsync({
          from: uri,
          to: pdfPath
        });
        await Sharing.shareAsync(pdfPath);
      } else {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Share Screening Report',
          UTI: 'com.adobe.pdf'
        });
      }
    } catch (error) {
      console.error('Error sharing report:', error);
      alert('Error sharing report. Please try again.');
    }
  };

  const scheduleAppointment = async () => {
    try {
      // Fetch complete patient data
      const patientDoc = await getDoc(doc(db, 'patients', report.patientId));
      if (!patientDoc.exists()) {
        alert('Patient data not found');
        return;
      }

      const patientData = patientDoc.data();
      navigation.navigate('NewAppointment', {
        patient: {
          id: report.patientId,
          name: patientData.name,
          age: patientData.age,
          gender: patientData.gender,
          phone: patientData.phone,
          email: patientData.email,
          address: patientData.address,
          medicalHistory: patientData.medicalHistory,
          allergies: patientData.allergies,
          currentMedications: patientData.currentMedications,
          upcomingVisit: patientData.upcomingVisit
        }
      });
    } catch (error) {
      console.error('Error fetching patient data:', error);
      alert('Error scheduling appointment. Please try again.');
    }
  };

  const fetchUpcomingAppointments = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

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
        apt.patientId === report.patientId && 
        new Date(apt.date) >= new Date() &&
        apt.status === 'scheduled'
      );

      setUpcomingAppointments(upcomingAppointments);
    } catch (error) {
      console.error('Error fetching appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUpcomingAppointments();
  }, [report.patientId]);

  return (
    <ScrollView style={styles.container}>
      <Surface style={styles.surface}>
        <View style={styles.header}>
          <Text style={styles.title}>Screening Report</Text>
          <IconButton
            icon="close"
            size={24}
            onPress={() => navigation.goBack()}
            style={styles.closeButton}
          />
        </View>

        <Card style={styles.section}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Patient Information</Text>
            <Text style={styles.patientName}>{report.patientName}</Text>
          </Card.Content>
        </Card>

        <Card style={styles.section}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Screening Image</Text>
            <Image source={{ uri: report.imageUrl }} style={styles.image} />
          </Card.Content>
        </Card>

        <Card style={styles.section}>
          <Card.Content>
            <Text style={styles.sectionTitle}>AI Focus Map</Text>
            <Image source={{ uri: report.processedImageUrl }} style={styles.image} />
          </Card.Content>
        </Card>

        <Card style={styles.section}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Analysis Results</Text>
            <Text style={styles.resultItem}>
              Detected Condition: {report.condition}
            </Text>
            <Text style={styles.resultItem}>
              Confidence: {(report.confidence * 100).toFixed(1)}%
            </Text>
            <Text style={styles.resultItem}>
              Analysis Model: {report.model}
            </Text>
          </Card.Content>
        </Card>

        <Card style={styles.section}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Recommendations</Text>
            {report.recommendations.map((rec, index) => (
              <Text key={index} style={styles.recommendation}>
                • {rec}
              </Text>
            ))}
          </Card.Content>
        </Card>

        <Card style={styles.section}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Upcoming Appointments</Text>
            {loading ? (
              <ActivityIndicator />
            ) : upcomingAppointments.length > 0 ? (
              upcomingAppointments.map(appointment => (
                <Card key={appointment.id} style={styles.appointmentCard}>
                  <Card.Content>
                    <Text style={styles.date}>
                      {format(new Date(appointment.date), 'MMMM d, yyyy')} at {appointment.time}
                    </Text>
                    <Text>Type: {appointment.type}</Text>
                    <Button
                      mode="outlined"
                      onPress={() => navigation.navigate('AppointmentDetails', { appointment })}
                      style={styles.viewButton}
                    >
                      View Details
                    </Button>
                  </Card.Content>
                </Card>
              ))
            ) : (
              <Text>No upcoming appointments</Text>
            )}
          </Card.Content>
        </Card>

        <Card style={styles.section}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Doctor's Notes</Text>
            <TextInput
              mode="outlined"
              multiline
              numberOfLines={4}
              value={doctorNotes}
              onChangeText={setDoctorNotes}
              style={styles.notesInput}
            />
            <Button
              mode="contained"
              onPress={handleSaveNotes}
              loading={saving}
              style={styles.saveButton}
            >
              Save Notes
            </Button>
          </Card.Content>
        </Card>

        <View style={styles.actions}>
          <Button
            mode="contained"
            onPress={shareReport}
            icon="share"
            style={styles.actionButton}
          >
            Share Report
          </Button>
          <Button
            mode="contained"
            onPress={scheduleAppointment}
            icon="calendar"
            style={[styles.actionButton, styles.scheduleButton]}
          >
            Schedule Appointment
          </Button>
        </View>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  closeButton: {
    position: 'absolute',
    right: 0,
    top: 0,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  patientName: {
    fontSize: 16,
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
  resultItem: {
    fontSize: 16,
    marginBottom: 8,
  },
  recommendation: {
    fontSize: 14,
    marginBottom: 4,
    lineHeight: 20,
  },
  notesInput: {
    marginBottom: 12,
  },
  saveButton: {
    marginTop: 8,
  },
  actions: {
    marginTop: 16,
    gap: 12,
  },
  actionButton: {
    width: '90%',
    alignSelf: 'center',
  },
  scheduleButton: {
    marginTop: 8,
  },
  appointmentCard: {
    marginVertical: 8,
  },
  date: {
    fontSize: 16,
    marginBottom: 8,
  },
  viewButton: {
    marginTop: 8,
  },
});

export default ScreeningReportScreen; 