import { version } from "@/package.json";

const bearerSecurity = [{ bearerAuth: [] }] as const;

const partyExample = {
	id: "8cda7b46-652b-4db2-86d8-61556dc91af2",
	kind: "cliente",
	name: "ACME Ltda",
	document: "12.345.678/0001-00",
	email: "financeiro@acme.test",
	phone: "(11) 99999-9999",
	note: "Conta principal",
	status: "Ativo",
	createdAt: "2026-06-28T16:10:00.000Z",
	integrations: [
		{
			sourceApp: "omie",
			profileKey: "empresa-principal",
			externalKey: "cliente-123",
			createdAt: "2026-06-28T16:10:00.000Z",
			updatedAt: "2026-06-28T16:10:00.000Z",
		},
	],
} as const;

const categoryExample = {
	id: "732f8cba-c77c-4bf2-b6d8-f6a3d356f1db",
	name: "Serviços Prestados",
	type: "receita",
	icon: "RiUserStarLine",
	partyKind: "cliente",
	createdAt: "2026-06-28T16:10:00.000Z",
	integrations: [
		{
			sourceApp: "omie",
			profileKey: "empresa-principal",
			externalKey: "categoria-321",
			createdAt: "2026-06-28T16:10:00.000Z",
			updatedAt: "2026-06-28T16:10:00.000Z",
		},
	],
} as const;

const inboxItemExample = {
	sourceApp: "openmonetis-companion",
	sourceAppName: "OpenMonetis Companion",
	profileKey: "nubank-pj",
	originalTitle: "Compra aprovada",
	originalText: "Compra de R$ 199,91 em Papelaria Centro",
	notificationTimestamp: "2026-06-28T13:12:00.000Z",
	parsedName: "Papelaria Centro",
	parsedAmount: 199.91,
	clientId: "android-evt-001",
	purchaseDate: "2026-06-28",
	transactionType: "Despesa",
	paymentMethod: "Pix",
	accountExternalKey: "conta:nubank-pj",
	categoryExternalKey: "MATERIAL_ESCRITORIO",
	partyExternalKey: "12.345.678/0001-00",
	autoImport: true,
} as const;

const partyWriteExample = {
	kind: "cliente",
	name: "ACME Ltda",
	document: "12.345.678/0001-00",
	email: "financeiro@acme.test",
	phone: "(11) 99999-9999",
	status: "Ativo",
	note: "Conta principal",
	integration: {
		sourceApp: "omie",
		profileKey: "empresa-principal",
		externalKey: "cliente-123",
	},
} as const;

const categoryWriteExample = {
	name: "Serviços Prestados",
	type: "receita",
	icon: "RiUserStarLine",
	partyKind: "cliente",
	integration: {
		sourceApp: "omie",
		profileKey: "empresa-principal",
		externalKey: "categoria-321",
	},
} as const;

function buildJsonResponse(schema: Record<string, unknown>, examples?: object) {
	return {
		content: {
			"application/json": {
				schema,
				...(examples ? { examples } : {}),
			},
		},
	};
}

function buildErrorExample(error: string, extra?: Record<string, unknown>) {
	return {
		error,
		...(extra ?? {}),
	};
}

