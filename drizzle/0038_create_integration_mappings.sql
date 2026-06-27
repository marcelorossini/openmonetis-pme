ALTER TABLE "pre_lancamentos" ADD COLUMN IF NOT EXISTS "profile_key" text;--> statement-breakpoint
ALTER TABLE "pre_lancamentos" ADD COLUMN IF NOT EXISTS "party_external_key" text;--> statement-breakpoint
ALTER TABLE "pre_lancamentos" ADD COLUMN IF NOT EXISTS "category_external_key" text;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "integration_party_mappings" (
	"user_id" text NOT NULL,
	"source_app" text NOT NULL,
	"profile_key" text DEFAULT '' NOT NULL,
	"external_key" text NOT NULL,
	"party_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "integration_party_mappings_user_source_profile_external_pk" PRIMARY KEY("user_id","source_app","profile_key","external_key")
);--> statement-breakpoint
ALTER TABLE "integration_party_mappings" ADD CONSTRAINT "integration_party_mappings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_party_mappings" ADD CONSTRAINT "integration_party_mappings_party_id_clientes_fornecedores_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."clientes_fornecedores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "integration_party_mappings_party_id_idx" ON "integration_party_mappings" USING btree ("party_id");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "integration_category_mappings" (
	"user_id" text NOT NULL,
	"source_app" text NOT NULL,
	"profile_key" text DEFAULT '' NOT NULL,
	"external_key" text NOT NULL,
	"category_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "integration_category_mappings_user_source_profile_external_pk" PRIMARY KEY("user_id","source_app","profile_key","external_key")
);--> statement-breakpoint
ALTER TABLE "integration_category_mappings" ADD CONSTRAINT "integration_category_mappings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_category_mappings" ADD CONSTRAINT "integration_category_mappings_category_id_categorias_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categorias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "integration_category_mappings_category_id_idx" ON "integration_category_mappings" USING btree ("category_id");
