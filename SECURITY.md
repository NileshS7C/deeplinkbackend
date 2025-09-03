# Backend Security Configuration

## 🔒 Security Setup

1. **Firebase Service Account Key**
   - Download your Firebase service account key from Firebase Console
   - Save it as `config/firebase-service-account.json`
   - Never commit this file to version control

2. **Environment Variables**
   - Copy the generated `.env` file and update values as needed
   - Set `MONGODB_URI` to your actual MongoDB connection string
   - Update `ALLOWED_ORIGINS` with your actual frontend domains

3. **Production Deployment**
   - Use environment variables instead of .env files in production
   - Ensure all sensitive data is properly secured
   - Use proper SSL/TLS certificates

## 🚀 Running the Backend

```bash
cd backend-example
npm install
npm start
```

## 📝 Environment Variables

See the generated `.env` file for all required variables.
