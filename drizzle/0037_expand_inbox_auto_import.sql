ALTER TABLE "pre_lancamentos" ADD COLUMN IF NOT EXISTS "data_compra" date;--> statement-breakpoint
ALTER TABLE "pre_lancamentos" ADD COLUMN IF NOT EXISTS "tipo_transacao" text;--> statement-breakpoint
ALTER TABLE "pre_lancamentos" ADD COLUMN IF NOT EXISTS "forma_pagamento" text;--> statement-breakpoint
ALTER TABLE "pre_lancamentos" ADD COLUMN IF NOT EXISTS "conta_id" uuid REFERENCES "public"."contas"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "pre_lancamentos" ADD COLUMN IF NOT EXISTS "cartao_id" uuid REFERENCES "public"."cartoes"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "pre_lancamentos" ADD COLUMN IF NOT EXISTS "categoria_id" uuid REFERENCES "public"."categorias"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "pre_lancamentos" ADD COLUMN IF NOT EXISTS "pagador_id" uuid REFERENCES "public"."pagadores"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "pre_lancamentos" ADD COLUMN IF NOT EXISTS "cliente_fornecedor_id" uuid REFERENCES "public"."clientes_fornecedores"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "pre_lancamentos" ADD COLUMN IF NOT EXISTS "auto_import_requested" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "pre_lancamentos" ADD COLUMN IF NOT EXISTS "auto_import_error" text;
