'use client';

import { useState } from 'react';
import { useT } from '@/lib/i18n';

export interface DeliveryLocationValue {
  deliveryLat: number | null;
  deliveryLng: number | null;
  address: string;
}

interface Props {
  value: DeliveryLocationValue;
  onChange: (next: DeliveryLocationValue) => void;
}

/** Browser geolocation + optional landmark (Mini App parity with bot location pin). */
export function DeliveryLocationFields({ value, onChange }: Props) {
  const t = useT();
  const [locError, setLocError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const captureLocation = () => {
    setLocError(null);
    if (!navigator.geolocation) {
      setLocError(t('location_unavailable'));
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({
          ...value,
          deliveryLat: pos.coords.latitude,
          deliveryLng: pos.coords.longitude,
        });
        setLoading(false);
      },
      () => {
        setLocError(t('location_denied'));
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  const hasCoords = value.deliveryLat != null && value.deliveryLng != null;

  return (
    <>
      <div className="field">
        <label>{t('delivery_location')}</label>
        <button type="button" className="btn btn-block" disabled={loading} onClick={captureLocation}>
          {loading ? t('loading') : t('use_my_location')}
        </button>
        {hasCoords && (
          <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
            {t('location_saved')}: {value.deliveryLat!.toFixed(5)}, {value.deliveryLng!.toFixed(5)}
          </p>
        )}
        {locError && (
          <div className="err" role="alert">
            {locError}
          </div>
        )}
      </div>
      <div className="field">
        <label>{t('landmark')}</label>
        <input
          className="input"
          value={value.address}
          placeholder={t('landmark_placeholder')}
          onChange={(e) => onChange({ ...value, address: e.target.value })}
        />
      </div>
    </>
  );
}

export function hasDeliveryLocation(c: {
  deliveryLat?: number | null;
  deliveryLng?: number | null;
}): boolean {
  return c.deliveryLat != null && c.deliveryLng != null && Number.isFinite(c.deliveryLat) && Number.isFinite(c.deliveryLng);
}
