/**
 * Ids das colunas reordenáveis da tabela de lançamentos (extrato).
 * select, purchaseDate e actions são fixos (início, oculto, fim).
 */
const TRANSACTIONS_REORDERABLE_COLUMN_IDS = [
	"name",
	"transactionType",
	"amount",
	"condition",
	"paymentMethod",
	"categoriaName",
	"partyName",
	"pagadorName",
	"note",
	"contaCartao",
] as const;

export const TRANSACTIONS_COLUMN_LABELS: Record<string, string> = {
	name: "Estabelecimento",
	transactionType: "Transação",
	amount: "Valor",
	condition: "Condição",
	paymentMethod: "Forma de Pagamento",
	categoriaName: "Categoria",
	partyName: "Cliente/Fornecedor",
	pagadorName: "Pessoa",
	note: "Anotação",
	contaCartao: "Conta/Cartão",
};

export const DEFAULT_TRANSACTIONS_COLUMN_ORDER: string[] = [
	...TRANSACTIONS_REORDERABLE_COLUMN_IDS,
];
