import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface PortalQrCodeProps {
  value: string;
  size?: number;
  className?: string;
}

const PortalQrCode: React.FC<PortalQrCodeProps> = ({ value, size = 176, className }) => {
  const [src, setSrc] = useState('');

  useEffect(() => {
    let cancelled = false;

    const renderQr = async () => {
      try {
        const dataUrl = await QRCode.toDataURL(value, {
          width: size,
          margin: 1,
          color: {
            dark: '#f3f4f6',
            light: '#111827',
          },
        });
        if (!cancelled) {
          setSrc(dataUrl);
        }
      } catch {
        if (!cancelled) {
          setSrc('');
        }
      }
    };

    void renderQr();

    return () => {
      cancelled = true;
    };
  }, [size, value]);

  return src ? (
    <img src={src} alt="QR code" width={size} height={size} className={className} />
  ) : (
    <div
      className={className}
      style={{ width: size, height: size }}
      aria-label="QR code loading"
    />
  );
};

export default PortalQrCode;
