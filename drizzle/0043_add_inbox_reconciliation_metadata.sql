ALTER TABLE "pre_lancamentos"
ADD COLUMN "reconciliation_status" text,
ADD COLUMN "titulo_conciliado_id" uuid,
ADD COLUMN "reconciliation_summary" text,
ADD COLUMN "reconciliation_attempted_at" timestamp with time zone,
ADD COLUMN "reconciliation_resolved_at" timestamp with time zone,
ADD COLUMN "reconciliation_dismissed" boolean DEFAULT false NOT NULL,
ADD COLUMN "reconciliation_dismissed_at" timestamp with time zone;

ALTER TABLE "pre_lancamentos"
ADD CONSTRAINT "pre_lancamentos_titulo_conciliado_id_titulos_financeiros_id_fk"
FOREIGN KEY ("titulo_conciliado_id")
REFERENCES "public"."titulos_financeiros"("id")
ON DELETE set null
ON UPDATE cascade;

CREATE INDEX "pre_lancamentos_user_id_reconciliation_status_idx"
ON "pre_lancamentos" USING btree ("user_id", "reconciliation_status");

CREATE INDEX "pre_lancamentos_titulo_conciliado_id_idx"
ON "pre_lancamentos" USING btree ("titulo_conciliado_id");
