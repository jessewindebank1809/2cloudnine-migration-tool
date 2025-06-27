'use client';

import { useEffect, useRef } from 'react';

export function AppInitializer() {
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    // Initialize the app on the server side
    fetch('/api/init')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          console.log('✅ App initialization triggered');
        } else {
          console.error('❌ App initialization failed:', data.error);
        }
      })
      .catch(error => {
        console.error('❌ Failed to trigger app initialization:', error);
      });
  }, []);

  return null;
}