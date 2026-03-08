import { Column, Entity, ManyToOne, JoinColumn, Index } from "typeorm"

@Entity("category_seo")
@Index(["category_id"])
export class CategorySEO {
  @Column({ primary: true, type: "uuid" })
  id: string

  @Column({ type: "uuid" })
  category_id: string

  @ManyToOne("ProductCategory", { nullable: false, onDelete: "CASCADE" })
  @JoinColumn({ name: "category_id" })
  category: any

  @Column({ nullable: true, type: "text" })
  meta_title: string

  @Column({ nullable: true, type: "text" })
  meta_description: string

  @Column({ nullable: true, type: "text" })
  meta_keywords: string

  @Column({ nullable: true, type: "text" })
  og_title: string

  @Column({ nullable: true, type: "text" })
  og_description: string

  @Column({ nullable: true, type: "text" })
  og_image: string

  @Column({ nullable: true, type: "text" })
  canonical_url: string

  @Column({ nullable: true, type: "text" })
  robots: string // e.g., "index, follow"

  @Column({ nullable: true, type: "text" })
  schema_markup: string // JSON-LD markup

  @Column({ default: true })
  is_published: boolean

  @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  created_at: Date

  @Column({
    type: "timestamp",
    default: () => "CURRENT_TIMESTAMP",
    onUpdate: "CURRENT_TIMESTAMP",
  })
  updated_at: Date
}
