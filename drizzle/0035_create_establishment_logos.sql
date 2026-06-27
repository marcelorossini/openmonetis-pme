CREATE TABLE IF NOT EXISTS "establishment_logos" (
	"user_id" text NOT NULL,
	"name_key" text NOT NULL,
	"domain" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "establishment_logos_user_id_name_key_pk" PRIMARY KEY("user_id","name_key")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "establishment_logos" ADD CONSTRAINT "establishment_logos_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
