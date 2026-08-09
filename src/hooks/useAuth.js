'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export function useAuth() {
  const router = useRouter();
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = localStorage.getItem('adminToken');
    if (!t) {
      router.replace('/login');
    } else {
      setToken(t);
    }
    setLoading(false);
  }, [router]);

  const logout = () => {
    localStorage.removeItem('adminToken');
    router.replace('/login');
  };

  return { token, loading, logout };
}

export function decodeToken(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '=='.slice(0, (4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}
