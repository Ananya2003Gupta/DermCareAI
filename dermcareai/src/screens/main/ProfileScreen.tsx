import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Image, Platform } from 'react-native';
import { Text, Button, Avatar, Surface, TextInput, Portal, Dialog, useTheme, MD3Theme } from 'react-native-paper';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import { signOut } from 'firebase/auth';
import * as ImagePicker from 'expo-image-picker';
import { Camera, PermissionResponse } from 'expo-camera';
import { uploadImage } from '../../config/cloudinary';

interface ProfileData {
  fullName: string;
  email: string;
  licenseNumber: string;
  specialization: string;
  phoneNumber: string;
  photoUrl?: string;
}

const ProfileScreen = ({ navigation }: { navigation: any }) => {
  const theme = useTheme<MD3Theme>();
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [editing, setEditing] = useState<boolean>(false);
  const [profileData, setProfileData] = useState<ProfileData>({
    fullName: '',
    email: '',
    licenseNumber: '',
    specialization: '',
    phoneNumber: '',
  });
  const [editedData, setEditedData] = useState<ProfileData>({ ...profileData });
  const [error, setError] = useState<string>('');
  const [uploading, setUploading] = useState<boolean>(false);

  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async (): Promise<void> => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const docRef = doc(db, 'doctors', userId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data() as ProfileData;
        setProfileData(data);
        setEditedData(data);
      }
    } catch (err) {
      const error = err as Error;
      console.error('Error fetching profile:', error.message);
      setError('Failed to load profile data');
    } finally {
      setLoading(false);
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

  const handleImageUpload = async (imageUri: string) => {
    try {
      setUploading(true);
      const userId = auth.currentUser?.uid;
      if (!userId) return null;

      // First upload to Cloudinary
      const cloudinaryUrl = await uploadImage(imageUri);
      
      // Add error checking for cloudinaryUrl
      if (!cloudinaryUrl || typeof cloudinaryUrl !== 'string') {
        throw new Error('Invalid response from Cloudinary');
      }

      // Then update Firestore with the Cloudinary URL
      await updateDoc(doc(db, 'doctors', userId), {
        photoUrl: cloudinaryUrl,
        updatedAt: new Date().toISOString()
      });

      // Clear any existing error
      setError('');
      return cloudinaryUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      // More specific error message
      if (error instanceof Error) {
        setError(`Failed to update profile picture: ${error.message}`);
      } else {
        setError('Failed to update profile picture');
      }
      return null;
    } finally {
      setUploading(false);
    }
  };

  const takePhoto = async (): Promise<void> => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets[0]) {
        setUploading(true);
        const cloudinaryUrl = await handleImageUpload(result.assets[0].uri);
        if (cloudinaryUrl) {
          const updatedData = { ...editedData, photoUrl: cloudinaryUrl };
          setEditedData(updatedData);
          setProfileData(updatedData);
        }
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      setError('Error taking photo. Please try again.');
    }
  };

  const pickImage = async (): Promise<void> => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets[0]) {
        setUploading(true);
        const cloudinaryUrl = await handleImageUpload(result.assets[0].uri);
        if (cloudinaryUrl) {
          const updatedData = { ...editedData, photoUrl: cloudinaryUrl };
          setEditedData(updatedData);
          setProfileData(updatedData);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      setError('Error selecting image. Please try again.');
    }
  };

  const handleSave = async (): Promise<void> => {
    try {
      setSaving(true);
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const updateData = {
        fullName: editedData.fullName,
        licenseNumber: editedData.licenseNumber,
        specialization: editedData.specialization,
        phoneNumber: editedData.phoneNumber,
        photoUrl: editedData.photoUrl || null,
        updatedAt: new Date().toISOString(),
      };

      await updateDoc(doc(db, 'doctors', userId), updateData);
      setProfileData(editedData);
      setEditing(false);
    } catch (err) {
      const error = err as Error;
      console.error('Error updating profile:', error.message);
      setError('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async (): Promise<void> => {
    try {
      await signOut(auth);
      navigation.replace('Login');
    } catch (err) {
      const error = err as Error;
      console.error('Error signing out:', error.message);
      setError('Failed to sign out. Please try again.');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Surface style={styles.surface}>
        {editing ? (
          <View style={styles.photoContainer}>
            {editedData.photoUrl ? (
              <Avatar.Image 
                size={120} 
                source={{ uri: editedData.photoUrl }} 
                style={styles.avatar}
              />
            ) : (
              <Avatar.Icon 
                size={120} 
                icon="account" 
                style={styles.avatar}
              />
            )}
            <View style={styles.photoActions}>
              <Button
                mode="contained"
                onPress={takePhoto}
                icon="camera"
                style={styles.photoButton}
                loading={uploading}
                disabled={uploading}
              >
                Take Photo
              </Button>
              <Button
                mode="contained"
                onPress={pickImage}
                icon="image"
                style={styles.photoButton}
                loading={uploading}
                disabled={uploading}
              >
                Pick Image
              </Button>
            </View>
          </View>
        ) : (
          profileData.photoUrl ? (
            <Avatar.Image 
              size={120} 
              source={{ uri: profileData.photoUrl }} 
              style={styles.avatar}
            />
          ) : (
            <Avatar.Icon 
              size={120} 
              icon="account" 
              style={styles.avatar}
            />
          )
        )}
        
        {editing ? (
          <>
            <TextInput
              label="Full Name"
              value={editedData.fullName}
              onChangeText={(text) => setEditedData({ ...editedData, fullName: text })}
              style={styles.input}
            />
            <TextInput
              label="License Number"
              value={editedData.licenseNumber}
              onChangeText={(text) => setEditedData({ ...editedData, licenseNumber: text })}
              style={styles.input}
            />
            <TextInput
              label="Specialization"
              value={editedData.specialization}
              onChangeText={(text) => setEditedData({ ...editedData, specialization: text })}
              style={styles.input}
            />
            <TextInput
              label="Phone Number"
              value={editedData.phoneNumber}
              onChangeText={(text) => setEditedData({ ...editedData, phoneNumber: text })}
              style={styles.input}
            />
            
            <View style={styles.buttonContainer}>
              <Button 
                mode="contained" 
                onPress={handleSave}
                loading={saving}
                style={styles.button}
              >
                Save
              </Button>
              <Button 
                mode="outlined" 
                onPress={() => {
                  setEditedData(profileData);
                  setEditing(false);
                }}
                style={styles.button}
              >
                Cancel
              </Button>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.name}>{profileData.fullName}</Text>
            <Text style={styles.role}>{profileData.specialization}</Text>
            
            <View style={styles.infoContainer}>
              <Text style={styles.infoLabel}>Email:</Text>
              <Text style={styles.infoValue}>{profileData.email}</Text>
              
              <Text style={styles.infoLabel}>License Number:</Text>
              <Text style={styles.infoValue}>{profileData.licenseNumber}</Text>
              
              <Text style={styles.infoLabel}>Phone Number:</Text>
              <Text style={styles.infoValue}>{profileData.phoneNumber}</Text>
            </View>

            <Button 
              mode="contained" 
              onPress={() => setEditing(true)}
              style={styles.button}
            >
              Edit Profile
            </Button>
          </>
        )}

        <Button 
          mode="outlined" 
          onPress={handleLogout}
          style={[styles.button, styles.logoutButton]}
        >
          Logout
        </Button>

        {error ? <Text style={styles.error}>{error}</Text> : null}
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
  },
  photoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  photoActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
    gap: 8,
  },
  photoButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  avatar: {
    marginBottom: 16,
    alignSelf: 'center',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  role: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: 'center',
    marginBottom: 24,
  },
  infoContainer: {
    marginBottom: 24,
  },
  infoLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    opacity: 0.7,
    marginBottom: 16,
  },
  input: {
    marginBottom: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    marginTop: 8,
  },
  logoutButton: {
    marginTop: 24,
  },
  error: {
    color: 'red',
    marginTop: 16,
    textAlign: 'center',
  },
});

export default ProfileScreen; 