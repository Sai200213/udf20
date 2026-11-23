import log from "@/src/utils/logger";
import { db, functions } from '../firebase/config';
import { collection, doc, onSnapshot, setDoc, query, where, getDocs, limit, QueryConstraint } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { LeaveRequest, AccountUpdateRequest, ResignationRequest, DisciplinaryAction, RequestStatus } from '../../types';
import { uploadFile } from './storageService';
import { logSystemAction } from './auditService';

// Collections
const LEAVE_REQ_COL = 'leave_requests';
const ACCOUNT_UPD_COL = 'account_updates';
const RESIGNATION_COL = 'resignations';
const DISCIPLINARY_COL = 'disciplinary_actions';

/**
 * Scans an object for any File instances, uploads them to Firebase Storage,
 * and replaces them with their download URLs. Returns a Firestore-safe copy
 * with all undefined fields recursively removed to prevent setDoc crashes (UDF-AUD-91).
 */
async function uploadFilesInObject(obj: Record<string, any>, storagePath: string): Promise<Record<string, any>> {
  const sanitizeFirestoreData = (val: any): any => {
    if (val === undefined || val === null) return null;
    if (Array.isArray(val)) {
      return val.filter(v => v !== undefined).map(sanitizeFirestoreData);
    }
    if (typeof val === 'object' && !(val instanceof Date) && !(val instanceof File)) {
      const cleanObj: Record<string, any> = {};
      for (const [k, v] of Object.entries(val)) {
        if (v !== undefined) {
          cleanObj[k] = sanitizeFirestoreData(v);
        }
      }
      return cleanObj;
    }
    return val;
  };

  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
      continue;
    }
    if (value instanceof File) {
      try {
        const url = await uploadFile(value, storagePath, value.name);
        result[key] = url;
        log.log(`[Storage] ✅ Uploaded ${key}: ${value.name}`);
      } catch (err) {
        log.error(`[Storage] ❌ Failed to upload ${key}: ${(value as File).name}`, err);
        result[key] = null; // Don't block the save — nullify the failed file
      }
    } else {
      result[key] = sanitizeFirestoreData(value);
    }
  }
  return result;
}


// Fetch leave requests by status (one-time query, capped with limit to prevent unbounded reads) (UDF-AUD-268)
export const fetchLeaveRequestsByStatus = async (status?: string, allowedSiteIds?: string[], limitCount = 200): Promise<LeaveRequest[]> => {
    const constraints: any[] = [];
    if (status) {
        constraints.push(where('status', '==', status));
    }
    if (allowedSiteIds && allowedSiteIds.length > 0 && allowedSiteIds.length <= 10) {
        constraints.push(where('siteId', 'in', allowedSiteIds));
    }
    constraints.push(limit(limitCount));

    const q = query(collection(db, LEAVE_REQ_COL), ...constraints);
    const snap = await getDocs(q);
    let results = snap.docs.map(d => ({ ...d.data(), id: d.id } as LeaveRequest));

    // Client-side filter by allowed site IDs if > 10 sites provided
    if (allowedSiteIds && allowedSiteIds.length > 10) {
        results = results.filter(r => allowedSiteIds.includes((r as any).siteId || ''));
    }

    return results;
};

// --- Leave Requests ---
export const subscribeToLeaveRequests = (callback: (reqs: LeaveRequest[]) => void) => {
    return onSnapshot(collection(db, LEAVE_REQ_COL), (snap) => {
        const reqs = snap.docs.map(d => ({ ...d.data(), id: d.id } as LeaveRequest));
        log.log(`Synced ${reqs.length} leave requests`);
        callback(reqs);
    }, (error) => {
        log.error("Error subscribing to leave requests:", error);
    });
};

const buildEmployeeIdQuery = (collPath: string, employeeId: string | string[]) => {
    const ids = (Array.isArray(employeeId) ? employeeId : [employeeId]).filter(Boolean);
    if (ids.length === 0) {
        return query(collection(db, collPath), where("employeeId", "==", "___dummy_nonexistent_id___"));
    }
    if (ids.length === 1) {
        return query(collection(db, collPath), where("employeeId", "==", ids[0]));
    }
    return query(collection(db, collPath), where("employeeId", "in", ids));
};

export const subscribeToMyLeaveRequests = (employeeId: string | string[], callback: (reqs: LeaveRequest[]) => void) => {
    const q = buildEmployeeIdQuery(LEAVE_REQ_COL, employeeId);
    return onSnapshot(q, (snap) => {
        const reqs = snap.docs.map(d => ({ ...d.data(), id: d.id } as LeaveRequest));
        callback(reqs);
    }, (error) => {
        log.error("Error subscribing to my leave requests:", error);
    });
};

export const submitLeaveRequest = async (request: LeaveRequest) => {
    const folderId = (request as any).portalId || request.employeeId;
    const safe = await uploadFilesInObject(
        request as unknown as Record<string, any>,
        `employees/${folderId}/requests/leave/${request.id}`
    );
    await setDoc(doc(db, LEAVE_REQ_COL, request.id), safe);
    await logSystemAction('CREATE', 'LEAVES', `Submitted leave request for ${request.employeeName} (${request.employeeId}) [${request.leaveType}: ${request.startDate} to ${request.endDate}]`);
};

