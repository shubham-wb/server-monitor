import { SetMetadata } from '@nestjs/common';
import { AUTH_TYPE_KEY, AuthType } from './auth.constants';

export const Public = () => SetMetadata(AUTH_TYPE_KEY, AuthType.PUBLIC);

export const IngestAuth = () => SetMetadata(AUTH_TYPE_KEY, AuthType.INGEST);
