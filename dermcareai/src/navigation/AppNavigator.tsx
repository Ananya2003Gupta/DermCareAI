import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTheme } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ParamListBase } from '@react-navigation/native';
import { NavigationProps } from './types';
import { RootStackParamList } from './types';

// Import all screens
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import DashboardScreen from '../screens/main/DashboardScreen';
import PatientsScreen from '../screens/main/PatientsScreen';
import AppointmentsScreen from '../screens/main/AppointmentsScreen';
import ScreeningScreen from '../screens/main/ScreeningScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import AddPatientScreen from '../screens/main/AddPatientScreen';
import EditPatientScreen from '../screens/main/EditPatientScreen';
import PatientDetailsScreen from '../screens/main/PatientDetailsScreen';
import NewAppointmentScreen from '../screens/main/NewAppointmentScreen';
import AppointmentDetailsScreen from '../screens/main/AppointmentDetailsScreen';
import EditAppointmentScreen from '../screens/main/EditAppointmentScreen';
import ScreeningReportScreen from '../screens/main/ScreeningReportScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

const MainTabs = () => {
  const theme = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.onSurfaceDisabled,
        tabBarStyle: {
          backgroundColor: theme.colors.background,
          borderTopColor: theme.colors.surface,
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Icon name="view-dashboard" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Patients"
        component={PatientsScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Icon name="account-group" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Appointments"
        component={AppointmentsScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Icon name="calendar" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Screening"
        component={ScreeningScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Icon name="camera" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Icon name="account" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

const AppNavigator = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="MainTabs" component={MainTabs} />
        
        {/* Patient-related screens */}
        <Stack.Screen name="AddPatient" component={AddPatientScreen} />
        <Stack.Screen name="EditPatient" component={EditPatientScreen} />
        <Stack.Screen name="PatientDetails" component={PatientDetailsScreen} />
        
        {/* Appointment-related screens */}
        <Stack.Screen name="NewAppointment" component={NewAppointmentScreen} />
        <Stack.Screen name="AppointmentDetails" component={AppointmentDetailsScreen} />
        <Stack.Screen name="EditAppointment" component={EditAppointmentScreen} />
        
        {/* Screening Report screen */}
        <Stack.Screen name="ScreeningReport" component={ScreeningReportScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator; 