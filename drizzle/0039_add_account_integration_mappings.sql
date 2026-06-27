ALTER TABLE "pre_lancamentos"
ADD COLUMN "account_external_key" text;

CREATE TABLE "integration_account_mappings" (
	"user_id" text NOT NULL,
	"source_app" text NOT NULL,
	"profile_key" text DEFAULT '' NOT NULL,
	"external_key" text NOT NULL,
	"account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "integration_account_mappings_user_id_source_app_profile_key_external_key_pk"
		PRIMARY KEY("user_id","source_app","profile_key","external_key")
);

ALTER TABLE "integration_account_mappings"
ADD CONSTRAINT "integration_account_mappings_user_id_user_id_fk"
FOREIGN KEY ("user_id") REFERENCES "public"."user"("id")
ON DELETE cascade ON UPDATE no action;

ALTER TABLE "integration_account_mappings"
ADD CONSTRAINT "integration_account_mappings_account_id_contas_id_fk"
FOREIGN KEY ("account_id") REFERENCES "public"."contas"("id")
ON DELETE cascade ON UPDATE no action;

CREATE INDEX "integration_account_mappings_account_id_idx"
ON "integration_account_mappings" USING btree ("account_id");
