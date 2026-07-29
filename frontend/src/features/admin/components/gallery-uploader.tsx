'use client';

import { useRef, useState } from 'react';
import { UploadCloud, X } from 'lucide-react';
import { apiUrl } from '@/shared/lib/api';

/** Multi-image uploader that manages an array of image URLs. */
export function GalleryUploader({
  folder = 'gallery',
  value,
  onChange,
}: {
  folder?: string;
  value: string[];
  onChange: (urls: string[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function uploadFiles(files: FileList) {
    setUploading(true);
    setError('');
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    const added: string[] = [];
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append('file', file);
        const res = await fetch(apiUrl(`/uploads?folder=${folder}`), {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: form,
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? 'Upload failed');
        added.push((await res.json()).url);
      }
      onChange([...value, ...added]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {value.map((url, i) => (
          <div key={i} data-testid={`upload-gallery-item-${i + 1}`} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={`Gallery image ${i + 1}`} className="h-24 w-24 rounded-xl border object-cover" />
            <button
              type="button"
              onClick={() => onChange(value.filter((_, idx) => idx !== i))}
              aria-label={`Remove gallery image ${i + 1}`}
              data-testid={`upload-gallery-remove-${i + 1}`}
              className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white"
            >
              <X size={14} aria-hidden />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files);
          }}
          aria-label="Add gallery images"
          data-testid="upload-gallery-add"
          className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-xl border border-dashed text-xs text-[rgb(var(--foreground))]/60 transition hover:bg-[rgb(var(--muted))]"
        >
          <UploadCloud size={20} aria-hidden />
          {uploading ? '…' : 'Add'}
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        aria-label="Choose images to upload"
        data-testid="upload-gallery-input"
        className="hidden"
        onChange={(e) => e.target.files && uploadFiles(e.target.files)}
      />
      {error && (
        <p role="alert" data-testid="upload-gallery-error" className="mt-1 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
