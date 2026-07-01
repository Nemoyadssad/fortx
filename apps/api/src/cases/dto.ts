import { IsString } from 'class-validator';

export class OpenCaseDto {
  @IsString()
  caseId!: string;
}
