// lpai-backend/pages/api/maps/calculate-eta.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { origin, destination } = req.body;

  if (!origin || !destination) {
    return res.status(400).json({ error: 'Missing origin or destination' });
  }

  try {
    // If destination is an address string, we need to geocode it first
    let destCoords = destination;
    
    if (typeof destination === 'string') {
      // Use Nominatim (OpenStreetMap) for free geocoding
      const geocodeUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(destination)}&format=json&limit=1`;
      
      const geocodeResponse = await axios.get(geocodeUrl, {
        headers: {
          'User-Agent': 'LPai-App/1.0' // Required by Nominatim
        }
      });
      
      if (geocodeResponse.data && geocodeResponse.data.length > 0) {
        destCoords = {
          lat: parseFloat(geocodeResponse.data[0].lat),
          lng: parseFloat(geocodeResponse.data[0].lon)
        };
      } else {
        // Can't find the address
        return res.status(200).json({
          success: false,
          error: 'Unable to find address location',
          duration: null,
          distance: null,
          trafficCondition: null
        });
      }
    }

    // Use OSRM for routing (free, no API key needed)
    const routeUrl = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destCoords.lng},${destCoords.lat}?overview=false`;
    
    const routeResponse = await axios.get(routeUrl);
    
    if (routeResponse.data && routeResponse.data.routes && routeResponse.data.routes.length > 0) {
      const route = routeResponse.data.routes[0];
      
      // OSRM returns duration in seconds, convert to minutes
      const durationMinutes = Math.ceil(route.duration / 60);
      const distanceKm = Math.round(route.distance / 1000);
      
      // Simulate traffic conditions based on time of day
      const hour = new Date().getHours();
      let trafficCondition: 'normal' | 'moderate' | 'heavy' = 'normal';
      let trafficMultiplier = 1;
      
      // Rush hours: 7-9 AM and 5-7 PM
      if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) {
        trafficCondition = 'heavy';
        trafficMultiplier = 1.5;
      } else if ((hour >= 6 && hour <= 10) || (hour >= 15 && hour <= 20)) {
        trafficCondition = 'moderate';
        trafficMultiplier = 1.2;
      }
      
      const adjustedDuration = Math.ceil(durationMinutes * trafficMultiplier);
      
      return res.status(200).json({
        success: true,
        duration: adjustedDuration,
        distance: distanceKm,
        trafficCondition,
        originalDuration: durationMinutes
      });
    }
    
    // Can't calculate route
    return res.status(200).json({
      success: false,
      error: 'Unable to calculate route',
      duration: null,
      distance: null,
      trafficCondition: null
    });

  } catch (error) {
    console.error('Failed to calculate ETA:', error);
    
    return res.status(200).json({
      success: false,
      error: 'Route calculation service unavailable',
      duration: null,
      distance: null,
      trafficCondition: null
    });
  }
}