import { Cloudinary } from '@cloudinary/url-gen';
import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } from '@env';
import crypto from 'crypto-js';

const generateSignature = (timestamp: number) => {
  const params = {
    timestamp: timestamp,
    upload_preset: 'dermcareai_preset',
  };
  
  // Generate the string to sign
  const str = Object.entries(params)
    .sort()
    .map(([key, value]) => `${key}=${value}`)
    .join('&');

  // Generate signature
  return crypto.HmacSHA256(str, CLOUDINARY_API_SECRET).toString();
};

export const uploadImage = async (imageUri: string): Promise<string> => {
  try {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const signature = generateSignature(timestamp);
    
    const formData = new FormData();
    const filename = imageUri.split('/').pop() || 'image.jpg';
    
    formData.append('file', {
      uri: imageUri,
      type: 'image/jpeg',
      name: filename,
    } as any);

    formData.append('upload_preset', 'dermcareai_preset');
    formData.append('api_key', CLOUDINARY_API_KEY);
    formData.append('timestamp', timestamp.toString());
    formData.append('signature', signature);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
      {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Upload failed');
    }

    const data = await response.json();
    return data.secure_url;
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    throw error;
  }
};

export const getImageUrl = (publicId: string) => {
  const cloudinary = new Cloudinary({
    cloud: {
      cloudName: CLOUDINARY_CLOUD_NAME,
    }
  });
  return cloudinary.image(publicId).toURL();
}; 