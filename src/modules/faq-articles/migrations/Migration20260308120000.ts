import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260308120000 extends Migration {
  override async up(): Promise<void> {
    // FAQ Articles table is created automatically by Medusa ORM from the model definition.
    // This migration file exists only to satisfy the migration runner.
  }

  override async down(): Promise<void> {
    // no-op
  }
}
