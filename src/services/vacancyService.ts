
import { db } from '../firebase/config';
import { collection, doc, addDoc, updateDoc, deleteDoc, getDocs, query, where, serverTimestamp, limit } from 'firebase/firestore';
import { Vacancy } from '../../types';
import { logSystemAction } from './auditService';

const VACANCIES_COLLECTION = 'vacancies';

/**
 * Fetch vacancies.
 * @param siteId Optional. If provided, filters by siteId.
 */
export const getVacancies = async (siteId?: string): Promise<Vacancy[]> => {
    try {
        let q;
        if (siteId) {
            q = query(collection(db, VACANCIES_COLLECTION), where("siteId", "==", siteId), limit(100));
        } else {
            q = query(collection(db, VACANCIES_COLLECTION), limit(100));
        }

        const snap = await getDocs(q);
        return snap.docs
            .map(d => ({ id: d.id, ...(d.data() as object) } as unknown as Vacancy))
            .filter((v: any) => !v.isDeleted);
    } catch (error) {
        console.error("Error fetching vacancies:", error);
        return [];
    }
};

export const createVacancy = async (vacancy: Omit<Vacancy, 'id'>, adminUid?: string, adminName?: string): Promise<string> => {
    try {
        const docRef = await addDoc(collection(db, VACANCIES_COLLECTION), vacancy);
        await logSystemAction(
            'CREATE',
            'SITES',
            `Created job vacancy "${vacancy.title}" for site "${vacancy.siteName}" (${vacancy.count} openings)`,
            adminUid ? { id: adminUid, name: adminName || 'Admin' } : undefined
        );
        return docRef.id;
    } catch (error) {
        console.error("Error creating vacancy:", error);
        throw error;
    }
};

export const updateVacancy = async (id: string, updates: Partial<Vacancy>, adminUid?: string, adminName?: string): Promise<void> => {
    try {
        await updateDoc(doc(db, VACANCIES_COLLECTION, id), updates);
        await logSystemAction(
            'UPDATE',
            'SITES',
            `Updated job vacancy ${id}${updates.title ? ` ("${updates.title}")` : ''}`,
            adminUid ? { id: adminUid, name: adminName || 'Admin' } : undefined
        );
    } catch (error) {
        console.error("Error updating vacancy:", error);
        throw error;
    }
};

export const deleteVacancy = async (id: string, adminUid?: string, adminName?: string): Promise<void> => {
    try {
        await deleteDoc(doc(db, VACANCIES_COLLECTION, id));
        await logSystemAction(
            'DELETE',
            'SITES',
            `Deleted job vacancy ${id}`,
            adminUid ? { id: adminUid, name: adminName || 'Admin' } : undefined
        );
    } catch (error) {
        console.error("Error deleting vacancy:", error);
        throw error;
    }
};

/**
 * Public method to get open vacancies for public blog
 */
export const getOpenVacancies = async (): Promise<Vacancy[]> => {
    try {
        const q = query(
            collection(db, VACANCIES_COLLECTION),
            where("status", "==", "Open"),
            limit(100)
        );
        const snap = await getDocs(q);
        return snap.docs
            .map(d => ({ id: d.id, ...d.data() } as unknown as Vacancy))
            .filter((v: any) => !v.isDeleted);
    } catch (error) {
        console.error("Error fetching public vacancies:", error);
        return [];
    }
}

