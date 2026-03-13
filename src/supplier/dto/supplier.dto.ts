import { IsString, IsNumber, IsOptional, IsEnum, IsDateString, IsUUID, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum ListingMode {
  IN_STOCK = 'IN_STOCK',
  ON_ORDER = 'ON_ORDER',
  IN_TRANSIT = 'IN_TRANSIT',
}

export class CreateOfferDto {
  @ApiProperty({ description: 'Trim UUID' })
  @IsUUID()
  trimId: string;

  @ApiProperty({ enum: ListingMode })
  @IsEnum(ListingMode)
  mode: ListingMode;

  @ApiProperty({ example: 5000000 })
  @IsNumber()
  @Type(() => Number)
  proposedPrice: number;

  @ApiProperty({ example: 3 })
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  quantity: number;

  @ApiPropertyOptional({ example: '2025-02-15T00:00:00Z' })
  @IsOptional()
  @IsDateString()
  shipmentDate?: string;

  @ApiPropertyOptional({ example: '2025-03-20T00:00:00Z' })
  @IsOptional()
  @IsDateString()
  arrivalDate?: string;
}
