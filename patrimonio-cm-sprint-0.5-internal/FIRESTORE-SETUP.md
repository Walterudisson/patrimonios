# Firestore — configuração segura da Sprint 0.5

## Publicação das regras

O conteúdo atualmente publicado com `allow read, write: if true` deve ser substituído integralmente. Não mantenha o curinga público junto das regras específicas, pois qualquer `allow` verdadeiro autoriza a operação.

No Console do Firebase:

1. Confirme que o Administrador possui `usuarios/{UID}` com `perfil: "admin"`.
2. Abra **Firestore Database → Rules**.
3. Substitua todo o editor pelo conteúdo de `firestore.rules` desta sprint.
4. Publique e refaça o login no app.
5. Execute o checklist abaixo.

## Modelo de perfis

| Operação | Conferente | Gestor | Administrador |
| --- | --- | --- | --- |
| Ler `divisoes` | sim | sim | sim |
| Escrever `divisoes` | não | não | não |
| Listar usuários | não | Conferentes | todos |
| Criar usuário | não | Conferente | qualquer perfil válido |
| Editar o próprio cadastro | não | somente nome | nome, perfil e divisões |
| Editar terceiros | não | Conferentes | usuários permitidos |
| Consultar patrimônios | divisões atribuídas | todos | todos |
| Atualizar patrimônios | conferência dentro da alçada | campos operacionais | campos operacionais |

## Regra nova desta sprint

- `divisoesAtribuidas` deve ser uma lista vazia para `admin` e `gestor` em novos cadastros e nas edições completas.
- Somente `conferente` utiliza divisões atribuídas.
- Um Gestor editando o próprio documento só pode alterar `nome`; perfil, e-mail e divisões permanecem inalterados.
- Gestor continua podendo criar e editar Conferentes.

Se já existirem Gestores com divisões preenchidas, elas não afetam a autorização do módulo. Para normalizar os dados, entre como Administrador, abra cada Gestor e salve o cadastro; o app enviará `divisoesAtribuidas: []`.

## Checklist após publicar

### Sem autenticação

- Leituras e escritas em `usuarios`, `divisoes` e `patrimonios` devem falhar.

### Administrador

- Listar todos os perfis.
- Criar e editar Conferente e Gestor.
- Salvar um Gestor e confirmar `divisoesAtribuidas: []`.
- Consultar e atualizar patrimônio.

### Gestor

- Listar Conferentes e ver o próprio cadastro.
- Editar somente o próprio nome.
- Não alterar o próprio perfil ou divisões.
- Criar, editar e excluir Conferentes.
- Aprovar/rejeitar transferências e usar a gestão de ciclo.

### Conferente

- Ler somente o próprio perfil.
- Consultar a Relação dentro das divisões atribuídas.
- Registrar conferência e propor transferência para uma divisão atribuída.
- Não listar usuários nem executar operações administrativas.

## Observações

- Excluir `usuarios/{uid}` bloqueia o acesso aos dados, mas não remove a conta do Firebase Authentication.
- A administração definitiva de contas deve migrar para backend confiável com Firebase Admin SDK ou Cloud Functions.
- Consultas com `OR`, `in`, status e ordenação podem exigir índices compostos. Crie somente o índice indicado pelo erro `failed-precondition`.
- O contador de leituras do app é parcial e não deve ser comparado como equivalente ao total diário do Console.

