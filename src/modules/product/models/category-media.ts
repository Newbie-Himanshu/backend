import { Column, Entity, ManyToOne, JoinColumn, Index } from "typeorm"

@Entity("category_media")
@Index(["category_id"])
export class CategoryMedia {
  @Column({ primary: true, type: "uuid" })
  id: string

  @Column({ type: "uuid" })
  category_id: string

  @ManyToOne("ProductCategory", { nullable: false, onDelete: "CASCADE" })
  @JoinColumn({ name: "category_id" })
  category: any

  @Column({ type: "varchar" })
  media_type: "image" | "icon" | "banner" | "thumbnail"

  @Column({ type: "text" })
  url: string

  @Column({ nullable: true, type: "text" })
  alt_text: string

  @Column({ nullable: true, type: "varchar" })
  mime_type: string

  @Column({ nullable: true, type: "int" })
  file_size: number

  @Column({ nullable: true, type: "int" })
  width: number

  @Column({ nullable: true, type: "int" })
  height: number

  @Column({ default: false })
  is_primary: boolean

  @Column({ default: 0, type: "int" })
  sort_order: number

  @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  created_at: Date

  @Column({
    type: "timestamp",
    default: () => "CURRENT_TIMESTAMP",
    onUpdate: "CURRENT_TIMESTAMP",
  })
  updated_at: Date
}
