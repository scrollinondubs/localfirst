import React from 'react';

// This is a placeholder component for markers
// The actual marker rendering is handled by the WebMapView component
const WebMarker = ({ 
  coordinate, 
  title, 
  description, 
  pinColor = '#FF0000',
  businessData
}) => {
  // This component doesn't render anything directly
  // It's used as a child of WebMapView to pass marker data
  return null;
};

export default WebMarker;