UPDATE "categorias" AS freelance
SET "nome" = 'Serviços Prestados'
WHERE freelance."tipo" = 'receita'
  AND freelance."nome" = 'Freelance'
  AND NOT EXISTS (
    SELECT 1
    FROM "categorias" AS existing
    WHERE existing."user_id" = freelance."user_id"
      AND existing."tipo" = 'receita'
      AND existing."nome" = 'Serviços Prestados'
      AND existing."id" <> freelance."id"
  );
