import { deleteObject, getDownloadURL, ref, uploadBytes } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";
import { storage } from "../config/firebase.js";
import {
  FOTO_PERFIL_DIMENSAO,
  calcularRecorteQuadrado,
  validarArquivoFoto
} from "../core/perfil.js";

function caminhoFoto(uid) {
  return `usuarios/${uid}/perfil/avatar`;
}

function carregarImagem(arquivo) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(arquivo);
    const imagem = new Image();
    imagem.onload = () => {
      URL.revokeObjectURL(url);
      resolve(imagem);
    };
    imagem.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Não foi possível processar a imagem selecionada.'));
    };
    imagem.src = url;
  });
}

function canvasParaBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('Não foi possível preparar a foto.'));
    }, 'image/webp', 0.82);
  });
}

export async function prepararFotoPerfil(arquivo) {
  const validacao = validarArquivoFoto(arquivo);
  if (!validacao.valido) throw new Error(validacao.mensagem);

  const imagem = await carregarImagem(arquivo);
  const recorte = calcularRecorteQuadrado(imagem.naturalWidth, imagem.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = FOTO_PERFIL_DIMENSAO;
  canvas.height = FOTO_PERFIL_DIMENSAO;
  const contexto = canvas.getContext('2d', { alpha: false });
  contexto.drawImage(
    imagem,
    recorte.origemX,
    recorte.origemY,
    recorte.lado,
    recorte.lado,
    0,
    0,
    FOTO_PERFIL_DIMENSAO,
    FOTO_PERFIL_DIMENSAO
  );
  return canvasParaBlob(canvas);
}

export async function obterUrlFotoPerfil(uid) {
  return getDownloadURL(ref(storage, caminhoFoto(uid)));
}

export async function salvarFotoPerfil(uid, arquivo) {
  const fotoOtimizada = await prepararFotoPerfil(arquivo);
  const referencia = ref(storage, caminhoFoto(uid));
  await uploadBytes(referencia, fotoOtimizada, {
    contentType: fotoOtimizada.type || 'image/webp',
    cacheControl: 'private,max-age=3600'
  });
  const url = await getDownloadURL(referencia);
  return `${url}${url.includes('?') ? '&' : '?'}v=${Date.now()}`;
}

export async function removerFotoPerfil(uid) {
  try {
    await deleteObject(ref(storage, caminhoFoto(uid)));
  } catch (erro) {
    if (erro?.code !== 'storage/object-not-found') throw erro;
  }
}
