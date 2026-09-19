import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCVMSES7nwZkZZdQpemDZIb8ypd40bUtvs",
  authDomain: "patrimonioscm.firebaseapp.com",
  projectId: "patrimonioscm",
  storageBucket: "patrimonioscm.firebasestorage.app",
  messagingSenderId: "707665651049",
  appId: "1:707665651049:web:42cb423f3c0911fe5709f8"
};

const app = initializeApp(firebaseConfig);
const appSecundario = initializeApp(firebaseConfig, "AppSecundarioCriacao");

export const auth = getAuth(app);
export const db = getFirestore(app);
export const authSecundario = getAuth(appSecundario);
