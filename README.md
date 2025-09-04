# Firebase Notification Server

This is a backend server that sends **real system notifications** to your React Native app using Firebase Cloud Messaging (FCM).

## 🚀 Quick Setup

### 1. Install Dependencies

```bash
cd backend-example
npm install
```

### 2. Get Firebase Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Project Settings** (gear icon)
4. Click **Service Accounts** tab
5. Click **Generate new private key**
6. Download the JSON file
7. Save it as `firebase-service-account-key.json` in this directory

### 3. Update Server Configuration

Edit `firebase-notification-server.js` and update the path to your service account key:

```javascript
const serviceAccount = require('./firebase-service-account-key.json');
```

### 4. Start the Server

```bash
npm start
```

Or for development with auto-reload:

```bash
npm run dev
```

The server will run on `http://localhost:3000`

## 📱 Update Your React Native App

Update the backend URL in your NotificationService:

```typescript
// In app/services/NotificationService.ts
const BACKEND_URL = 'http://your-server-url.com'; // Replace with your server URL
```

For local testing, use:
```typescript
const BACKEND_URL = 'http://localhost:3000'; // For local development
```

## 🔔 API Endpoints

### Send Single Notification

**POST** `/api/send-notification`

```json
{
  "token": "FCM_TOKEN_HERE",
  "notification": {
    "title": "Welcome to Sunrise B2B! 🌅",
    "body": "Your account is ready. Start exploring!"
  },
  "data": {
    "type": "welcome",
    "action": "open_app"
  }
}
```

### Send Multicast Notification

**POST** `/api/send-multicast-notification`

```json
{
  "tokens": ["FCM_TOKEN_1", "FCM_TOKEN_2"],
  "notification": {
    "title": "New Feature Available!",
    "body": "Check out our latest updates"
  },
  "data": {
    "type": "feature_update"
  }
}
```

### Health Check

**GET** `/health`

Returns server status.

## 🧪 Testing

### Test with curl

```bash
# Send a test notification
curl -X POST http://localhost:3000/api/send-notification \
  -H "Content-Type: application/json" \
  -d '{
    "token": "YOUR_FCM_TOKEN_HERE",
    "notification": {
      "title": "Test Notification",
      "body": "This is a test from your backend!"
    },
    "data": {
      "type": "test"
    }
  }'
```

### Test with Postman

1. Create a POST request to `http://localhost:3000/api/send-notification`
2. Set Content-Type to `application/json`
3. Use the JSON body format shown above
4. Replace `YOUR_FCM_TOKEN_HERE` with an actual FCM token from your app

## 🔧 How It Works

1. **App Installation**: When users install your app, it generates an FCM token
2. **Token Registration**: The app sends the FCM token to your backend
3. **Notification Trigger**: Your backend sends notifications using Firebase Admin SDK
4. **System Notification**: Users see real notifications in their notification tray

## 🌐 Deployment

### Deploy to Heroku

1. Create a Heroku app
2. Add your Firebase service account key as environment variables
3. Deploy the code
4. Update your React Native app with the Heroku URL

### Deploy to Vercel/Netlify

1. Upload your code to GitHub
2. Connect to Vercel/Netlify
3. Add environment variables for Firebase config
4. Deploy

### Deploy to AWS/Google Cloud

1. Create a server instance
2. Install Node.js
3. Upload your code
4. Install dependencies
5. Start the server with PM2 or similar

## 🔐 Security

- Add authentication to your endpoints
- Validate FCM tokens
- Rate limit requests
- Use HTTPS in production
- Store Firebase service account key securely

## 📝 Environment Variables

For production, use environment variables instead of hardcoded values:

```bash
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email
PORT=3000
```

## 🎯 Next Steps

1. Set up your backend server
2. Update the BACKEND_URL in your React Native app
3. Test notifications
4. Deploy to production
5. Add user authentication
6. Implement notification scheduling
7. Add analytics and monitoring

Now your users will receive **real system notifications** in their notification tray! 🔔✨
