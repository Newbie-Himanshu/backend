import { Column, Entity, ManyToOne, JoinColumn, Index } from "typeorm"

@Entity("product")
@Index(["category_id"])
@Index(["handle"])
export class Product {
  @Column({ primary: true, type: "uuid" })
  id: string

  @Column()
  name: string

  @Column({ nullable: true, type: "text" })
  description: string

  @Column({ nullable: true, unique: true })
  handle: string

  @Column({ nullable: true, type: "decimal", precision: 10, scale: 2 })
  price: number

  @Column({ nullable: true })
  sku: string

  @Column({ nullable: true, type: "uuid" })
  category_id: string | null

  @ManyToOne("ProductCategory", { nullable: true, onDelete: "SET NULL", lazy: true })
  @JoinColumn({ name: "category_id" })
  category: any | null

  @Column({ default: true })
  is_active: boolean

  @Column({ type: "int", default: 0 })
  stock_quantity: number

  @Column({ nullable: true, type: "text" })
  image_url: string

  @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  created_at: Date

  @Column({
    type: "timestamp",
    default: () => "CURRENT_TIMESTAMP",
    onUpdate: "CURRENT_TIMESTAMP",
  })
  updated_at: Date
}
