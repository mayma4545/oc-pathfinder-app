# OC Pathfinder - Complete Setup Guide

## Step-by-Step Installation

### Part 1: Backend (Django) Setup

1. **Navigate to the backend directory**:
   ```powershell
   cd c:\Users\Admin\Desktop\recorder\record
   ```

2. **Ensure Python virtual environment is activated** (if you have one):
   ```powershell
   # If you have a venv
   .\venv\Scripts\Activate.ps1
   ```

3. **Install any missing dependencies** (if needed):
   ```powershell
   pip install djangorestframework
   ```

4. **Run migrations** (if this is first time setup):
   ```powershell
   python manage.py migrate
   ```

5. **Create a superuser for admin access** (if not already created):
   ```powershell
   python manage.py createsuperuser
   # Follow prompts to create username and password
   ```

6. **Start the Django development server**:
   ```powershell
   python manage.py runserver 0.0.0.0:8000
   ```
   
   Keep this terminal window open. The server must be running for the mobile app to work.

### Part 2: Mobile App (React Native) Setup

1. **Open a NEW PowerShell terminal**

2. **Navigate to the mobile app directory**:
   ```powershell
   cd c:\Users\Admin\Desktop\recorder\OC-PATHFINDER
   ```

3. **Install dependencies**:
   ```powershell
   npm install
   ```
   
   This will install all required packages including:
   - React Navigation
   - Axios
   - React Native Paper
   - Expo Image Picker
   - And more...

4. **Configure the API endpoint**:
   - Open `config.js` in your editor
   - Update `API_BASE_URL` based on your setup:
     - For **Android Emulator**: Use `http://10.0.2.2:8000` (default)
     - For **iOS Simulator**: Use `http://localhost:8000`
     - For **Physical Device**: Use `http://YOUR_COMPUTER_IP:8000`
   
   To find your computer's IP on Windows:
   ```powershell
   ipconfig
   # Look for "IPv4 Address" under your active network adapter
   ```

5. **Start the Expo development server**:
   ```powershell
   npm start
   ```
   
   This will open Expo DevTools in your browser.

6. **Run the app**:
   
   **Option A: Android Emulator**
   - Make sure Android Studio and an emulator are running
   - Press `a` in the terminal
   
   **Option B: iOS Simulator** (Mac only)
   - Make sure Xcode is installed
   - Press `i` in the terminal
   
   **Option C: Physical Device**
   - Install "Expo Go" app from Play Store (Android) or App Store (iOS)
   - Scan the QR code shown in terminal/browser
   - Make sure your phone is on the same WiFi network as your computer

## Verification

### Test the Backend

1. Open browser and go to: `http://localhost:8000/api/mobile/nodes/`
   - You should see a JSON response with nodes data

2. Go to: `http://localhost:8000/admin/`
   - Log in with your superuser credentials
   - Verify you can access Django admin

### Test the Mobile App

1. **Welcome Screen**: Should appear automatically
2. **Point Selection**: Should load after 3 seconds
3. **Try selecting locations**: Tap on "Starting Point" or "Destination"
   - If nodes appear, backend connection is working! ✅
   - If you get errors, check your API_BASE_URL configuration

### Test Admin Features

1. On the Point Selection screen, tap the title "Find Your Way" **5 times rapidly**
2. Enter your Django superuser credentials
3. You should be redirected to Admin Dashboard
4. Try navigating to "Manage Nodes" to verify CRUD operations work

## Common Issues and Solutions

### Issue: "Network Error" or "Failed to load nodes"

**Solution**:
1. Verify Django server is running on port 8000
2. Check `API_BASE_URL` in `config.js`
3. For physical devices, ensure:
   - Phone and computer are on same WiFi
   - Windows Firewall allows port 8000
   - Using correct IP address

To allow port 8000 in Windows Firewall:
```powershell
New-NetFirewallRule -DisplayName "Django Dev Server" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow
```

### Issue: "Unable to resolve module"

**Solution**:
```powershell
npm install
# Then clear cache
npm start -- --clear
```

### Issue: Images not loading

**Solution**:
1. Check Django `settings.py` has correct `MEDIA_URL` and `MEDIA_ROOT`
2. Verify media files exist in `record/media/`
3. Ensure Django serves media files in development:
   
   In `record/urls.py`, add:
   ```python
   from django.conf import settings
   from django.conf.urls.static import static
   
   urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
   ```

### Issue: Admin login fails

**Solution**:
1. Verify superuser exists: `python manage.py createsuperuser`
2. Check user has `is_staff = True` in Django admin
3. Ensure CSRF is exempted for API endpoints (already done in code)

## What's Next?

### Add Sample Data

You can add sample data through:
1. Django admin interface: `http://localhost:8000/admin/`
2. Mobile app admin features
3. Load sample data script (if available)

### Features to Try

1. **Create Nodes**: Add rooms and locations
2. **Create Edges**: Connect nodes to create paths
3. **Upload 360° Images**: Add panoramic views
4. **Add Annotations**: Label features in 360° images
5. **Test Pathfinding**: Select start and end points to see routes

## Development Tips

### Hot Reload
- The app supports hot reload - changes to code will reflect automatically
- If something doesn't update, shake your device or press `R` to reload

### Debugging
- Shake your device to open Developer Menu
- Enable "Remote JS Debugging" to use Chrome DevTools
- Check logs in the terminal running `npm start`

### Building for Production

When ready to deploy:
```powershell
# Android
expo build:android

# iOS (requires Mac)
expo build:ios
```

## Architecture Overview

```
┌─────────────────────────────────────┐
│     React Native Mobile App         │
│  (OC-PATHFINDER - Expo/React)      │
│                                     │
│  - User Interface                   │
│  - Navigation                       │
│  - 360° Image Viewer               │
│  - Admin Panel                      │
└──────────────┬──────────────────────┘
               │
               │ HTTP/REST API
               │
┌──────────────▼──────────────────────┐
│       Django Backend Server         │
│     (record - Python/Django)        │
│                                     │
│  - REST API Endpoints               │
│  - A* Pathfinding Algorithm        │
│  - Database (SQLite)                │
│  - Media File Storage               │
└─────────────────────────────────────┘
```

## Support

If you encounter any issues not covered here:
1. Check the main README.md
2. Review error messages in terminal
3. Check Django server logs
4. Verify all dependencies are installed

Happy navigating! 🗺️✨
