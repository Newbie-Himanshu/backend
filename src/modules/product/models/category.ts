import { Column, Entity, ManyToOne, OneToMany, JoinColumn, Index } from "typeorm";

@Entity("product_category")
@Index(["parent_category_id"])
@Index(["handle"])
export class ProductCategory {
  @Column({ primary: true, type: "uuid" })
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true, type: "text" })
  description: string;

  @Column({ nullable: true, unique: true })
  handle: string;

  @Column({ nullable: true, type: "uuid" })
  parent_category_id: string | null;

  // Depth level in hierarchy (0 = root, 1 = direct child of root, etc.)
  @Column({ default: 0, type: "smallint" })
  level: number;

  // For sorting within same level
  @Column({ nullable: true, type: "int" })
  sort_order: number;

  // Path for efficient querying (e.g., "1/2/3/" for breadcrumb trails)
  @Column({ nullable: true, type: "text" })
  path: string;

  @ManyToOne(() => ProductCategory, (category) => category.children, {
    nullable: true,
    onDelete: "CASCADE",
    lazy: true,
  })
  @JoinColumn({ name: "parent_category_id" })
  parent_category: ProductCategory | null;

  @OneToMany(() => ProductCategory, (category) => category.parent_category, {
    cascade: true,
    eager: false,
    lazy: true,
  })
  children: ProductCategory[];

  @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  created_at: Date;

  @Column({
    type: "timestamp",
    default: () => "CURRENT_TIMESTAMP",
    onUpdate: "CURRENT_TIMESTAMP",
  })
  updated_at: Date;
}
