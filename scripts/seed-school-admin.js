require("dotenv").config({ path: ".env.local" });
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

const SCHOOL_ID = "esrp";
const SCHOOL_DATA = {
  name: "Escola Secundária de Rocha Peixoto",
  shortName: "ESRP",
  address: "",
  contact: "",
  educationLevel: "Secundária/Profissional",
  emailDomain: "@esrpeixoto.edu.pt",
  requireInstitutionalEmail: false,
};

const ADMIN_EMAIL = "angrycloud.op@gmail.com";
const ADMIN_NAME = "Angry Cloud";
const ADMIN_ROLE = "admin_escolar";

function buildCredential() {
  const serviceAccountPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
    : undefined;

  if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
    const resolved = path.resolve(serviceAccountPath);
    return admin.credential.cert(require(resolved));
  }

  if (projectId && clientEmail && privateKey) {
    return admin.credential.cert({ projectId, clientEmail, privateKey });
  }

  return admin.credential.applicationDefault();
}

async function ensureInitialized() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: buildCredential(),
    });
  }
}

async function seedSchool() {
  const db = admin.firestore();
  const schoolRef = db.collection("schools").doc(SCHOOL_ID);
  await schoolRef.set(
    {
      ...SCHOOL_DATA,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  return schoolRef;
}

async function seedAdminUser(schoolId) {
  const auth = admin.auth();
  const db = admin.firestore();
  let user;

  try {
    user = await auth.getUserByEmail(ADMIN_EMAIL);
    console.log(`Utilizador já existe no Auth: ${ADMIN_EMAIL}`);
  } catch (error) {
    if (error.code === "auth/user-not-found") {
      const tempPassword = process.env.ADMIN_ESCOLAR_PASSWORD || "ChangeMe123!";
      if (!process.env.ADMIN_ESCOLAR_PASSWORD) {
        console.warn("ADMIN_ESCOLAR_PASSWORD não definido. A usar password temporária ChangeMe123!.");
      }
      user = await auth.createUser({
        email: ADMIN_EMAIL,
        displayName: ADMIN_NAME,
        password: tempPassword,
        emailVerified: true,
      });
      console.log(`Utilizador criado no Auth: ${ADMIN_EMAIL}`);
    } else {
      throw error;
    }
  }

  const userRef = db.collection("users").doc(user.uid);
  await userRef.set(
    {
      role: ADMIN_ROLE,
      nome: ADMIN_NAME,
      email: ADMIN_EMAIL,
      schoolId,
      estado: "ativo",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return user.uid;
}

async function run() {
  await ensureInitialized();
  const schoolRef = await seedSchool();
  await seedAdminUser(schoolRef.id);
  console.log("Seed concluído.");
}

run().catch((error) => {
  console.error("Erro ao executar seed:", error);
  process.exit(1);
});
