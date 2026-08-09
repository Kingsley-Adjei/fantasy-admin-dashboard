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

    const connect = async () => {
      try {
        const { Client } = await import('@stomp/stompjs');
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
          },
          onStompError: (frame) => {
            console.warn('STOMP error:', frame.headers?.message);
          },
        });
        stompClient.activate();
        clientRef.current = stompClient;
      } catch (e) {
        console.warn('WebSocket not available:', e.message);
      }
    };

    connect();

    return () => {
      if (clientRef.current?.active) {
        clientRef.current.deactivate();
      }
    };
  }, []);
}
