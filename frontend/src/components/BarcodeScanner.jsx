import { useEffect, useRef, useState } from 'react';
import { useScanner } from '../hooks/useScanner';

export default function BarcodeScanner({ onResult, onClose }) {
  const videoRef = useRef(null);
  const fileRef = useRef(null);
  const { start, stop } = useScanner(code => { stop(); onResult(code); });
  const [mode, setMode] = useState('video'); // 'video' | 'file'
  const [decoding, setDecoding] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // mediaDevices is undefined on HTTP in Android (secure context required)
    if (!navigator.mediaDevices?.getUserMedia) {
      setMode('file');
      return;
    }
    if (mode !== 'video' || !videoRef.current) return;
    start(videoRef.current).catch(() => {
      stop();
      setMode('file');
    });
    return stop;
  }, [mode]);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setDecoding(true);
    setError(null);
    try {
      const url = URL.createObjectURL(file);
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const reader = new BrowserMultiFormatReader();
      const result = await reader.decodeFromImageUrl(url);
      URL.revokeObjectURL(url);
      onResult(result.getText());
    } catch {
      setError('Kein Barcode erkannt. Bitte nochmal versuchen.');
    } finally {
      setDecoding(false);
      // Reset so same file can be re-selected
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div>
      {mode === 'video' ? (
        <div style={{ position: 'relative' }}>
          <video ref={videoRef}
            style={{ width: '100%', borderRadius: 12, maxHeight: 320, background: '#000' }}
            autoPlay playsInline muted />
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%,-50%)',
            width: 200, height: 120,
            border: '3px solid var(--accent)',
            borderRadius: 8,
            pointerEvents: 'none',
          }} />
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '24px 16px' }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>📷</div>
          <p className="text-muted text-sm mb-4">
            Kamera-Direktzugriff benötigt HTTPS.<br />
            Foto mit der Kamera-App aufnehmen:
          </p>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={handleFile}
          />
          <button
            className="btn-primary"
            style={{ padding: '14px 28px', fontSize: '1rem' }}
            onClick={() => fileRef.current?.click()}
            disabled={decoding}>
            {decoding ? '🔍 Scanne...' : '📸 Barcode fotografieren'}
          </button>

          {error && (
            <div style={{ marginTop: 12, color: 'var(--danger)', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}
        </div>
      )}

      <button onClick={() => { stop(); onClose(); }} className="btn-ghost w-full mt-3">
        Abbrechen
      </button>
    </div>
  );
}
