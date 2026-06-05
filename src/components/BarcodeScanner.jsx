import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { X } from 'lucide-react';
import { IconButton } from './ui.jsx';

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];

export default function BarcodeScanner({ onDetected, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const lastRef = useRef({ code: null, time: 0 });
  const [error, setError] = useState('');

  useEffect(() => {
    let stopped = false;
    let raf = 0;
    let controls = null;

    const stop = () => {
      stopped = true;
      cancelAnimationFrame(raf);
      controls?.stop?.();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };

    const emit = (code) => {
      const now = Date.now();
      if (!code || (lastRef.current.code === code && now - lastRef.current.time < 1800)) return;
      lastRef.current = { code, time: now };
      onDetected(String(code));
    };

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (stopped) return;
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        if ('BarcodeDetector' in window) {
          const detector = new window.BarcodeDetector({ formats: FORMATS });
          const tick = async () => {
            if (stopped) return;
            try {
              const codes = await detector.detect(videoRef.current);
              if (codes[0]?.rawValue) emit(codes[0].rawValue);
            } catch {
              setError('Scanner is warming up');
            }
            raf = requestAnimationFrame(tick);
          };
          tick();
        } else {
          const reader = new BrowserMultiFormatReader();
          controls = await reader.decodeFromVideoElement(videoRef.current, (result) => {
            if (result) emit(result.getText());
          });
        }
      } catch {
        setError('Camera unavailable. You can still search or add food manually.');
      }
    };

    start();
    return stop;
  }, [onDetected]);

  return (
    <div className="modal-overlay" role="presentation">
      <div className="glass-strong panel stack">
        <div className="split">
          <strong>Scan barcode</strong>
          <IconButton label="Close scanner" onClick={onClose}><X size={19} /></IconButton>
        </div>
        <div className="scanner">
          <video ref={videoRef} muted playsInline aria-label="Barcode scanner camera preview" />
          <div className="reticle" />
        </div>
        {error && <span className="status-warn">{error}</span>}
      </div>
    </div>
  );
}
