import { mongoose } from '@nest-extended/mongoose';

export function cli(): string {
  console.log(mongoose());
  return 'cli';
}
