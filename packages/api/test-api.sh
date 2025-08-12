#!/bin/bash

# Local First Arizona API Test Script
# Run this after starting the dev server: node dev-server.js

BASE_URL="http://localhost:8787"

echo "Testing Local First Arizona API..."
echo "================================="

# Test 1: Health Check
echo -e "\n1. Testing Health Check..."
curl -s $BASE_URL/ | jq

# Test 2: Get Chain Businesses
echo -e "\n2. Testing Chain Businesses Endpoint..."
curl -s $BASE_URL/api/chains | jq '{total: .total, sampleChains: .chains[0:3] | map(.name)}'

# Test 3: Get Nearby Businesses (Phoenix)
echo -e "\n3. Testing Nearby Businesses (Phoenix - 2 mile radius)..."
curl -s "$BASE_URL/api/businesses/nearby?lat=33.4484&lng=-112.0740&radius=2" | \
  jq '{total: .total, radius: .radius, closestBusiness: .businesses[0].name, distance: .businesses[0].distance}'

# Test 4: Get Nearby Businesses (Scottsdale)
echo -e "\n4. Testing Nearby Businesses (Scottsdale - 3 mile radius)..."
curl -s "$BASE_URL/api/businesses/nearby?lat=33.4942&lng=-111.9261&radius=3" | \
  jq '{total: .total, radius: .radius}'

# Test 5: Post Analytics Events
echo -e "\n5. Testing Analytics Events..."
curl -s -X POST $BASE_URL/api/analytics/events \
  -H "Content-Type: application/json" \
  -d '{
    "extension_id": "test-extension-'$(date +%s)'",
    "events": [
      {"type": "install"},
      {"type": "filter_toggle", "metadata": {"enabled": true}},
      {"type": "view", "business_id": "test-business-123"}
    ]
  }' | jq

# Test 6: Get Analytics Summary
echo -e "\n6. Testing Analytics Summary..."
curl -s $BASE_URL/api/analytics/summary | jq

# Test 7: Invalid Request (missing coordinates)
echo -e "\n7. Testing Error Handling (missing coordinates)..."
curl -s "$BASE_URL/api/businesses/nearby" | jq

# Test 8: Invalid Request (out of range coordinates)
echo -e "\n8. Testing Error Handling (invalid coordinates)..."
curl -s "$BASE_URL/api/businesses/nearby?lat=200&lng=200&radius=5" | jq

echo -e "\n================================="
echo "API Tests Complete!"