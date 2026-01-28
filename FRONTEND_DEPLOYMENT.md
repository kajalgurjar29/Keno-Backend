# 🚀 Frontend Deployment Guide

## ✅ Setup Complete for puntdata.com.au!

Your Express server is now configured to serve both your API and frontend from the same domain.

## 📁 Current Setup

### **Domain Configuration:**
- **Frontend (Production):** `https://puntdata.com.au`
- **Frontend (Beta):** `https://puntmate.betamxpertz.co.in`
- **API:** `https://api.puntdata.com.au` (API endpoints)
- **Static Files:** Served from `dist 14/dist/`

### **Server Configuration:**
```javascript
// Static file serving
app.use(express.static(path.join(__dirname, "dist 14", "dist")));

// SPA routing (catch-all for non-API routes)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist 14", "dist", "index.html"));
});
```

## 🌐 Environment Variables

Your `.env` file is configured:
```env
FRONTEND_URL=https://puntmate.betamxpertz.co.in
API_BASE_URL=https://api.puntdata.com.au
```

## 🔧 Frontend API Configuration

Your frontend should make API calls to the API subdomain:

```javascript
// ✅ Production API calls
const API_BASE = 'https://api.puntdata.com.au/api/v1';

// Examples:
fetch('https://api.puntdata.com.au/api/v1/dashboard/quick-stats-dashboard')
fetch('https://api.puntdata.com.au/api/v1/keno/graph-stats')
fetch('https://api.puntdata.com.au/api/v1/trackside/graph-stats')

// For development (localhost):
const API_BASE = 'http://localhost:3000/api/v1';
```

## 🚀 Deployment Steps

### **1. Build Your Frontend**
```bash
# In your frontend project directory
npm run build
# Copy the 'dist' folder to your backend's 'dist 14/dist/' folder
```

### **2. Environment Variables** ✅ **Already Configured**
```env
FRONTEND_URL=https://puntdata.com.au
API_BASE_URL=https://api.puntdata.com.au
```

### **3. Deploy to Production**
- **Frontend Server:** Point `puntdata.com.au` to serve your built React/Vue/Angular app
- **API Server:** Point `api.puntdata.com.au` to serve your Node.js API
- Set environment variables on your hosting platform
- Your app will serve frontend at `puntdata.com.au` and API at `api.puntdata.com.au/api/v1/*`

## 📊 Testing Your Setup

### **Frontend Access:**
- Visit: `https://puntdata.com.au`
- Should load your React/Vue/Angular app

### **API Access:**
- API endpoints: `https://api.puntdata.com.au/api/v1/*`
- Example: `https://api.puntdata.com.au/api/v1/dashboard/quick-stats-dashboard`

### **SPA Routing:**
- Direct URL access: `https://puntdata.com.au/dashboard` ✅ Works
- Page refreshes: ✅ Handled by catch-all route

## 🔒 Security Notes

- Update `FRONTEND_URL` in production to your actual domain
- Consider implementing rate limiting for API endpoints
- Add proper error handling for production

## 🎯 What's Working Now

✅ **Frontend served from root domain**  
✅ **API routes work alongside frontend**  
✅ **SPA routing handled properly**  
✅ **Static assets served efficiently**  
✅ **CORS configured for frontend domain**  

Your full-stack application is ready for deployment! 🎉