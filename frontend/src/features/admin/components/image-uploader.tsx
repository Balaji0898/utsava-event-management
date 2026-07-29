'use client';

import { useRef, useState } from 'react';
import { UploadCloud, X } from 'lucide-react';
import { apiUrl } from '@/shared/lib/api';

/**
 * Drag-and-drop image uploader. Posts to the backend /uploads endpoint
 * (local disk or Cloudinary depending on backend config) and returns the URL.
 */
export function ImageUploader({
  folder = 'general',
  value,
  onChange,
}: {
  folder?: string;
  value?: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function handleFile(file: File) {
    setUploading(true);
    setError('');
    try {
      const token =
        typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(apiUrl(`/uploads?folder=${folder}`), {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? 'Upload failed');
      }
      const data = await res.json();
      onChange(data.url);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      {value ? (
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="Uploaded image preview"
            data-testid={`upload-preview-${folder}`}
            className="h-28 w-28 rounded-xl border object-cover"
          />
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="Remove image"
            data-testid={`upload-remove-${folder}`}
            className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white"
          >
            <X size={14} aria-hidden />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            if (file) handleFile(file);
          }}
          data-testid={`upload-drop-${folder}`}
          className="flex h-28 w-full max-w-xs flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-sm text-[rgb(var(--foreground))]/60 transition hover:bg-[rgb(var(--muted))]"
        >
          <UploadCloud size={22} aria-hidden />
          {uploading ? 'Uploading…' : 'Click or drop an image'}
        </button>
      )}
      {/* Visually hidden but present in the DOM, so setInputFiles can target it
          directly rather than going through a file chooser. */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        aria-label="Choose an image to upload"
        data-testid={`upload-input-${folder}`}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      {error && (
        <p role="alert" data-testid={`upload-error-${folder}`} className="mt-1 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
