# HeartLen App

## Project Overview

The HeartLen App is a web-based tool designed to process photoplethysmography (PPG) signals captured via a webcam. It calculates heart rate, heart rate variability (HRV), and signal quality using machine learning models. The processed data can be saved to a MongoDB database for further analysis.

## Installation Instructions

### Prerequisites
- **Node.js** (v18 or higher)
- **MongoDB Atlas account** (or local MongoDB instance)

### Steps
1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/heartlen-app.git
   cd heartlen-app

2. **Install dependencies:**
   ```bash
   npm install
   
3. **Set up environment variables: Create a .env.local file in the root directory and add your MongoDB connection string:**
   ```bash
   MONGODB_URI=your_mongodb_connection_string

4. **Start the development server:**
   ```bash
   npm run dev

5.**Open the app in your browser: Navigate to http://localhost:3000**


## Linking to Database

### Connecting to MongoDB database

To link the app to your MongoDB database:
1. **Create a MongoDB Atlas cluster:**
- Sign up at MongoDB Atlas or set up a local MongoDB instance.

2. **Get the Connection String:**
- Copy the connection string from MongoDB Atlas and paste it into the `.env.local` file as shown above.

3. **Configure `.env.local`:**
- Paste the connection string into your `.env.local` file as `MONGODB_URI`.

4. **Database Collection:**
- Ensure the database has a collection named records to store PPG data (the app creates this automatically if it doesn’t exist).

## Deployment

### Deployment Steps

To deploy the app to a platform like Vercel:

1. **Build the production version:**
   ```bash
   npm run build

2. **Deploy:**
   - Install the Vercel CLI:
   ```bash
   npm install -g vercel
   ```

   - Run the deployment command:
   ```bash
   vercel
   ```

   - Follow the prompts to link your GitHub repo and configure the project.
   
3. **Environment Variables:**
   - Add `MONGODB_URI` to Vercel’s environment variables via the dashboard or CLI:
   ```bash
   vercel env add MONGODB_URI
   ```
   
4. **Access the App:**
   - After deployment, Vercel provides a URL (e.g., `https://heartlen-app.vercel.app`).



## Repository Structure
```
├── /app
│ ├── /components # React components (CameraFeed, ChartComponent, MetricsCard, SignalCombinationSelector)
│ ├── /hooks # Custom hooks (usePPGProcessing, useSignalQuality, useMongoDB)
│ ├── /api # Backend API routes (not implemented yet)
│ └── page.tsx # Main application file
│
├── /public # Public assets (e.g., favicon.ico)
├── /types # TypeScript types (if added later)
├── README.md # Developer instructions (this file)
└── package.json # Dependencies and scripts
```
#### **Vercel link:** `https://vercel.com/williams-projects-b38d639d/heartlens](https://heartlens-three.vercel.app/`
