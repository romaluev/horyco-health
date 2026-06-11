import { IsString, MinLength } from 'class-validator';

export class SetBotTokenDto {
  @IsString()
  @MinLength(20)
  token!: string;
}
