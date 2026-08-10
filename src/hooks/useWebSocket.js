'use client';
import { useEffect, useRef, useCallback } from 'react';

const WS_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://fantasy-backend-oune.onrender.com')
  .replace(/^http:\/\//, 'ws://')
  .replace(/^https:\/\//, 'wss://');

export function useWebSocket(callbacks = {}) {
  const clientRef = useRef(null);
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  useEffect(() => {
    let stompClient = null;

    // React StrictMode mounts every effect twice in development. connect() is
    // async (the stompjs import is dynamic), so the first cleanup ran before
    // its client object even existed: `clientRef.current` was still null, the
    // deactivate() guard skipped it, and that first socket was left connecting
    // with nothing holding a reference to it. The second mount then opened
    // another one. Whichever lost the race logged "WebSocket is closed before
    // the connection is established". This flag lets a cleanup that arrives
    // mid-import cancel the connection instead of leaking it.
    let cancelled = false;

    const connect = async () => {
      try {
        const { Client } = await import('@stomp/stompjs');
        if (cancelled) return;
        stompClient = new Client({
          brokerURL: `${WS_URL}/ws`,
          reconnectDelay: 5000,
          heartbeatIncoming: 25000,
          heartbeatOutgoing: 25000,
          onConnect: () => {
            stompClient.subscribe('/topic/matches/live', (msg) => {
              const data = JSON.parse(msg.body);
              callbacksRef.current.onMatchLive?.(data);
            });
            stompClient.subscribe('/topic/points/updated', (msg) => {
              const data = JSON.parse(msg.body);
              callbacksRef.current.onPointsUpdated?.(data);
            });
            stompClient.subscribe('/topic/matches/completed', (msg) => {
              const data = JSON.parse(msg.body);
              callbacksRef.current.onMatchCompleted?.(data);
            });
            stompClient.subscribe('/topic/leaderboard/updated', () => {
              callbacksRef.current.onLeaderboardUpdated?.();
            });
            // Emitted by set-deadline and start-gameweek. Both change the
            // active gameweek or its deadline, and neither used to broadcast
            // anything at all — so a second admin (or a second tab) kept
            // showing the old gameweek until a manual reload.
            stompClient.subscribe('/topic/gameweek/updated', (msg) => {
              const data = JSON.parse(msg.body);
              callbacksRef.current.onGameweekUpdated?.(data);
            });
          },
          onStompError: (frame) => {
            console.warn('STOMP error:', frame.headers?.message);
          },
        });
        clientRef.current = stompClient;
        stompClient.activate();
      } catch (e) {
        console.warn('WebSocket not available:', e.message);
      }
    };

    connect();

    return () => {
      cancelled = true;
      // Deactivate the client this effect created, not clientRef.current —
      // under StrictMode the ref may already point at the second instance.
      // Dropping the `.active` check matters too: a client that is still
      // CONNECTING reports active === false, so the old guard let exactly the
      // sockets we needed to close slip through.
      stompClient?.deactivate();
      if (clientRef.current === stompClient) clientRef.current = null;
    };
  }, []);
}
