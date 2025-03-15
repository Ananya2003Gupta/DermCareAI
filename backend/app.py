from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
import uvicorn
from PIL import Image
import io
import logging
from typing import Dict, Any
from pydantic import BaseModel
import base64
import tensorflow as tf

# Import our custom classes
from ImagePreprocessing import ImagePreprocessor
from MelanomaClassifier import MobileNetPredictor
from SkinLesionClassifier import SkinLesionClassifier

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class PredictionResponse(BaseModel):
    class_name: str
    confidence: float
    model_used: str
    visualization: str  # Base64 encoded Grad-CAM visualization

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ModelService:
    def __init__(self):
        self.preprocessor = ImagePreprocessor(target_size=(224, 224))
        self.mobilenet = MobileNetPredictor('models/melanoma_classifier.pth')
        self.nasnet = SkinLesionClassifier('models/FinetunedNasNetMobile.keras')
        
        # NASNet class mapping
        self.nasnet_classes = {
            0: 'Actinic Keratosis',
            1: 'Basal Cell Carcinoma',
            2: 'Benign Keratosis',
            3: 'Dermatofibroma',
            4: 'Melanoma',
            5: 'Melanocytic Nevus',
            6: 'Vascular Lesion'
        }
        
        logger.info("Model service initialized successfully")

    async def process_image(self, image_bytes: bytes) -> Dict[str, Any]:
        try:
            # Convert bytes to PIL Image
            image = Image.open(io.BytesIO(image_bytes))
            image = image.convert('RGB')
            logger.info("PIL Conversion")

            # Convert to numpy array
            image_array = np.array(image)
            logger.info("Numpy Conversion")

            # Preprocess image
            processed_image = self.preprocessor.preprocess(image_array)
            logger.info("Preprocessing Done")
            if processed_image is None:
                raise HTTPException(status_code=400, detail="Image preprocessing failed")
            
            # First prediction with MobileNetV2
            mobilenet_result = self.mobilenet.predict(processed_image)
            mobilenet_predicted_class = mobilenet_result['class_index']
            mobilenet_confidence = mobilenet_result['probabilities'][mobilenet_predicted_class]
            logger.info("Mobilenet prediction")

            # If predicted as Non-Melanoma (0), use NASNetMobile for detailed classification
            if mobilenet_predicted_class == 0:  # Non-Melanoma
                nasnet_image = tf.cast(processed_image, tf.float32) / 255.0
                nasnet_result = self.nasnet.predict_with_gradcam(nasnet_image)
                final_class = self.nasnet_classes[nasnet_result['class_index']]
                final_confidence = nasnet_result['probabilities'][nasnet_result['class_index']]
                model_used = "NASNetMobile"
                visualization = nasnet_result['gradcam_visualization']
                logger.info("NASNetMobile prediction")
            else:
                final_class = "Melanoma"
                final_confidence = mobilenet_confidence
                model_used = "MobileNetV2"
                visualization = self.mobilenet.gradcam_visualization(processed_image, mobilenet_predicted_class)
            logger.info("Final prediction")

            # Convert Grad-CAM visualization to base64
            visualization_img = Image.fromarray((visualization * 255).astype(np.uint8))
            buffered = io.BytesIO()
            visualization_img.save(buffered, format="JPEG")
            visualization_str = base64.b64encode(buffered.getvalue()).decode()

            return {
                "class_name": final_class,
                "confidence": float(final_confidence),
                "model_used": model_used,
                "visualization": visualization_str
            }

        except Exception as e:
            logger.error(f"Error processing image: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))

# Initialize model service
model_service = ModelService()

@app.get("/")
def read_root():
    return {"message": "Hello World"}

@app.post("/predict", response_model=PredictionResponse)
async def predict(file: UploadFile = File(...)):
    """
    Endpoint for skin lesion classification
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    contents = await file.read()
    result = await model_service.process_image(contents)
    return result

@app.get("/health")
async def health_check():
    """
    Health check endpoint
    """
    return {"status": "healthy"}
