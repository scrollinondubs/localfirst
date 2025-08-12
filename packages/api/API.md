# Local First Arizona API Documentation

## Overview

The Local First Arizona API provides endpoints for the Chrome extension to identify local businesses and filter chain stores on Google Maps.

## Base URL

- **Development**: `http://localhost:8787`
- **Production**: TBD (will be deployed to Cloudflare Workers)

## Endpoints

### 1. Health Check

**GET** `/`

Returns the API status and version.

#### Response
```json
{
  "status": "ok",
  "service": "Local First Arizona API",
  "version": "1.0.0",
  "timestamp": "2025-08-12T18:29:44.640Z"
}
```

---

### 2. Get Nearby LFA Businesses

**GET** `/api/businesses/nearby`

Returns LFA member businesses within a specified radius of a location.

#### Query Parameters
- `lat` (required): Latitude of the center point
- `lng` (required): Longitude of the center point  
- `radius` (optional): Search radius in miles (default: 5, max: 50)

#### Example Request
```bash
curl "http://localhost:8787/api/businesses/nearby?lat=33.4484&lng=-112.0740&radius=2"
```

#### Response
```json
{
  "businesses": [
    {
      "id": "89e3be20-6317-459e-9480-8d46e7599c0c",
      "name": "Hospice Rocks",
      "address": "PO Box 852, Phoenix, AZ 85001",
      "latitude": 33.447410835141156,
      "longitude": -112.07397266387457,
      "phone": "(480) 329-3969",
      "website": "Hospicerocks.com",
      "category": "other",
      "lfaMember": true,
      "verified": true,
      "distance": 0.06836707136049801
    }
  ],
  "total": 870,
  "center": {
    "lat": 33.4484,
    "lng": -112.074
  },
  "radius": 2
}
```

---

### 3. Get Chain Business Patterns

**GET** `/api/chains`

Returns chain business patterns for client-side filtering. This endpoint is designed to be cached locally by the extension.

#### Example Request
```bash
curl "http://localhost:8787/api/chains"
```

#### Response
```json
{
  "chains": [
    {
      "id": "3c144e9a-d1be-48a6-892c-0f5539720b5f",
      "name": "Walmart",
      "patterns": ["walmart", "wal-mart", "walmart supercenter"],
      "category": "retail",
      "parentCompany": "Walmart Inc.",
      "confidenceScore": 100
    },
    {
      "id": "0ec57083-4a39-4902-b13a-5c334f1243ff",
      "name": "Target",
      "patterns": ["target", "target store"],
      "category": "retail",
      "parentCompany": "Target Corporation",
      "confidenceScore": 100
    }
  ],
  "lastUpdated": "2025-08-12T18:29:50.123Z",
  "total": 32
}
```

**Headers**
- `Cache-Control: public, max-age=86400` - Cache for 24 hours
- `ETag` - For cache validation

---

### 4. Track Analytics Events

**POST** `/api/analytics/events`

Records user interaction events from the extension. Accepts batch events to minimize API calls.

#### Request Body
```json
{
  "extension_id": "unique-extension-identifier",
  "events": [
    {
      "type": "view",
      "business_id": "89e3be20-6317-459e-9480-8d46e7599c0c",
      "metadata": {
        "source": "maps"
      },
      "timestamp": "2025-08-12T18:30:00.000Z"
    },
    {
      "type": "filter_toggle",
      "metadata": {
        "enabled": true
      }
    }
  ]
}
```

#### Event Types
- `view` - User viewed an LFA business badge
- `click` - User clicked on an LFA business
- `filter_toggle` - User toggled chain filtering
- `install` - Extension was installed

#### Response
```json
{
  "success": true,
  "processed": 2,
  "timestamp": "2025-08-12T18:30:10.159Z"
}
```

---

### 5. Analytics Summary (Debug)

**GET** `/api/analytics/summary`

Returns analytics summary for monitoring (not exposed to extension).

#### Response
```json
{
  "totalEvents": 2,
  "uniqueUsers": 1,
  "timestamp": "2025-08-12T18:30:15.833Z"
}
```

---

## Error Responses

All endpoints return consistent error responses:

### 400 Bad Request
```json
{
  "error": "Invalid latitude or longitude"
}
```

### 404 Not Found
```json
{
  "error": "Not Found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal Server Error"
}
```

---

## Rate Limiting

Public endpoints have the following limits:
- 1000 requests per hour per IP
- Batch analytics events to minimize API calls (max 100 events per request)

---

## CORS Configuration

The API allows requests from:
- `http://localhost:*` (development)
- `https://*.google.com` (Google Maps)
- `chrome-extension://*` (Chrome extensions)

---

## Database Schema

The API uses SQLite with the following main tables:

- **businesses**: LFA member businesses with location data
- **chain_businesses**: Chain patterns for filtering
- **analytics_events**: User interaction tracking
- **user_sessions**: Session aggregation data

Total data as of deployment:
- 5,146 LFA member businesses
- 32 chain business patterns