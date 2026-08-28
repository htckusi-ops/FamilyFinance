import { useRef, useCallback } from 'react';

export function useScanner(onResult) {
  const controlsRef = useRef(null);

  const start = useCallback(async (videoEl) => {
    const { BrowserMultiFormatReader } = await import('@zxing/browser');
    const reader = new BrowserMultiFormatReader();
    controlsRef.current = await reader.decodeFromVideoDevice(null, videoEl, (result, err) => {
      if (result) onResult(result.getText());
    });
  }, [onResult]);

  const stop = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
  }, []);

  return { start, stop };
}
