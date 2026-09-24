import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-functions.js";
import { functions } from "../config/firebase.js";

const chamar = (nome, dados) => httpsCallable(functions, nome)(dados).then(resultado => resultado.data);

export function criarUsuarioSeguro(dados) {
  return chamar('criarUsuario', dados);
}

export function atualizarUsuarioSeguro(dados) {
  return chamar('atualizarUsuario', dados);
}

export function alterarEstadoUsuario(uid, ativo) {
  return chamar('alterarEstadoUsuario', { uid, ativo });
}
