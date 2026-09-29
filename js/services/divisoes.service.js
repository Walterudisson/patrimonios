import {
  arrayUnion,
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db } from "../config/firebase.js";

const normalizarNome = nome => String(nome || '').trim().replace(/\s+/g, ' ');
const chaveDivisao = nome => normalizarNome(nome).replace(/%/g, '%25').replace(/\//g, '%2F');

export async function listarDivisoes() {
  const snapshot = await getDocs(collection(db, "divisoes"));
  return snapshot.docs.map(documento => ({ id: documento.id, ...documento.data() }));
}

export async function listarDivisoesAtivas() {
  const divisoes = await listarDivisoes();
  const nomes = divisoes
    .filter(dados => dados.nome && dados.ativo !== false)
    .map(dados => dados.nome);

  return {
    nomes,
    documentosLidos: divisoes.length
  };
}

export async function criarDivisao(dados, operador) {
  const nome = normalizarNome(dados.nome);
  if (nome.length < 3) throw new Error('Informe um nome de divisão com pelo menos 3 caracteres.');
  const agora = new Date().toISOString();
  const evento = { acao: 'criacao', em: agora, uid: operador.uid, nome: operador.nome || operador.email || 'Administrador' };
  const registro = {
    nome,
    ativo: dados.ativo !== false,
    responsavelPrincipalUid: dados.responsavelPrincipalUid || '',
    responsavelPrincipalNome: dados.responsavelPrincipalNome || '',
    responsavelSubstitutoUid: dados.responsavelSubstitutoUid || '',
    responsavelSubstitutoNome: dados.responsavelSubstitutoNome || '',
    funcaoResponsavelId: 'responsavel_divisao',
    criadoEm: agora,
    criadoPorUid: operador.uid,
    atualizadoEm: agora,
    atualizadoPorUid: operador.uid,
    auditoria: [evento]
  };
  await setDoc(doc(db, 'divisoes', chaveDivisao(nome)), registro);
}

export async function atualizarDivisao(id, dados, operador) {
  const agora = new Date().toISOString();
  const evento = { acao: 'atualizacao', em: agora, uid: operador.uid, nome: operador.nome || operador.email || 'Administrador' };
  await updateDoc(doc(db, 'divisoes', id), {
    ativo: dados.ativo !== false,
    responsavelPrincipalUid: dados.responsavelPrincipalUid || '',
    responsavelPrincipalNome: dados.responsavelPrincipalNome || '',
    responsavelSubstitutoUid: dados.responsavelSubstitutoUid || '',
    responsavelSubstitutoNome: dados.responsavelSubstitutoNome || '',
    funcaoResponsavelId: 'responsavel_divisao',
    atualizadoEm: agora,
    atualizadoPorUid: operador.uid,
    auditoria: arrayUnion(evento)
  });
}
