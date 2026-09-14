import { useEffect, useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { OrgNode } from '@/api/types';

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

// Interface for the WebSocket patch message
interface WSPatchMessage {
  id: string;
  headcount: number;
  budget: number;
  performance: number;
  updatedAt: string;
}

/**
 * useOrgWebSocket - Custom hook to manage persistent WebSocket connection with the backend.
 * Performs in-place React Query cache updates on live patches and manages reconnection
 * using an exponential backoff strategy.
 */
export function useOrgWebSocket() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [lastUpdatedNode, setLastUpdatedNode] = useState<{ id: string; timestamp: number } | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectDelayRef = useRef<number>(1000); // Initial reconnection delay (1s)
  const maxReconnectDelay = 16000;                // Maximum reconnection delay (16s)

  useEffect(() => {
    let isMounted = true;

    function connect() {
      if (!isMounted) return;

      // Dynamically resolve WebSocket connection URL:
      // In production, use the relative host to keep the container portable.
      // In Vite dev mode (port 5173), connect directly to the Go backend on port 8080.
      let wsUrl = import.meta.env.VITE_WS_URL;
      if (!wsUrl) {
        const isProdPort = window.location.port === '80' || window.location.port === '' || window.location.port === '443';
        if (isProdPort) {
          const isSecure = window.location.protocol === 'https:';
          wsUrl = (isSecure ? 'wss://' : 'ws://') + window.location.host + '/ws';
        } else {
          wsUrl = 'ws://localhost:8080/ws';
        }
      }
      logWS('Connecting to WebSocket at ' + wsUrl);

      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        if (!isMounted) return;
        setStatus('connected');
        reconnectDelayRef.current = 1000; // Reset reconnection delay upon successful connection
        logWS('WebSocket connection established successfully!');
      };

      socket.onmessage = (event) => {
        if (!isMounted) return;

        try {
          const patch: WSPatchMessage = JSON.parse(event.data);
          logWS('Received live patch: ' + JSON.stringify(patch));

          // Record modification timestamp to trigger fade-out UI animation
          setLastUpdatedNode({ id: patch.id, timestamp: Date.now() });

          // Localized query cache update without triggering a full refetch
          queryClient.setQueryData<OrgNode[]>(['org-tree'], (oldData) => {
            if (!oldData) return oldData;
            
            return oldData.map((node) => {
              if (node.id === patch.id) {
                return {
                  ...node,
                  headcount: patch.headcount,
                  budget: patch.budget,
                  performance: patch.performance,
                  updatedAt: patch.updatedAt,
                };
              }
              return node;
            });
          });
        } catch (err) {
          console.error('Failed to parse WebSocket patch message:', err);
        }
      };

      socket.onclose = (event) => {
        if (!isMounted) return;
        setStatus('disconnected');
        logWS(`WebSocket connection closed (code: ${event.code}). Attempting to reconnect...`);
        
        // Exponential backoff reconnection logic
        const nextDelay = Math.min(reconnectDelayRef.current * 2, maxReconnectDelay);
        reconnectDelayRef.current = nextDelay;

        setTimeout(() => {
          connect();
        }, reconnectDelayRef.current);
      };

      socket.onerror = (error) => {
        if (!isMounted) return;
        logWS('WebSocket error occurred: ' + JSON.stringify(error));
        // Close the socket; the onclose handler will automatically trigger reconnection
        socket.close();
      };
    }

    connect();

    return () => {
      isMounted = false;
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [queryClient]);

  return {
    status,
    lastUpdatedNode,
  };
}

// Formatted console logging for WebSockets in development mode
function logWS(message: string) {
  if (import.meta.env.DEV) {
    console.log(`%c[WebSocket] ${message}`, 'color: #3b82f6; font-weight: bold;');
  }
}
export type { WSPatchMessage };
