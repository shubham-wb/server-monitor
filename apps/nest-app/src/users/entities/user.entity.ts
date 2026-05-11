import { Column, PrimaryColumn } from 'typeorm';

export class User {
  @PrimaryColumn({ type: 'uuid', generated: 'uuid' })
  id: string;

  @Column()
  name: string;

  @Column()
  email: string;
}
