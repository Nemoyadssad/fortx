import { IsNumber, IsPositive, Max, IsUUID } from 'class-validator';

export class AmountDto {
  @IsNumber()
  @IsPositive()
  @Max(1000000)
  amount!: number;
}

export class WithdrawDto extends AmountDto {
  @IsUUID()
  requestId!: string; // фронт генерирует один раз на попытку вывода, переиспользует при ретраях
}