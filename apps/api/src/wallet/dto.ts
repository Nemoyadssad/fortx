import { IsNumber, IsPositive, Max } from 'class-validator';

export class AmountDto {
  @IsNumber()
  @IsPositive()
  @Max(1000000)
  amount!: number;
}
