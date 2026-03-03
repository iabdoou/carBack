import { IsString, IsNumber, IsOptional, IsEnum, IsEmail, Min, IsDateString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

// ============ ENUMS ============

export enum ListingMode {
  IN_STOCK = 'IN_STOCK',
  ON_ORDER = 'ON_ORDER',
  IN_TRANSIT = 'IN_TRANSIT',
}

export enum ListingStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  OUT_OF_STOCK = 'OUT_OF_STOCK',
}

export enum OrderStatus {
  CREATED = 'CREATED',
  CONFIRMED = 'CONFIRMED',
  IN_TRANSIT = 'IN_TRANSIT',
  ARRIVED = 'ARRIVED',
  READY = 'READY',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export enum MovementType {
  ADD = 'ADD',
  RESERVE = 'RESERVE',
  RELEASE = 'RELEASE',
  SOLD = 'SOLD',
  ADJUST = 'ADJUST',
}

// ============ BUYER MANAGEMENT ============

export class CreateBuyerDto {
  @ApiProperty({ example: 'Ahmed Benali' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'ahmed@client.dz' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: '+213 555 12 34 56' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'TGHU1234567' })
  @IsOptional()
  @IsString()
  containerTrackingCode?: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  password: string;
}

export class UpdateBuyerDto {
  @ApiPropertyOptional({ example: 'Ahmed Benali' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'ahmed@client.dz' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+213 555 12 34 56' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'TGHU1234567' })
  @IsOptional()
  @IsString()
  containerTrackingCode?: string;

  @ApiPropertyOptional({ example: 'newpassword123' })
  @IsOptional()
  @IsString()
  password?: string;
}

// ============ VEHICLE MODEL & TRIM ============

export class CreateVehicleModelDto {
  @ApiProperty({ example: 'Toyota' })
  @IsString()
  brand: string;

  @ApiProperty({ example: 'Corolla' })
  @IsString()
  model: string;

  @ApiProperty({ example: 2024 })
  @IsNumber()
  @Type(() => Number)
  year: number;
}

export class UpdateVehicleModelDto {
  @ApiPropertyOptional({ example: 'Toyota' })
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional({ example: 'Corolla' })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional({ example: 2024 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  year?: number;
}

export class CreateTrimDto {
  @ApiProperty({ example: 'XLE Premium' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Vehicle Model UUID' })
  @IsUUID()
  vehicleModelId: string;

  @ApiPropertyOptional({ example: 'https://example.com/image.jpg' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ example: ['Cuir', 'Toit ouvrant', 'Écran tactile'] })
  @IsOptional()
  @IsString({ each: true })
  options?: string[];
}

export class UpdateTrimDto {
  @ApiPropertyOptional({ example: 'XLE Premium' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'https://example.com/image.jpg' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ example: ['Cuir', 'Toit ouvrant', 'Écran tactile'] })
  @IsOptional()
  @IsString({ each: true })
  options?: string[];
}

// ============ LISTING ============

export class CreateListingDto {
  @ApiProperty({ description: 'Trim UUID' })
  @IsUUID()
  trimId: string;

  @ApiProperty({ enum: ListingMode })
  @IsEnum(ListingMode)
  mode: ListingMode;

  @ApiProperty({ example: 4500000 })
  @IsNumber()
  @Type(() => Number)
  publicPrice: number;

  @ApiProperty({ example: 5 })
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  totalQuantity: number;
}

export class UpdateListingDto {
  @ApiPropertyOptional({ enum: ListingMode })
  @IsOptional()
  @IsEnum(ListingMode)
  mode?: ListingMode;

  @ApiPropertyOptional({ example: 4500000 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  publicPrice?: number;

  @ApiPropertyOptional({ enum: ListingStatus })
  @IsOptional()
  @IsEnum(ListingStatus)
  status?: ListingStatus;
}

// ============ ORDER ============

export class CreateOrderDto {
  @ApiProperty({ description: 'Buyer UUID' })
  @IsUUID()
  buyerId: string;

  @ApiProperty({ description: 'Listing UUID' })
  @IsUUID()
  listingId: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  quantity: number;

  @ApiProperty({ example: 4400000 })
  @IsNumber()
  @Type(() => Number)
  finalPrice: number;
}

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: OrderStatus })
  @IsEnum(OrderStatus)
  status: OrderStatus;
}

// ============ TRACKING ============

export class AddTrackingEventDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  @Type(() => Number)
  step: number;

  @ApiProperty({ example: 'Commande confirmée' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ example: '2025-01-15T10:00:00Z' })
  @IsOptional()
  @IsDateString()
  eventDate?: string;
}

// ============ INVENTORY ============

export class AdjustStockDto {
  @ApiProperty({ example: 5 })
  @IsNumber()
  @Type(() => Number)
  quantity: number;

  @ApiProperty({ example: 'Manual stock adjustment' })
  @IsString()
  reason: string;
}

// ============ OFFER APPROVAL ============

export class ApproveOfferDto {
  @ApiProperty({ example: 5000000 })
  @IsNumber()
  @Type(() => Number)
  publicPrice: number;

  @ApiProperty({ example: 5 })
  @IsNumber()
  @Type(() => Number)
  quantity: number;

  @ApiPropertyOptional({ example: 'Approved with modifications' })
  @IsOptional()
  @IsString()
  adminNote?: string;

  
}

export class RejectOfferDto {
  @ApiProperty({ example: 'Price too high' })
  @IsString()
  adminNote: string;
}