export function buildPublicOpenApiDocument() {
	return {
		openapi: "3.1.0",
		info: {
			title: "OpenMonetis PE - API pública de integrações",
			version,
			description:
				"Referência pública dos endpoints externos autenticados por Bearer token usados por integrações e pelo Companion.",
		},
		servers: [{ url: "/" }],
		tags: [
			{
				name: "Health",
				description: "Endpoints públicos de diagnóstico e disponibilidade.",
			},
			{
				name: "Auth",
				description:
					"Operações auxiliares de autenticação por token de dispositivo.",
			},
			{
				name: "Inbox",
				description:
					"Recebimento de pré-lançamentos e tentativas de autoimportação.",
			},
			{
				name: "Categories",
				description: "Cadastro de categorias com suporte a binding externo.",
			},
			{
				name: "Parties",
				description:
					"Cadastro de clientes e fornecedores com suporte a binding externo.",
			},
		],
		components: {
			securitySchemes: {
				bearerAuth: {
					type: "http",
					scheme: "bearer",
					bearerFormat: "API Token",
					description:
						"Use um token gerado em Ajustes > Companion no formato `Authorization: Bearer opm_xxx`.",
				},
			},
			parameters: {
				PartyId: {
					name: "partyId",
					in: "path",
					required: true,
					description: "ID interno do cliente/fornecedor no OpenMonetis.",
					schema: {
						type: "string",
						format: "uuid",
					},
				},
				CategoryId: {
					name: "categoryId",
					in: "path",
					required: true,
					description: "ID interno da categoria no OpenMonetis.",
					schema: {
						type: "string",
						format: "uuid",
					},
				},
			},
			schemas: {
				ErrorResponse: {
					type: "object",
					required: ["error"],
					properties: {
						error: { type: "string" },
					},
				},
				RateLimitErrorResponse: {
					type: "object",
					required: ["error", "retryAfter"],
					properties: {
						error: { type: "string" },
						retryAfter: { type: "integer", minimum: 1 },
					},
				},
				HealthOkResponse: {
					type: "object",
					required: ["status", "name", "timestamp"],
					properties: {
						status: { type: "string", enum: ["ok"] },
						name: { type: "string" },
						timestamp: { type: "string", format: "date-time" },
					},
				},
				HealthErrorResponse: {
					type: "object",
					required: ["status", "name", "timestamp", "message"],
					properties: {
						status: { type: "string", enum: ["error"] },
						name: { type: "string" },
						timestamp: { type: "string", format: "date-time" },
						message: { type: "string" },
					},
				},
				DeviceVerifySuccessResponse: {
					type: "object",
					required: ["valid", "userId", "tokenId", "tokenName"],
					properties: {
						valid: { type: "boolean", enum: [true] },
						userId: { type: "string", format: "uuid" },
						tokenId: { type: "string", format: "uuid" },
						tokenName: { type: "string" },
					},
				},
				DeviceVerifyErrorResponse: {
					type: "object",
					required: ["valid", "error"],
					properties: {
						valid: { type: "boolean", enum: [false] },
						error: { type: "string" },
					},
				},
				InboxItemRequest: {
					type: "object",
					required: ["sourceApp", "originalText", "notificationTimestamp"],
					properties: {
						sourceApp: { type: "string", minLength: 1, maxLength: 255 },
						sourceAppName: { type: "string", maxLength: 255 },
						profileKey: { type: "string", maxLength: 255 },
						originalTitle: { type: "string", maxLength: 500 },
						originalText: { type: "string", minLength: 1, maxLength: 5000 },
						notificationTimestamp: {
							type: "string",
							format: "date-time",
						},
						parsedName: { type: "string", maxLength: 500 },
						parsedAmount: { type: "number" },
						clientId: { type: "string", maxLength: 255 },
						purchaseDate: {
							type: "string",
							pattern: "^\\d{4}-\\d{2}-\\d{2}$",
						},
						transactionType: {
							type: "string",
							enum: ["Despesa", "Receita", "Transferência"],
						},
						paymentMethod: {
							type: "string",
							enum: [
								"Cartão de crédito",
								"Cartão de débito",
								"Pix",
								"Dinheiro",
								"Boleto",
								"Pré-Pago | VR/VA",
								"Transferência bancária",
							],
						},
						accountId: { type: ["string", "null"], format: "uuid" },
						accountExternalKey: { type: "string", maxLength: 255 },
						cardId: { type: ["string", "null"], format: "uuid" },
						categoryId: { type: ["string", "null"], format: "uuid" },
						categoryExternalKey: { type: "string", maxLength: 255 },
						payerId: { type: ["string", "null"], format: "uuid" },
						partyId: { type: ["string", "null"], format: "uuid" },
						partyExternalKey: { type: "string", maxLength: 255 },
						autoImport: { type: "boolean", default: false },
					},
				},
				InboxItemResponse: {
					type: "object",
					required: ["id", "message", "status", "autoImported"],
					properties: {
						id: { type: "string", format: "uuid" },
						clientId: { type: "string" },
						message: { type: "string" },
						status: {
							type: "string",
							enum: ["pending", "processed"],
						},
						autoImported: { type: "boolean" },
						transactionId: { type: "string", format: "uuid" },
						autoImportError: { type: "string" },
						reconciliationStatus: {
							type: "string",
							enum: ["reconciled", "unmatched", "ambiguous"],
						},
						reconciledTitleId: { type: "string", format: "uuid" },
					},
				},
				InboxBatchRequest: {
					type: "object",
					required: ["items"],
					properties: {
						items: {
							type: "array",
							minItems: 1,
							maxItems: 50,
							items: { $ref: "#/components/schemas/InboxItemRequest" },
						},
					},
				},
				InboxBatchItemResponse: {
					type: "object",
					required: ["success"],
					properties: {
						clientId: { type: "string" },
						serverId: { type: "string", format: "uuid" },
						success: { type: "boolean" },
						status: {
							type: "string",
							enum: ["pending", "processed"],
						},
						autoImported: { type: "boolean" },
						transactionId: { type: "string", format: "uuid" },
						autoImportError: { type: "string" },
						reconciliationStatus: {
							type: "string",
							enum: ["reconciled", "unmatched", "ambiguous"],
						},
						reconciledTitleId: { type: "string", format: "uuid" },
						error: { type: "string" },
					},
				},
				InboxBatchResponse: {
					type: "object",
					required: ["message", "total", "success", "failed", "results"],
					properties: {
						message: { type: "string" },
						total: { type: "integer", minimum: 0 },
						success: { type: "integer", minimum: 0 },
						failed: { type: "integer", minimum: 0 },
						results: {
							type: "array",
							items: { $ref: "#/components/schemas/InboxBatchItemResponse" },
						},
					},
				},
				CategoryIntegrationPayload: {
					type: "object",
					required: ["sourceApp", "externalKey"],
					properties: {
						sourceApp: { type: "string", minLength: 1, maxLength: 255 },
						profileKey: { type: ["string", "null"], maxLength: 255 },
						externalKey: { type: "string", minLength: 1, maxLength: 255 },
					},
				},
				CategoryWriteRequest: {
					type: "object",
					required: ["name", "type"],
					properties: {
						name: { type: "string", minLength: 1 },
						type: { type: "string", enum: ["receita", "despesa"] },
						icon: { type: ["string", "null"], maxLength: 100 },
						partyKind: {
							type: ["string", "null"],
							enum: ["cliente", "fornecedor", null],
						},
						integration: {
							$ref: "#/components/schemas/CategoryIntegrationPayload",
						},
					},
				},
				CategoryIntegrationBinding: {
					type: "object",
					required: [
						"sourceApp",
						"profileKey",
						"externalKey",
						"createdAt",
						"updatedAt",
					],
					properties: {
						sourceApp: { type: "string" },
						profileKey: { type: ["string", "null"] },
						externalKey: { type: "string" },
						createdAt: { type: "string", format: "date-time" },
						updatedAt: { type: "string", format: "date-time" },
					},
				},
				CategoryItem: {
					type: "object",
					required: [
						"id",
						"name",
						"type",
						"icon",
						"partyKind",
						"createdAt",
						"integrations",
					],
					properties: {
						id: { type: "string", format: "uuid" },
						name: { type: "string" },
						type: { type: "string", enum: ["receita", "despesa"] },
						icon: { type: ["string", "null"] },
						partyKind: {
							type: ["string", "null"],
							enum: ["cliente", "fornecedor", null],
						},
						createdAt: { type: "string", format: "date-time" },
						integrations: {
							type: "array",
							items: {
								$ref: "#/components/schemas/CategoryIntegrationBinding",
							},
						},
					},
				},
				CategoriesListResponse: {
					type: "object",
					required: ["items", "pagination"],
					properties: {
						items: {
							type: "array",
							items: { $ref: "#/components/schemas/CategoryItem" },
						},
						pagination: {
							type: "object",
							required: ["page", "pageSize", "totalItems", "totalPages"],
							properties: {
								page: { type: "integer", minimum: 1 },
								pageSize: { type: "integer", enum: [10, 20, 50, 100] },
								totalItems: { type: "integer", minimum: 0 },
								totalPages: { type: "integer", minimum: 1 },
							},
						},
					},
				},
				CategoryUpsertResponse: {
					type: "object",
					required: ["mode", "item"],
					properties: {
						mode: { type: "string", enum: ["created", "updated"] },
						item: { $ref: "#/components/schemas/CategoryItem" },
					},
				},
				PartyIntegrationPayload: {
					type: "object",
					required: ["sourceApp", "externalKey"],
					properties: {
						sourceApp: { type: "string", minLength: 1, maxLength: 255 },
						profileKey: { type: ["string", "null"], maxLength: 255 },
						externalKey: { type: "string", minLength: 1, maxLength: 255 },
					},
				},
				PartyWriteRequest: {
					type: "object",
					required: ["kind", "name", "status"],
					properties: {
						kind: { type: "string", enum: ["cliente", "fornecedor"] },
						name: { type: "string", minLength: 1 },
						document: { type: ["string", "null"], maxLength: 255 },
						email: { type: ["string", "null"], maxLength: 255 },
						phone: { type: ["string", "null"], maxLength: 255 },
						status: { type: "string", enum: ["Ativo", "Inativo"] },
						note: { type: ["string", "null"] },
						integration: {
							$ref: "#/components/schemas/PartyIntegrationPayload",
						},
					},
				},
				PartyIntegrationBinding: {
					type: "object",
					required: [
						"sourceApp",
						"profileKey",
						"externalKey",
						"createdAt",
						"updatedAt",
					],
					properties: {
						sourceApp: { type: "string" },
						profileKey: { type: ["string", "null"] },
						externalKey: { type: "string" },
						createdAt: { type: "string", format: "date-time" },
						updatedAt: { type: "string", format: "date-time" },
					},
				},
				PartyItem: {
					type: "object",
					required: [
						"id",
						"kind",
						"name",
						"document",
						"email",
						"phone",
						"note",
						"status",
						"createdAt",
						"integrations",
					],
					properties: {
						id: { type: "string", format: "uuid" },
						kind: { type: "string", enum: ["cliente", "fornecedor"] },
						name: { type: "string" },
						document: { type: ["string", "null"] },
						email: { type: ["string", "null"] },
						phone: { type: ["string", "null"] },
						note: { type: ["string", "null"] },
						status: { type: "string", enum: ["Ativo", "Inativo"] },
						createdAt: { type: "string", format: "date-time" },
						integrations: {
							type: "array",
							items: {
								$ref: "#/components/schemas/PartyIntegrationBinding",
							},
						},
					},
				},
				PartiesListResponse: {
					type: "object",
					required: ["items", "pagination"],
					properties: {
						items: {
							type: "array",
							items: { $ref: "#/components/schemas/PartyItem" },
						},
						pagination: {
							type: "object",
							required: ["page", "pageSize", "totalItems", "totalPages"],
							properties: {
								page: { type: "integer", minimum: 1 },
								pageSize: { type: "integer", enum: [10, 20, 50, 100] },
								totalItems: { type: "integer", minimum: 0 },
								totalPages: { type: "integer", minimum: 1 },
							},
						},
					},
				},
				PartyUpsertResponse: {
					type: "object",
					required: ["mode", "item"],
					properties: {
						mode: { type: "string", enum: ["created", "updated"] },
						item: { $ref: "#/components/schemas/PartyItem" },
					},
				},
			},
		},
		paths: {
			"/api/health": {
				get: {
					tags: ["Health"],
					summary: "Verifica disponibilidade da aplicação",
					description:
						"Executa uma consulta simples no banco para confirmar que a aplicação e o PostgreSQL estão operacionais.",
					security: [],
					responses: {
						"200": {
							description: "Aplicação saudável.",
							...buildJsonResponse(
								{ $ref: "#/components/schemas/HealthOkResponse" },
								{
									ok: {
										value: {
											status: "ok",
											name: "OpenMonetis PE",
											timestamp: "2026-06-28T16:40:00.000Z",
										},
									},
								},
							),
						},
						"503": {
							description: "Falha ao acessar o banco de dados.",
							...buildJsonResponse(
								{ $ref: "#/components/schemas/HealthErrorResponse" },
								{
									unavailable: {
										value: {
											status: "error",
											name: "OpenMonetis PE",
											timestamp: "2026-06-28T16:40:00.000Z",
											message: "Database connection failed",
										},
									},
								},
							),
						},
					},
				},
			},
			"/api/auth/device/verify": {
				post: {
					tags: ["Auth"],
					summary: "Valida um token Bearer de integração",
					description:
						"Permite que clientes externos confirmem se o token ainda está ativo, sem depender do fluxo de inbox.",
					security: bearerSecurity,
					responses: {
						"200": {
							description: "Token válido.",
							...buildJsonResponse(
								{ $ref: "#/components/schemas/DeviceVerifySuccessResponse" },
								{
									default: {
										value: {
											valid: true,
											userId: "ee89d064-eb7a-43a0-9a1f-1a0efa3937c8",
											tokenId: "a4107071-4f36-4a30-b1b4-fcab11de7d0d",
											tokenName: "Companion Android",
										},
									},
								},
							),
						},
						"401": {
							description: "Token ausente, inválido, revogado ou expirado.",
							...buildJsonResponse(
								{ $ref: "#/components/schemas/DeviceVerifyErrorResponse" },
								{
									missing: {
										value: {
											valid: false,
											error: "Token não fornecido",
										},
									},
									invalid: {
										value: {
											valid: false,
											error: "Token inválido ou revogado",
										},
									},
								},
							),
						},
					},
				},
			},
			"/api/inbox": {
				post: {
					tags: ["Inbox"],
					summary: "Cria um pré-lançamento na inbox",
					description:
						"Recebe notificações externas, resolve mapeamentos conhecidos e, quando `autoImport` estiver ativo, tenta criar o lançamento automaticamente.",
					security: bearerSecurity,
					requestBody: {
						required: true,
						content: {
							"application/json": {
								schema: {
									$ref: "#/components/schemas/InboxItemRequest",
								},
								examples: {
									default: {
										value: inboxItemExample,
									},
								},
							},
						},
					},
					responses: {
						"201": {
							description: "Pré-lançamento registrado.",
							...buildJsonResponse(
								{ $ref: "#/components/schemas/InboxItemResponse" },
								{
									default: {
										value: {
											id: "d44ec0a0-2800-4210-8e27-18857bbd5c03",
											clientId: "android-evt-001",
											message: "Notificação importada automaticamente",
											status: "processed",
											autoImported: true,
											transactionId: "424f7a2f-aec6-4504-b10d-ef74cfe1d665",
											reconciliationStatus: "reconciled",
											reconciledTitleId: "41bd7f8a-3e05-4198-9e59-0b7b243bdf75",
										},
									},
								},
							),
						},
						"400": {
							description: "Payload inválido ou regra de domínio não atendida.",
							...buildJsonResponse(
								{ $ref: "#/components/schemas/ErrorResponse" },
								{
									validation: {
										value: buildErrorExample("originalText é obrigatório"),
									},
								},
							),
						},
						"401": {
							description: "Token Bearer inválido.",
							...buildJsonResponse(
								{ $ref: "#/components/schemas/ErrorResponse" },
								{
									default: {
										value: buildErrorExample("Token inválido ou revogado"),
									},
								},
							),
						},
						"429": {
							description: "Limite de 100 requisições por minuto excedido.",
							...buildJsonResponse(
								{ $ref: "#/components/schemas/RateLimitErrorResponse" },
								{
									default: {
										value: buildErrorExample("Limite de requisições excedido", {
											retryAfter: 60,
										}),
									},
								},
							),
						},
						"500": {
							description: "Falha interna durante o registro do item.",
							...buildJsonResponse(
								{ $ref: "#/components/schemas/ErrorResponse" },
								{
									default: {
										value: buildErrorExample("Erro ao lançar notificação"),
									},
								},
							),
						},
					},
				},
			},
			"/api/inbox/batch": {
				post: {
					tags: ["Inbox"],
					summary: "Processa vários pré-lançamentos em lote",
					description:
						"Recebe de 1 a 50 itens por chamada e retorna o resultado individual de cada tentativa.",
					security: bearerSecurity,
					requestBody: {
						required: true,
						content: {
							"application/json": {
								schema: {
									$ref: "#/components/schemas/InboxBatchRequest",
								},
								examples: {
									default: {
										value: {
											items: [
												inboxItemExample,
												{
													...inboxItemExample,
													clientId: "android-evt-002",
													parsedName: "Mercado Central",
													parsedAmount: 89.4,
													originalText: "Compra de R$ 89,40 em Mercado Central",
												},
											],
										},
									},
								},
							},
						},
					},
					responses: {
						"201": {
							description: "Lote processado.",
							...buildJsonResponse(
								{ $ref: "#/components/schemas/InboxBatchResponse" },
								{
									default: {
										value: {
											message: "1 notificações processadas, 1 falharam",
											total: 2,
											success: 1,
											failed: 1,
											results: [
												{
													clientId: "android-evt-001",
													serverId: "d44ec0a0-2800-4210-8e27-18857bbd5c03",
													success: true,
													status: "processed",
													autoImported: true,
													transactionId: "424f7a2f-aec6-4504-b10d-ef74cfe1d665",
													reconciliationStatus: "reconciled",
													reconciledTitleId:
														"41bd7f8a-3e05-4198-9e59-0b7b243bdf75",
												},
												{
													clientId: "android-evt-002",
													success: false,
													error: "Erro ao lançar notificação",
												},
											],
										},
									},
								},
							),
						},
						"400": {
							description: "Payload inválido.",
							...buildJsonResponse(
								{ $ref: "#/components/schemas/ErrorResponse" },
								{
									default: {
										value: buildErrorExample(
											"Array deve ter no máximo 50 itens",
										),
									},
								},
							),
						},
						"401": {
							description: "Token Bearer inválido.",
							...buildJsonResponse(
								{ $ref: "#/components/schemas/ErrorResponse" },
								{
									default: {
										value: buildErrorExample("Token inválido ou revogado"),
									},
								},
							),
						},
						"429": {
							description:
								"Limite de 20 requisições de lote por minuto excedido.",
							...buildJsonResponse(
								{ $ref: "#/components/schemas/RateLimitErrorResponse" },
								{
									default: {
										value: buildErrorExample("Limite de requisições excedido", {
											retryAfter: 60,
										}),
									},
								},
							),
						},
						"500": {
							description: "Falha interna ao processar o lote.",
							...buildJsonResponse(
								{ $ref: "#/components/schemas/ErrorResponse" },
								{
									default: {
										value: buildErrorExample("Erro ao lançar notificações"),
									},
								},
							),
						},
					},
				},
			},
			"/api/categories": {
				get: {
					tags: ["Categories"],
					summary: "Lista categorias",
					description:
						"Permite paginação, filtros simples e lookup pontual por binding externo usando `sourceApp` e `externalKey`.",
					security: bearerSecurity,
					parameters: [
						{
							name: "page",
							in: "query",
							description: "Página atual.",
							schema: { type: "integer", minimum: 1, default: 1 },
						},
						{
							name: "pageSize",
							in: "query",
							description: "Tamanho da página.",
							schema: { type: "integer", enum: [10, 20, 50, 100], default: 20 },
						},
						{
							name: "search",
							in: "query",
							description: "Busca textual em nome, ícone e tipo de vínculo.",
							schema: { type: "string" },
						},
						{
							name: "type",
							in: "query",
							description: "Filtra por tipo da categoria.",
							schema: { type: "string", enum: ["receita", "despesa"] },
						},
						{
							name: "partyKind",
							in: "query",
							description:
								"Filtra por vínculo esperado com cliente/fornecedor.",
							schema: { type: "string", enum: ["cliente", "fornecedor"] },
						},
						{
							name: "sourceApp",
							in: "query",
							description: "Origem da integração para lookup por binding.",
							schema: { type: "string" },
						},
						{
							name: "profileKey",
							in: "query",
							description: "Perfil opcional do binding.",
							schema: { type: "string" },
						},
						{
							name: "externalKey",
							in: "query",
							description: "Identificador externo para lookup por binding.",
							schema: { type: "string" },
						},
					],
					responses: {
						"200": {
							description: "Lista paginada.",
							...buildJsonResponse(
								{ $ref: "#/components/schemas/CategoriesListResponse" },
								{
									default: {
										value: {
											items: [categoryExample],
											pagination: {
												page: 1,
												pageSize: 20,
												totalItems: 1,
												totalPages: 1,
											},
										},
									},
								},
							),
						},
						"400": {
							description: "Parâmetros de busca inválidos.",
							...buildJsonResponse(
								{ $ref: "#/components/schemas/ErrorResponse" },
								{
									default: {
										value: buildErrorExample(
											"sourceApp e externalKey precisam ser informados juntos.",
										),
									},
								},
							),
						},
						"401": {
							description: "Token Bearer inválido.",
							...buildJsonResponse(
								{ $ref: "#/components/schemas/ErrorResponse" },
								{
									default: {
										value: buildErrorExample("Token inválido ou revogado"),
									},
								},
							),
						},
						"500": {
							description: "Falha interna ao buscar categorias.",
							...buildJsonResponse(
								{ $ref: "#/components/schemas/ErrorResponse" },
								{
									default: {
										value: buildErrorExample("Algo deu errado."),
									},
								},
							),
						},
					},
				},
				post: {
					tags: ["Categories"],
					summary: "Cria ou atualiza uma categoria por binding externo",
					description:
						"Sem `integration`, sempre cria uma nova categoria. Com `integration`, o endpoint faz upsert por `userId + sourceApp + profileKey + externalKey`.",
					security: bearerSecurity,
					requestBody: {
						required: true,
						content: {
							"application/json": {
								schema: {
									$ref: "#/components/schemas/CategoryWriteRequest",
								},
								examples: {
									default: {
										value: categoryWriteExample,
									},
								},
							},
						},
					},
					responses: {
						"200": {
							description: "Categoria atualizada pelo upsert de integração.",
							...buildJsonResponse(
								{ $ref: "#/components/schemas/CategoryUpsertResponse" },
								{
									updated: {
										value: {
											mode: "updated",
											item: categoryExample,
										},
									},
								},
							),
						},
						"201": {
							description: "Categoria criada.",
							...buildJsonResponse(
								{ $ref: "#/components/schemas/CategoryUpsertResponse" },
								{
									created: {
										value: {
											mode: "created",
											item: categoryExample,
										},
									},
								},
							),
						},
						"400": {
							description: "Payload inválido ou categoria protegida.",
							...buildJsonResponse(
								{ $ref: "#/components/schemas/ErrorResponse" },
								{
									validation: {
										value: buildErrorExample("Informe o nome da categoria."),
									},
									protected: {
										value: buildErrorExample(
											"A categoria 'Pagamentos' é protegida e não pode ser editada.",
										),
									},
								},
							),
						},
						"401": {
							description: "Token Bearer inválido.",
							...buildJsonResponse(
								{ $ref: "#/components/schemas/ErrorResponse" },
								{
									default: {
										value: buildErrorExample("Token inválido ou revogado"),
									},
								},
							),
						},
						"500": {
							description: "Falha interna ao persistir a categoria.",
							...buildJsonResponse(
								{ $ref: "#/components/schemas/ErrorResponse" },
								{
									default: {
										value: buildErrorExample("Algo deu errado."),
									},
								},
							),
						},
					},
				},
			},
			"/api/categories/{categoryId}": {
				get: {
					tags: ["Categories"],
					summary: "Busca o detalhe de uma categoria",
					security: bearerSecurity,
					parameters: [{ $ref: "#/components/parameters/CategoryId" }],
					responses: {
						"200": {
							description: "Categoria encontrada.",
							...buildJsonResponse(
								{ $ref: "#/components/schemas/CategoryItem" },
								{
									default: {
										value: categoryExample,
									},
								},
							),
						},
						"401": {
							description: "Token Bearer inválido.",
							...buildJsonResponse(
								{ $ref: "#/components/schemas/ErrorResponse" },
								{
									default: {
										value: buildErrorExample("Token inválido ou revogado"),
									},
								},
							),
						},
						"404": {
							description: "Categoria não encontrada para o usuário do token.",
							...buildJsonResponse(
								{ $ref: "#/components/schemas/ErrorResponse" },
								{
									default: {
										value: buildErrorExample("Categoria não encontrada."),
									},
								},
							),
						},
						"500": {
							description: "Falha interna ao buscar a categoria.",
							...buildJsonResponse(
								{ $ref: "#/components/schemas/ErrorResponse" },
								{
									default: {
										value: buildErrorExample("Algo deu errado."),
									},
								},
							),
						},
					},
				},
				patch: {
					tags: ["Categories"],
					summary: "Atualiza uma categoria existente",
					description:
						"Também aceita o bloco `integration` para criar ou atualizar o binding externo da categoria.",
					security: bearerSecurity,
					parameters: [{ $ref: "#/components/parameters/CategoryId" }],
					requestBody: {
						required: true,
						content: {
							"application/json": {
								schema: {
									$ref: "#/components/schemas/CategoryWriteRequest",
								},
								examples: {
									default: {
										value: categoryWriteExample,
									},
								},
							},
						},
					},
					responses: {
						"200": {
							description: "Categoria atualizada.",
							...buildJsonResponse(
								{ $ref: "#/components/schemas/CategoryItem" },
								{
									default: {
										value: categoryExample,
									},
								},
							),
						},
						"400": {
							description: "Payload inválido ou categoria protegida.",
							...buildJsonResponse(
								{ $ref: "#/components/schemas/ErrorResponse" },
								{
									validation: {
										value: buildErrorExample("Informe o nome da categoria."),
									},
									protected: {
										value: buildErrorExample(
											"A categoria 'Pagamentos' é protegida e não pode ser editada.",
										),
									},
								},
							),
						},
						"401": {
							description: "Token Bearer inválido.",
							...buildJsonResponse(
								{ $ref: "#/components/schemas/ErrorResponse" },
								{
									default: {
										value: buildErrorExample("Token inválido ou revogado"),
									},
								},
							),
						},
						"404": {
							description: "Categoria não encontrada.",
							...buildJsonResponse(
								{ $ref: "#/components/schemas/ErrorResponse" },
								{
									default: {
										value: buildErrorExample("Categoria não encontrada."),
									},
								},
							),
						},
						"500": {
							description: "Falha interna ao atualizar a categoria.",
							...buildJsonResponse(
								{ $ref: "#/components/schemas/ErrorResponse" },
								{
									default: {
										value: buildErrorExample("Algo deu errado."),
									},
								},
							),
						},
					},
				},
				delete: {
					tags: ["Categories"],
					summary: "Remove uma categoria",
					description:
						"Remove a categoria fisicamente e também seus bindings externos por cascade. Categorias protegidas não podem ser removidas.",
					security: bearerSecurity,
					parameters: [{ $ref: "#/components/parameters/CategoryId" }],
					responses: {
						"200": {
							description: "Categoria removida.",
							...buildJsonResponse(
								{ $ref: "#/components/schemas/CategoryItem" },
								{
									default: {
										value: categoryExample,
									},
								},
							),
						},
						"400": {
							description: "Categoria protegida.",
							...buildJsonResponse(
								{ $ref: "#/components/schemas/ErrorResponse" },
								{
									default: {
										value: buildErrorExample(
											"A categoria 'Pagamentos' é protegida e não pode ser removida.",
										),
									},
								},
							),
						},
						"401": {
							description: "Token Bearer inválido.",
							...buildJsonResponse(
								{ $ref: "#/components/schemas/ErrorResponse" },
								{
									default: {
										value: buildErrorExample("Token inválido ou revogado"),
									},
								},
							),
						},
						"404": {
							description: "Categoria não encontrada.",
							...buildJsonResponse(
								{ $ref: "#/components/schemas/ErrorResponse" },
								{
									default: {
										value: buildErrorExample("Categoria não encontrada."),
									},
								},
							),
						},
						"500": {
							description: "Falha interna ao remover a categoria.",
							...buildJsonResponse(
								{ $ref: "#/components/schemas/ErrorResponse" },
								{
									default: {
										value: buildErrorExample("Algo deu errado."),
									},
								},
							),
						},
					},
				},
			},
			"/api/parties": {
				get: {
					tags: ["Parties"],
					summary: "Lista clientes e fornecedores",
					description:
						"Permite paginação, filtros simples e lookup pontual por binding externo usando `sourceApp` e `externalKey`.",
					security: bearerSecurity,
					parameters: [
						{
							name: "page",
							in: "query",
							description: "Página atual.",
							schema: { type: "integer", minimum: 1, default: 1 },
						},
						{
							name: "pageSize",
							in: "query",
							description: "Tamanho da página.",
							schema: { type: "integer", enum: [10, 20, 50, 100], default: 20 },
						},
						{
							name: "search",
							in: "query",
							description:
								"Busca textual em nome, documento, e-mail, telefone e observação.",
							schema: { type: "string" },
						},
						{
							name: "kind",
							in: "query",
							description: "Filtra por tipo de cadastro.",
							schema: { type: "string", enum: ["cliente", "fornecedor"] },
						},
						{
							name: "status",
							in: "query",
							description: "Filtra por status.",
							schema: { type: "string", enum: ["Ativo", "Inativo"] },
						},
						{
							name: "sourceApp",
							in: "query",
							description: "Origem da integração para lookup por binding.",
							schema: { type: "string" },
						},
						{
							name: "profileKey",
							in: "query",
							description: "Perfil opcional do binding.",
							schema: { type: "string" },
						},
						{
							name: "externalKey",
							in: "query",
							description: "Identificador externo para lookup por binding.",
							schema: { type: "string" },
						},
					],
					responses: {
						"200": {
							description: "Lista paginada.",
							...buildJsonResponse(
								{ $ref: "#/components/schemas/PartiesListResponse" },
								{
									default: {
										value: {
											items: [partyExample],
											pagination: {
												page: 1,
												pageSize: 20,
												totalItems: 1,
												totalPages: 1,
											},
										},
									},
								},
							),
						},
						"400": {
							description: "Parâmetros de busca inválidos.",
							...buildJsonResponse(
								{ $ref: "#/components/schemas/ErrorResponse" },
								{
									default: {
										value: buildErrorExample(
											"sourceApp e externalKey precisam ser informados juntos.",
										),
									},
								},
							),
						},
						"401": {
							description: "Token Bearer inválido.",
							...buildJsonResponse(
								{ $ref: "#/components/schemas/ErrorResponse" },
								{
									default: {
										value: buildErrorExample("Token inválido ou revogado"),
									},
								},
							),
						},
						"500": {
							description: "Falha interna ao buscar cadastros.",
							...buildJsonResponse(
								{ $ref: "#/components/schemas/ErrorResponse" },
								{
									default: {
										value: buildErrorExample("Algo deu errado."),
									},
								},
							),
						},
					},
				},
				post: {
					tags: ["Parties"],
					summary: "Cria ou atualiza um cliente/fornecedor por binding externo",
					description:
						"Sem `integration`, sempre cria um novo cadastro. Com `integration`, o endpoint faz upsert por `userId + sourceApp + profileKey + externalKey`.",
					security: bearerSecurity,
					requestBody: {
						required: true,
						content: {
							"application/json": {
								schema: {
									$ref: "#/components/schemas/PartyWriteRequest",
								},
								examples: {
									default: {
										value: partyWriteExample,
									},
								},
							},
						},
					},
					responses: {
						"200": {
							description: "Cadastro atualizado pelo upsert de integração.",
							...buildJsonResponse(
								{ $ref: "#/components/schemas/PartyUpsertResponse" },
								{
									updated: {
										value: {
											mode: "updated",
											item: partyExample,
										},
									},
								},
							),
						},
						"201": {
							description: "Cadastro criado.",
							...buildJsonResponse(
								{ $ref: "#/components/schemas/PartyUpsertResponse" },
								{
									created: {
										value: {
											mode: "created",
											item: partyExample,
										},
									},
								},
							),
						},
						"400": {
							description: "Payload inválido.",
							...buildJsonResponse(
								{ $ref: "#/components/schemas/ErrorResponse" },
								{
									default: {
										value: buildErrorExample("Informe o nome."),
									},
								},
							),
						},
						"401": {
							description: "Token Bearer inválido.",
							...buildJsonResponse(
								{ $ref: "#/components/schemas/ErrorResponse" },
								{
									default: {
										value: buildErrorExample("Token inválido ou revogado"),
									},
								},
							),
						},
						"500": {
							description: "Falha interna ao persistir o cadastro.",
							...buildJsonResponse(
								{ $ref: "#/components/schemas/ErrorResponse" },
								{
									default: {
										value: buildErrorExample("Algo deu errado."),
									},
								},
							),
						},
					},
				},
			},
			"/api/parties/{partyId}": {
				get: {
					tags: ["Parties"],
					summary: "Busca o detalhe de um cliente/fornecedor",
					security: bearerSecurity,
					parameters: [{ $ref: "#/components/parameters/PartyId" }],
					responses: {
						"200": {
							description: "Cadastro encontrado.",
							...buildJsonResponse(
								{ $ref: "#/components/schemas/PartyItem" },
								{
									default: {
										value: partyExample,
									},
								},
							),
						},
						"401": {
							description: "Token Bearer inválido.",
							...buildJsonResponse(
								{ $ref: "#/components/schemas/ErrorResponse" },
								{
									default: {
										value: buildErrorExample("Token inválido ou revogado"),
									},
								},
							),
						},
						"404": {
							description: "Cadastro não encontrado para o usuário do token.",
							...buildJsonResponse(
								{ $ref: "#/components/schemas/ErrorResponse" },
								{
									default: {
										value: buildErrorExample("Cadastro não encontrado."),
									},
								},
							),
						},
						"500": {
							description: "Falha interna ao buscar o cadastro.",
							...buildJsonResponse(
								{ $ref: "#/components/schemas/ErrorResponse" },
								{
									default: {
										value: buildErrorExample("Algo deu errado."),
									},
								},
							),
						},
					},
				},
				patch: {
					tags: ["Parties"],
					summary: "Atualiza um cliente/fornecedor existente",
					description:
						"Também aceita o bloco `integration` para criar ou atualizar o binding externo do cadastro.",
					security: bearerSecurity,
					parameters: [{ $ref: "#/components/parameters/PartyId" }],
					requestBody: {
						required: true,
						content: {
							"application/json": {
								schema: {
									$ref: "#/components/schemas/PartyWriteRequest",
								},
								examples: {
									default: {
										value: partyWriteExample,
									},
								},
							},
						},
					},
					responses: {
						"200": {
							description: "Cadastro atualizado.",
							...buildJsonResponse(
								{ $ref: "#/components/schemas/PartyItem" },
								{
									default: {
										value: partyExample,
									},
								},
							),
						},
						"400": {
							description: "Payload inválido.",
							...buildJsonResponse(
								{ $ref: "#/components/schemas/ErrorResponse" },
								{
									default: {
										value: buildErrorExample("Informe o nome."),
									},
								},
							),
						},
						"401": {
							description: "Token Bearer inválido.",
							...buildJsonResponse(
								{ $ref: "#/components/schemas/ErrorResponse" },
								{
									default: {
										value: buildErrorExample("Token inválido ou revogado"),
									},
								},
							),
						},
						"404": {
							description: "Cadastro não encontrado.",
							...buildJsonResponse(
								{ $ref: "#/components/schemas/ErrorResponse" },
								{
									default: {
										value: buildErrorExample("Cadastro não encontrado."),
									},
								},
							),
						},
						"500": {
							description: "Falha interna ao atualizar o cadastro.",
							...buildJsonResponse(
								{ $ref: "#/components/schemas/ErrorResponse" },
								{
									default: {
										value: buildErrorExample("Algo deu errado."),
									},
								},
							),
						},
					},
				},
				delete: {
					tags: ["Parties"],
					summary: "Inativa logicamente um cliente/fornecedor",
					description:
						"Não remove o registro fisicamente. O endpoint apenas retorna o cadastro com `status = Inativo`.",
					security: bearerSecurity,
					parameters: [{ $ref: "#/components/parameters/PartyId" }],
					responses: {
						"200": {
							description: "Cadastro inativado.",
							...buildJsonResponse(
								{ $ref: "#/components/schemas/PartyItem" },
								{
									default: {
										value: {
											...partyExample,
											status: "Inativo",
										},
									},
								},
							),
						},
						"401": {
							description: "Token Bearer inválido.",
							...buildJsonResponse(
								{ $ref: "#/components/schemas/ErrorResponse" },
								{
									default: {
										value: buildErrorExample("Token inválido ou revogado"),
									},
								},
							),
						},
						"404": {
							description: "Cadastro não encontrado.",
							...buildJsonResponse(
								{ $ref: "#/components/schemas/ErrorResponse" },
								{
									default: {
										value: buildErrorExample("Cadastro não encontrado."),
									},
								},
							),
						},
						"500": {
							description: "Falha interna ao inativar o cadastro.",
							...buildJsonResponse(
								{ $ref: "#/components/schemas/ErrorResponse" },
								{
									default: {
										value: buildErrorExample("Algo deu errado."),
									},
								},
							),
						},
					},
				},
			},
		},
	} as const;
}
