export const FOTO_PERFIL_TAMANHO_MAXIMO_ORIGINAL = 10 * 1024 * 1024;
export const FOTO_PERFIL_DIMENSAO = 512;
export const FOTO_PERFIL_TIPOS = ['image/jpeg', 'image/png', 'image/webp'];

export function validarArquivoFoto(arquivo) {
  if (!arquivo) return { valido: false, mensagem: 'Selecione uma imagem.' };
  if (!FOTO_PERFIL_TIPOS.includes(arquivo.type)) {
    return { valido: false, mensagem: 'Use uma imagem JPG, PNG ou WebP.' };
  }
  if (arquivo.size > FOTO_PERFIL_TAMANHO_MAXIMO_ORIGINAL) {
    return { valido: false, mensagem: 'A imagem original deve ter no máximo 10 MB.' };
  }
  return { valido: true, mensagem: '' };
}

export function validarNovaSenha(senhaAtual, novaSenha, confirmacao) {
  if (!senhaAtual || !novaSenha || !confirmacao) {
    return { valido: false, mensagem: 'Preencha os três campos de senha.' };
  }
  if (novaSenha.length < 8) {
    return { valido: false, mensagem: 'A nova senha deve ter pelo menos 8 caracteres.' };
  }
  if (novaSenha !== confirmacao) {
    return { valido: false, mensagem: 'A confirmação não corresponde à nova senha.' };
  }
  if (senhaAtual === novaSenha) {
    return { valido: false, mensagem: 'A nova senha deve ser diferente da senha atual.' };
  }
  return { valido: true, mensagem: '' };
}

export function calcularRecorteQuadrado(largura, altura) {
  const lado = Math.min(largura, altura);
  return {
    origemX: Math.max(0, (largura - lado) / 2),
    origemY: Math.max(0, (altura - lado) / 2),
    lado
  };
}
