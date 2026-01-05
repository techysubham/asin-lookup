# Amazon ASIN Lookup Tool

A full-stack application for looking up Amazon product information using ASINs (Amazon Standard Identification Numbers). Supports both single and batch lookups.

## Features

- 🔍 **Single & Batch Lookup** - Look up one or multiple ASINs at once
- 💾 **MongoDB Caching** - Caches product data for 30 days to reduce API calls
- ⚡ **Fast Response** - Returns cached data instantly when available
- 📦 **Complete Product Info** - Title, brand, price, images, and descriptions
- 🎨 **Modern UI** - Clean, responsive React interface with grid layout

## Tech Stack

### Backend
- Node.js + Express
- MongoDB for caching
- Amazon Product API integration

### Frontend
- React + Vite
- Modern CSS with responsive design

## Setup

### Prerequisites
- Node.js (v14 or higher)
- MongoDB Atlas account (or local MongoDB)

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd asin-lookup
```

2. Install backend dependencies:
```bash
cd backend
npm install
```

3. Install frontend dependencies:
```bash
cd ../frontend
npm install
```

4. Create a `.env` file in the `backend` directory:
```env
MONGO_URI=your_mongodb_connection_string
PORT=8000
CACHE_TTL=2592000
```

### Running the Application

1. Start the backend server:
```bash
cd backend
npm start
```

2. Start the frontend development server:
```bash
cd frontend
npm run dev
```

3. Open your browser to `http://localhost:5173`

## Deployment

### Deploying to Vercel

This project can be deployed to Vercel in two ways:

#### Option 1: Deploy Frontend and Backend Separately (Recommended)

1. **Deploy Backend:**
   - Create a new Vercel project for the backend
   - Set root directory to `backend`
   - Add environment variables: `MONGO_URI`, `PORT`, `CACHE_TTL`
   - Deploy

2. **Deploy Frontend:**
   - Create another Vercel project for the frontend
   - Set root directory to `frontend`
   - Add environment variable: `VITE_API_BASE=https://your-backend-url.vercel.app`
   - Deploy

#### Option 2: Deploy as Monorepo (Frontend Only)

The current `vercel.json` deploys only the frontend. You'll need to:
1. Deploy the backend separately (Render, Railway, or another Vercel project)
2. Update the `VITE_API_BASE` environment variable in Vercel with your backend URL

## Usage

1. Enter one or more ASINs in the text area:
   - Comma-separated: `B0CGV192GK, B08N5WRWNW, B07XJ8C8F5`
   - One per line
2. Click "Lookup" or press Ctrl+Enter
3. View product details in a responsive grid layout

## API Endpoints

- `GET /product/:asin` - Get single product by ASIN
- `POST /products` - Get multiple products (send `{ "asins": ["ASIN1", "ASIN2"] }`)
- `GET /` - Health check

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MONGO_URI` | MongoDB connection string | `mongodb://localhost:27017` |
| `PORT` | Backend server port | `8000` |
| `CACHE_TTL` | Cache time-to-live in seconds | `2592000` (30 days) |

## License

MIT
