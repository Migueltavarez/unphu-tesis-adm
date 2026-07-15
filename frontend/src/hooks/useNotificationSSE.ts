'use client';
import { useEffect, useRef } from 'react';
import Cookies from 'js-cookie';
import { useAuthStore } from '@/store/auth.store';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/Toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export function useNotificationSSE() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!user) return;

    let active = true;
    let retryDelay = 3000;

    const connect = async () => {
      const token = Cookies.get('accessToken');
      if (!token || !active) return;

      try {
        abortRef.current = new AbortController();
        const response = await fetch(`${API_URL}/notifications/stream`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: abortRef.current.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`SSE failed: ${response.status}`);
        }

        retryDelay = 3000;
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (active) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const payload = JSON.parse(line.slice(6));
              const notification = payload.data ?? payload;
              if (notification?.title) {
                toast({ title: notification.title, message: notification.message, type: 'notification' });
                queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
              }
            } catch {}
          }
        }
      } catch (err: any) {
        if (!active || err?.name === 'AbortError') return;
        // Exponential back-off capped at 30s
        retryDelay = Math.min(retryDelay * 1.5, 30_000);
        setTimeout(connect, retryDelay);
      }
    };

    connect();

    return () => {
      active = false;
      abortRef.current?.abort();
    };
  }, [user?.id]);
}
