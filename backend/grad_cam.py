import torch
import torch.nn.functional as F
import numpy as np
import tensorflow as tf
from typing import Tuple, Union

def pytorch_grad_cam(model: torch.nn.Module, 
                    input_tensor: torch.Tensor, 
                    target_class: int,
                    layer_name: str = 'features') -> Tuple[np.ndarray, np.ndarray]:
    """
    Generate Grad-CAM visualization for PyTorch models.
    
    Args:
        model: PyTorch model
        input_tensor: Input image tensor
        target_class: Target class index
        layer_name: Name of the target layer for visualization
    
    Returns:
        Tuple of (original image array, Grad-CAM heatmap)
    """
    model.eval()
    input_tensor.requires_grad = True
    
    if hasattr(model, 'model'):
        target_model = model.model
    else:
        target_model = model
    
    # Get the target layer
    target_layer = None
    for name, module in target_model.named_modules():
        if name == layer_name:
            target_layer = module
            break
    
    if target_layer is None:
        raise ValueError(f"Layer {layer_name} not found in model")
    
    # Forward pass
    output = model(input_tensor)
    
    # Clear gradients
    model.zero_grad()
    
    # Backward pass for target class
    one_hot = torch.zeros_like(output)
    one_hot[0][target_class] = 1
    output.backward(gradient=one_hot)
    
    # Get gradients and features
    gradients = input_tensor.grad.data
    features = target_layer(input_tensor)
    
    # Calculate weights
    weights = torch.mean(gradients, dim=(2, 3))
    
    # Generate heatmap
    heatmap = torch.zeros(features.shape[2:])
    for i, w in enumerate(weights[0]):
        heatmap += w * features[0, i]
    
    # Normalize heatmap
    heatmap = F.relu(heatmap)
    heatmap = heatmap.detach().cpu().numpy()
    heatmap = (heatmap - heatmap.min()) / (heatmap.max() - heatmap.min() + 1e-8)
    
    # Get original image
    original_image = input_tensor.detach().cpu().numpy()
    original_image = np.transpose(original_image[0], (1, 2, 0))
    original_image = (original_image - original_image.min()) / (original_image.max() - original_image.min() + 1e-8)
    
    return original_image, heatmap

def tensorflow_grad_cam(model: tf.keras.Model,
                       input_tensor: tf.Tensor,
                       target_class: int,
                       layer_name: str = 'conv2d_93') -> Tuple[np.ndarray, np.ndarray]:
    """
    Generate Grad-CAM visualization for TensorFlow models.
    
    Args:
        model: TensorFlow model
        input_tensor: Input image tensor
        target_class: Target class index
        layer_name: Name of the target layer for visualization
    
    Returns:
        Tuple of (original image array, Grad-CAM heatmap)
    """
    # Fix the input shape if needed
    if len(input_tensor.shape) == 3 and input_tensor.shape[1] == 3:
        # If shape is (batch, 3, width) - wrong format
        input_tensor = tf.transpose(input_tensor, [0, 2, 1])
    
    if len(input_tensor.shape) == 3:
        # If shape is (height, width, channels) - add batch dimension
        input_tensor = tf.expand_dims(input_tensor, 0)
    
    # Get the target layer
    try:
        target_layer = model.get_layer(layer_name)
    except ValueError:
        # If layer not found, try to find the last convolutional layer
        for layer in reversed(model.layers):
            if isinstance(layer, tf.keras.layers.Conv2D):
                layer_name = layer.name
                target_layer = layer
                break
        if not target_layer:
            raise ValueError(f"Layer {layer_name} not found in model")
    
    # Create a model that maps the input image to the activations
    # of the target layer and the output predictions
    grad_model = tf.keras.models.Model(
        [model.inputs],
        [target_layer.output, model.output]
    )
    
    # Compute gradient of the predicted class with respect to
    # the output feature map of the target layer
    with tf.GradientTape() as tape:
        conv_output, predictions = grad_model(input_tensor)
        loss = predictions[:, target_class]
    
    # Extract gradients and compute weights
    grads = tape.gradient(loss, conv_output)
    weights = tf.reduce_mean(grads, axis=(1, 2))
    
    # Generate heatmap
    heatmap = tf.reduce_sum(tf.multiply(weights[:, tf.newaxis, tf.newaxis, :], conv_output), axis=-1)
    heatmap = tf.maximum(heatmap, 0) / tf.math.reduce_max(heatmap)
    heatmap = heatmap.numpy()
    
    # Get original image
    original_image = input_tensor.numpy()
    original_image = (original_image - original_image.min()) / (original_image.max() - original_image.min() + 1e-8)
    
    return original_image, heatmap

def apply_grad_cam(original_image: np.ndarray,
                   heatmap: np.ndarray,
                   alpha: float = 0.4) -> np.ndarray:
    """
    Apply Grad-CAM heatmap to the original image.
    
    Args:
        original_image: Original image array
        heatmap: Grad-CAM heatmap
        alpha: Transparency of the heatmap
    
    Returns:
        Visualization image
    """
    # Resize heatmap to match image dimensions if necessary
    if original_image.shape[:2] != heatmap.shape:
        import cv2
        heatmap = cv2.resize(heatmap, (original_image.shape[1], original_image.shape[0]))
    
    # Create colored heatmap
    heatmap = np.uint8(255 * heatmap)
    heatmap = np.expand_dims(heatmap, axis=-1)
    heatmap_colored = np.zeros_like(original_image)
    heatmap_colored[:, :, 0] = heatmap[:, :, 0]  # Red channel
    
    # Combine original image with heatmap
    visualization = original_image + alpha * heatmap_colored
    visualization = np.clip(visualization, 0, 1)
    
    return visualization
