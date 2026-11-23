import { 
  collection, doc, getDoc, getDocs, setDoc, deleteDoc, 
  updateDoc, query, orderBy, onSnapshot, serverTimestamp, where, limit 
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, auth, functions } from '../firebase/config';
import { SETTINGS_COLLECTION } from './adminService';
import { Site } from '../../types';
import { resolveEmployeeDoc } from './employeeService';

export type RecycleBinItemType = 'SITE' | 'STAFF' | 'EMPLOYEE' | 'SUBMISSION' | 'INVITE' | 'ROLE' | 'VACANCY' | 'DESIGNATION';

export interface RecycleBinItem {
  id: string;
  itemType: RecycleBinItemType;
  name: string;
  originalId: string;
  originalCollection: string;
  data: any;
  deletedAt: string;
  deletedByUid: string;
  deletedByName: string;
  expiresAt: string; // 30 days retention
  metadata?: Record<string, any>;
}

const RECYCLE_BIN_COLLECTION = 'recycle_bin';
const RETENTION_DAYS = 30;

/**
 * Move any portal item to the universal Recycle Bin.
 */
export async function moveToRecycleBin(params: {
  itemType: RecycleBinItemType;
  name: string;
  originalId: string;
  originalCollection: string;
  data: any;
  deletedByUid: string;
  deletedByName: string;
  metadata?: Record<string, any>;
}): Promise<string> {
  const docRef = doc(collection(db, RECYCLE_BIN_COLLECTION));
  const now = new Date();
  const expires = new Date(now.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const binItem: Omit<RecycleBinItem, 'id'> = {
    itemType: params.itemType,
    name: params.name || 'Unnamed Record',
    originalId: params.originalId,
    originalCollection: params.originalCollection,
    data: params.data,
    deletedAt: now.toISOString(),
    deletedByUid: params.deletedByUid || 'system',
    deletedByName: params.deletedByName || 'Admin',
    expiresAt: expires.toISOString(),
    ...(params.metadata ? { metadata: params.metadata } : {})
  };

  await setDoc(docRef, binItem);
  return docRef.id;
}

async function syncRestoredStaffSitesLocal(
  staffId: string,
  savedSiteIds: string[],
  shouldRestoreLinks: boolean
): Promise<string[]> {
  const targetIds = new Set((Array.isArray(savedSiteIds) ? savedSiteIds : []).filter(Boolean));
  const sitesDocRef = doc(db, SETTINGS_COLLECTION, 'sites');
  const sitesSnap = await getDoc(sitesDocRef);
  if (!sitesSnap.exists()) {
    return shouldRestoreLinks ? Array.from(targetIds) : [];
  }

  const currentSites: Site[] = sitesSnap.data().sites || [];
  let modified = false;
  const validSiteIds: string[] = [];

  const updatedSites = currentSites.map((s) => {
    if (!s || !s.id) return s;
    let supervisorIds = Array.isArray(s.supervisorIds)
      ? s.supervisorIds.filter(Boolean)
      : (s.supervisorId ? [s.supervisorId] : []);
    let supervisorId = s.supervisorId || '';

    if (shouldRestoreLinks && targetIds.has(s.id)) {
      validSiteIds.push(s.id);
      if (!supervisorIds.includes(staffId)) {
        supervisorIds = [...supervisorIds, staffId];
        modified = true;
      }
      if (!supervisorId) {
        supervisorId = staffId;
        modified = true;
      }
      return { ...s, supervisorId, supervisorIds };
    }

    if (!shouldRestoreLinks && (supervisorId === staffId || supervisorIds.includes(staffId))) {
      supervisorIds = supervisorIds.filter((id) => id !== staffId);
      if (supervisorId === staffId) {
        supervisorId = supervisorIds[0] || '';
      }
      modified = true;
      return { ...s, supervisorId, supervisorIds };
    }

    return s;
  });

  if (modified) {
    await updateDoc(sitesDocRef, { sites: updatedSites });
  }
  return shouldRestoreLinks ? validSiteIds : [];
}

/**
 * Restore an item from the Recycle Bin back to its original state and collection.
 */
export async function restoreFromRecycleBin(
  recycleBinItemId: string,
  options?: { restoreSiteLinks?: boolean }
): Promise<{ success: boolean; message: string }> {
  const restoreSiteLinks = options?.restoreSiteLinks !== false;
  try {
    const fn = httpsCallable<
      { recycleBinItemId: string; restoreSiteLinks?: boolean },
      { success: boolean; message: string }
    >(
      functions,
      'restoreRecycleBinServer'
    );
    const res = await fn({ recycleBinItemId, restoreSiteLinks });
    if (res.data && res.data.success) {
      return res.data;
    }
    throw new Error(res.data?.message || 'Restore failed on server.');
  } catch (serverErr: any) {
    if (serverErr?.code === 'functions/permission-denied') throw serverErr;
    console.error('[RECYCLE_BIN] Server restore failed:', serverErr);
    throw new Error(serverErr.message || 'Failed to restore record via server.');
  }
}

/**
 * Permanently purge an item from the Recycle Bin.
 */
export async function permanentDeleteFromRecycleBin(recycleBinItemId: string): Promise<void> {
  const binDocRef = doc(db, RECYCLE_BIN_COLLECTION, recycleBinItemId);
  const snap = await getDoc(binDocRef);
  if (snap.exists()) {
    const binData = snap.data();
    const originalId = binData.originalId;
    if (originalId) {
      try {
        if (binData.itemType === 'STAFF') {
          const { deleteStaffUser } = await import('./staffService');
          await deleteStaffUser(originalId);
        } else if (binData.itemType === 'EMPLOYEE') {
          const { permanentDeleteEmployee } = await import('./employeeService');
          await permanentDeleteEmployee(originalId);
        } else if (binData.itemType === 'SUBMISSION') {
          const { deleteSubmission } = await import('./employeeService');
          await deleteSubmission(originalId);
        } else if (binData.itemType === 'SITE') {
          // Clean up soft-deleted vacancies linked to this site (UDF-AUD-95)
          try {
            const vacSnap = await getDocs(query(collection(db, 'vacancies'), where('siteId', '==', originalId)));
            const vacDeletes = vacSnap.docs.filter(d => (d.data() as any).isDeleted === true).map(d => deleteDoc(d.ref));
            await Promise.all(vacDeletes);
          } catch (e) {
            console.warn(`Could not purge vacancies for site ${originalId}:`, e);
          }
        } else if (binData.itemType === 'VACANCY') {
          try {
            await deleteDoc(doc(db, 'vacancies', originalId));
          } catch (e) {
            console.error(`Could not purge vacancy ${originalId}:`, e);
            throw e;
          }
        } else if (binData.itemType === 'INVITE') {
          try {
            await deleteDoc(doc(db, 'referral_invites', originalId));
          } catch (e) {
            console.error(`Could not purge referral_invite ${originalId}:`, e);
            throw e;
          }
        }
      } catch (purgeErr) {
        console.error(`Could not purge underlying ${binData.itemType} (${originalId}):`, purgeErr);
        throw new Error(`Underlying ${binData.itemType} purge failed; keeping Recycle Bin entry for safety.`);
      }
    }
  }
  await deleteDoc(binDocRef);
}

/**
 * Permanently purge all items currently in the Recycle Bin.
 */
export async function emptyRecycleBin(): Promise<number> {
  const snap = await getDocs(collection(db, RECYCLE_BIN_COLLECTION));
  let count = 0;
  for (let i = 0; i < snap.docs.length; i += 10) {
    const chunk = snap.docs.slice(i, i + 10);
    await Promise.all(chunk.map(d => permanentDeleteFromRecycleBin(d.id)));
    count += chunk.length;
  }
  return count;
}

/**
 * Subscribe to the Recycle Bin in real time (capped at maxLimit to prevent unbounded memory growth - UDF-AUD-295).
 */
export function subscribeToRecycleBin(callback: (items: RecycleBinItem[]) => void, maxLimit = 100): () => void {
  const q = query(collection(db, RECYCLE_BIN_COLLECTION), orderBy('deletedAt', 'desc'), limit(maxLimit));
  return onSnapshot(q, (snapshot) => {
    const items: RecycleBinItem[] = snapshot.docs.map(d => ({
      id: d.id,
      ...d.data()
    } as RecycleBinItem));
    callback(items);
  }, (err) => {
    console.warn('[RecycleBin] Subscription error:', err);
    callback([]);
  });
}
