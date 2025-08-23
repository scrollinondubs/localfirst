import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { getBaseUrl, API_CONFIG } from '../config/api';

export default function DebugInfo() {
  const [isVisible, setIsVisible] = useState(false);
  const [debugData, setDebugData] = useState({});
  const [lastApiCall, setLastApiCall] = useState(null);
  const [testResults, setTestResults] = useState({});

  useEffect(() => {
    const updateDebugData = () => {
      try {
        const data = {
          timestamp: new Date().toISOString(),
          baseUrl: getBaseUrl(),
          hostname: typeof window !== 'undefined' ? window.location.hostname : 'undefined',
          userAgent: navigator?.userAgent?.substring(0, 100) + '...',
          environment: {
            NODE_ENV: process.env.NODE_ENV,
            REACT_APP_API_URL: process.env.REACT_APP_API_URL
          }
        };
        setDebugData(data);
      } catch (error) {
        console.error('Error updating debug data:', error);
      }
    };

    updateDebugData();
    const interval = setInterval(updateDebugData, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  const runDirectFetchTest = async () => {
    const baseUrl = getBaseUrl();
    const testUrl = `${baseUrl}/api/businesses/semantic-search?query=test&limit=3&radius=25&lat=33.4484&lng=-112.074`;
    
    console.log('[DEBUG] Starting comprehensive fetch diagnostics');
    console.log('[DEBUG] Base URL:', baseUrl);
    console.log('[DEBUG] Full Test URL:', testUrl);
    console.log('[DEBUG] Current hostname:', window.location.hostname);
    console.log('[DEBUG] Navigator online:', navigator.onLine);
    
    let result = {
      success: false,
      timestamp: new Date().toISOString(),
      diagnostics: {}
    };
    
    try {
      // Test 1: Basic connectivity to root URL
      console.log('[DEBUG] Test 1: Testing root URL connectivity');
      const rootUrl = baseUrl;
      const rootTest = await fetch(rootUrl, {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-cache',
        credentials: 'omit'
      }).then(() => 'reachable').catch(err => `failed: ${err.message}`);
      
      result.diagnostics.rootConnectivity = rootTest;
      console.log('[DEBUG] Root connectivity:', rootTest);
      
      // Test 2: CORS preflight test
      console.log('[DEBUG] Test 2: Testing CORS preflight');
      const corsTest = await fetch(testUrl, {
        method: 'OPTIONS',
        mode: 'cors',
        cache: 'no-cache',
        credentials: 'omit',
        headers: {
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'content-type'
        }
      }).then(res => `preflight-ok: ${res.status}`).catch(err => `preflight-failed: ${err.message}`);
      
      result.diagnostics.corsTest = corsTest;
      console.log('[DEBUG] CORS test:', corsTest);
      
      // Test 3: Actual API request
      console.log('[DEBUG] Test 3: Running actual API request');
      const startTime = Date.now();
      
      const response = await fetch(testUrl, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-cache',
        credentials: 'omit',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const duration = Date.now() - startTime;
      console.log('[DEBUG] Response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      });
      
      const data = await response.json();
      
      result = {
        success: true,
        status: response.status,
        statusText: response.statusText,
        duration: `${duration}ms`,
        dataReceived: Array.isArray(data) ? data.length : (data.businesses ? data.businesses.length : 'unknown'),
        timestamp: new Date().toISOString(),
        diagnostics: result.diagnostics
      };
      
      console.log('[DEBUG] Direct fetch test succeeded:', result);
      
    } catch (error) {
      console.error('[DEBUG] Main fetch failed:', error);
      
      // Enhanced error analysis
      result.error = error.message;
      result.name = error.name;
      result.stack = error.stack?.split('\n')[0]; // First line only
      
      // Analyze specific error types
      if (error.message.includes('Failed to fetch')) {
        result.diagnostics.likelyCause = 'Network/CORS issue';
        result.diagnostics.suggestions = [
          'Check if API is running',
          'Verify CORS headers allow this domain',
          'Check for network connectivity issues'
        ];
      } else if (error.message.includes('CORS')) {
        result.diagnostics.likelyCause = 'CORS policy violation';
        result.diagnostics.suggestions = [
          'Add domain to CORS allowlist in API',
          'Check CORS headers are properly set'
        ];
      } else if (error.message.includes('TypeError')) {
        result.diagnostics.likelyCause = 'Invalid URL or request format';
        result.diagnostics.suggestions = [
          'Verify URL format is correct',
          'Check request headers and method'
        ];
      }
      
      console.error('[DEBUG] Enhanced error details:', result);
    }
    
    setTestResults(result);
  };

  const clearTestResults = () => {
    setTestResults({});
  };

  if (!isVisible) {
    return (
      <TouchableOpacity 
        style={styles.toggleButton}
        onPress={() => setIsVisible(true)}
      >
        <Text style={styles.toggleButtonText}>DEBUG</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Debug Information</Text>
        <TouchableOpacity 
          style={styles.closeButton}
          onPress={() => setIsVisible(false)}
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>API Configuration</Text>
        <Text style={styles.debugText}>Base URL: {debugData.baseUrl}</Text>
        <Text style={styles.debugText}>Hostname: {debugData.hostname}</Text>
        <Text style={styles.debugText}>Updated: {debugData.timestamp}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Environment</Text>
        <Text style={styles.debugText}>NODE_ENV: {debugData.environment?.NODE_ENV}</Text>
        <Text style={styles.debugText}>REACT_APP_API_URL: {debugData.environment?.REACT_APP_API_URL || 'undefined'}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Network Test</Text>
        <TouchableOpacity style={styles.testButton} onPress={runDirectFetchTest}>
          <Text style={styles.testButtonText}>Run Direct Fetch Test</Text>
        </TouchableOpacity>
        
        {testResults.timestamp && (
          <View style={styles.testResults}>
            <Text style={[styles.testResultText, testResults.success ? styles.success : styles.error]}>
              {testResults.success ? '✓ SUCCESS' : '✗ FAILED'}
            </Text>
            {testResults.success ? (
              <>
                <Text style={styles.debugText}>Status: {testResults.status} {testResults.statusText}</Text>
                <Text style={styles.debugText}>Duration: {testResults.duration}</Text>
                <Text style={styles.debugText}>Data received: {testResults.dataReceived} items</Text>
              </>
            ) : (
              <>
                <Text style={styles.debugText}>Error: {testResults.error}</Text>
                <Text style={styles.debugText}>Type: {testResults.name}</Text>
              </>
            )}
            <Text style={styles.debugText}>Time: {testResults.timestamp}</Text>
            <TouchableOpacity style={styles.clearButton} onPress={clearTestResults}>
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Console Log</Text>
        <Text style={styles.debugText}>Check browser console for detailed logs</Text>
        <Text style={styles.debugText}>Look for [API] and [MOBILE-SEARCH] tags</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  toggleButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: '#f59e0b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    zIndex: 1000,
  },
  toggleButtonText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    padding: 20,
    zIndex: 999,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    backgroundColor: '#ef4444',
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  section: {
    marginBottom: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  sectionTitle: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  debugText: {
    color: '#e5e7eb',
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  testButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    marginBottom: 10,
  },
  testButtonText: {
    color: 'white',
    fontSize: 12,
    textAlign: 'center',
  },
  testResults: {
    backgroundColor: '#1f2937',
    padding: 10,
    borderRadius: 4,
    marginTop: 5,
  },
  testResultText: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  success: {
    color: '#10b981',
  },
  error: {
    color: '#ef4444',
  },
  clearButton: {
    backgroundColor: '#6b7280',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 2,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  clearButtonText: {
    color: 'white',
    fontSize: 10,
  },
});