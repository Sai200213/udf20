import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Notification, UserType } from '../../types';
import { AppView } from '../../App';
import { db, functions } from '../firebase/config';
import { httpsCallable } from 'firebase/functions';
import { collection, doc, query, where, limit, onSnapshot, setDoc, updateDoc, writeBatch, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';

interface NotificationContextType {
    notifications: Notification[];
    setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
    sendNotification: (targetUserId: string, message: string, type?: 'success' | 'error' | 'info' | 'warning', link?: AppView) => Promise<void>;
    markNotificationAsRead: (id: string) => Promise<void>;
    markAllNotificationsAsRead: (userId: string) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const { user } = useAuth();

    // Listen for real-time notifications from Firestore for the logged-in user
    useEffect(() => {
        if (!user || !user.id || (user as any).roleId === 'guest' || (user as any).roleId === 'candidate') {
            setNotifications([]);
            return;
        }

        const isVendor = (user as any).isBgvVendor || (user as any).roleId === 'role-bgv-vendor' || (user as any).roleId === 'bgv-vendor';
        const targetIds = [user.id];
        const isStaffOrAdmin = !isVendor && (user.type === UserType.ADMIN || user.isSuperAdmin || (user.type as string) === 'Staff');
        if (isStaffOrAdmin) {
            targetIds.push('all_admins', 'admin');
        }
        if ((user as any).roleId && (user as any).roleId !== 'guest' && (user as any).roleId !== 'candidate') {
            const roleTarget = `ROLE:${(user as any).roleId}`;
            if (!targetIds.includes(roleTarget)) {
                targetIds.push(roleTarget);
            }
        }
        if (user.type === UserType.EMPLOYEE || (user as any).isEmployee) {
            if (!targetIds.includes('ROLE:employee')) {
                targetIds.push('ROLE:employee');
            }
        }
        if (user.employeeId && !targetIds.includes(user.employeeId)) {
            targetIds.push(user.employeeId);
        }
        if (user.portalId && !targetIds.includes(user.portalId)) {
            targetIds.push(user.portalId);
        }

        // Keep targetIds within Firestore limit (max 10)
        const activeTargets = targetIds.slice(0, 10);

        const unsubscribers: (() => void)[] = [];
        const notifMap = new Map<string, Notification>();

        activeTargets.forEach((targetId) => {
            const q = query(
                collection(db, 'notifications'),
                where('targetUserId', '==', targetId),
                limit(50)
            );

            const unsub = onSnapshot(q, (snapshot) => {
                snapshot.forEach((docSnap) => {
                    const data = docSnap.data();
                    const readByList: string[] = Array.isArray(data.readBy) ? data.readBy : [];
                    const isRead = Boolean(data.read) || 
                        (readByList.includes(user.id)) ||
                        Boolean(user.employeeId && readByList.includes(user.employeeId)) ||
                        Boolean(user.portalId && readByList.includes(user.portalId));

                    notifMap.set(docSnap.id, {
                        id: docSnap.id,
                        targetUserId: data.targetUserId,
                        type: data.type || 'info',
                        message: data.message || '',
                        read: isRead,
                        readBy: readByList,
                        timestamp: data.timestamp || new Date().toISOString(),
                        link: data.link
                    });
                });

                snapshot.docChanges().forEach(change => {
                    if (change.type === 'removed') {
                        notifMap.delete(change.doc.id);
                    }
                });

                const list = Array.from(notifMap.values());
                list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                setNotifications(list);
            }, (err) => {
                console.warn(`Notifications subscription listener warning for target ${targetId}:`, err);
            });

            unsubscribers.push(unsub);
        });

        return () => {
            unsubscribers.forEach(u => u());
        };
    }, [user?.id, user?.type, user?.isSuperAdmin, user?.employeeId, user?.portalId, (user as any)?.roleId]);

    const sendNotification = useCallback(async (
        targetUserId: string,
        message: string,
        type: 'success' | 'error' | 'info' | 'warning' = 'info',
        link?: AppView
    ) => {
        const notifId = uuidv4();
        const newNotif: Notification = {
            id: notifId,
            targetUserId,
            type,
            message,
            read: false,
            timestamp: new Date().toISOString(),
            link: (link || null) as any
        };

        // Instant local update (only if target matches the active user session)
        const isSelfOrBroadcast = targetUserId === user?.id || 
            targetUserId === user?.employeeId || 
            targetUserId === user?.portalId || 
            (targetUserId === 'all_admins' && (user?.type === UserType.ADMIN || user?.isSuperAdmin || (user?.type as string) === 'Staff')) ||
            (targetUserId === 'ROLE:employee' && (user?.type === UserType.EMPLOYEE || (user as any)?.isEmployee)) ||
            (targetUserId === `ROLE:${(user as any)?.roleId}`);

        if (isSelfOrBroadcast) {
            setNotifications(prev => [newNotif, ...prev.filter(n => n.id !== notifId)]);
        }

        // Persist via secure Cloud Function with fallback
        try {
            const sendFn = httpsCallable<{ id: string; targetUserId: string; message: string; type: string; link: any }, { success: boolean }>(functions, 'sendNotificationServer');
            await sendFn({
                id: notifId,
                targetUserId,
                message,
                type,
                link: (link || null) as any
            });
        } catch (serverErr) {
            console.warn("Failed to persist notification via Cloud Function, attempting direct Firestore write:", serverErr);
            try {
                await setDoc(doc(db, 'notifications', notifId), {
                    ...newNotif,
                    createdAt: serverTimestamp()
                });
            } catch (err) {
                console.warn("Failed to persist notification to Firestore fallback:", err);
            }
        }

    }, [user]);

    const markNotificationAsRead = useCallback(async (id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
        try {
            const notif = notifications.find(n => n.id === id);
            const isBroadcast = notif && (notif.targetUserId === 'all_admins' || notif.targetUserId === 'admin' || notif.targetUserId.startsWith('ROLE:'));
            if (isBroadcast && user?.id) {
                await updateDoc(doc(db, 'notifications', id), {
                    readBy: arrayUnion(user.id)
                });
            } else {
                await updateDoc(doc(db, 'notifications', id), {
                    read: true,
                    ...(user?.id ? { readBy: arrayUnion(user.id) } : {})
                });
            }
        } catch (err) {
            console.warn("Failed to mark notification read in Firestore:", err);
        }
    }, [notifications, user?.id]);

    const markAllNotificationsAsRead = useCallback(async (userId: string) => {
        const myTargets = new Set<string>([userId]);
        if (user?.employeeId) myTargets.add(user.employeeId);
        if (user?.portalId) myTargets.add(user.portalId);
        const isVendor = (user as any)?.isBgvVendor || (user as any)?.roleId === 'role-bgv-vendor' || (user as any)?.roleId === 'bgv-vendor';
        if (!isVendor && (user?.type === UserType.ADMIN || user?.isSuperAdmin)) {
            myTargets.add('all_admins');
            myTargets.add('admin');
        }

        setNotifications(prev => prev.map(n => {
            if (myTargets.has(n.targetUserId)) {
                return { ...n, read: true };
            }
            return n;
        }));

        try {
            const batch = writeBatch(db);
            const unread = notifications.filter(n => !n.read && myTargets.has(n.targetUserId));
            unread.slice(0, 50).forEach(n => {
                const isBroadcast = n.targetUserId === 'all_admins' || n.targetUserId === 'admin' || n.targetUserId.startsWith('ROLE:');
                if (isBroadcast && user?.id) {
                    batch.update(doc(db, 'notifications', n.id), {
                        readBy: arrayUnion(user.id)
                    });
                } else {
                    batch.update(doc(db, 'notifications', n.id), {
                        read: true,
                        ...(user?.id ? { readBy: arrayUnion(user.id) } : {})
                    });
                }
            });
            await batch.commit();
        } catch (err) {
            console.warn("Failed to batch update notifications in Firestore:", err);
        }
    }, [notifications, user]);

    const value: NotificationContextType = {
        notifications,
        setNotifications,
        sendNotification,
        markNotificationAsRead,
        markAllNotificationsAsRead
    };

    return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error('useNotifications must be used within a NotificationProvider');
    }
    return context;
};

