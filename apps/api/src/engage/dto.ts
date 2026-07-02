import { IsString, MinLength, MaxLength } from 'class-validator';

export class ClaimMissionDto {
  @IsString()
  id!: string;
}

export class BroadcastDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  text!: string;
}