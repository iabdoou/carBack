import { IsString, IsNumber, IsOptional, IsEnum, IsUUID, Min, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum FuelType {
  ESSENCE = 'ESSENCE',
  DIESEL = 'DIESEL',
  HYBRIDE = 'HYBRIDE',
  ELECTRIQUE = 'ELECTRIQUE',
}

export enum Transmission {
  MANUELLE = 'MANUELLE',
  AUTOMATIQUE = 'AUTOMATIQUE',
}

export enum CarStatus {
  AVAILABLE = 'AVAILABLE',
  RENTED = 'RENTED',
  MAINTENANCE = 'MAINTENANCE',
}

export enum RentalStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export class CreateRentalCarDto {
  @ApiProperty({ example: 'Dacia' })
  @IsString()
  brand: string;

  @ApiProperty({ example: 'Logan' })
  @IsString()
  model: string;

  @ApiProperty({ example: 2023 })
  @IsNumber()
  @Type(() => Number)
  year: number;

  @ApiProperty({ example: 5000 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  pricePerDay: number;

  @ApiProperty({ enum: FuelType, example: FuelType.ESSENCE })
  @IsEnum(FuelType)
  fuel: FuelType;

  @ApiProperty({ enum: Transmission, example: Transmission.MANUELLE })
  @IsEnum(Transmission)
  transmission: Transmission;

  @ApiPropertyOptional({ example: 'https://example.com/car.jpg' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ enum: CarStatus, example: CarStatus.AVAILABLE })
  @IsOptional()
  @IsEnum(CarStatus)
  status?: CarStatus;

  @ApiPropertyOptional({ description: 'Supplier ID (User UUID)' })
  @IsOptional()
  @IsUUID()
  supplierId?: string;
}

export class UpdateRentalCarDto {
  @ApiPropertyOptional({ example: 'Dacia' })
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional({ example: 'Logan' })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional({ example: 2023 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  year?: number;

  @ApiPropertyOptional({ example: 5000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  pricePerDay?: number;

  @ApiPropertyOptional({ enum: FuelType })
  @IsOptional()
  @IsEnum(FuelType)
  fuel?: FuelType;

  @ApiPropertyOptional({ enum: Transmission })
  @IsOptional()
  @IsEnum(Transmission)
  transmission?: Transmission;

  @ApiPropertyOptional({ example: 'https://example.com/car.jpg' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ enum: CarStatus })
  @IsOptional()
  @IsEnum(CarStatus)
  status?: CarStatus;

  @ApiPropertyOptional({ description: 'Supplier ID (User UUID)' })
  @IsOptional()
  @IsUUID()
  supplierId?: string;
}

export class CreateRentalDto {
  @ApiProperty({ description: 'ID of the car to rent' })
  @IsString()
  carId: string;

  @ApiProperty({ example: 'Mohamed Larbi' })
  @IsString()
  clientName: string;

  @ApiProperty({ example: '0550 12 34 56' })
  @IsString()
  clientPhone: string;

  @ApiProperty({ example: '2024-04-11T12:00:00Z' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2024-04-15T12:00:00Z' })
  @IsDateString()
  endDate: string;

  @ApiProperty({ example: 15000 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  totalPrice: number;

  @ApiPropertyOptional({ example: 'Initial deposit paid' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ enum: RentalStatus, default: RentalStatus.ACTIVE })
  @IsOptional()
  @IsEnum(RentalStatus)
  status?: RentalStatus;
}

export class CheckAvailabilityDto {
  @ApiProperty({ description: 'ID of the car to check' })
  @IsString()
  carId: string;

  @ApiProperty({ example: '2024-04-11T12:00:00Z' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2024-04-15T12:00:00Z' })
  @IsDateString()
  endDate: string;
}
