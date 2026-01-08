const { GoogleGenerativeAI } = require('@google/generative-ai');
const { processMultipleImages } = require('./imageService');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Generate eBay title using AI
async function generateEbayTitle(amazonTitle, brand) {
  // Remove brand name from title
  let cleanTitle = amazonTitle;
  if (brand) {
    cleanTitle = amazonTitle.replace(new RegExp(brand, 'gi'), '').trim();
  }
  // Remove extra spaces and dashes
  cleanTitle = cleanTitle.replace(/\s+/g, ' ').replace(/^[\s\-]+|[\s\-]+$/g, '');
  return cleanTitle.substring(0, 80);
}

// Generate eBay description using AI
async function generateEbayDescription(amazonTitle, amazonDescription, brand, price, images = []) {
  // Remove brand name from description
  let description = amazonDescription || amazonTitle;
  if (brand) {
    description = description.replace(new RegExp(brand, 'gi'), '').trim();
  }
  
  // Create bullet points from description (5-6 points)
  const sentences = description.split(/[.!?]+/).filter(s => s.trim().length > 10);
  const bulletPoints = sentences.slice(0, 6).map(sentence => {
    let cleaned = sentence.trim();
    // Remove unwanted terms
    const unwantedTerms = ['MagSafe', 'Refund', 'Replace', 'Replacement', 'Return', 'Warranty', 'Guarantee', 'Amazon'];
    unwantedTerms.forEach(term => {
      cleaned = cleaned.replace(new RegExp(term, 'gi'), '');
    });
    if (brand) {
      cleaned = cleaned.replace(new RegExp(brand, 'gi'), '');
    }
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    return cleaned ? `<li>${cleaned}</li>` : '';
  }).filter(li => li).join('\n            ');
  
  // Get images
  const mainImage = images[0] || '';
  const image2 = images[1] || images[0] || '';
  const image3 = images[2] || images[0] || '';
  const image4 = images[3] || images[0] || '';
  
  // Remove brand from title
  let cleanTitle = amazonTitle;
  if (brand) {
    cleanTitle = amazonTitle.replace(new RegExp(brand, 'gi'), '').trim();
    cleanTitle = cleanTitle.replace(/\s+/g, ' ').replace(/^[\s\-]+|[\s\-]+$/g, '');
  }
  
  // Create HTML formatted description
  const htmlDescription = `<div style='max-width:1000px;margin:auto;font-family:Arial,Helvetica,sans-serif;'>

  <div style='background:#0a84c1;color:#fff;text-align:center;padding:18px;font-size:28px;font-weight:bold;'>
    ${cleanTitle}
  </div>

  <table width='100%' cellpadding='0' cellspacing='0' style='margin-top:30px;'>
    <tr>
      <td width='40%' align='center' valign='top'>
        <img src='${mainImage}' width='100%' style='border:1px solid #ccc;'>
      </td>

      <td width='60%' valign='top' style='padding-left:20px;font-size:15px;color:#000;'>
        <ul>
            ${bulletPoints}
        </ul>

        <table width='100%' cellpadding='5' cellspacing='0' style='margin-top:10px;'>
          <tr>
            <td align='center' width='33%'>
              <img src='${image2}' width='80%' style='border:1px solid #ccc;'>
            </td>
            <td align='center' width='33%'>
              <img src='${image3}' width='80%' style='border:1px solid #ccc;'>
            </td>
            <td align='center' width='33%'>
              <img src='${image4}' width='80%' style='border:1px solid #ccc;'>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>

  <div style='text-align:center;margin-top:20px;'>

    <div style='font-weight:bold;color:#0a84c1;font-size:20px;text-decoration:underline;'>
      Top Seller | Fast, Reliable Shipping | Always Free | 1-Day Processing | Customer Support You Can Trust
    </div>

    <br>

    <div style='font-weight:bold;color:#0b3c8c;text-decoration:underline;'>
      Questions? We're Happy to Help
    </div>

    <div style='color:#6a0dad;'>
      We're committed to giving you a five-star experience from start to finish.
      Whether you're just browsing or have already made a purchase, we're available
      to answer your questions quickly and clearly.
      <br><br>
      All communication is handled through eBay's messaging platform. We usually
      respond within 24 hours.
    </div>

    <br>

    <div style='font-weight:bold;color:#0b3c8c;text-decoration:underline;'>
      Buy with Confidence
    </div>

    <div style='color:#6a0dad;'>
      Each item is carefully inspected before shipping to ensure it arrives as described.
      <br><br>
      Orders ship within 1 business day using USPS or UPS. Shipping is always free.
    </div>

    <div style='font-weight:bold;color:#ff0000;margin-top:10px;'>
      ♦ Due to lighting and screen differences, actual color may vary slightly.
    </div>

    <div style='height:0.5cm;background:#1e90ff;margin:15px 0;'></div>

    <table width='100%' cellpadding='10' cellspacing='0'>
      <tr align='center'>
        <td style='font-size:40px'>🇺🇸<br><span style='font-size:16px;font-weight:bold'>Ship from USA</span></td>
        <td style='font-size:40px'>🚚<br><span style='font-size:16px;font-weight:bold'>Free & Fast Shipping</span></td>
        <td style='font-size:40px'>🛒<br><span style='font-size:16px;font-weight:bold'>30 Days Return</span></td>
      </tr>
    </table>

    <div style='height:0.5cm;background:#1e90ff;margin:15px 0;'></div>

  </div>

  <div style='margin-top:35px;text-align:center;font-size:18px;font-weight:bold;'>
    <a href='https://www.ebay.com/str/brightvision78' target='_blank' style='color:#0a84c1;text-decoration:none;'>
      PLEASE VISIT OUR STORE TO CHECK OTHER ITEMS!
    </a>
  </div>

  <div style='margin-top:10px;text-align:center;font-size:18px;color:#0a84c1;font-weight:bold;'>
    Thank you for shopping at our store.
  </div>

</div>`;
  
  return htmlDescription;
}

// Generate both eBay title and description
async function generateEbayContent(product, baseUrl = 'http://localhost:8000') {
  console.log(`📝 Generating eBay content for ${product.brand}...`);
  
  // Process images with overlay
  let processedImages = product.images || [];
  if (product.images && product.images.length > 0 && product.asin) {
    console.log(`🖼️ Processing images with overlay for ${product.asin}...`);
    processedImages = await processMultipleImages(product.images, product.asin, baseUrl);
    console.log(`✅ Images processed: ${processedImages.length} images`);
    console.log(`First processed image: ${processedImages[0]}`);
  }
  
  const [ebayTitle, ebayDescription] = await Promise.all([
    generateEbayTitle(product.title, product.brand),
    generateEbayDescription(product.title, product.description, product.brand, product.price, processedImages)
  ]);

  console.log(`✅ Content generation successful`);
  return {
    title: ebayTitle,
    description: ebayDescription,
    image: processedImages && processedImages[0] ? processedImages[0] : (product.images && product.images[0] ? product.images[0] : ''),
    imageLinks: processedImages.join(' | ')
  };
}

module.exports = {
  generateEbayTitle,
  generateEbayDescription,
  generateEbayContent
};