import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';

export type Patient = {
  id: string;
  name: string;
  age: number;
  gender: string;
  phone?: string;
  email?: string;
  address?: string;
  medicalHistory?: string;
  allergies?: string;
  currentMedications?: string;
  upcomingVisit?: string;
};

export interface ScreeningReport {
  id: string;
  patientId: string;
  patientName: string;
  date: string;
  imageUrl: string;
  processedImageUrl: string;
  condition: string;
  confidence: number;
  model: string;
  recommendations: string[];
  doctorNotes?: string;
}

export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled' | 'no-show';

export type Appointment = {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  date: string;
  time: string;
  type: string;
  status: AppointmentStatus;
  notes?: string;
  diagnosis?: string;
  prescription?: string;
  createdAt: string;
  updatedAt: string;
};

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  MainTabs: undefined;
  AddPatient: undefined;
  EditPatient: { patient: Patient };
  PatientDetails: { patient: Patient };
  NewAppointment: undefined | { patient?: Patient };
  AppointmentDetails: { appointment: Appointment };
  EditAppointment: { appointment: Appointment };
  Screening: undefined | { patient?: Patient };
  ScreeningReport: { report: ScreeningReport };
};

export type NavigationProps<T extends keyof RootStackParamList> = {
  navigation: NativeStackNavigationProp<RootStackParamList, T>;
  route: RouteProp<RootStackParamList, T>;
};