const sharp = require('sharp');
const axios = require('axios');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const FormData = require('form-data');

const OVERLAYS_DIR = path.join(__dirname, '../public/overlays');
const PROCESSED_DIR = path.join(__dirname, '../public/processed');
const IMGBB_API_KEY = process.env.IMGBB_API_KEY; // Add this to your .env file

// Upload image to ImgBB
async function uploadToImgBB(imagePath) {
  try {
    if (!IMGBB_API_KEY) {
      console.log('⚠️ IMGBB_API_KEY not configured, using local URL');
      return null;
    }

    const imageBuffer = await fs.readFile(imagePath);
    const base64Image = imageBuffer.toString('base64');
    
    const formData = new FormData();
    formData.append('image', base64Image);
    
    console.log('☁️ Uploading to ImgBB...');
    const response = await axios.post(
      `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`,
      formData,
      {
        headers: formData.getHeaders(),
        timeout: 30000
      }
    );
    
    if (response.data && response.data.data && response.data.data.url) {
      console.log('✅ Image uploaded to ImgBB:', response.data.data.url);
      return response.data.data.url;
    }
    
    return null;
  } catch (error) {
    console.error('❌ ImgBB upload error:', error.message);
    return null;
  }
}

// Create overlay from images (USA Seller badge + Free Shipping badge)
async function createOverlay() {
  try {
    // Create a composite overlay with USA Seller (top-left) and Free Shipping (top-right)
    const overlayPath = path.join(OVERLAYS_DIR, 'badges-overlay.png');
    
    // Check if overlay already exists
    try {
      await fs.access(overlayPath);
      return overlayPath;
    } catch {
      // Overlay doesn't exist, we'll create a simple one or user needs to provide it
      console.log('⚠️ Overlay image not found. Please add badges-overlay.png to backend/public/overlays/');
      return null;
    }
  } catch (error) {
    console.error('Error creating overlay:', error);
    return null;
  }
}

// Download image from URL
async function downloadImage(url) {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    return Buffer.from(response.data);
  } catch (error) {
    console.error('Error downloading image:', error.message);
    return null;
  }
}

// Upload image to ImgBB
async function uploadToImgBB(imagePath, filename) {
  try {
    if (!IMGBB_API_KEY) {
      console.log('⚠️ IMGBB_API_KEY not set, returning local path');
      return null;
    }

    console.log(`📤 Uploading ${filename} to ImgBB...`);
    console.log(`API Key present: ${IMGBB_API_KEY ? 'Yes' : 'No'}`);
    
    const imageBuffer = await fs.readFile(imagePath);
    const base64Image = imageBuffer.toString('base64');
    
    console.log(`Image buffer size: ${imageBuffer.length} bytes`);
    console.log(`Base64 size: ${base64Image.length} characters`);
    
    const formData = new FormData();
    formData.append('image', base64Image);
    formData.append('name', filename);
    
    const response = await axios.post(
      `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`,
      formData,
      {
        headers: formData.getHeaders(),
        timeout: 30000
      }
    );
    
    console.log(`ImgBB Response Status: ${response.status}`);
    console.log(`ImgBB Response Data:`, JSON.stringify(response.data, null, 2));
    
    if (response.data && response.data.data && response.data.data.url) {
      console.log(`✅ Uploaded to ImgBB: ${response.data.data.url}`);
      return response.data.data.url;
    }
    
    console.log('⚠️ No URL in ImgBB response');
    return null;
  } catch (error) {
    console.error('❌ ImgBB upload error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    return null;
  }
}

// Process image with overlay
async function processImageWithOverlay(imageUrl, asin, baseUrl = '') {
  try {
    // Generate unique filename based on ASIN
    const hash = crypto.createHash('md5').update(imageUrl).digest('hex').substring(0, 8);
    const outputFilename = `${asin}-${hash}.jpg`;
    const outputPath = path.join(PROCESSED_DIR, outputFilename);
    
    let needsProcessing = true;
    
    // Check if processed image already exists locally
    try {
      await fs.access(outputPath);
      console.log(`📁 Found cached local image: ${outputFilename}`);
      needsProcessing = false;
    } catch {
      console.log(`📥 Image not cached, will process`);
    }

    // If file doesn't exist locally, download and process it
    if (needsProcessing) {
      // Download the original image
      console.log(`📥 Downloading image for ${asin}...`);
      const imageBuffer = await downloadImage(imageUrl);
      if (!imageBuffer) {
        console.log(`❌ Failed to download image for ${asin}`);
        return imageUrl; // Return original if download fails
      }

      // Get overlay path
      const overlayPath = path.join(OVERLAYS_DIR, 'badges-overlay.png');
      
      // Check if overlay exists
      try {
        await fs.access(overlayPath);
      } catch {
        console.log('⚠️ Overlay not found at:', overlayPath);
        return imageUrl;
      }

      // Load and process the image
      const image = sharp(imageBuffer);
      const metadata = await image.metadata();
      
      console.log(`📏 Image dimensions: ${metadata.width}x${metadata.height}`);
      
      // Resize overlay to match image width (overlay will be at top)
      const overlayBuffer = await sharp(overlayPath)
        .resize({ width: metadata.width })
        .toBuffer();

      // Composite the overlay on top of the image
      await image
        .composite([{
          input: overlayBuffer,
          top: 0,
          left: 0
        }])
        .jpeg({ quality: 90 })
        .toFile(outputPath);

      console.log(`✅ Image processed and saved locally`);
    }
    
    // Always try to upload to ImgBB (whether cached or newly processed)
    console.log(`🔄 Attempting ImgBB upload...`);
    const imgbbUrl = await uploadToImgBB(outputPath, outputFilename);
    
    if (imgbbUrl) {
      console.log(`✅ Returning ImgBB URL: ${imgbbUrl}`);
      return imgbbUrl; // Return ImgBB URL
    } else {
      // Fallback to local URL
      const processedUrl = baseUrl ? `${baseUrl}/processed/${outputFilename}` : `/processed/${outputFilename}`;
      console.log(`⚠️ Using local URL: ${processedUrl}`);
      return processedUrl;
    }
  } catch (error) {
    console.error('❌ Error processing image:', error.message);
    return imageUrl; // Return original on error
  }
}

// Process multiple images (only main image gets overlay)
async function processMultipleImages(images, asin, baseUrl = 'http://localhost:8000') {
  if (!images || images.length === 0) return [];
  
  console.log(`🖼️ Processing images for ${asin}...`);
  const processedImages = [];
  
  // Process ONLY the first image with overlay
  console.log(`Processing main image: ${images[0]}`);
  const processedMainImage = await processImageWithOverlay(images[0], asin, baseUrl);
  processedImages.push(processedMainImage);
  
  // Add remaining images without processing (up to 4 images total)
  for (let i = 1; i < Math.min(images.length, 4); i++) {
    console.log(`Adding image ${i + 1} without overlay: ${images[i]}`);
    processedImages.push(images[i]);
  }
  
  console.log(`✅ Processed 1 image with overlay, added ${processedImages.length - 1} without overlay`);
  console.log(`All image URLs:`, processedImages);
  return processedImages;
}

module.exports = {
  processImageWithOverlay,
  processMultipleImages,
  createOverlay
};
