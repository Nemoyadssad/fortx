import { IsIn, IsInt, IsNumber, IsOptional, IsPositive, IsString, Max, Min } from 'class-validator';

export class StartMinesDto {
  @IsNumber()
  @IsPositive()
  stake!: number;

  @IsInt()
  @Min(1)
  @Max(24)
  mines!: number;
}

export class RevealDto {
  @IsInt()
  @Min(0)
  @Max(24)
  cell!: number;
}

export class StartClimberDto {
  @IsNumber()
  @IsPositive()
  stake!: number;

  @IsOptional()
  @IsIn(['easy', 'hard'])
  difficulty?: string;
}

export class PickDto {
  @IsInt()
  @Min(0)
  row!: number;

  @IsInt()
  @Min(0)
  tile!: number;
}

export class StartCrashDto {
  @IsNumber()
  @IsPositive()
  stake!: number;
}

export class CrashCashoutDto {
  @IsOptional()
  @IsNumber()
  multiplier?: number;
}


export class PlayDiceDto {
  @IsNumber() @IsPositive() stake!: number;
  @IsInt() target!: number;
  @IsIn(['under', 'over']) direction!: 'under' | 'over';
}

export class PlayPlinkoDto {
  @IsNumber() @IsPositive() stake!: number;
  @IsIn([8, 12, 16]) rows!: number;
  @IsIn(['low', 'medium', 'high']) risk!: 'low' | 'medium' | 'high';
}

export class PlayRouletteDto {
  @IsNumber() @IsPositive() stake!: number;
  @IsIn(['color', 'parity', 'range', 'dozen', 'straight']) betType!: string;
  @IsString() betValue!: string;
}

export class PlayCoinflipDto {
  @IsNumber() @IsPositive() stake!: number;
  @IsIn(['heads', 'tails']) side!: 'heads' | 'tails';
}
