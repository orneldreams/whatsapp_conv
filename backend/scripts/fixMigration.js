/**
 * Script de correction de migration one-shot
 *
 * Déplace tous les documents de :
 *   pasteurs/VaXSPdddxodY032UOhVGTqnbq353/disciples/*
 * vers :
 *   pasteurs/VaXSPdddxodY032U0hVGTqnbq353/disciples/*
 *
 * Puis supprime le document source erroné et ses sous-collections.
 *
 * Usage :
 *   node scripts/fixMigration.js
 *   node scripts/fixMigration.js --dry-run
 */

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const { db, admin } = require("../src/services/firebase");

const SOURCE_PASTEUR_ID = "VaXSPdddxodY032UOhVGTqnbq353"; // ID avec O (lettre) — créé par erreur
const TARGET_PASTEUR_ID = "VaXSPdddxodY032U0hVGTqnbq353"; // ID correct avec 0 (zéro)

const dryRun = process.argv.includes("--dry-run");

if (dryRun) {
  console.log("[fixMigration] Mode DRY-RUN activé — aucune écriture ne sera effectuée.");
}

/**
 * Copie tous les documents d'une sous-collection d'un source vers un target.
 * Retourne le nombre de documents copiés.
 */
async function copySubcollection(sourceDocRef, targetDocRef, subcollectionName) {
  const snapshot = await sourceDocRef.collection(subcollectionName).get();
  if (snapshot.empty) {
    return 0;
  }

  let copied = 0;
  let batch = db.batch();
  let writes = 0;

  for (const doc of snapshot.docs) {
    if (!dryRun) {
      batch.set(targetDocRef.collection(subcollectionName).doc(doc.id), doc.data(), { merge: true });
    }
    writes += 1;
    copied += 1;

    if (writes >= 400) {
      if (!dryRun) await batch.commit();
      batch = db.batch();
      writes = 0;
    }
  }

  if (writes > 0 && !dryRun) {
    await batch.commit();
  }

  return copied;
}

/**
 * Supprime récursivement une sous-collection.
 */
async function deleteSubcollection(docRef, subcollectionName) {
  const snapshot = await docRef.collection(subcollectionName).get();
  if (snapshot.empty) return;

  let batch = db.batch();
  let writes = 0;

  for (const doc of snapshot.docs) {
    batch.delete(doc.ref);
    writes += 1;

    if (writes >= 400) {
      if (!dryRun) await batch.commit();
      batch = db.batch();
      writes = 0;
    }
  }

  if (writes > 0 && !dryRun) {
    await batch.commit();
  }
}

async function run() {
  console.log(`[fixMigration] Source : pasteurs/${SOURCE_PASTEUR_ID}/disciples`);
  console.log(`[fixMigration] Cible  : pasteurs/${TARGET_PASTEUR_ID}/disciples`);

  const sourceRef = db.collection("pasteurs").doc(SOURCE_PASTEUR_ID);
  const targetRef = db.collection("pasteurs").doc(TARGET_PASTEUR_ID);

  // 1. Vérifier que le pasteur cible est accessible (le doc peut ne pas avoir de champs
  //    s'il a été créé implicitement via ses sous-collections — c'est valide)
  const targetDoc = await targetRef.get();
  if (!targetDoc.exists) {
    console.log(`[fixMigration] Le document cible n'a pas de champs (créé implicitement via sous-collections). Migration autorisée.`);
  } else {
    console.log(`[fixMigration] Pasteur cible trouvé : ${targetDoc.data()?.email || TARGET_PASTEUR_ID}`);
  }

  // 2. Lister tous les disciples dans la source erronée
  const disciplesSnapshot = await sourceRef.collection("disciples").get();
  if (disciplesSnapshot.empty) {
    console.log(`[fixMigration] Aucun disciple trouvé sous pasteurs/${SOURCE_PASTEUR_ID}/disciples. Rien à faire.`);
    process.exit(0);
  }

  console.log(`[fixMigration] ${disciplesSnapshot.size} disciple(s) à migrer...`);

  let migratedDisciples = 0;
  let migratedCheckins = 0;

  for (const discipleDoc of disciplesSnapshot.docs) {
    const discipleId = discipleDoc.id;
    const data = discipleDoc.data();

    const sourceDisciple = sourceRef.collection("disciples").doc(discipleId);
    const targetDisciple = targetRef.collection("disciples").doc(discipleId);

    console.log(`  → Copie disciple : ${discipleId} (${data.name || "sans nom"})`);

    if (!dryRun) {
      // Copier le document principal du disciple
      await targetDisciple.set(data, { merge: true });
    }
    migratedDisciples += 1;

    // Copier la sous-collection checkins
    const checkinsCopied = await copySubcollection(sourceDisciple, targetDisciple, "checkins");
    if (checkinsCopied > 0) {
      console.log(`     ✓ ${checkinsCopied} check-in(s) copiés`);
      migratedCheckins += checkinsCopied;
    }
  }

  console.log(`\n[fixMigration] Migration terminée : ${migratedDisciples} disciple(s), ${migratedCheckins} check-in(s).`);

  if (dryRun) {
    console.log("[fixMigration] Mode DRY-RUN : rien n'a été supprimé.");
    process.exit(0);
  }

  // 3. Supprimer les disciples source (sous-collections d'abord)
  console.log("\n[fixMigration] Suppression des données source...");

  for (const discipleDoc of disciplesSnapshot.docs) {
    const discipleId = discipleDoc.id;
    const sourceDisciple = sourceRef.collection("disciples").doc(discipleId);

    await deleteSubcollection(sourceDisciple, "checkins");
    await sourceDisciple.delete();
    console.log(`  ✗ Supprimé : pasteurs/${SOURCE_PASTEUR_ID}/disciples/${discipleId}`);
  }

  // 4. Supprimer les sous-collections restantes sur le document source
  //    (config, etc. si présentes)
  const sourceSubcollections = ["config"];
  for (const subCol of sourceSubcollections) {
    await deleteSubcollection(sourceRef, subCol);
  }

  // 5. Supprimer le document source lui-même
  await sourceRef.delete();
  console.log(`\n[fixMigration] Document pasteurs/${SOURCE_PASTEUR_ID} supprimé.`);
  console.log("[fixMigration] Script terminé avec succès ✓");

  process.exit(0);
}

run().catch((err) => {
  console.error("[fixMigration] Erreur fatale :", err);
  process.exit(1);
});
