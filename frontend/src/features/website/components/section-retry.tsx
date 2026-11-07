'use client';

import {
  Component,
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { RotateCw } from 'lucide-react';
import { Tr } from '@/shared/i18n/tr';

/**
 * Wait before each automatic refresh. Together with the time each refresh spends
 * on the server, this outlasts the 30-60s cold start of a sleeping backend.
 */
const RETRY_DELAYS_MS = [3000, 8000, 15000, 30000, 30000];

/**
 * Mounted retriers, oldest first. `router.refresh()` re-renders every section at
 * once, so only the oldest triggers it; several failed sections share one refresh.
 */
const retriers: object[] = [];

/** "Couldn't load" note with a retry button. */
export function SectionError({
  message,
  onRetry,
  busy = false,
}: {
  message: string;
  onRetry: () => void;
  busy?: boolean;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 text-[rgb(var(--foreground))]/70">
      <p>
        <Tr>{message}</Tr>
      </p>
      <button
        type="button"
        onClick={onRetry}
        disabled={busy}
        className="btn-ghost inline-flex items-center gap-1.5 px-4 py-2 text-sm"
      >
        <RotateCw size={14} aria-hidden className={busy ? 'animate-spin' : undefined} />
        <Tr>Try again</Tr>
      </button>
    </div>
  );
}

/** Shown when a section loaded fine and there is simply nothing in it. */
export function SectionEmpty({ message }: { message: string }) {
  return (
    <p className="mt-4 text-[rgb(var(--foreground))]/70">
      <Tr>{message}</Tr>
    </p>
  );
}

/**
 * Rendered by a server section whose data failed to load. The HTML has already
 * gone out by then, so nothing else would ever try again: this re-runs the
 * server render a bounded number of times, and unmounts once the section renders
 * normally. Successful data lands in the server cache, so the next visitor
 * benefits too.
 *
 * Shows `loading` while retrying and `message` with a retry button once the
 * retries run out. With no `message` it stays invisible, for sections that have
 * no heading of their own or still have something useful on screen.
 */
export function SectionRetry({
  section,
  message,
  loading = null,
}: {
  section: string;
  message?: string;
  loading?: ReactNode;
}) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [attempt, setAttempt] = useState(0);
  const self = useRef({}).current;
  const exhausted = attempt >= RETRY_DELAYS_MS.length;

  const refresh = useCallback(() => {
    startRefresh(() => router.refresh());
  }, [router]);

  useEffect(() => {
    retriers.push(self);
    return () => {
      retriers.splice(retriers.indexOf(self), 1);
    };
  }, [self]);

  useEffect(() => {
    if (refreshing) return;
    if (exhausted) {
      console.warn(`[api] section=${section} gave up after ${attempt} refreshes`);
      return;
    }
    const timer = setTimeout(() => {
      // A refresh that can't reach the server makes Next fall back to a full
      // page load, which offline means the browser's error page. Hold off; the
      // `online` listener below picks this up.
      if (!navigator.onLine) return;
      setAttempt((n) => n + 1);
      if (retriers[0] === self) refresh();
    }, RETRY_DELAYS_MS[attempt]);
    return () => clearTimeout(timer);
  }, [attempt, exhausted, refreshing, refresh, section, self]);

  useEffect(() => {
    const onOnline = () => {
      setAttempt(0);
      if (retriers[0] === self) refresh();
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [refresh, self]);

  if (!message) return null;
  if (!exhausted) return <>{loading}</>;
  return (
    <SectionError
      message={message}
      busy={refreshing}
      onRetry={() => {
        setAttempt(0);
        refresh();
      }}
    />
  );
}

type BoundaryProps = { section: string; message?: string; children: ReactNode };

/**
 * Keeps a render error inside its section. Without it an exception goes to the
 * route's error.tsx, which swaps the whole page for "Something went wrong".
 * Render errors come from the data itself, so an automatic retry would hit the
 * same one; this offers a full reload instead.
 */
export class SectionBoundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.warn(`[api] section=${this.props.section} render failed: ${error.message}`);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const { message } = this.props;
    if (!message) return null;
    return <SectionError message={message} onRetry={() => window.location.reload()} />;
  }
}
