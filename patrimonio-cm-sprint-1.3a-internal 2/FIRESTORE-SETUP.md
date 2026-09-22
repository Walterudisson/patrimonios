# Firebase e hospedagem — configuração da Sprint 1.2

> **Sprint 1.3A / v1.13.2:** mantenha as regras do Firestore já publicadas na v1.12.2 e as regras atuais de Storage. A correção da divisão efetiva não altera as permissões. As novas consultas de contagem podem exigir índices compostos no projeto; confira os links de criação apresentados pelo Firestore antes da publicação. As instruções abaixo descrevem a configuração da base anterior, se ainda não tiver sido aplicada.

### Verificação da revisão v1.13.2

No Painel, a contagem por divisão consulta, além das agregações existentes, os documentos com `divisaoOrigem == A` e `localizacaoAtual != A` e com `divisao == A` e `localizacaoAtual != A`. Os dois índices propostos estão no arquivo interno `firestore.indexes.json`. No Console do Firebase, em **Firestore Database → Índices**, crie os pares de campos com ordem ascendente, se ainda não existirem; aguarde o estado **Ativo**. Se o Firestore pedir outro índice para combinações existentes de filtros, siga o link indicado pelo erro. Repita para Gestor e Conferente, em divisão selecionada e em **Todas**. Se as consultas falharem, os números aparecerão como **—**; a Relação continua paginada.

## Resumo do que muda

| Serviço | Ação nesta sprint |
|---|---|
| Firestore | publicar `firestore.rules` da revisão `v1.12.2`; nenhuma nova coleção |
| Authentication | nenhuma alteração adicional |
| Cloud Storage | manter `storage.rules` da Sprint 1.1 |
| Hosting | publicar os novos arquivos PWA em HTTPS |
| Cloud Messaging | não habilitar nesta sprint |

Nas revisões `v1.12.1` e `v1.12.2`, **é obrigatório publicar o `firestore.rules` atualizado antes de disponibilizar os arquivos do app**. As revisões `v1.12.3`, `v1.12.4` e `v1.12.5` não mudam as regras da `v1.12.2`. A regra anterior permitia que Gestor ou Administrador atualizassem diretamente o local; a regra de `v1.12.1` ainda não incluía o destino sugerido no escopo de leitura do Conferente.

A revisão `v1.11.1` corrige somente o feedback após a troca de senha. Não exige republicação de regras, Storage ou modelos de e-mail.

A revisão `v1.11.2` separa `Usuários` e `Inventários` somente na interface. O histórico de inventários é apenas um espaço planejado: não há coleção, índice, regra ou migração adicional a publicar.

A versão inicial `v1.12.0` adicionou somente a fundação PWA. As revisões `v1.12.1` e `v1.12.2` alteram as regras do Firestore; as regras de Storage permanecem as mesmas.

### Publicar as regras da revisão v1.12.2

1. No Console do Firebase do projeto correto, abra `Firestore Database` → `Regras`.
2. Substitua o conteúdo integral pelo arquivo **interno** `firestore.rules` deste pacote e publique. Não utilize permissões abertas como `allow read, write: if true`.
3. Confira o fluxo com perfis Conferente, Gestor e Administrador: qualquer leitura que altere a divisão deve manter o local atual e gerar uma pendência; somente aprovação na Fila promove o destino.
4. Confira com Conferente atribuído apenas ao destino sugerido que o item pendente aparece no seu Painel e na Relação; ele não pode aprovar nem rejeitar. Confira também Conferente da divisão de origem e conferente atribuído às duas divisões, sem contagem duplicada.
5. Confira a rejeição e a leitura sem mudança de local; uma pendência existente impede nova leitura e reinício do item até sua resolução.
6. Se o Firebase pedir um índice para consultar `statusTransferencia` e `divisaoDestinoSugerida` ou a contagem de sobreposição com as divisões, siga o link apresentado pelo Console, crie o índice e aguarde a conclusão antes do teste.
7. Publique então a aplicação `v1.12.5` e aceite `ATUALIZAR AGORA` no app instalado para usar o código atualizado.

As regras anteriores podem permitir gravações diretas por Gestor/Administrador ou impedir o Conferente de consultar itens pendentes destinados ao seu setor. Apenas substituir o código do app não garante o comportamento exigido.

## 1. Publicação do PWA

Publique junto com os arquivos existentes:

- `manifest.webmanifest`;
- `service-worker.js`;
- `offline.html`;
- `js/pwa.js`;
- arquivos PNG em `assets/`.

Requisitos:

1. Usar HTTPS; `localhost` é aceito apenas para desenvolvimento.
2. Manter `service-worker.js` na raiz publicada do CM APP para que seu escopo alcance toda a aplicação.
3. Não configurar cache imutável de longa duração para `service-worker.js`.
4. Confirmar que o servidor entrega `manifest.webmanifest` e os ícones sem redirecionamento para a página principal.
5. Após publicar, remover a instalação antiga no aparelho de teste e instalar novamente.

