import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260307170333 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "faq_query" ("id" text not null, "customer_name" text not null, "customer_email" text not null, "subject" text not null, "question" text not null, "answer" text null, "status" text check ("status" in ('pending', 'answered')) not null default 'pending', "answered_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "faq_query_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_faq_query_deleted_at" ON "faq_query" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "faq_query" cascade;`);
  }

}
