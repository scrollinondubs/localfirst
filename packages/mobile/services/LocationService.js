import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCATION_CACHE_KEY = 'cached_user_location';
const LOCATION_PERMISSION_ASKED_KEY = 'location_permission_asked';

class LocationService {
  constructor() {
    this.currentLocation = null;
    this.isWatching = false;
    this.watchSubscription = null;
    this.listeners = new Set();
  }

  // Add listener for location updates
  addLocationListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  // Notify all listeners of location changes
  notifyListeners(location) {
    this.listeners.forEach(callback => {
      try {
        callback(location);
      } catch (error) {
        console.error('Error in location listener:', error);
      }
    });
  }

  // Check if location permission has been asked before
  async hasAskedForPermission() {
    try {
      const hasAsked = await AsyncStorage.getItem(LOCATION_PERMISSION_ASKED_KEY);
      return hasAsked === 'true';
    } catch (error) {
      console.error('Error checking permission history:', error);
      return false;
    }
  }

  // Mark that we've asked for permission
  async markPermissionAsked() {
    try {
      await AsyncStorage.setItem(LOCATION_PERMISSION_ASKED_KEY, 'true');
    } catch (error) {
      console.error('Error saving permission history:', error);
    }
  }

  // Get current permission status
  async getPermissionStatus() {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      return status;
    } catch (error) {
      console.error('Error getting permission status:', error);
      return 'undetermined';
    }
  }

  // Request location permission with proper messaging
  async requestLocationPermission() {
    try {
      const currentStatus = await this.getPermissionStatus();
      
      // If already granted, return success
      if (currentStatus === 'granted') {
        return { success: true, status: 'granted' };
      }

      // If denied, we can't request again (user must go to settings)
      if (currentStatus === 'denied') {
        return { 
          success: false, 
          status: 'denied',
          message: 'Location permission was denied. Please enable location access in your device settings to discover nearby businesses.'
        };
      }

      // Request permission
      await this.markPermissionAsked();
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status === 'granted') {
        return { success: true, status: 'granted' };
      } else {
        return { 
          success: false, 
          status,
          message: 'Location access is needed to find businesses near you. You can still search by manually entering a location.'
        };
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
      return { 
        success: false, 
        status: 'error',
        message: 'Unable to request location permission. Please try again.'
      };
    }
  }

  // Get current location with caching
  async getCurrentLocation(useCache = true) {
    try {
      // Check permission first
      const permissionStatus = await this.getPermissionStatus();
      if (permissionStatus !== 'granted') {
        // Try to load cached location
        if (useCache) {
          const cachedLocation = await this.getCachedLocation();
          if (cachedLocation) {
            console.log('Using cached location (no permission)');
            return { 
              success: true, 
              location: cachedLocation,
              fromCache: true
            };
          }
        }
        
        return { 
          success: false, 
          error: 'Location permission not granted',
          needsPermission: true
        };
      }

      // Try to get fresh location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeout: 10000,
        maximumAge: 300000, // 5 minutes
      });

      if (location) {
        this.currentLocation = location;
        await this.cacheLocation(location);
        this.notifyListeners(location);
        
        return { 
          success: true, 
          location,
          fromCache: false
        };
      }

      // If fresh location fails, try cache
      if (useCache) {
        const cachedLocation = await this.getCachedLocation();
        if (cachedLocation) {
          console.log('Using cached location (fresh location failed)');
          return { 
            success: true, 
            location: cachedLocation,
            fromCache: true
          };
        }
      }

      return { 
        success: false, 
        error: 'Unable to determine current location'
      };

    } catch (error) {
      console.error('Error getting current location:', error);
      
      // Try cached location as fallback
      if (useCache) {
        const cachedLocation = await this.getCachedLocation();
        if (cachedLocation) {
          console.log('Using cached location (error occurred)');
          return { 
            success: true, 
            location: cachedLocation,
            fromCache: true
          };
        }
      }

      return { 
        success: false, 
        error: error.message || 'Location error occurred'
      };
    }
  }

  // Start watching location changes
  async startLocationWatch() {
    if (this.isWatching) return;

    try {
      const permissionStatus = await this.getPermissionStatus();
      if (permissionStatus !== 'granted') {
        console.log('Cannot watch location: permission not granted');
        return;
      }

      this.watchSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 30000, // 30 seconds
          distanceInterval: 100, // 100 meters
        },
        (location) => {
          this.currentLocation = location;
          this.cacheLocation(location);
          this.notifyListeners(location);
        }
      );

      this.isWatching = true;
      console.log('Started location watching');
    } catch (error) {
      console.error('Error starting location watch:', error);
    }
  }

  // Stop watching location changes
  stopLocationWatch() {
    if (this.watchSubscription) {
      try {
        this.watchSubscription.remove();
      } catch (error) {
        // On web, the remove() method may fail due to missing LocationEventEmitter.removeSubscription
        console.warn('Error removing location subscription (this is expected on web):', error.message);
      }
      this.watchSubscription = null;
    }
    this.isWatching = false;
    console.log('Stopped location watching');
  }

  // Cache location to AsyncStorage
  async cacheLocation(location) {
    try {
      const locationData = {
        coords: location.coords,
        timestamp: location.timestamp,
        cached_at: Date.now()
      };
      await AsyncStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(locationData));
    } catch (error) {
      console.error('Error caching location:', error);
    }
  }

  // Get cached location from AsyncStorage
  async getCachedLocation() {
    try {
      const cachedData = await AsyncStorage.getItem(LOCATION_CACHE_KEY);
      if (!cachedData) return null;

      const locationData = JSON.parse(cachedData);
      
      // Check if cached location is too old (24 hours)
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
      if (Date.now() - locationData.cached_at > maxAge) {
        console.log('Cached location too old, ignoring');
        return null;
      }

      return locationData;
    } catch (error) {
      console.error('Error getting cached location:', error);
      return null;
    }
  }

  // Get approximate location from IP address (fast fallback)
  async getIPLocation() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout

      const response = await fetch('https://ipapi.co/json/', {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error('IP geolocation failed');
      }

      const data = await response.json();
      
      if (!data.latitude || !data.longitude) {
        throw new Error('Invalid IP geolocation response');
      }

      // Format like GPS location for consistency
      const ipLocation = {
        coords: {
          latitude: data.latitude,
          longitude: data.longitude,
          accuracy: 5000, // ~5km typical IP accuracy
        },
        timestamp: Date.now(),
        fromIP: true,
      };

      console.log(`IP location: ${data.city}, ${data.region}`);
      return { success: true, location: ipLocation, fromIP: true };
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('IP geolocation timeout');
      } else {
        console.error('IP geolocation error:', error.message);
      }
      return { success: false, error: 'IP geolocation unavailable' };
    }
  }

  // Clear cached location
  async clearCachedLocation() {
    try {
      await AsyncStorage.removeItem(LOCATION_CACHE_KEY);
    } catch (error) {
      console.error('Error clearing cached location:', error);
    }
  }

  // Get formatted address from coordinates (reverse geocoding)
  async getAddressFromCoordinates(latitude, longitude) {
    try {
      const reverseGeocode = await Location.reverseGeocodeAsync({
        latitude,
        longitude
      });

      if (reverseGeocode && reverseGeocode.length > 0) {
        const address = reverseGeocode[0];
        const formattedAddress = [
          address.streetNumber,
          address.street,
          address.city,
          address.region,
          address.postalCode
        ].filter(Boolean).join(' ');

        return {
          success: true,
          address: formattedAddress,
          details: address
        };
      }

      return { success: false, error: 'No address found' };
    } catch (error) {
      console.error('Error getting address:', error);
      return { success: false, error: error.message };
    }
  }

  // Calculate distance between two points
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 3959; // Earth's radius in miles
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return Math.round(distance * 10) / 10; // Round to 1 decimal place
  }

  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  // Cleanup method
  cleanup() {
    this.stopLocationWatch();
    this.listeners.clear();
    this.currentLocation = null;
  }
}

// Export singleton instance
const locationService = new LocationService();
export default locationService;