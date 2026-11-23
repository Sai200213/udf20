import log from "@/src/utils/logger";

import { db } from '../firebase/config';
import { doc, getDoc, setDoc, collection, getCountFromServer, query, where } from 'firebase/firestore';

const SETTINGS_COLLECTION = 'settings';
const STATS_DOC_ID = 'public_stats';
const EMPLOYEES_COLLECTION = 'employees';

export interface PublicStats {
    totalEmployees: number;
    lastUpdated: string;
}

export const getPublicStats = async (): Promise<PublicStats> => {
    try {
        const docRef = doc(db, SETTINGS_COLLECTION, STATS_DOC_ID);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            return snap.data() as PublicStats;
        }
        return { totalEmployees: 0, lastUpdated: new Date().toISOString() };
    } catch (error) {
        console.error("Error fetching public stats:", error);
        return { totalEmployees: 0, lastUpdated: new Date().toISOString() };
    }
};

export const updatePublicStats = async (): Promise<void> => {
    // Only administrators or scheduled triggers with SETTINGS_MANAGE permission can update settings/public_stats
    try {
        // Calculate Total Active Non-Relieved Employees (UDF-AUD-162)
        const empColl = collection(db, EMPLOYEES_COLLECTION);
        const q = query(empColl, where("isActive", "==", true), where("isRelieved", "==", false));
        const snapshot = await getCountFromServer(q);
        const count = snapshot.data().count;

        const stats: PublicStats = {
            totalEmployees: count,
            lastUpdated: new Date().toISOString()
        };

        await setDoc(doc(db, SETTINGS_COLLECTION, STATS_DOC_ID), stats, { merge: true });
        log.log("Public stats updated:", stats);

    } catch (error: any) {
        if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
            log.debug("Public stats update skipped: caller lacks SETTINGS_MANAGE permissions.");
        } else {
            console.warn("Error updating public stats:", error);
        }
    }
};
