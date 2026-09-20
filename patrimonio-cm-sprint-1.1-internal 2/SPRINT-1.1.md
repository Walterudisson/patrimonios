# Sprint 1.1 — perfil, foto e credenciais

## Identificação

- Sprint: `1.1`
- Aplicação: `v1.11.1`
- Base: Sprint 1.0, revisão `v1.10.1`

## Revisão v1.11.1

- Corrigido o falso toast de erro exibido depois de uma troca de senha efetivamente concluída.
- O formulário agora é preservado antes das chamadas assíncronas de reautenticação e atualização.
- A limpeza dos campos ocorre sem depender de `event.currentTarget` após o retorno do Firebase.
- Nenhuma regra ou configuração do Firebase foi alterada nesta revisão.

## Objetivo

Entregar um espaço próprio para o usuário consultar sua identidade e abrangência no sistema, personalizar a foto do perfil e alterar a própria senha. Para Administradores, adicionar uma ação de envio do fluxo oficial de redefinição de senha do Firebase Authentication.

## Entregas

### Meu perfil

- Acesso pelo menu da foto no canto superior direito.
- Nova página `Meu perfil`, integrada ao histórico interno e ao botão voltar.
- Exibição de nome, e-mail institucional, perfil de acesso e divisões de atuação.
- Administradores e Gestores exibem abrangência global; Conferentes exibem suas divisões em ordem alfabética.
- Foto circular sincronizada na barra superior, sidebar e página do perfil.
- Iniciais permanecem como fallback quando não houver foto ou o Storage estiver indisponível.

### Foto do perfil

- Aceita JPG, PNG e WebP de até 10 MB antes do processamento.
- Recorte central quadrado e redução local para `512 × 512`.
- Conversão para WebP com qualidade de 82% antes do envio.
- Um único objeto por usuário em `usuarios/{uid}/perfil/avatar`; uma nova foto sobrescreve a anterior.
- Upload limitado pelas regras do Storage a menos de 2 MB e somente ao próprio UID.
- Remoção da foto com diálogo de confirmação.

### Segurança da conta

- Alteração da própria senha mediante senha atual, nova senha e confirmação.
- Reautenticação com `reauthenticateWithCredential` antes de `updatePassword`.
- Requisito local de pelo menos 8 caracteres e senha nova diferente da atual.
- Senhas nunca são armazenadas no Firestore.

### Administração de usuários

- Administradores visualizam `Redefinir senha` ao lado de cada usuário.
- A ação confirma o e-mail de destino antes do envio.
- O envio usa `sendPasswordResetEmail` do Firebase Authentication em português do Brasil.
- Gestores não recebem essa ação.

## Firebase

- As regras do Firestore permanecem idênticas às da Sprint 1.0.
- É necessário habilitar o Cloud Storage e publicar `storage.rules` para testar fotos.
- O bucket configurado no app é `patrimonioscm.firebasestorage.app`.
- O Cloud Storage for Firebase exige atualmente o plano Blaze. Sem a ativação, o restante da Sprint funciona e os avatares continuam usando iniciais.
- O modelo `Redefinição de senha` deve ser revisado no Console do Firebase conforme `FIRESTORE-SETUP.md`.

## Arquivos principais

- `index.html`: página de perfil e ações na lista de usuários.
- `app.css`: layout responsivo e avatares reais.
- `app.js`: foto, senha, reset administrativo e integração com navegação.
- `js/config/firebase.js`: inicialização do Storage.
- `js/core/perfil.js`: validações determinísticas e cálculo do recorte.
- `js/services/perfil.service.js`: processamento e persistência da foto.
- `js/ui/navigation.js`: rota de perfil e atualização dos avatares.
- `storage.rules`: regras exclusivas do Cloud Storage.

## Testes automatizados

Executar na pasta pública:

```bash
node --test tests/*.test.mjs
```

A suíte possui 37 testes e cobre câmera, estrutura, feedback, foto e senha.

## Roteiro de teste manual

1. Entrar com um Conferente, abrir a foto do cabeçalho e acessar `MEU PERFIL`.
2. Confirmar nome, e-mail, perfil e divisões atribuídas.
3. Enviar uma imagem horizontal e confirmar o recorte central circular nas três posições.
4. Atualizar a página e confirmar que a foto permanece.
5. Substituir a foto e confirmar que não é criado um histórico de arquivos no Storage.
6. Remover a foto e confirmar o retorno das iniciais.
7. Tentar arquivo não suportado e arquivo acima de 10 MB.
8. Tentar alterar a senha com confirmação divergente, senha atual incorreta e senha curta.
9. Alterar a senha corretamente, sair e entrar com a nova senha.
10. Entrar como Gestor e confirmar que não existe ação de redefinição na lista de usuários.
11. Entrar como Administrador, enviar uma redefinição e conferir o e-mail recebido.
12. Abrir o perfil e usar o botão voltar do celular para retornar à tela anterior.

## Próximas sprints

- Sprint 1.2: PWA instalável em modo `standalone`, manifesto, ícones e avaliação de push notifications.
- Sprint 1.3: operações administrativas sensíveis em backend confiável.
- Sprint 1.4: observabilidade com fontes oficiais.
- Sprint 2.0: consolidação final da refatoração.
