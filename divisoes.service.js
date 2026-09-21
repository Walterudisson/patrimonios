import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db } from "../config/firebase.js";

export async function listarDivisoesAtivas() {
  const snapshot = await getDocs(collection(db, "divisoes"));
  const nomes = snapshot.docs
    .map(documento => documento.data())
    .filter(dados => dados.nome && dados.ativo !== false)
    .map(dados => dados.nome);

  return {
    nomes,
    documentosLidos: snapshot.size
  };
}
