const { db, admin } = require("../services/firebase");

function parseArgs(argv) {
  const args = new Set(argv.slice(2));
  return {
    dryRun: args.has("--dry-run"),
    help: args.has("--help") || args.has("-h")
  };
}

function printHelp() {
  console.log("Migration legacy users -> pasteurs/{pasteurId}/disciples/{phoneNumber}");
  console.log("");
  console.log("Usage:");
  console.log("  npm run migrate:users");
  console.log("  npm run migrate:users -- --dry-run");
}

async function copySubcollection(sourceDocRef, targetDocRef, subcollectionName) {
  const snapshot = await sourceDocRef.collection(subcollectionName).get();
  if (snapshot.empty) {
    return 0;
  }

  let copied = 0;
  let batch = db.batch();
  let writes = 0;

  for (const doc of snapshot.docs) {
    batch.set(targetDocRef.collection(subcollectionName).doc(doc.id), doc.data(), { merge: true });
    writes += 1;
    copied += 1;

    if (writes >= 400) {
      await batch.commit();
      batch = db.batch();
      writes = 0;
    }
  }

  if (writes > 0) {
    await batch.commit();
  }

  return copied;
}

async function migrate({ dryRun }) {
  const legacySnapshot = await db.collection("users").get();

  if (legacySnapshot.empty) {
    console.log("[migration] Aucun document legacy users a migrer.");
    return;
  }

  let movedUsers = 0;
  let movedCheckins = 0;
  let movedManualMessages = 0;

  for (const legacyDoc of legacySnapshot.docs) {
    const data = legacyDoc.data() || {};
    const discipleId = legacyDoc.id;
    const pasteurId = data.pasteurId || data.ownerId || "unassigned";

    const targetDocRef = db
      .collection("pasteurs")
      .doc(pasteurId)
      .collection("disciples")
      .doc(discipleId);

    if (!dryRun) {
      await db
        .collection("pasteurs")
        .doc(pasteurId)
        .set(
          {
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          },
          { merge: true }
        );

      await targetDocRef.set(
        {
          ...data,
          phoneNumber: data.phoneNumber || discipleId,
          phone: data.phone || discipleId,
          migratedAt: admin.firestore.FieldValue.serverTimestamp()
        },
        { merge: true }
      );
    }

    if (!dryRun) {
      movedCheckins += await copySubcollection(legacyDoc.ref, targetDocRef, "checkins");
      movedManualMessages += await copySubcollection(legacyDoc.ref, targetDocRef, "manualMessages");
    }

    movedUsers += 1;
  }

  if (dryRun) {
    console.log(`[migration] Dry run: ${movedUsers} utilisateur(s) legacy detecte(s).`);
    return;
  }

  console.log(`[migration] Utilisateurs migrés: ${movedUsers}`);
  console.log(`[migration] Check-ins migrés: ${movedCheckins}`);
  console.log(`[migration] Messages manuels migrés: ${movedManualMessages}`);
  console.log("[migration] Terminé. Vérifie la cohérence puis supprime la collection legacy manuellement.");
}

const args = parseArgs(process.argv);

if (args.help) {
  printHelp();
  process.exit(0);
}

migrate({ dryRun: args.dryRun }).catch((error) => {
  console.error("[migration] Erreur:", error);
  process.exit(1);
});
