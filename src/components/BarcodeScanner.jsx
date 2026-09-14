import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { Search } from 'lucide-react';
import { Modal } from './ui.jsx';

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];

export default function BarcodeScanner({ onDetected, onClose }) {
  const videoRef = useRef(null);
  const detectedRef = useRef(onDetected);
  const [status, setStatus] = useState('starting');
  const [manual, setManual] = useState('');

  useEffect(() => {
    detectedRef.current = onDetected;
  });

  // Runs once per open. Depending on onDetected here would tear down and
  // re-acquire the camera every time the parent re-rendered.
  useEffect(() => {
    let stopped = false;
    let raf = 0;
    let controls = null;
    let stream = null;
    let found = false;

    const emit = (code) => {
      if (!code || found || stopped) return;
      found = true;
      navigator.vibrate?.(40);
      detectedRef.current(String(code));
    };

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('unavailable');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (stopped) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setStatus('scanning');

        const supported = 'BarcodeDetector' in window && (await window.BarcodeDetector.getSupportedFormats?.())?.some((format) => FORMATS.includes(format));
        if (supported) {
          const detector = new window.BarcodeDetector({ formats: FORMATS });
          const tick = async () => {
            if (stopped) return;
            try {
              if (videoRef.current?.readyState >= 2) {
                const codes = await detector.detect(videoRef.current);
                if (codes[0]?.rawValue) emit(codes[0].rawValue);
              }
            } catch {
              // Frames can fail to decode while the camera settles; keep polling.
            }
            raf = requestAnimationFrame(tick);
          };
          tick();
        } else {
          const reader = new BrowserMultiFormatReader();
          controls = await reader.decodeFromVideoElement(videoRef.current, (result) => {
            if (result) emit(result.getText());
          });
          if (stopped) controls.stop();
        }
      } catch (error) {
        if (!stopped) setStatus(error?.name === 'NotAllowedError' ? 'denied' : 'unavailable');
      }
    };

    start();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      controls?.stop?.();
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const code = manual.replace(/\D/g, '');
  const message = {
    starting: 'Starting camera…',
    scanning: 'Line the barcode up inside the frame.',
    denied: 'Camera permission was denied. Allow camera access in your browser settings, or type the barcode below.',
    unavailable: 'Camera unavailable on this device. Type the barcode below instead.'
  }[status];

  return (
    <Modal title="Scan barcode" onClose={onClose} onSubmit={() => code.length >= 6 && onDetected(code)}>
      {(status === 'starting' || status === 'scanning') && (
        <div className="scanner">
          <video ref={videoRef} muted playsInline aria-label="Barcode scanner camera preview" />
          <div className="reticle" />
        </div>
      )}
      <span className={status === 'denied' || status === 'unavailable' ? 'status-warn scanner-status' : 'muted'}>{message}</span>
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <input className="input" inputMode="numeric" autoComplete="off" placeholder="Or type the barcode number" aria-label="Barcode number" value={manual} onChange={(event) => setManual(event.target.value)} />
        <button className="btn-secondary" type="submit" disabled={code.length < 6}><Search size={18} /> Look up</button>
      </div>
    </Modal>
  );
}
