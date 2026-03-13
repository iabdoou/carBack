import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { SupplierService } from './supplier.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateOfferDto } from './dto/supplier.dto';

@ApiTags('supplier')
@Controller('api/v1/supplier')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPPLIER')
@ApiBearerAuth()
export class SupplierController {
  constructor(private supplierService: SupplierService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get supplier dashboard stats' })
  @ApiResponse({ status: 200, description: 'Supplier stats' })
  async getStats(@CurrentUser() user: any) {
    return this.supplierService.getStats(user.sub);
  }

  @Get('offers/grouped')
  @ApiOperation({ summary: 'Get my offers grouped by vehicle model' })
  @ApiQuery({ name: 'status', required: false, enum: ['PENDING', 'APPROVED', 'REJECTED'] })
  @ApiResponse({ status: 200, description: 'List of vehicles with offer stats' })
  async getMyOffersGrouped(
    @CurrentUser() user: any,
    @Query('status') status?: string,
  ) {
    return this.supplierService.getMyOffersGroupedByVehicle(user.sub, status);
  }

  @Get('offers/by-vehicle/:vehicleModelId')
  @ApiOperation({ summary: 'Get my offers for a vehicle model, grouped by trim' })
  @ApiQuery({ name: 'status', required: false, enum: ['PENDING', 'APPROVED', 'REJECTED'] })
  @ApiResponse({ status: 200, description: 'Vehicle with offers grouped by trim' })
  @ApiResponse({ status: 404, description: 'Vehicle model not found' })
  async getMyOffersByVehicle(
    @CurrentUser() user: any,
    @Param('vehicleModelId') vehicleModelId: string,
    @Query('status') status?: string,
  ) {
    return this.supplierService.getMyOffersByVehicleModel(user.sub, vehicleModelId, status);
  }

  @Get('offers')
  @ApiOperation({ summary: 'Get my offers' })
  @ApiQuery({ name: 'status', required: false, enum: ['PENDING', 'APPROVED', 'REJECTED'] })
  @ApiResponse({ status: 200, description: 'List of my offers' })
  async getMyOffers(
    @CurrentUser() user: any,
    @Query('status') status?: string,
  ) {
    return this.supplierService.getMyOffers(user.sub, status);
  }

  @Get('offers/:id')
  @ApiOperation({ summary: 'Get offer by ID' })
  @ApiResponse({ status: 200, description: 'Offer details' })
  @ApiResponse({ status: 404, description: 'Offer not found' })
  async getOffer(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.supplierService.getOffer(user.sub, id);
  }

  @Post('offers')
  @ApiOperation({ summary: 'Create a new offer' })
  @ApiResponse({ status: 201, description: 'Offer created' })
  @ApiResponse({ status: 404, description: 'Trim not found' })
  async createOffer(
    @CurrentUser() user: any,
    @Body() dto: CreateOfferDto,
  ) {
    return this.supplierService.createOffer(user.sub, dto);
  }

  @Get('trims')
  @ApiOperation({ summary: 'Get available trims for creating offers' })
  @ApiResponse({ status: 200, description: 'List of trims' })
  async getAvailableTrims() {
    return this.supplierService.getAvailableTrims();
  }

  @Get('trims/by-vehicle/:vehicleModelId')
  @ApiOperation({ summary: 'Get trims for a specific vehicle model' })
  @ApiResponse({ status: 200, description: 'List of trims for vehicle' })
  async getTrimsByVehicle(@Param('vehicleModelId') vehicleModelId: string) {
    return this.supplierService.getTrimsByVehicleModel(vehicleModelId);
  }
}
