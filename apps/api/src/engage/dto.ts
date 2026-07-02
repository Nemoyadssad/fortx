import { IsString } from 'class-validator';

export class ClaimMissionDto {
  @IsString()
  id!: string;
}