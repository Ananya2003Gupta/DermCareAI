import torch
import torch.nn as nn
from torchvision import models, transforms
from PIL import Image
import numpy as np
import logging
from grad_cam import pytorch_grad_cam, apply_grad_cam
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ModelConfig:
    def __init__(self):
        self.learning_rate = 0.0008
        self.dropout_rate = 0.2
        self.batch_size = 32
        self.num_unfreeze_stages = 4
        self.layers_per_stage = 3
        self.grad_clip_value = 1.6514
        self.patience = 10
        self.num_epochs = 50
        self.image_size = 224
        self.num_classes = 2

class MobileNetV2Classifier(nn.Module):
    def __init__(self, config: ModelConfig):
        super(MobileNetV2Classifier, self).__init__()
        self.model = models.mobilenet_v2(weights=models.MobileNet_V2_Weights.IMAGENET1K_V1)
        
        # Modify the classifier
        self.model.classifier = nn.Sequential(
            nn.Dropout(p=config.dropout_rate),
            nn.Linear(self.model.last_channel, config.num_classes)
        )
        
        # Freeze all layers initially
        for param in self.model.parameters():
            param.requires_grad = False
        
        # Unfreeze the specified number of stages from the end
        stages_to_unfreeze = list(self.model.features)[-config.num_unfreeze_stages * config.layers_per_stage:]
        for layer in stages_to_unfreeze:
            for param in layer.parameters():
                param.requires_grad = True
        
        # Unfreeze classifier
        for param in self.model.classifier.parameters():
            param.requires_grad = True

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.model(x)

class MobileNetPredictor:
    def __init__(self, checkpoint_path: str):
        self.config = ModelConfig()
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.model = self._load_model(checkpoint_path)
        self.transform = self._get_transform()
        logger.info(f"MobileNetPredictor initialized on device: {self.device}")

    def _load_model(self, checkpoint_path: str) -> MobileNetV2Classifier:
        model = MobileNetV2Classifier(self.config)
        checkpoint = torch.load(checkpoint_path, map_location=self.device)
        model.load_state_dict(checkpoint['state_dict'])
        model.to(self.device)
        model.eval()
        return model

    def _get_transform(self) -> transforms.Compose:
        return transforms.Compose([
            transforms.Resize((self.config.image_size, self.config.image_size)),
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225]
            )
        ])

    def prepare_image(self, image_array: np.ndarray) -> torch.Tensor:
        """
        Prepare image for model inference
        
        Args:
            image_array: numpy array of shape (H, W, C) in RGB format
            
        Returns:
            torch.Tensor: Preprocessed image tensor
        """
        logger.info("Inside MobileNetPredictor")
        pil_image = Image.fromarray(image_array)
        logger.info("PIL Image Conversion")
        image_tensor = self.transform(pil_image).unsqueeze(0)
        logger.info("Image Tensor")
        return image_tensor.to(self.device)

    @torch.no_grad()
    def predict(self, image_array: np.ndarray) -> dict:
        """
        Make prediction on input image
        
        Args:
            image_array: numpy array of shape (H, W, C) in RGB format
            
        Returns:
            dict: Dictionary containing prediction probabilities
        """
        image_tensor = self.prepare_image(image_array)
        outputs = self.model(image_tensor)
        probabilities = torch.softmax(outputs, dim=1)
        
        return {
            'class_index': int(torch.argmax(probabilities).item()),
            'probabilities': probabilities[0].tolist()
        }

    def predict_with_gradcam(self, image_array: np.ndarray) -> dict:
        """
        Predict class and generate Grad-CAM visualization.
        
        Args:
            image_array: Input image as numpy array
            
        Returns:
            Dictionary containing prediction results and Grad-CAM visualization
        """
        # Prepare image
        input_tensor = self.prepare_image(image_array)
        
        # Get prediction
        with torch.no_grad():
            output = self.model(input_tensor)
            probabilities = torch.softmax(output, dim=1)
            predicted_class = torch.argmax(probabilities).item()
        
        # Generate Grad-CAM visualization
        original_image, heatmap = pytorch_grad_cam(
            self.model,
            input_tensor,
            predicted_class,
            layer_name='features'
        )
        
        # Apply Grad-CAM to image
        visualization = apply_grad_cam(original_image, heatmap)
        
        return {
            'class_index': int(predicted_class),
            'probabilities': probabilities[0].cpu().numpy(),
            'gradcam_visualization': visualization
        }
