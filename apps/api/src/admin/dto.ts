import { ArrayMinSize, IsArray, IsIn, IsNumber, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateUserDto {
  @IsOptional()
  @IsIn(['USER', 'SUPPORT', 'ADMIN', 'SUPERADMIN'])
  role?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'SUSPENDED', 'BANNED'])
  status?: string;
}

export class AdjustBalanceDto {
  @IsNumber()
  amount!: number; // signed: positive credits, negative debits

  @IsOptional()
  @IsString()
  note?: string;
}

export class ResolveMarketDto {
  @IsString()
  outcomeId!: string;
}

class OutcomeInput {
  @IsString()
  label!: string;

  @IsNumber()
  price!: number; // 0..1 implied probability
}

export class CreateEventDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsString()
  question!: string;

  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => OutcomeInput)
  outcomes!: OutcomeInput[];
}


export class UpdateSettingsDto {
  @IsObject()
  data!: Record<string, any>;
}
