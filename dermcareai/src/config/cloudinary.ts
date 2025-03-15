import { Cloudinary } from '@cloudinary/url-gen';
import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } from '@env';
import crypto from 'crypto-js';

// Add debug logging
console.log('Cloudinary Config:', {
  cloudName: CLOUDINARY_CLOUD_NAME || 'NOT_SET',
  apiKey: CLOUDINARY_API_KEY ? 'EXISTS' : 'NOT_SET',
  apiSecret: CLOUDINARY_API_SECRET ? 'EXISTS' : 'NOT_SET',
});

// Verify env variables before creating instance
if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
  throw new Error('Missing Cloudinary environment variables');
}

const cloudinary = new Cloudinary({
  cloud: {
    cloudName: CLOUDINARY_CLOUD_NAME,
    apiKey: CLOUDINARY_API_KEY,
    apiSecret: CLOUDINARY_API_SECRET,
  }
});

const generateSignature = (timestamp: number) => {
  // Add debug logging
  console.log('Generating signature with:', {
    timestamp,
    preset: 'dermcareai_preset',
    secretLength: CLOUDINARY_API_SECRET.length
  });

  // Create the exact string that Cloudinary expects
  const stringToSign = `timestamp=${timestamp}&upload_preset=dermcareai_preset${CLOUDINARY_API_SECRET}`;
  
  // Generate the SHA-1 signature
  return crypto.SHA1(stringToSign).toString();
};

export const uploadImage = async (imageUri: string): Promise<string | null> => {
  try {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const signature = generateSignature(timestamp);

    // Create form data
    const formData = new FormData();
    const filename = imageUri.split('/').pop() || 'image.jpg';
    
    // Append the file
    formData.append('file', {
      uri: imageUri,
      type: 'image/jpeg',
      name: filename,
    } as any);

    // Append ALL required parameters
    formData.append('api_key', CLOUDINARY_API_KEY);
    formData.append('timestamp', timestamp.toString());
    formData.append('upload_preset', 'dermcareai_preset');
    formData.append('signature', signature);

    // Add debug logging
    console.log('Sending request with params:', {
      api_key: CLOUDINARY_API_KEY ? 'EXISTS' : 'MISSING',
      timestamp,
      upload_preset: 'dermcareai_preset',
      signature_length: signature.length
    });

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
      console.error('Cloudinary error response:', errorData);
      throw new Error(errorData.error?.message || 'Upload failed');
    }

    const data = await response.json();
    return data.secure_url;
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw error;
  }
};

export const getImageUrl = (publicId: string) => {
  return cloudinary.image(publicId).toURL();
}; 