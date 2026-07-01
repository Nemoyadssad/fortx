import { IsInt, IsNumber, IsOptional, IsPositive, IsString, Max, Min, MaxLength } from 'class-validator';

export class CreatePromoDto {
  @IsString()
  @MaxLength(40)
  code!: string;

  @IsNumber()
  @IsPositive()
  @Max(1000000)
  amount!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxUses?: number;

  @IsOptional()
  @IsString()
  expiresAt?: string;
}

export class RedeemDto {
  @IsString()
  @MaxLength(40)
  code!: string;
}
