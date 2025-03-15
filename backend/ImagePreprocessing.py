import cv2
import numpy as np
from typing import Tuple, Optional, Union
import logging
import base64
from io import BytesIO
from PIL import Image

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ImagePreprocessor:
    """Class for preprocessing dermoscopic images"""
    
    def __init__(self, target_size: Tuple[int, int] = (224, 224)):
        self.target_size = target_size
    
    @staticmethod
    def hair_remove(image: np.ndarray) -> np.ndarray:
        """Remove hair artifacts from skin images"""
        try:
            gray_scale = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
            kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (17, 17))
            blackhat = cv2.morphologyEx(gray_scale, cv2.MORPH_BLACKHAT, kernel)
            _, threshold = cv2.threshold(blackhat, 10, 255, cv2.THRESH_BINARY)
            final_image = cv2.inpaint(image, threshold, 1, cv2.INPAINT_TELEA)
            return final_image
        except Exception as e:
            logger.error(f"Error in hair removal: {str(e)}")
            return image
    
    @staticmethod
    def sharpen_image(image: np.ndarray) -> np.ndarray:
        """Sharpen image using unsharp masking"""
        try:
            gaussian = cv2.GaussianBlur(image, (0, 0), 2.0)
            return cv2.addWeighted(image, 1.5, gaussian, -0.5, 0)
        except Exception as e:
            logger.error(f"Error in image sharpening: {str(e)}")
            return image

    def normalize_image(self, image: np.ndarray) -> np.ndarray:
        """Normalize image for neural network input"""
        image = image.astype(np.float32)
        return image
    
    def process_bytes(self, image_bytes: bytes) -> Optional[np.ndarray]:
        """Process image from bytes"""
        try:
            nparr = np.frombuffer(image_bytes, np.uint8)
            image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            return self.preprocess(image)
        except Exception as e:
            logger.error(f"Error processing image bytes: {str(e)}")
            return None

    def preprocess(self, image: np.ndarray) -> Optional[np.ndarray]:
        """Apply full preprocessing pipeline"""
        try:
            # Apply preprocessing steps
            image = self.hair_remove(image)
            image = self.sharpen_image(image)
            
            # Resize to target size
            image = cv2.resize(
                image, 
                self.target_size, 
                interpolation=cv2.INTER_NEAREST
            )
            
            return image
            
        except Exception as e:
            logger.error(f"Error in preprocessing pipeline: {str(e)}")
            return None

    def to_base64(self, image: np.ndarray) -> str:
        """Convert processed image to base64 string"""
        try:
            # Convert to uint8 if float
            if image.dtype == np.float32 or image.dtype == np.float64:
                image = (image * 255).astype(np.uint8)
            
            # Convert to PIL Image
            pil_image = Image.fromarray(image)
            
            # Save to bytes
            buffered = BytesIO()
            pil_image.save(buffered, format="PNG")
            
            # Convert to base64
            return base64.b64encode(buffered.getvalue()).decode()
        except Exception as e:
            logger.error(f"Error converting to base64: {str(e)}")
            return ""
