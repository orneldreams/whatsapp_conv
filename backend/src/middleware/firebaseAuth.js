const { admin } = require("../services/firebase");

async function firebaseAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : "";

    if (!token) {
      return res.status(401).json({ error: "Token manquant" });
    }

    const decoded = await admin.auth().verifyIdToken(token);
    req.userId = decoded.uid;
    req.user = decoded;

    await admin
      .firestore()
      .collection("pasteurs")
      .doc(decoded.uid)
      .set(
        {
          email: decoded.email || "",
          displayName: decoded.name || decoded.displayName || "",
          lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        },
        { merge: true }
      );

    return next();
  } catch (error) {
    console.error("[firebaseAuth] verifyIdToken failed", {
      message: error?.message,
      code: error?.code,
      authHeaderPresent: Boolean(req.headers.authorization),
      origin: req.headers.origin || null
    });
    return res.status(401).json({ error: "Token invalide" });
  }
}

module.exports = {
  firebaseAuth
};
