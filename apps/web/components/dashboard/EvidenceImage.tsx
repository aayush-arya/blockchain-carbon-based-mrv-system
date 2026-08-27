'use client';

import { useEffect, useState } from 'react';
import { API_BASE_URL, getStoredTokens } from '@/lib/api';
import { Spinner } from '@/components/ui/Feedback';

/**
 * The evidence endpoint requires a Bearer token, which a plain <img src> can't send - so this
 * fetches the bytes with auth and renders them as a blob URL instead.
 */
export function EvidenceImage({ evidenceFileId, alt, className }: { evidenceFileId: string; alt: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    async function load() {
      const tokens = getStoredTokens();
      const res = await fetch(`${API_BASE_URL}/api/evidence/${evidenceFileId}`, {
        headers: tokens ? { Authorization: `Bearer ${tokens.accessToken}` } : undefined,
      });
      if (!res.ok) {
        if (!cancelled) setFailed(true);
        return;
      }
      const blob = await res.blob();
      objectUrl = URL.createObjectURL(blob);
      if (!cancelled) setSrc(objectUrl);
    }

    load().catch(() => {
      if (!cancelled) setFailed(true);
    });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [evidenceFileId]);

  if (failed) {
    return (
      <div className={`flex items-center justify-center bg-surface-sunken text-sm text-ink-faint ${className ?? ''}`}>
        Could not load evidence photo.
      </div>
    );
  }

  if (!src) {
    return (
      <div className={`flex items-center justify-center bg-surface-sunken ${className ?? ''}`}>
        <Spinner />
      </div>
    );
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} />;
}
