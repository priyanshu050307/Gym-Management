import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../context/AuthContext.js';

export interface RealtimeNotification {
  id: string;
  type: 'checkin' | 'payment' | 'member' | 'info';
  title: string;
  message: string;
  timestamp: Date;
}

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export const useSocket = () => {
  const { user, token } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [notifications, setNotifications] = useState<RealtimeNotification[]>([]);

  const addNotification = (n: Omit<RealtimeNotification, 'id' | 'timestamp'>) => {
    setNotifications((prev) => [
      {
        ...n,
        id: `${Date.now()}-${Math.random()}`,
        timestamp: new Date(),
      },
      ...prev.slice(0, 19), // keep last 20
    ]);
  };

  const dismissNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  useEffect(() => {
    if (!user || !token) return;

    // Only admin/staff need real-time dashboard events
    if (!['ADMIN', 'STAFF'].includes(user.role)) return;

    const socket = io(SOCKET_URL, {
      auth: {
        userId: user.id,
        ownerId: user.id, // for ADMIN, their own id is the ownerId
      },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      console.info('[Socket] Connected:', socket.id);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('checkin:new', (data: { memberName: string; branchName: string }) => {
      addNotification({
        type: 'checkin',
        title: '✅ New Check-In',
        message: `${data.memberName} just checked in at ${data.branchName}`,
      });
    });

    socket.on('payment:received', (data: { memberName: string; amount: number; planName: string }) => {
      addNotification({
        type: 'payment',
        title: '💰 Payment Received',
        message: `${data.memberName} paid ₹${data.amount} for ${data.planName}`,
      });
    });

    socket.on('member:registered', (data: { memberName: string; branchName: string }) => {
      addNotification({
        type: 'member',
        title: '👤 New Member',
        message: `${data.memberName} joined ${data.branchName}`,
      });
    });

    socket.on('notification:new', (data: { title: string; message: string }) => {
      addNotification({
        type: 'info',
        title: data.title,
        message: data.message,
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [user?.id, token]);

  return { connected, notifications, dismissNotification };
};
