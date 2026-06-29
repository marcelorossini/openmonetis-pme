# Mapeamentos de integração

Mapeamentos de integração são a camada que liga um valor externo recebido pela inbox a uma entidade local do OpenMonetis.

Na primeira versão, essa camada cobre:

- conta
- cliente/fornecedor
- categoria

Ela existe para resolver casos em que a origem não envia o ID interno do OpenMonetis, mas sim um valor próprio, como:

- CNPJ
- código externo de categoria
- alias de cliente
- chave composta criada por um perfil de conversão

## Ideia central

O fluxo é este:

```text
Payload externo -> perfil de conversão -> externalKey -> mapeamento -> pré-lançamento ou lançamento
```

Sem mapeamento, o valor externo é apenas armazenado no pré-lançamento e o item fica pendente.

Com mapeamento, o OpenMonetis resolve a entidade local correspondente e pode seguir para revisão ou autoimportação.

## Escopo da regra

Cada mapeamento é resolvido por:

```text
userId + sourceApp + profileKey + externalKey
```

Isso significa:

- o mesmo valor externo pode apontar para destinos diferentes em integrações diferentes
- o mesmo valor externo pode apontar para destinos diferentes em perfis diferentes da mesma origem
- ausência de `profileKey` também é um escopo válido

Exemplo:

```text
assa-asaas + webhook-recebimentos + 98.765.432/0001-10 -> Marcelo
```

## Como o payload participa disso

Além dos campos canônicos já aceitos pela inbox, o payload pode enviar:

```json
{
  "sourceApp": "assa-asaas",
  "sourceAppName": "Asaas",
  "profileKey": "webhook-recebimentos",
  "accountExternalKey": "conta:asaas-pj",
  "partyExternalKey": "98.765.432/0001-10",
  "categoryExternalKey": "SERVICOS_PRESTADOS__REENVIO",
  "autoImport": true
}
```

Regras:

- `accountId` vence sobre `accountExternalKey`
- `profileKey` é opcional
- `partyId` vence sobre `partyExternalKey`
- `categoryId` vence sobre `categoryExternalKey`
- mesmo quando um ID interno é enviado, a chave externa ainda pode ser persistida para rastreabilidade

## Matching do valor externo

Na v1, a comparação é por texto.

O sistema só normaliza:

- `null` e string vazia
- espaços nas bordas via `trim()`

Ele não normaliza semanticamente:

- máscara de CNPJ
- maiúsculas/minúsculas por regra de negócio
- remoção de pontuação
- aliases equivalentes

Então estes dois valores são diferentes:

```text
12.345.678/0001-99
12345678000199
```

Se a origem alternar formatos, ela precisa:

- padronizar isso antes de enviar
- ou cadastrar dois mapeamentos

## Onde isso fica salvo

### No pré-lançamento

O item da inbox guarda:

- `sourceApp`
- `sourceAppName`
- `profileKey`
- `accountExternalKey`
- `partyExternalKey`
- `categoryExternalKey`
- `accountId` resolvido, quando existir
- `partyId` resolvido, quando existir
- `categoryId` resolvido, quando existir
- `autoImportRequested`
- `autoImportError`

Isso preserva rastreabilidade mesmo quando a importação não acontece.

### Nas tabelas de mapeamento

As regras ficam em:

- `integration_account_mappings`
- `integration_party_mappings`
- `integration_category_mappings`

Cada linha guarda:

- `userId`
- `sourceApp`
- `profileKey`
- `externalKey`
- destino local (`partyId` ou `categoryId`)
- `createdAt`
- `updatedAt`

## Fluxo operacional na UI

A configuração fica em:

```text
Ajustes -> Integrações
```

Também existe um atalho direto dentro do cadastro de:

- conta
- categoria
- cliente/fornecedor

Esse atalho abre `Ajustes -> Integrações` já filtrado para a entidade selecionada.

A tela tem dois blocos:

### Pendentes de mapeamento

Mostra valores externos ainda não resolvidos, agrupados por:

- entidade
- origem
- perfil
- valor recebido

Cada item exibe:

- origem
- perfil
- tipo de entidade
- valor recebido
- quantidade de pendências
- último recebimento

### Mapeamentos salvos

Mostra as regras já cadastradas, com:

- filtros
- edição
- remoção

## O que acontece quando o operador salva um mapeamento

Ao salvar uma regra:

1. o mapeamento é salvo ou atualizado
2. os pré-lançamentos pendentes compatíveis são revisitados
3. se o item tinha `autoImportRequested = true`, o OpenMonetis tenta importar de novo
4. se ainda faltar algo ou houver regra de negócio inválida, o item continua `pending`

Isso vale tanto para itens antigos quanto para os próximos payloads com a mesma combinação de:

```text
sourceApp + profileKey + externalKey
```

## Exemplo completo

Payload recebido:

```json
{
  "sourceApp": "assa-asaas",
  "sourceAppName": "Asaas",
  "profileKey": "webhook-recebimentos",
  "originalText": "Pagamento confirmado",
  "notificationTimestamp": "2026-06-27T15:47:00.000Z",
  "parsedName": "Recebimento de serviço",
  "parsedAmount": 199.91,
  "purchaseDate": "2026-06-27",
  "transactionType": "Receita",
  "paymentMethod": "Pix",
  "accountExternalKey": "conta:asaas-pj",
  "partyExternalKey": "98.765.432/0001-10",
  "categoryExternalKey": "SERVICOS_PRESTADOS__REENVIO",
  "autoImport": true
}
```

Sem mapeamento, o resultado esperado é:

- item salvo na inbox
- `accountId = null`
- `status = pending`
- `partyId = null`
- `categoryId = null`

Depois que os mapeamentos são cadastrados:

```text
assa-asaas + webhook-recebimentos + conta:asaas-pj -> Asaas
assa-asaas + webhook-recebimentos + 98.765.432/0001-10 -> Marcelo
assa-asaas + webhook-recebimentos + SERVICOS_PRESTADOS__REENVIO -> Serviços Prestados
```

os próximos payloads equivalentes já podem ser autoimportados.

## Compatibilidade entre categoria e cliente/fornecedor

Resolver o mapeamento não garante que o lançamento pode ser criado.

O destino resolvido ainda precisa respeitar a regra da categoria.

Exemplo real:

- categoria `Serviços Prestados`
- `tipo_vinculo = cliente`

Se o `partyExternalKey` estiver mapeado para um registro do tipo `fornecedor`, a resolução técnica acontece, mas a criação do lançamento falha.

Nesse caso, o item fica `pending` com erro como:

```text
O cliente/fornecedor selecionado não é compatível com a categoria.
```

## Por que um item pode continuar pendente

Motivos comuns:

- não existe mapeamento para `partyExternalKey`
- não existe mapeamento para `categoryExternalKey`
- a categoria exige `cliente` e o mapeamento aponta para `fornecedor`
- a categoria exige `fornecedor` e o mapeamento aponta para `cliente`
- falta conta, cartão, forma de pagamento ou outro dado obrigatório para criar o lançamento

## O que o sistema não faz automaticamente

Na v1, ele não:

- cria mapeamento sozinho ao receber payload novo
- cria cliente/fornecedor automaticamente
- cria categoria automaticamente
- corrige formato de CNPJ ou alias equivalente
- assume que duas chaves parecidas representam a mesma entidade

## Boas práticas para a origem

- manter `sourceApp` estável
- usar `profileKey` estável quando houver mais de um fluxo por origem
- padronizar o formato do valor externo antes de enviar
- evitar alternar entre chave mascarada e não mascarada
- usar o mesmo padrão de categoria externa para todos os eventos do mesmo domínio

## Troubleshooting rápido

Se um payload igual continua pendente, verifique nesta ordem:

1. `sourceApp` bate exatamente?
2. `profileKey` bate exatamente?
3. `partyExternalKey` e `categoryExternalKey` batem exatamente?
4. o mapeamento está no mesmo usuário do token da API?
5. o tipo do cliente/fornecedor é compatível com o `tipo_vinculo` da categoria?
6. os demais campos obrigatórios do lançamento foram enviados?

## Relação com perfis de conversão

Perfis de conversão e mapeamentos não competem entre si.

Separação de responsabilidades:

- perfil de conversão: transforma o payload externo em chaves canônicas
- mapeamento: resolve essas chaves para entidades locais

Veja também:

- [Perfis de conversão](./perfis-de-conversao.md)

## APIs públicas de cadastros

Além da inbox, integrações autenticadas por Bearer token também podem gravar
clientes, fornecedores e categorias diretamente em:

```text
/api/parties
/api/categories
```

A referência endpoint-a-endpoint da API pública agora fica em:

```text
/api-docs
```

O OpenAPI bruto consumido pelo Scalar fica em:

```text
/openapi.json
```

### Autenticação

Use o mesmo token de API gerado em:

```text
Ajustes -> Companion
```

Envie no header:

```text
Authorization: Bearer opm_xxx
```

### Operações disponíveis

- `GET /api/categories`
- `POST /api/categories`
- `GET /api/categories/:categoryId`
- `PATCH /api/categories/:categoryId`
- `DELETE /api/categories/:categoryId`
- `GET /api/parties`
- `POST /api/parties`
- `GET /api/parties/:partyId`
- `PATCH /api/parties/:partyId`
- `DELETE /api/parties/:partyId`

Outros endpoints públicos já documentados no Scalar:

- `GET /api/health`
- `POST /api/auth/device/verify`
- `POST /api/inbox`
- `POST /api/inbox/batch`

Os contratos completos de request/response, exemplos e erros por status agora
ficam centralizados no Scalar. Este documento mantém apenas as regras
operacionais específicas da integração.

### Semântica do POST

O `POST /api/parties` funciona como upsert por mapeamento quando `integration`
é enviado:

- se `userId + sourceApp + profileKey + externalKey` já existir, o cadastro
  vinculado é atualizado
- se não existir, o OpenMonetis cria o cadastro e grava o binding

Sem `integration`, o `POST` sempre cria um novo cadastro.

O `POST /api/categories` segue a mesma ideia:

- se `userId + sourceApp + profileKey + externalKey` já existir, a categoria
  vinculada é atualizada
- se não existir, o OpenMonetis cria a categoria e grava o binding

Sem `integration`, o `POST` sempre cria uma nova categoria.

### Semântica do DELETE

O `DELETE /api/parties/:partyId` não remove o registro fisicamente.

Ele apenas altera:

```text
status = Inativo
```

Isso preserva o histórico financeiro já vinculado ao cliente/fornecedor.

Já o `DELETE /api/categories/:categoryId` remove a categoria de fato.

Exceção:

- categorias protegidas continuam bloqueadas para edição e remoção
- exemplos: `Transferência interna`, `Saldo inicial` e `Pagamentos`

### Leitura

O `GET /api/parties` retorna paginação básica com:

- `page`
- `pageSize`
- `totalItems`
- `totalPages`

Filtros suportados:

- `search`
- `kind`
- `status`
- `sourceApp` + `externalKey`
- `profileKey` opcional quando houver lookup por mapeamento

O `GET /api/parties/:partyId` retorna o cadastro e também os bindings de
integração já associados ao registro.

O `GET /api/categories` retorna a mesma estrutura de paginação, com filtros por:

- `search`
- `type`
- `partyKind`
- `sourceApp` + `externalKey`
- `profileKey` opcional quando houver lookup por mapeamento

O `GET /api/categories/:categoryId` retorna a categoria e também os bindings de
integração já associados ao registro.