O cache do PWA não armazena documentos do Firestore nem cria suporte a alterações offline.

## 2. Cloud Storage para fotos

### Requisito de plano

A documentação atual do Firebase informa que o Cloud Storage for Firebase exige o plano de faturamento Blaze. Antes de ativar:

1. Revise o orçamento do projeto.
2. Configure alertas de orçamento no Google Cloud.
3. Considere que o app grava somente uma foto otimizada por usuário, substituindo o mesmo objeto.

Sem o Storage, a tela de perfil, as divisões e a alteração de senha continuam funcionando. A foto permanece representada pelas iniciais.

### Habilitação

1. Abra o projeto `patrimonioscm` no Console do Firebase.
2. Acesse `Criação/Build` → `Storage`.
3. Clique em `Começar`.
4. Confirme o bucket padrão `patrimonioscm.firebasestorage.app`.
5. Escolha conscientemente a região, pois ela não deve ser tratada como uma configuração descartável.
6. Finalize a criação do bucket.

### Publicação das regras

1. Ainda em `Storage`, abra a aba `Rules/Regras`.
2. Substitua o conteúdo pelo arquivo interno `storage.rules`.
3. Publique.

As regras permitem:

- leitura das fotos somente para usuários autenticados;
- criação, substituição e exclusão somente pelo próprio UID;
- somente o objeto `avatar` no caminho `usuarios/{uid}/perfil/avatar`;
- somente JPEG, PNG ou WebP;
- arquivo final menor que 2 MB;
- negação de qualquer outro caminho.

Não use regras abertas como `allow read, write: if true`.

## 3. Personalização do e-mail de redefinição

1. No Console do Firebase, acesse `Authentication`.
2. Abra `Templates/Modelos`.
3. Selecione `Password reset/Redefinição de senha`.
4. Clique no ícone de edição.
5. Use a identidade abaixo como ponto de partida.

### Conteúdo sugerido

- Nome do remetente: `CM APP`
- Assunto: `Redefinição de senha — CM APP`
- Idioma de envio: português do Brasil; o app define `auth.languageCode = "pt-BR"`.

Texto sugerido:

> Olá,
>
> Recebemos uma solicitação para redefinir a senha da sua conta no CM APP.
>
> Utilize o botão ou link abaixo para criar uma nova senha. Se você não solicitou esta alteração, ignore esta mensagem e mantenha sua senha atual.
>
> Por segurança, não encaminhe este e-mail nem compartilhe o link de redefinição.
>
> Equipe CM APP

Preserve no editor do Firebase o campo dinâmico do link de redefinição. Não substitua o link por um endereço fixo.

### Link de ação

Nesta sprint, pode ser mantido o manipulador padrão hospedado pelo Firebase. A adoção de página própria, domínio personalizado e retorno integrado ao app deve ser avaliada na Sprint 1.3.

Se for usada uma URL personalizada no futuro, ela deverá:

- estar em domínio autorizado no Authentication;
- tratar com segurança `mode`, `oobCode`, `apiKey` e `lang`;
- validar o código com o SDK antes de aceitar a nova senha;
- utilizar HTTPS.

## 4. Testes recomendados

### Foto

1. Publicar `storage.rules`.
2. Entrar com um usuário real.
3. Enviar uma foto e verificar o arquivo em `usuarios/{UID}/perfil/avatar`.
4. Tentar substituir a foto de outro UID pelo Console do navegador; a regra deve negar.
5. Remover a foto pelo app e confirmar a exclusão do objeto.

### Senha própria

1. Informar senha atual incorreta; o app deve mostrar aviso e não alterar a credencial.
2. Alterar corretamente.
3. Sair e entrar com a nova senha.
4. Confirmar que nenhuma senha foi criada no documento `usuarios/{UID}`.

### Reset administrativo

1. Entrar como Gestor e confirmar que o botão não existe.
2. Entrar como Administrador.
3. Selecionar um usuário com e-mail acessível para teste.
4. Confirmar o destinatário no diálogo.
5. Verificar assunto, nome do remetente, idioma, texto e funcionamento do link.

## 5. Observações de segurança

- A senha é gerenciada exclusivamente pelo Firebase Authentication.
- A foto é processada no dispositivo antes do upload, reduzindo tráfego e armazenamento.
- O botão administrativo dispara o fluxo oficial de recuperação; o Administrador não vê nem define a senha do usuário.
- Operações privilegiadas que exigirem garantia de autorização no servidor continuam reservadas à Sprint 1.3.
- Antes da produção, habilitar App Check e acompanhar orçamento/uso do Storage.
