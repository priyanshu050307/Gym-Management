import React, { useEffect, useState } from 'react';
import { apiFetch } from '../utils/api.js';
import { Bell, AlertTriangle, CheckCircle, CreditCard, Calendar, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

export const NotificationPopup: React.FC = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!user) return;

    // Check if shown in this session already
    const hasBeenShown = sessionStorage.getItem('gymflow_notification_shown');
    if (hasBeenShown === 'true') return;

    const fetchNotifications = async () => {
      try {
        const data = await apiFetch<{ notifications: Notification[] }>('/notifications');
        const unread = data.notifications.filter(n => !n.isRead);
        
        if (unread.length > 0) {
          setNotifications(unread);
          setIsOpen(true);
          sessionStorage.setItem('gymflow_notification_shown', 'true');
        }
      } catch (err) {
        console.error('Error fetching notifications:', err);
      }
    };

    fetchNotifications();
  }, [user]);

  const handleMarkAllRead = async () => {
    try {
      await apiFetch('/notifications/read-all', { method: 'PUT' });
      setIsOpen(false);
    } catch (err) {
      console.error('Error marking notifications as read:', err);
      setIsOpen(false);
    }
  };

  if (!isOpen || notifications.length === 0) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case 'ALERT':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case 'BILLING':
        return <CreditCard className="h-5 w-5 text-green-500" />;
      case 'BOOKING':
        return <Calendar className="h-5 w-5 text-blue-500" />;
      default:
        return <CheckCircle className="h-5 w-5 text-purple-500" />;
    }
  };

  const getBgColor = (type: string) => {
    switch (type) {
      case 'ALERT':
        return 'bg-red-50/70 border-red-100';
      case 'BILLING':
        return 'bg-green-50/70 border-green-100';
      case 'BOOKING':
        return 'bg-blue-50/70 border-blue-100';
      default:
        return 'bg-purple-50/70 border-purple-100';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white border border-slate-100 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-gym-primary/10 to-gym-secondary/10 flex items-center justify-between border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gym-primary/20 text-gym-primary rounded-xl">
              <Bell className="h-5 w-5 animate-bounce" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-gym-text">GymFlow Alerts</h2>
              <p className="text-xs text-gym-muted font-semibold">You have {notifications.length} new update{notifications.length > 1 ? 's' : ''}</p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-gym-muted hover:text-gym-text transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[350px] overflow-y-auto space-y-3.5">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`p-4 rounded-2xl border flex gap-3.5 items-start ${getBgColor(notification.type)}`}
            >
              <div className="mt-0.5">{getIcon(notification.type)}</div>
              <div className="space-y-0.5 flex-1">
                <h4 className="text-sm font-extrabold text-slate-800 leading-snug">{notification.title}</h4>
                <p className="text-xs text-slate-600 font-medium leading-relaxed">{notification.message}</p>
                <p className="text-[10px] text-slate-400 font-mono pt-1">
                  {new Date(notification.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
          <button
            onClick={() => setIsOpen(false)}
            className="flex-1 py-3 px-4 bg-white hover:bg-slate-100 border border-slate-200 text-gym-text font-bold rounded-xl transition-all text-xs text-center"
          >
            Review Later
          </button>
          <button
            onClick={handleMarkAllRead}
            className="flex-1 py-3 px-4 bg-gym-primary hover:bg-gym-primary/80 text-white font-bold rounded-xl transition-all text-xs text-center shadow-lg shadow-gym-primary/20"
          >
            Dismiss All
          </button>
        </div>
      </div>
    </div>
  );
};
