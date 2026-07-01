import { IsNumber, IsPositive, IsString } from 'class-validator';

export class PlaceBetDto {
  @IsString()
  marketId!: string;

  @IsString()
  outcomeId!: string;

  @IsNumber()
  @IsPositive()
  stake!: number;
}
