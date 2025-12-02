# OC Pathfinder - Campus Navigation Mobile App

A React Native mobile application for campus navigation with pathfinding, interactive maps, and 360° room views.

## Features

### User Features
- 🗺️ **Interactive Campus Navigation**: Search and select starting point and destination
- 🎯 **Smart Pathfinding**: A* algorithm-based route calculation
- 📍 **Visual Route Display**: See your route on the campus map
- 📷 **360° Room Views**: Explore panoramic images of locations
- 🧭 **Turn-by-Turn Directions**: Step-by-step navigation instructions
- ⚡ **Fast Search**: Quick location search with filtering

### Admin Features (Hidden Login)
- 🔐 **Secure Admin Access**: Secret tap login (tap title 5 times)
- ➕ **Node Management**: Add, edit, delete location nodes
- 🔗 **Edge Management**: View and delete path connections
- 🏷️ **Annotation Management**: Manage 360° image labels
- 📸 **Image Upload**: Upload 360° panorama images
- 🗺️ **Map Positioning**: Set node coordinates on campus map

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- Django backend running (from `record` folder)
- Android Studio (for Android) or Xcode (for iOS)

## Backend Setup

1. Navigate to the Django backend folder:
   ```bash
   cd ../record
   ```

2. Start the Django development server:
   ```bash
   python manage.py runserver 0.0.0.0:8000
   ```

3. Make sure your Django backend is accessible from your mobile device or emulator.

## Mobile App Setup

1. Install dependencies:
   ```bash
   cd OC-PATHFINDER
   npm install
   ```

2. Configure the API endpoint in `config.js`:
   ```javascript
   // For Android Emulator
   export const API_BASE_URL = 'http://10.0.2.2:8000';
   
   // For iOS Simulator
   export const API_BASE_URL = 'http://localhost:8000';
   
   // For Physical Device (replace with your computer's IP)
   export const API_BASE_URL = 'http://YOUR_IP_ADDRESS:8000';
   ```

3. Start the Expo development server:
   ```bash
   npm start
   ```

4. Run on your device:
   - **Android Emulator**: Press `a`
   - **iOS Simulator**: Press `i`
   - **Physical Device**: Scan QR code with Expo Go app

## Usage

### For Regular Users

1. **Welcome Screen**: Auto-navigates to main screen after 3 seconds or tap "Get Started"

2. **Point Selection**:
   - Tap "Starting Point" to select your current location
   - Tap "Destination" to select where you want to go
   - Use the search bar to find locations quickly
   - Tap "Find Path" to calculate route

3. **Map Display**:
   - View your route on the campus map
   - See turn-by-turn directions
   - Tap on waypoints to see details
   - View 360° images of locations along the route

### For Administrators

1. **Access Admin Panel**:
   - On Point Selection screen, tap the title "Find Your Way" 5 times rapidly
   - Enter admin credentials (username and password)
   - You'll be redirected to the Admin Dashboard

2. **Manage Nodes**:
   - Add new locations with name, building, floor, coordinates
   - Upload 360° panorama images
   - Edit or delete existing nodes
   - QR codes are auto-generated

3. **Manage Edges**:
   - View all path connections
   - Delete inactive or incorrect edges
   - (Full edge creation available on web interface)

4. **Manage Annotations**:
   - View 360° image annotations
   - Delete unwanted annotations
   - (Full annotation editing available on web interface)

## API Endpoints

The app uses the following API endpoints:

### Public Endpoints
- `GET /api/mobile/nodes/` - List all nodes
- `GET /api/mobile/nodes/{id}/` - Get node details
- `GET /api/mobile/buildings/` - List all buildings
- `GET /api/mobile/campus-map/` - Get campus map
- `POST /api/mobile/find-path/` - Calculate path
- `GET /api/mobile/edges/` - List all edges
- `GET /api/mobile/annotations/` - List all annotations

### Admin Endpoints (Authentication Required)
- `POST /api/mobile/admin/login/` - Admin login
- `POST /api/mobile/admin/nodes/create/` - Create node
- `PUT /api/mobile/admin/nodes/{id}/update/` - Update node
- `DELETE /api/mobile/admin/nodes/{id}/delete/` - Delete node
- `DELETE /api/mobile/admin/edges/{id}/delete/` - Delete edge
- `DELETE /api/mobile/admin/annotations/{id}/delete/` - Delete annotation

## Configuration

### Theme Colors (config.js)
```javascript
THEME_COLORS = {
  primary: '#1976D2',      // Main blue
  secondary: '#FFC107',    // Amber
  accent: '#FF5722',       // Red accent
  background: '#F5F5F5',   // Light gray
  // ... more colors
}
```

### Admin Secret Taps
Change the number of taps required for admin login in `config.js`:
```javascript
APP_CONFIG = {
  ADMIN_SECRET_TAPS: 5,  // Default: 5 taps
}
```

## Project Structure

```
OC-PATHFINDER/
├── screens/
│   ├── WelcomeScreen.js           # Splash/welcome screen
│   ├── PointSelectionScreen.js    # Start/end point selection
│   ├── MapDisplayScreen.js        # Route visualization
│   └── admin/
│       ├── AdminDashboardScreen.js
│       ├── NodesListScreen.js
│       ├── NodeFormScreen.js
│       ├── EdgesListScreen.js
│       └── AnnotationsListScreen.js
├── services/
│   └── ApiService.js              # API communication layer
├── contexts/
│   └── AuthContext.js             # Authentication state
├── config.js                      # App configuration
├── App.js                         # Main navigation
└── package.json
```

## Dependencies

Key packages used:
- **React Navigation**: App navigation
- **Axios**: HTTP requests
- **React Native Paper**: UI components
- **Expo Image Picker**: Image uploads
- **React Native SVG**: Map route rendering
- **AsyncStorage**: Local data storage

## Troubleshooting

### Cannot connect to backend
- Make sure Django server is running
- Check `API_BASE_URL` in `config.js`
- For physical devices, use your computer's IP address
- Ensure firewall allows connections on port 8000

### Images not loading
- Check Django media files are properly configured
- Verify `MEDIA_URL` and `MEDIA_ROOT` in Django settings
- Ensure images are accessible via HTTP

### Admin login not working
- Verify Django admin user exists
- Check user has `is_staff = True`
- Ensure CSRF exemption is configured for API endpoints

## Building for Production

### Android APK
```bash
expo build:android
```

### iOS App
```bash
expo build:ios
```

## License

This project is part of the OC Campus Navigation System.

## Support

For issues or questions, please refer to the main project documentation in the `record` folder.
