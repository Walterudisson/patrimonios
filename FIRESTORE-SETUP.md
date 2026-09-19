# Firestore — configuração segura da Sprint 0.4

## Situação encontrada

As regras publicadas atualmente deixam todo o banco disponível na internet:

```text
match /{document=**} {
  allow read, write: if true;
}
```

Esse bloco não pode permanecer junto das novas regras. Quando dois blocos `match` alcançam o mesmo documento, basta um `allow` resultar em `true` para a operação ser autorizada. Portanto, o conteúdo atual deve ser **substituído integralmente** pelo arquivo `firestore.rules` desta sprint.

O bloco sugerido na Sprint 0.3 protegia somente `divisoes`. Enquanto o curinga público permanecesse ativo, ele continuaria autorizando todas as leituras e gravações, inclusive nessa coleção.

## Pré-requisito para não perder o acesso

Antes de publicar as regras, confirme no Console do Firebase:

1. Em **Authentication → Users**, localize o administrador atual e copie o `UID`.
2. Em **Firestore Database → Data → usuarios**, confirme a existência de `usuarios/{UID}`.
3. O documento deve conter, no mínimo:

```text
nome: "Nome do administrador"
email: "email institucional"
perfil: "admin"
divisoesAtribuidas: []
```

O identificador do documento deve ser exatamente igual ao UID do Authentication. Não publique as regras antes de corrigir essa correspondência.

## Arquivo a publicar

Use o conteúdo completo de `firestore.rules`. A política resultante é:

| Coleção | Conferente | Gestor | Administrador |
| --- | --- | --- | --- |
| `divisoes` | leitura | leitura | leitura |
| `divisoes` — escrita | bloqueada | bloqueada | bloqueada |
| `usuarios` | lê somente o próprio perfil | lê Conferentes e o próprio perfil | lê todos |
| `usuarios` — criação | bloqueada | cria Conferente | cria qualquer perfil |
| `usuarios` — edição | bloqueada | edita a si e Conferentes | edita usuários |
| `usuarios` — exclusão | bloqueada | exclui Conferente | exclui Gestor/Conferente |
| `patrimonios` — consulta | divisões atribuídas | todos | todos |
| `patrimonios` — plaqueta exata | permitida | permitida | permitida |
| `patrimonios` — atualização | registra conferência em divisão atribuída | campos operacionais | campos operacionais |
| `patrimonios` — criação/exclusão | bloqueada | bloqueada | bloqueada |
| coleções não declaradas | bloqueadas | bloqueadas | bloqueadas |

Administradores não podem excluir outro Administrador pela aplicação. Essa restrição reduz o risco de remover o último acesso administrativo.

## Publicação pelo Console

1. Faça uma cópia local das regras atuais, apenas para histórico.
2. Abra **Firebase Console → Firestore Database → Rules**.
3. Apague todo o conteúdo do editor.
4. Cole todo o conteúdo de `firestore.rules`.
5. Clique em **Publish**.
6. Saia e entre novamente no aplicativo com o Administrador.
7. Execute o checklist abaixo.

Não acrescente as regras novas abaixo do curinga `allow read, write: if true`. O curinga deve desaparecer.

## Mudanças de compatibilidade no app

- O cadastro público do primeiro Administrador foi removido da tela de login.
- A verificação pública da quantidade de usuários foi removida.
- O Administrador inicial passa a ser uma configuração controlada pelo Console/Admin SDK.
- O seletor de localização do Conferente mostra somente divisões atribuídas.
- O autocomplete do Conferente envia filtros de divisão na própria consulta.
- A consulta direta de uma plaqueta continua disponível para registrar um bem de outra divisão encontrado fisicamente; o destino proposto precisa pertencer às divisões do Conferente.
- O botão de exclusão não é apresentado para contas Administradoras.

## Checklist imediatamente após publicar

### Sem autenticação

- Acessar `usuarios`, `divisoes` ou `patrimonios`: deve falhar.
- Criar, editar ou excluir qualquer documento: deve falhar.

### Administrador

- Entrar no sistema e carregar o Painel.
- Listar usuários de todos os perfis.
- Criar um usuário de teste.
- Editar o usuário de teste.
- Consultar e atualizar um patrimônio.
- Abrir a Relação e testar a paginação.
- Confirmar que `divisoes` aparece nos seletores, mas não pode ser alterada pelo app.

### Gestor

- Listar somente Conferentes e o próprio perfil.
- Criar, editar e excluir um Conferente.
- Não editar ou excluir Admin/Outro Gestor.
- Acessar a fila e aprovar/rejeitar transferência.
- Reiniciar inventário por divisão somente no ambiente de teste.

### Conferente

- Ler o próprio perfil.
- Não listar usuários.
- Ver somente divisões atribuídas no seletor de localização.
- Usar autocomplete e Relação dentro das divisões atribuídas.
- Consultar uma plaqueta exata de outra divisão.
- Propor a transferência desse bem para uma divisão atribuída.
- Não abrir a fila nem executar reversões.

## Índices

As consultas combinam `OR`, `in`, status, ordenação por ID e paginação por cursor. Se o Firestore retornar `failed-precondition`, abra o link fornecido pela própria mensagem e crie o índice solicitado no ambiente de homologação. Depois registre o índice confirmado em `firestore.indexes.json`.

Não crie índices por tentativa antes de observar a consulta exata que falhou.

## Leituras geradas pelas regras

As regras consultam `usuarios/{request.auth.uid}` para resolver perfil e divisões. Essa leitura dependente pode ser cobrada, inclusive em pedidos negados, embora chamadas repetidas ao mesmo documento possam ser armazenadas em cache durante a avaliação da requisição.

Uma sprint futura poderá migrar o perfil para **Custom Claims**, reduzindo dependência de leituras de documentos e centralizando a autorização. As divisões atribuídas ainda exigirão uma estratégia própria porque podem ultrapassar o tamanho adequado para claims.

## Limites conhecidos

- Excluir `usuarios/{uid}` bloqueia o acesso aos dados, mas não remove a conta correspondente do Firebase Authentication.
- A criação e remoção definitiva de contas do Authentication deve migrar futuramente para backend confiável com Firebase Admin SDK ou Cloud Functions.
- Security Rules protegem o Firestore, mas não substituem App Check, auditoria e testes automatizados.
- O catálogo `divisoes` permanece somente para leitura na Sprint 0.4.
