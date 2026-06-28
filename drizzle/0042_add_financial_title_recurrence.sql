ALTER TABLE "titulos_financeiros"
ADD COLUMN "serie_id" uuid,
ADD COLUMN "papel_serie" text,
ADD COLUMN "frequencia_serie" text,
ADD COLUMN "indice_serie" integer,
ADD COLUMN "data_inicio_serie" date,
ADD COLUMN "data_fim_serie" date,
ADD COLUMN "dia_ancora_serie" smallint,
ADD COLUMN "gerado_ate_periodo_serie" text,
ADD COLUMN "encerrado_em_serie" timestamp with time zone;

CREATE INDEX "titulos_financeiros_user_serie_id_idx"
ON "titulos_financeiros" USING btree ("user_id", "serie_id");

CREATE INDEX "titulos_financeiros_user_papel_serie_idx"
ON "titulos_financeiros" USING btree ("user_id", "papel_serie");

CREATE UNIQUE INDEX "titulos_financeiros_user_serie_periodo_unique"
ON "titulos_financeiros" USING btree ("user_id", "serie_id", "periodo_competencia")
WHERE "serie_id" IS NOT NULL;
