'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { auth } from '@/shared/lib/api';
import { Logo } from '@/shared/ui/logo';
import { Loader2 } from 'lucide-react';

// WebGL gem — client only.
const Hero3D = dynamic(() => import('@/features/website/components/hero-3d'), {
  ssr: false,
});

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password required'),
});
type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setError('');
    try {
      const data = await auth.login(values.email, values.password);
      if (['ADMIN', 'SUPER_ADMIN'].includes(data.user.role)) {
        router.push('/admin');
      } else {
        router.push('/');
      }
    } catch (e: any) {
      setError(e.message ?? 'Login failed');
    }
  }

  const field =
    'mt-1 w-full rounded-xl border bg-[rgb(var(--card))] px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500';

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-hero-gradient px-4 pt-28">
      {/* Hex pattern as an overlay so it layers over the gradient instead of
         replacing it (the unlayered .hex-pattern rule would otherwise win over
         the bg-hero-gradient utility). */}
      <div className="hex-pattern pointer-events-none absolute inset-0" aria-hidden />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md rounded-3xl border bg-[rgba(255,255,255,0.82)] p-8 shadow-luxe backdrop-blur-xl dark:bg-[rgba(24,20,14,0.82)]"
      >
        {/* floating 3D gold gem above the card */}
        <div className="pointer-events-none absolute -top-40 left-1/2 h-52 w-52 -translate-x-1/2">
          <Hero3D />
        </div>

        <div className="mb-6 flex items-center gap-2">
          <Logo />
          <span className="text-sm text-[rgb(var(--foreground))]/70">· Admin</span>
        </div>
        <h1 className="text-2xl font-bold">Welcome back</h1>
        <p className="mt-1 text-sm text-[rgb(var(--foreground))]/60">
          Sign in to the admin dashboard.
        </p>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="mt-6 space-y-4"
          data-testid="login-form"
        >
          <div>
            <label htmlFor="login-email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="login-email"
              data-testid="login-email"
              className={field}
              type="email"
              autoComplete="email"
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={errors.email ? 'login-email-error' : undefined}
              {...register('email')}
            />
            {errors.email && (
              <p id="login-email-error" className="mt-1 text-xs text-red-600 dark:text-red-400">
                {errors.email.message}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="login-password" className="text-sm font-medium">
              Password
            </label>
            <input
              id="login-password"
              data-testid="login-password"
              className={field}
              type="password"
              autoComplete="current-password"
              aria-invalid={errors.password ? true : undefined}
              aria-describedby={errors.password ? 'login-password-error' : undefined}
              {...register('password')}
            />
            {errors.password && (
              <p id="login-password-error" className="mt-1 text-xs text-red-600 dark:text-red-400">
                {errors.password.message}
              </p>
            )}
          </div>
          {error && (
            <p role="alert" data-testid="login-error" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
          <button disabled={isSubmitting} data-testid="login-submit" className="btn-primary w-full">
            {isSubmitting && <Loader2 size={16} className="mr-2 animate-spin" />}
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
