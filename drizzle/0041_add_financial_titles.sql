CREATE TABLE "titulos_financeiros" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tipo" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"nome" text NOT NULL,
	"descricao" text,
	"valor" numeric(12, 2) NOT NULL,
	"data_vencimento" date NOT NULL,
	"periodo_competencia" text NOT NULL,
	"forma_pagamento" text NOT NULL,
	"data_baixa" date,
	"valor_baixado" numeric(12, 2),
	"cancelado_em" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" text NOT NULL,
	"cliente_fornecedor_id" uuid,
	"categoria_id" uuid,
	"conta_id" uuid,
	"pagador_id" uuid,
	"lancamento_baixa_id" uuid,
	CONSTRAINT "titulos_financeiros_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "titulos_financeiros_cliente_fornecedor_id_clientes_fornecedores_id_fk" FOREIGN KEY ("cliente_fornecedor_id") REFERENCES "public"."clientes_fornecedores"("id") ON DELETE set null ON UPDATE cascade,
	CONSTRAINT "titulos_financeiros_categoria_id_categorias_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias"("id") ON DELETE set null ON UPDATE cascade,
	CONSTRAINT "titulos_financeiros_conta_id_contas_id_fk" FOREIGN KEY ("conta_id") REFERENCES "public"."contas"("id") ON DELETE set null ON UPDATE cascade,
	CONSTRAINT "titulos_financeiros_pagador_id_pagadores_id_fk" FOREIGN KEY ("pagador_id") REFERENCES "public"."pagadores"("id") ON DELETE set null ON UPDATE cascade,
	CONSTRAINT "titulos_financeiros_lancamento_baixa_id_lancamentos_id_fk" FOREIGN KEY ("lancamento_baixa_id") REFERENCES "public"."lancamentos"("id") ON DELETE set null ON UPDATE cascade
);

CREATE INDEX "titulos_financeiros_user_periodo_competencia_idx" ON "titulos_financeiros" USING btree ("user_id", "periodo_competencia");
CREATE INDEX "titulos_financeiros_user_data_vencimento_idx" ON "titulos_financeiros" USING btree ("user_id", "data_vencimento");
CREATE INDEX "titulos_financeiros_user_status_idx" ON "titulos_financeiros" USING btree ("user_id", "status");
CREATE INDEX "titulos_financeiros_user_tipo_idx" ON "titulos_financeiros" USING btree ("user_id", "tipo");
CREATE UNIQUE INDEX "titulos_financeiros_lancamento_baixa_id_key" ON "titulos_financeiros" USING btree ("lancamento_baixa_id");
