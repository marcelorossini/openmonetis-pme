DO $$ BEGIN
	IF to_regclass('public.clientes') IS NOT NULL
		AND to_regclass('public.clientes_fornecedores') IS NULL THEN
		ALTER TABLE "clientes" RENAME TO "clientes_fornecedores";
	END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "clientes_fornecedores" ADD COLUMN IF NOT EXISTS "tipo" text;--> statement-breakpoint
ALTER TABLE "clientes_fornecedores" ADD COLUMN IF NOT EXISTS "documento" text;--> statement-breakpoint
ALTER TABLE "clientes_fornecedores" ADD COLUMN IF NOT EXISTS "email" text;--> statement-breakpoint
ALTER TABLE "clientes_fornecedores" ADD COLUMN IF NOT EXISTS "telefone" text;--> statement-breakpoint
UPDATE "clientes_fornecedores" SET "tipo" = 'cliente' WHERE "tipo" IS NULL;--> statement-breakpoint
ALTER TABLE "clientes_fornecedores" ALTER COLUMN "tipo" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "categorias" ADD COLUMN IF NOT EXISTS "tipo_vinculo" text;--> statement-breakpoint
DO $$ BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'lancamentos'
			AND column_name = 'cliente_id'
	) AND NOT EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'lancamentos'
			AND column_name = 'cliente_fornecedor_id'
	) THEN
		ALTER TABLE "lancamentos" RENAME COLUMN "cliente_id" TO "cliente_fornecedor_id";
	END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "lancamentos" ADD COLUMN IF NOT EXISTS "cliente_fornecedor_id" uuid;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clientes_fornecedores_user_tipo_status_idx" ON "clientes_fornecedores" USING btree ("user_id","tipo","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lancamentos_cliente_fornecedor_id_idx" ON "lancamentos" USING btree ("cliente_fornecedor_id");
