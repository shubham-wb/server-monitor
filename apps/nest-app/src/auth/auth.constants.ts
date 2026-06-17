import { ICurrentUser } from './current-user.interface';

export enum AuthType {
  OPERATOR = 'operator',
  INGEST = 'ingest',
  PUBLIC = 'public',
}

export const AUTH_TYPE_KEY = 'auth:type';

export const OPERATOR_USER: ICurrentUser = {
  id: 'default-user-1',
  name: 'Default User 1',
  email: 'default-user-1@example.com',
};
