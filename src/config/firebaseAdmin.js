// // import admin from "firebase-admin";
// // import fs from "fs";
// // import path from "path";
// // import { fileURLToPath } from "url";

// // const __filename = fileURLToPath(import.meta.url);
// // const __dirname = path.dirname(__filename);

// // const serviceAccount = JSON.parse(
// //   fs.readFileSync(
// //     path.join(__dirname, "firebaseServiceKey.json"),
// //     "utf8"
// //   )
// // );

// // admin.initializeApp({
// //   credential: admin.credential.cert(serviceAccount),
// // });

// export default admin;

import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let serviceAccount = null;

if (
  process.env.FIREBASE_PROJECT_ID &&
  process.env.FIREBASE_CLIENT_EMAIL &&
  process.env.FIREBASE_PRIVATE_KEY
) {
  serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  };
} else {
  // fallback to local service account file if available
  try {
    const file = path.join(__dirname, "firebaseServiceKey.json");
    const json = fs.readFileSync(file, "utf8");
    serviceAccount = JSON.parse(json);
  } catch (err) {
    console.warn(
      "No Firebase credentials found in environment and no firebaseServiceKey.json present. Firebase not initialized."
    );
  }
}

// 🔒 prevent re-initialization and avoid crashing if no credentials
if (serviceAccount && !admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export default admin;
