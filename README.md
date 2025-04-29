# DermCareAI  - Dermatologist Patient Management App

A comprehensive mobile clinic for dermatologists to manage their patients, appointments, and medical records.
It is designed for independent dermatologists and use in remote/rural areas where PC setup might be too costly and difficult to maintain.

⚠️ **Disclaimer**: The AI-based skin cancer screening feature included in DermCareAI is intended for research and educational purposes only. It has not been clinically tested or approved for medical diagnosis or treatment. Users should consult licensed medical professionals for any clinical decisions.

## Features

- Patient Profile Management
- Appointment Scheduling
- Medical Records Management
- AI-based Skin Cancer Screening *(Research tool; not clinically validated)*
- Digital Prescriptions & Notes
- Reports & Analytics
- Secure Data Storage
- Calendar Integration
- Multi-User Support
- AI Assistance

## Tech Stack

### Mobile App
- React Native with Expo
- Firebase (Backend & Authentication)
- Cloudinary (Image Storage)
- React Navigation
- React Native Paper (UI Components)
- TypeScript

### Backend
- Python
- FastAPI
- TensorFlow
- PyTorch
- OpenCV

## Setup Instructions

### Running the Backend

1. Navigate to the `backend` directory
    ```
    cd backend
    ```

2. Create the Models Folder

First, create a folder named `models` in the backend directory and place the following model weight files inside it:
- `models/FinetunedNasNetMobile.keras`
- `models/melanoma_classifier.pth` (MobileNetV2)

Ensure the files follow the exact naming convention mentioned above.

**Requesting Model Weights** : For model weights, contact [Ananya Gupta](https://github.com/Ananya2003Gupta)

3. Set Up a Virtual Environment

Run the following commands to create and activate a virtual environment:

**For Windows (Command Prompt):**
```sh
python -m venv venv
venv\Scripts\activate
```

**For macOS/Linux (Terminal):**
```sh
python3 -m venv venv
source venv/bin/activate
```

4. Install Dependencies

Install the required dependencies using the `requirements.txt` file:
```sh
pip install -r requirements.txt
```

5. Configure ngrok

To expose the backend to the internet, set up `ngrok`:
- Sign up at [ngrok](https://ngrok.com/) and get your authentication token.
- Run the following command to add your `ngrok` authtoken:
   ```sh
   ngrok config add-authtoken YOUR_AUTHTOKEN
   ```
- Verify that `ngrok` is configured correctly by running:
   ```sh
   ngrok http 8000
   ```

6. Run the Backend

Start the backend server by running:
```sh
python main.py
```

7. Get the Backend Endpoint

After running the backend, you will receive an `ngrok` URL. This URL serves as the backend endpoint for API requests.

Ensure `ngrok` is properly configured if you face any issues.


### Running the Mobile App (Client Side)

1. Navigate to the `dermcareai` directory
    ```
    cd dermcareai
    ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the `dermcareai` directory with the following variables:
   ```
   FIREBASE_API_KEY=your_firebase_api_key
   FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
   FIREBASE_PROJECT_ID=your_firebase_project_id
   FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
   FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
   FIREBASE_APP_ID=your_firebase_app_id
   CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
   CLOUDINARY_API_KEY=your_cloudinary_api_key
   CLOUDINARY_API_SECRET=your_cloudinary_api_secret
   API_URL=your_backend_endpoint_url
   APP_NAME=DermCareAI
   APP_ENV=development
   ```

4. Start the development server:
   ```bash
   npx expo start
   ```

5. Run on your preferred platform:
   - iOS: Press 'i'
   - Android: Press 'a'
   - Web: Press 'w'

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## Medical Disclaimer

DermCareAI is a digital aid tool and not a substitute for professional medical advice, diagnosis, or treatment. The AI-based skin cancer screening feature is experimental and has not been reviewed or approved by any regulatory authority. Always seek the advice of a qualified healthcare provider with any questions regarding a medical condition.