export const updateLeaveRequest = async (request: LeaveRequest) => {
    await setDoc(doc(db, LEAVE_REQ_COL, request.id), request, { merge: true });
    const action = request.status === 'Approved' ? 'APPROVAL' : request.status === 'Rejected' ? 'REJECTION' : 'STATUS_CHANGE';
    await logSystemAction(action, 'LEAVES', `Leave request for ${request.employeeName} (${request.employeeId}) updated to ${request.status} (level ${request.currentLevel})`);
};

// --- Account Update Requests ---
export const subscribeToAccountUpdates = (callback: (reqs: AccountUpdateRequest[]) => void) => {
    return onSnapshot(collection(db, ACCOUNT_UPD_COL), (snap) => {
        const reqs = snap.docs.map(d => ({ ...d.data(), id: d.id } as AccountUpdateRequest));
        log.log(`Synced ${reqs.length} account updates`);
        callback(reqs);
    }, (error) => {
        log.error("Error subscribing to account updates:", error);
    });
};

export const subscribeToMyAccountUpdates = (employeeId: string | string[], callback: (reqs: AccountUpdateRequest[]) => void) => {
    const q = buildEmployeeIdQuery(ACCOUNT_UPD_COL, employeeId);
    return onSnapshot(q, (snap) => {
        const reqs = snap.docs.map(d => ({ ...d.data(), id: d.id } as AccountUpdateRequest));
        callback(reqs);
    }, (error) => {
        log.error("Error subscribing to my account updates:", error);
    });
};

export const submitAccountUpdateRequest = async (request: AccountUpdateRequest) => {
    const folderId = (request as any).portalId || request.employeeId;
    const safe = await uploadFilesInObject(
        request as unknown as Record<string, any>,
        `employees/${folderId}/requests/account_updates/${request.id}`
    );
    await setDoc(doc(db, ACCOUNT_UPD_COL, request.id), safe);
    await logSystemAction('CREATE', 'EMPLOYEES', `Submitted profile update request for ${request.employeeName} (${request.employeeId}): ${request.fieldLabel}`);
};

export const updateAccountUpdateRequest = async (request: AccountUpdateRequest) => {
    await setDoc(doc(db, ACCOUNT_UPD_COL, request.id), request, { merge: true });
    const action = request.status === 'Approved' ? 'APPROVAL' : request.status === 'Rejected' ? 'REJECTION' : 'STATUS_CHANGE';
    await logSystemAction(action, 'EMPLOYEES', `Account update request for ${request.employeeName} (${request.employeeId}) [${request.fieldLabel}] updated to ${request.status}`);
};

// --- Resignation Requests ---
export const subscribeToResignationRequests = (callback: (reqs: ResignationRequest[]) => void) => {
    return onSnapshot(collection(db, RESIGNATION_COL), (snap) => {
        const reqs = snap.docs.map(d => ({ ...d.data(), id: d.id } as ResignationRequest));
        log.log(`Synced ${reqs.length} resignations`);
        callback(reqs);
    }, (error) => {
        log.error("Error subscribing to resignation requests:", error);
    });
};

export const subscribeToMyResignations = (employeeId: string | string[], callback: (reqs: ResignationRequest[]) => void) => {
    const q = buildEmployeeIdQuery(RESIGNATION_COL, employeeId);
    return onSnapshot(q, (snap) => {
        const reqs = snap.docs.map(d => ({ ...d.data(), id: d.id } as ResignationRequest));
        callback(reqs);
    }, (error) => {
        log.error("Error subscribing to my resignation requests:", error);
    });
};

export const submitResignationRequest = async (request: ResignationRequest) => {
    const folderId = (request as any).portalId || request.employeeId;
    const safe = await uploadFilesInObject(
        request as unknown as Record<string, any>,
        `employees/${folderId}/requests/resignations/${request.id}`
    );
    await setDoc(doc(db, RESIGNATION_COL, request.id), safe);
    await logSystemAction('CREATE', 'EMPLOYEES', `Submitted resignation request for ${request.employeeName} (${request.employeeId}), relieving date: ${request.relievingDate}`);
};

export const updateResignationRequest = async (request: ResignationRequest) => {
    await setDoc(doc(db, RESIGNATION_COL, request.id), request, { merge: true });
    const action = request.status === 'Approved' ? 'APPROVAL' : request.status === 'Rejected' ? 'REJECTION' : 'STATUS_CHANGE';
    await logSystemAction(action, 'EMPLOYEES', `Resignation request for ${request.employeeName} (${request.employeeId}) updated to ${request.status} (relieving: ${request.relievingDate})`);
};

