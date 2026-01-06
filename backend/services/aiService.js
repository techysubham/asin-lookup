const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Generate eBay title using AI
async function generateEbayTitle(amazonTitle, brand) {
  // Using fallback logic - AI disabled due to API issues
  const titleParts = [];
  if (brand) titleParts.push(brand);
  const cleanTitle = amazonTitle.replace(new RegExp(brand, 'gi'), '').trim();
  titleParts.push(cleanTitle.substring(0, 60));
  return titleParts.join(' - ').substring(0, 80);
}

// Generate eBay description using AI
async function generateEbayDescription(amazonTitle, amazonDescription, brand, price) {
  // Using fallback logic - AI disabled due to API issues
  if (amazonDescription) {
    const words = amazonDescription.split(' ').slice(0, 80).join(' ');
    return words;
  }
  return `Quality ${brand} product - ${amazonTitle}. Great value at ${price}. Shop with confidence.`;
}

// Generate both eBay title and description
async function generateEbayContent(product) {
  console.log(`📝 Generating eBay content for ${product.brand}...`);
  const [ebayTitle, ebayDescription] = await Promise.all([
    generateEbayTitle(product.title, product.brand),
    generateEbayDescription(product.title, product.description, product.brand, product.price)
  ]);

  console.log(`✅ Content generation successful`);
  return {
    title: ebayTitle,
    description: ebayDescription,
    image: product.images && product.images[0] ? product.images[0] : ''
  };
}

module.exports = {
  generateEbayTitle,
  generateEbayDescription,
  generateEbayContent
};