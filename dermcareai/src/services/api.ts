import { Platform } from 'react-native';
import { API_URL } from '@env';

export type PredictionResponse = {
  class_name: string;
  confidence: number;
  model_used: string;
  visualization: string;
};

export const api = {
  async analyzeSkinImage(imageUri: string): Promise<PredictionResponse> {
    try {
      // Validate imageUri
      if (!imageUri) {
        throw new Error('No image provided');
      }

      const formData = new FormData();

      // Handle image file
      const imageUriParsed = Platform.OS === 'ios' ? imageUri.replace('file://', '') : imageUri;

      // Log the actual image data being sent
      console.log('Image data:', {
        uri: imageUriParsed,
        type: 'image/jpeg',
        name: 'image.jpg'
      });

      // Append file with explicit type declaration
      const fileData = {
        uri: imageUriParsed,
        type: 'image/jpeg',
        name: 'image.jpg'
      };
      formData.append('file', fileData as any);

      console.log('Sending request with formData:', formData);

      const response = await fetch(`${API_URL}/predict`, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        throw new Error(`API Error: ${errorText}`);
      }

      const responseText = await response.text();
      // console.log('Successful Response:', responseText);

      const data = JSON.parse(responseText);
      return data as PredictionResponse;

    } catch (error) {
      console.error('Full error details:', error);
      if (error instanceof Error) {
        if (error.message.includes('Network request failed')) {
          throw new Error('Connection failed. Please check your internet and try again.');
        }
        throw error;
      }
      throw new Error('An unexpected error occurred');
    }
  },

  getRecommendations(condition: string): string[] {
    // Map conditions to recommendations
    const recommendationsMap: { [key: string]: string[] } = {
      'Melanoma': [
        'Perform a thorough dermoscopic examination',
        'Assess Breslow thickness and ulceration',
        'Order a biopsy (excisional preferred) for histopathological confirmation',
        'Evaluate lymph node involvement if indicated',
        'Refer for oncologic assessment if metastatic risk is high'
      ],
      'Actinic Keratosis': [
        'Differentiate from SCC using dermoscopy',
        'Consider cryotherapy or topical 5-FU/imiquimod',
        'Assess for signs of progression to SCC',
        'Educate patient on long-term photoprotection',
        'Schedule periodic follow-ups to monitor recurrence'
      ],
      'Basal Cell Carcinoma': [
        'Confirm diagnosis via biopsy (shave or punch)',
        'Assess margins for surgical excision planning',
        'Consider Mohs surgery for high-risk areas',
        'Evaluate nonsurgical treatments like imiquimod or PDT',
        'Long-term follow-up for recurrence monitoring'
      ],
      'Benign Keratosis': [
        'Differentiate from malignant lesions via dermoscopy',
        'No intervention needed unless symptomatic',
        'Consider curettage, cryotherapy, or laser for cosmetic removal',
        'Monitor for atypical changes over time',
        'Reassure patient and educate on skin monitoring'
      ],
      'Dermatofibroma': [
        'Use dermoscopy to confirm central white scar-like area',
        'Perform a punch biopsy if atypical features present',
        'Differentiate from DFSP (dermatofibrosarcoma protuberans)',
        'No treatment necessary unless symptomatic',
        'Consider excision if growth or pain occurs'
      ],
      'Melanocytic Nevus': [
        'Evaluate with dermoscopy for atypical features',
        'Apply the ABCDE rule for melanoma risk assessment',
        'Document lesion changes using serial photography',
        'Consider excision if dysplastic or concerning',
        'Regular monitoring for high-risk patients'
      ],
      'Vascular Lesion': [
        'Differentiate from hemangioma, angiokeratoma, and Kaposi sarcoma',
        'Use dermoscopy to assess vascular patterns',
        'Consider Doppler ultrasound for deeper lesions',
        'Evaluate treatment options: laser therapy or excision',
        'Refer to oncology if signs of malignancy present'
      ]
    };

    return recommendationsMap[condition] || [
      'Use dermoscopy to assess lesion characteristics',
      'Consider histopathological examination if atypical',
      'Evaluate differential diagnoses based on morphology',
      'Determine appropriate treatment or referral',
      'Monitor for recurrence or malignant transformation'
    ];
  }
}; 