// Auto-relieve employees whose notice period has concluded
export const processDueResignations = async (requests: ResignationRequest[]): Promise<void> => {
    if (!requests || requests.length === 0) return;
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

    const { relieveEmployee } = await import('./employeeService');

    for (const req of requests) {
        if (req.status === 'Approved' && !req.isProcessed && req.relievingDate) {
            const relDateStr = String(req.relievingDate).split('T')[0];
            if (relDateStr <= todayStr) {
                try {
                    await relieveEmployee(req.employeeId, req.relievingDate, 'Resignation');
                    // Avoid client-side setDoc on resignations which fails for non-SuperAdmins under firestore.rules (UDF-AUD-269)
                    // Authoritative process flags and notifications are managed via Cloud Function cron
                    log.log(`[AutoRelieve] Relieved ${req.employeeId} (${req.employeeName}) on relieving date ${req.relievingDate}`);
                } catch (e) {
                    log.error(`[AutoRelieve] Failed to auto-relieve ${req.employeeId}:`, e);
                }
            }
        }
    }
};

export const fetchResignationRequestsByStatus = async (
    status: RequestStatus | 'ALL',
    allowedSiteIds: string[] = [],
    limitCount: number = 100
): Promise<ResignationRequest[]> => {
    try {
        const colRef = collection(db, RESIGNATION_COL);
        const constraints: QueryConstraint[] = [];

        if (status !== 'ALL') {
            constraints.push(where('status', '==', status));
        }

        if (allowedSiteIds.length > 0 && allowedSiteIds.length <= 10) {
            constraints.push(where('siteId', 'in', allowedSiteIds));
        }

        constraints.push(limit(limitCount));
        const q = query(colRef, ...constraints);
        const snap = await getDocs(q);

        let results = snap.docs.map(d => ({ ...d.data(), id: d.id } as ResignationRequest));

        if (allowedSiteIds.length > 10) {
            const siteSet = new Set(allowedSiteIds);
            results = results.filter(r => r.siteId && siteSet.has(r.siteId));
        }

        return results;
    } catch (err) {
        log.error(`Error fetching resignation requests for status ${status}:`, err);
        return [];
    }
};

// --- Disciplinary Actions ---
export const subscribeToDisciplinaryActions = (callback: (actions: DisciplinaryAction[]) => void) => {
    return onSnapshot(collection(db, DISCIPLINARY_COL), (snap) => {
        const actions = snap.docs.map(d => ({ ...d.data(), id: d.id } as DisciplinaryAction));
        callback(actions);
    });
};

export const subscribeToMyDisciplinaryActions = (employeeId: string | string[], callback: (actions: DisciplinaryAction[]) => void) => {
    const q = buildEmployeeIdQuery(DISCIPLINARY_COL, employeeId);
    return onSnapshot(q, (snap) => {
        const actions = snap.docs.map(d => ({ ...d.data(), id: d.id } as DisciplinaryAction));
        callback(actions);
    }, (error) => {
        log.error("Error subscribing to my disciplinary actions:", error);
    });
};

export const addDisciplinaryAction = async (action: DisciplinaryAction) => {
    const folderId = (action as any).portalId || action.employeeId;
    const safe = await uploadFilesInObject(
        action as unknown as Record<string, any>,
        `employees/${folderId}/requests/disciplinary/${action.id}`
    );
    await setDoc(doc(db, DISCIPLINARY_COL, action.id), safe);
    await logSystemAction('CREATE', 'DISCIPLINARY', `Filed ${action.actionType} for employee ${action.employeeName} (${action.employeeId}) by ${action.filedBy}`);
};

// --- CLOUD-4: Multi-Level Approval Engine (Server-Enforced) ---
export interface ProcessRequestReviewParams {
    requestType: 'LEAVES' | 'ACCOUNT_UPDATES' | 'RESIGNATIONS';
    requestId: string;
    action: 'APPROVE' | 'REJECT' | 'REVERT';
    comment?: string;
    isBypass?: boolean;
    updatedRelievingDate?: string;
    targetLevel?: number;
}

export interface ProcessRequestReviewResult {
    success: boolean;
    requestId: string;
    status: string;
    currentLevel: number;
}

export const processRequestReview = async (
    params: ProcessRequestReviewParams
): Promise<ProcessRequestReviewResult> => {
    const fn = httpsCallable<ProcessRequestReviewParams, ProcessRequestReviewResult>(
        functions,
        'processRequestReviewServer'
    );
    const res = await fn(params);
    return res.data;
};

// --- Universal Workflow Revert ---
export const revertWorkflowRequest = async (
    collectionId: 'leave_requests' | 'account_updates' | 'resignations',
    id: string,
    targetLevel: number
) => {
    const typeMap = {
        'leave_requests': 'LEAVES',
        'account_updates': 'ACCOUNT_UPDATES',
        'resignations': 'RESIGNATIONS'
    } as const;

    try {
        await processRequestReview({
            requestType: typeMap[collectionId],
            requestId: id,
            action: 'REVERT',
            targetLevel
        });
    } catch (err) {
        log.warn(`[revertWorkflowRequest] Server callable failed, falling back to direct write:`, err);
        const docRef = doc(db, collectionId, id);
        await setDoc(docRef, {
            status: 'Pending',
            currentLevel: targetLevel
        }, { merge: true });
        await logSystemAction('STATUS_CHANGE', 'SYSTEM', `Reverted ${collectionId} request ${id} to approval level ${targetLevel}`);
    }
};





