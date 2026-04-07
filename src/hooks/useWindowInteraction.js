import { useState, useEffect } from 'react';

export const useWindowInteraction = () => {
  const [isLocked, setIsLocked] = useState(false);
  const [lockMessage, setLockMessage] = useState('');

  useEffect(() => {
    if (!window.api?.onWindowInteractionLocked) return;

    const unsubscribe = window.api.onWindowInteractionLocked((data) => {
      setIsLocked(data.isLocked);
      setLockMessage(data.message || '');
    });

    return unsubscribe;
  }, []);

  const getInteractionStyle = () => ({
    pointerEvents: isLocked ? 'none' : 'auto',
    opacity: isLocked ? 0.5 : 1,
    transition: 'opacity 0.2s ease-in-out'
  });

  return {
    isLocked,
    lockMessage,
    getInteractionStyle
  };
};