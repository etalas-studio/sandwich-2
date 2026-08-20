'use client';
import { useEffect } from 'react';

export default function TraceInit() {
  useEffect(() => {
    const orig = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const res = await orig(input, init);
      const traceId = res.headers.get('x-trace-id');
      if (traceId) (window as any).__lastTraceId = traceId;
      return res;
    };
  }, []);
  return null;
}
