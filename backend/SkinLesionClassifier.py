from tensorflow.keras.applications import NASNetMobile
from tensorflow.keras.layers import Dense, Input, Dropout, GlobalAveragePooling2D
from tensorflow.keras.models import Model
from tensorflow.keras.optimizers import Adam
import tensorflow as tf
from grad_cam import tensorflow_grad_cam, apply_grad_cam

class SkinLesionClassifier:
    """A class to handle skin lesion classification using a NASNetMobile-based model."""
    
    # Class variable for label mapping
    LABELS = {
        0: 'akiec',
        1: 'bcc',
        2: 'bkl',
        3: 'df',
        4: 'mel',
        5: 'nv',
        6: 'vasc'
    }
    
    def __init__(self, model_path: str, input_shape: tuple = (224, 224, 3)):
        """
        Initialize the classifier with a pre-trained model.
        
        Args:
            model_path (str): Path to the saved model weights
            input_shape (tuple): Input shape for the model (default: (224, 224, 3))
        """
        self.input_shape = input_shape
        self.model = self._build_model()
        self.model.load_weights(model_path)
    
    def _build_model(self) -> Model:
        """
        Build the NASNetMobile-based model architecture.
        
        Returns:
            Model: Compiled Keras model
        """
        base_model = NASNetMobile(
            weights='imagenet',
            include_top=False,
            input_shape=self.input_shape
        )
        
        # Make all layers trainable
        for layer in base_model.layers:
            layer.trainable = True
        
        # Add classification layers
        x = base_model.output
        x = GlobalAveragePooling2D()(x)
        x = Dense(192, kernel_regularizer='l2', activation='relu')(x)
        x = Dropout(0.5)(x)
        x = Dense(len(self.LABELS), activation='softmax')(x)
        
        return Model(inputs=base_model.input, outputs=x)
    
    def preprocess_image(self, image: tf.Tensor) -> tf.Tensor:
        """
        Preprocess an input image for the model.
        
        Args:
            image (tf.Tensor): Input image tensor
            
        Returns:
            tf.Tensor: Preprocessed image
        """
        return tf.keras.applications.nasnet.preprocess_input(image)
    
    def predict_with_gradcam(self, image: tf.Tensor) -> dict:
        """
        Predict class and generate Grad-CAM visualization.
        
        Args:
            image: Input image tensor
            
        Returns:
            Dictionary containing prediction results and Grad-CAM visualization
        """
        processed_image = tf.identity(image)

        # Ensure image has batch dimension
        if len(image.shape) == 3:
            image = tf.expand_dims(image, 0)
            
        # Make prediction
        predictions = self.model.predict(image)
        # Get predicted class and probability
        predicted_class = int(tf.argmax(predictions[0]))
        probabilities = {i: float(prob) 
                        for i, prob in enumerate(predictions[0])}
        
        # Generate Grad-CAM visualization
        original_image, heatmap = tensorflow_grad_cam(
            self.model,
            processed_image,
            predicted_class,
            layer_name='conv2d_93'
        )
        
        # Apply Grad-CAM to image
        visualization = apply_grad_cam(original_image[0], heatmap[0])
        
        return {
            'class_index': predicted_class,
            'probabilities': probabilities,
            'gradcam_visualization': visualization
        }
