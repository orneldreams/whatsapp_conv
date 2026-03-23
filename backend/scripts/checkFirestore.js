/**
 * Script de vérification : liste tous les documents de pasteurs et leurs sous-collections
 */
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const { db } = require("../src/services/firebase");

async function run() {
  const pasteurSnap = await db.collection("pasteurs").get();

  console.log(`\n=== Collection "pasteurs" : ${pasteurSnap.size} document(s) ===\n`);

  for (const doc of pasteurSnap.docs) {
    const data = doc.data();
    const idHex = Buffer.from(doc.id).toString("hex");
    console.log(`--- Document ID : "${doc.id}"`);
    console.log(`    ID (hex)     : ${idHex}`);
    console.log(`    exists       : ${doc.exists}`);
    console.log(`    email        : ${data.email || "(aucun champ email)"}`);
    console.log(`    firstName    : ${data.firstName || "(aucun champ)"}`);

    // Lister les sous-collections
    const subSnap = await db.collection("pasteurs").doc(doc.id).collection("disciples").get();
    console.log(`    disciples    : ${subSnap.size} document(s)`);
    for (const d of subSnap.docs) {
      console.log(`      - ${d.id}`);
    }
    console.log("");
  }

  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
