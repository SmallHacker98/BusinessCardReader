import { useState, useEffect, useRef } from 'react';
import { photoStorage } from '../storage/photoStorage';

export const usePhoto = (photoRef, photoStorageType) => {
  const [url, setUrl] = useState(null);
  const urlRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!photoRef) {
        setUrl(null);
        return;
      }
      const objectUrl = await photoStorage.load(photoRef, photoStorageType);
      if (!cancelled) {
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = objectUrl;
        setUrl(objectUrl);
      }
    };

    load();

    return () => {
      cancelled = true;
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, [photoRef, photoStorageType]);

  return url;
};
