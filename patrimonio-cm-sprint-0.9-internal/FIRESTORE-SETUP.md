# Firestore — configuração segura da Sprint 0.9

## Publicação das regras

O conteúdo atualmente publicado com `allow read, write: if true` deve ser substituído integralmente. Não mantenha o curinga público junto das regras específicas, pois qualquer `allow` verdadeiro autoriza a operação.

No Console do Firebase:

1. Confirme que o Administrador possui `usuarios/{UID}` com `perfil: "admin"`.
2. Abra **Firestore Database → Rules**.
3. Substitua todo o editor pelo conteúdo de `firestore.rules` desta sprint.
4. Publique e refaça o login no app.
5. Execute o checklist abaixo.

As regras da Sprint 0.9 são iguais às da Sprint 0.6, 0.7 e 0.8. Esta sprint altera somente o fluxo de câmera, a interface de leitura, a modularização do cliente e os testes. Se as regras anteriores já foram publicadas integralmente, não é necessário republicá-las nesta etapa.

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

## Regras consolidadas

- `divisoesAtribuidas` deve ser uma lista vazia para `admin` e `gestor` em novos cadastros e nas edições completas.
- Somente `conferente` utiliza divisões atribuídas.
- Um Gestor editando o próprio documento só pode alterar `nome`; perfil, e-mail e divisões permanecem inalterados.
- Gestor continua podendo criar e editar Conferentes.
- Um patrimônio que já esteja com `statusTransferencia: "pendente"` não pode ser atualizado novamente pelo Conferente; somente Gestor ou Administrador pode resolver a pendência.

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
- Alterar a localização atual de um patrimônio e confirmar que a mudança é efetivada diretamente, sem criar pendência na Fila.
- Rejeitar uma transferência e confirmar que o local atual anterior é mantido e o destino sugerido é limpo.
- Aprovar uma transferência e confirmar que o destino sugerido passa a ser o local atual.

### Conferente

- Ler somente o próprio perfil.
- Consultar a Relação dentro das divisões atribuídas.
- Registrar conferência e propor transferência para uma divisão atribuída.
- Alterar a localização atual e confirmar que a mudança gera uma pendência na Fila.
- Tentar salvar novamente o patrimônio pendente e confirmar que a operação permanece bloqueada.
- Não listar usuários nem executar operações administrativas.

## Observações

- Excluir `usuarios/{uid}` bloqueia o acesso aos dados, mas não remove a conta do Firebase Authentication.
- A administração definitiva de contas deve migrar para backend confiável com Firebase Admin SDK ou Cloud Functions.
- Consultas com `OR`, `in`, status e ordenação podem exigir índices compostos. Crie somente o índice indicado pelo erro `failed-precondition`.
- O contador de leituras do app é parcial e não deve ser comparado como equivalente ao total diário do Console.
