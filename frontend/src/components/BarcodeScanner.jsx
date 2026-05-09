import { useEffect, useRef } from 'react';
import { useScanner } from '../hooks/useScanner';

export default function BarcodeScanner({ onResult, onClose }) {
  const videoRef = useRef(null);
  const { start, stop } = useScanner(code => { stop(); onResult(code); });

  useEffect(() => {
    if (videoRef.current) start(videoRef.current);
    return stop;
  }, []);

  return (
    <div style={{ position: 'relative' }}>
      <video ref={videoRef} style={{ width: '100%', borderRadius: 12, maxHeight: 320, background: '#000' }} autoPlay playsInline muted />
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        width: 200, height: 120,
        border: '3px solid var(--accent)',
        borderRadius: 8,
        pointerEvents: 'none',
      }} />
      <button onClick={() => { stop(); onClose(); }} className="btn-ghost w-full mt-3">Abbrechen</button>
    </div>
  );
}
