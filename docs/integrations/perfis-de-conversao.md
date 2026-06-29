# Perfis de conversão

Perfis de conversão são a camada que traduz o formato da ferramenta externa para o formato interno da inbox do OpenMonetis.

Veja também:

- [Mapeamentos de integração](./mapeamentos-de-integracao.md)

Sem isso, a API externa precisa enviar exatamente no padrão do OpenMonetis. Com perfil, ela pode enviar no formato dela, e o OpenMonetis converte antes de resolver categoria, conta/cartão e cliente/fornecedor.

## O que um perfil faz

Cada perfil define:

- quem é a origem (`sourceApp` e `profileKey`)
- se está ativo ou não
- qual o modo padrão (`review` ou `auto`)
- como converter o payload externo (`converterConfig`)

Fluxo resumido:

```text
Payload externo -> perfil de conversão -> payload canônico da inbox -> resolução de mapeamentos -> pré-lançamento ou lançamento
```

## Exemplo prático

Payload externo:

```json
{
  "id": "txn_123",
  "descricao": "Pix recebido",
  "valor_centavos": 150000,
  "data": "26/06/2026",
  "tipo": "credito",
  "chave_pix": "12345678000199",
  "tipo_chave_pix": "cnpj"
}
```

Depois da conversão:

```json
{
  "externalId": "txn_123",
  "parsedName": "Pix recebido",
  "parsedAmount": 1500,
  "purchaseDate": "2026-06-26",
  "transactionType": "Receita",
  "paymentMethod": "Pix",
  "party": {
    "externalKey": "pix:cnpj:12345678000199"
  }
}
```

O perfil não cria o lançamento por conta própria. Ele normaliza o dado para o idioma do OpenMonetis.

## Campos principais

### `name`

Nome humano do perfil, usado na tela e no tester.

Exemplos:

- `Banco Inter - webhook`
- `n8n financeiro`
- `ERP XPTO`

### `profileKey`

Identificador estável do perfil.

Exemplos:

- `inter-webhook`
- `n8n-financeiro`

Quando o payload vier via envelope com `payload`, o sistema usa esse valor para escolher qual conversor aplicar.

### `sourceApp`

Nome lógico da origem.

Exemplos:

- `bank-api`
- `n8n`
- `erp-xpto`

Isso entra no registro da inbox e ajuda em rastreabilidade, idempotência e análise de pendências.

### `status`

- `active`
- `inactive`

Se estiver inativo, o perfil não deve ser usado para processar payload novo.

### `defaultProcessingMode`

Modo padrão do perfil:

- `review`: cria pré-lançamento pendente
- `auto`: tenta criar lançamento automaticamente

Esse valor é fallback. Se o payload mandar `processingMode`, o valor do payload vence.

### `converterConfig`

É o núcleo do perfil. Ele descreve:

- onde cada valor está no JSON externo
- quais transformações aplicar
- como montar chaves compostas

## Exemplo de `converterConfig`

```json
{
  "fields": {
    "externalId": { "path": "$.id" },
    "parsedName": { "path": "$.descricao", "transforms": ["trim"] },
    "parsedAmount": { "path": "$.valor_centavos", "transforms": ["centsToCurrency"] },
    "purchaseDate": {
      "path": "$.data",
      "transforms": [{ "type": "date", "input": "dd/MM/yyyy" }]
    },
    "transactionType": {
      "path": "$.tipo",
      "transforms": [
        {
          "type": "map",
          "values": {
            "credito": "Receita",
            "debito": "Despesa"
          }
        }
      ]
    },
    "paymentMethod": { "fixed": "Pix" }
  }
}
```

## O que ele consegue preencher

Um perfil pode preencher automaticamente:

- `externalId`
- nome
- valor
- data
- tipo da transação
- forma de pagamento
- conta/cartão via `externalKey`
- categoria via `externalKey`
- cliente/fornecedor via `externalKey`
- metadados auxiliares

Exemplo de chave Pix composta:

```json
{
  "fields": {
    "party.externalKey": {
      "template": "pix:{tipo}:{chave}",
      "vars": {
        "tipo": { "path": "$.tipo_chave_pix", "transforms": ["lowercase"] },
        "chave": { "path": "$.chave_pix", "transforms": ["onlyDigits"] }
      }
    }
  }
}
```

## O que o perfil não faz

Ele não deve:

- executar JavaScript arbitrário
- substituir validações do lançamento
- criar conta/cartão automaticamente
- encapsular regra de negócio excessivamente aberta

Ele é um conversor declarativo e seguro, não um motor livre de automação.

## Relação com os mapeamentos do OpenMonetis

Depois que o perfil converte:

```json
{
  "party": {
    "externalKey": "pix:cnpj:12345678000199"
  }
}
```

o OpenMonetis consulta o mapeamento correspondente ao escopo da integração:

```text
sourceApp + profileKey + party + pix:cnpj:12345678000199 -> Cliente XPTO
```

Separação de papéis:

- perfil: transforma dado externo em chave canônica
- mapeamento: liga essa chave canônica a uma entidade local dentro do escopo da origem e do perfil

Isso evita duplicar regra em vários lugares.

## Quando ter mais de um perfil

Faz sentido ter perfis diferentes quando mudarem:

- o formato do payload
- a origem
- a estratégia de conversão
- o modo padrão de processamento

Exemplos:

- `inter-webhook`
- `nubank-export`
- `n8n-normalizador`
- `erp-recebimentos`

Perfis diferentes podem apontar o mesmo valor externo para destinos diferentes, porque o mapeamento é separado por `sourceApp` e `profileKey`.

Na primeira versão da UI, os mapeamentos cobrem:

- cliente/fornecedor
- categoria

As pendências nascem dos próprios pré-lançamentos da inbox: quando chega uma chave externa sem resolução, o item continua pendente até o operador salvar o vínculo em `Ajustes > Integrações`.

## Como isso deve aparecer na UI

Perfis não devem ficar expostos como um formulário técnico sempre aberto.

O formato mais claro é:

- lista de perfis existentes
- nome, `profileKey`, `sourceApp`, status e modo padrão em cada item
- ações como `Editar` e `Testar`
- criação e edição em modal
- tester em modal separado

Isso mantém a tela operacional e reduz ruído visual.
