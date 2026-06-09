import * as functions from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { initializeApp, getApps } from "firebase-admin/app";

if (getApps().length === 0) {
  initializeApp();
}

const AUDIT_LOG_COLLECTION = "auditLogs";
const RETENTION_DAYS = 365;
const BATCH_SIZE = 500;

export const cleanupOldAuditLogs = functions.onSchedule(
  {
    schedule: "0 3 * * *",
    timeZone: "Europe/Lisbon",
    retryCount: 2,
    maxInstances: 1,
  },
  async () => {
    const db = getFirestore();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
    const cutoffTimestamp = Timestamp.fromDate(cutoff);

    const schoolSnap = await db.collection("schools").select().get();
    let totalDeleted = 0;
    let schoolsProcessed = 0;

    for (const schoolDoc of schoolSnap.docs) {
      const schoolId = schoolDoc.id;
      let processed = 0;

      const logSnap = await db
        .collection("schools")
        .doc(schoolId)
        .collection(AUDIT_LOG_COLLECTION)
        .where("timestamp", "<", cutoffTimestamp)
        .orderBy("timestamp")
        .limit(BATCH_SIZE)
        .get();

      if (logSnap.empty) continue;

      const batch = db.batch();
      logSnap.docs.forEach((doc) => {
        batch.delete(doc.ref);
        processed++;
      });
      await batch.commit();
      totalDeleted += processed;
      schoolsProcessed++;

      logger.info(
        `[cleanupOldAuditLogs] Removed ${processed} old audit logs from school ${schoolId}`
      );
    }

    logger.info(
      `[cleanupOldAuditLogs] Complete: ${totalDeleted} logs deleted across ${schoolsProcessed} schools`
    );
  }
);
