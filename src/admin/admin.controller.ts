import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  CreateBuyerDto,
  UpdateBuyerDto,
  CreateVehicleModelDto,
  UpdateVehicleModelDto,
  CreateTrimDto,
  UpdateTrimDto,
  CreateListingDto,
  UpdateListingDto,
  CreateOrderDto,
  UpdateOrderStatusDto,
  AddTrackingEventDto,
  AdjustStockDto,
  ApproveOfferDto,
  RejectOfferDto,
} from './dto/admin.dto';

@ApiTags('admin')
@Controller('api/v1/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class AdminController {
  constructor(private adminService: AdminService) {}

  // ============ DASHBOARD ============

  @Get('stats')
  @ApiOperation({ summary: 'Get admin dashboard stats' })
  @ApiResponse({ status: 200, description: 'Dashboard stats' })
  async getStats() {
    return this.adminService.getStats();
  }

  // ============ BUYERS MANAGEMENT ============

  @Post('users/buyer')
  @ApiOperation({ summary: 'Create a new buyer (admin only)' })
  @ApiResponse({ status: 201, description: 'Buyer created' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  async createBuyer(@Body() dto: CreateBuyerDto) {
    return this.adminService.createBuyer(dto);
  }

  @Get('users/buyers')
  @ApiOperation({ summary: 'Get all buyers' })
  @ApiResponse({ status: 200, description: 'List of buyers' })
  async getAllBuyers() {
    return this.adminService.getAllBuyers();
  }

  @Get('users/buyers/:id')
  @ApiOperation({ summary: 'Get buyer by ID' })
  @ApiResponse({ status: 200, description: 'Buyer details with orders' })
  @ApiResponse({ status: 404, description: 'Buyer not found' })
  async getBuyer(@Param('id') id: string) {
    return this.adminService.getBuyer(id);
  }

  @Put('users/buyers/:id')
  @ApiOperation({ summary: 'Update buyer' })
  @ApiResponse({ status: 200, description: 'Buyer updated' })
  @ApiResponse({ status: 404, description: 'Buyer not found' })
  async updateBuyer(@Param('id') id: string, @Body() dto: UpdateBuyerDto) {
    return this.adminService.updateBuyer(id, dto);
  }

  @Delete('users/buyers/:id')
  @ApiOperation({ summary: 'Delete buyer' })
  @ApiResponse({ status: 200, description: 'Buyer deleted' })
  @ApiResponse({ status: 404, description: 'Buyer not found' })
  async deleteBuyer(@Param('id') id: string) {
    return this.adminService.deleteBuyer(id);
  }

  // ============ VEHICLE MODELS ============

  @Post('vehicle-models')
  @ApiOperation({ summary: 'Create a new vehicle model' })
  @ApiResponse({ status: 201, description: 'Vehicle model created' })
  async createVehicleModel(@Body() dto: CreateVehicleModelDto) {
    return this.adminService.createVehicleModel(dto);
  }

  @Get('vehicle-models')
  @ApiOperation({ summary: 'Get all vehicle models with trims' })
  @ApiResponse({ status: 200, description: 'List of vehicle models' })
  async getAllVehicleModels() {
    return this.adminService.getAllVehicleModels();
  }

  @Get('vehicle-models/:id')
  @ApiOperation({ summary: 'Get vehicle model by ID' })
  @ApiResponse({ status: 200, description: 'Vehicle model details' })
  @ApiResponse({ status: 404, description: 'Vehicle model not found' })
  async getVehicleModel(@Param('id') id: string) {
    return this.adminService.getVehicleModel(id);
  }

  @Put('vehicle-models/:id')
  @ApiOperation({ summary: 'Update vehicle model' })
  @ApiResponse({ status: 200, description: 'Vehicle model updated' })
  @ApiResponse({ status: 404, description: 'Vehicle model not found' })
  async updateVehicleModel(@Param('id') id: string, @Body() dto: UpdateVehicleModelDto) {
    return this.adminService.updateVehicleModel(id, dto);
  }

  @Delete('vehicle-models/:id')
  @ApiOperation({ summary: 'Delete vehicle model' })
  @ApiResponse({ status: 200, description: 'Vehicle model deleted' })
  @ApiResponse({ status: 404, description: 'Vehicle model not found' })
  async deleteVehicleModel(@Param('id') id: string) {
    return this.adminService.deleteVehicleModel(id);
  }

  // ============ TRIMS ============

  @Get('trims')
  @ApiOperation({ summary: 'Get all trims with vehicle model info' })
  @ApiResponse({ status: 200, description: 'List of trims' })
  async getAllTrims() {
    return this.adminService.getAllTrims();
  }

  @Post('trims')
  @ApiOperation({ summary: 'Create a new trim' })
  @ApiResponse({ status: 201, description: 'Trim created' })
  @ApiResponse({ status: 404, description: 'Vehicle model not found' })
  async createTrim(@Body() dto: CreateTrimDto) {
    return this.adminService.createTrim(dto);
  }

  @Put('trims/:id')
  @ApiOperation({ summary: 'Update trim' })
  @ApiResponse({ status: 200, description: 'Trim updated' })
  @ApiResponse({ status: 404, description: 'Trim not found' })
  async updateTrim(@Param('id') id: string, @Body() dto: UpdateTrimDto) {
    return this.adminService.updateTrim(id, dto);
  }

  @Delete('trims/:id')
  @ApiOperation({ summary: 'Delete trim' })
  @ApiResponse({ status: 200, description: 'Trim deleted' })
  @ApiResponse({ status: 404, description: 'Trim not found' })
  async deleteTrim(@Param('id') id: string) {
    return this.adminService.deleteTrim(id);
  }

  // ============ LISTINGS ============

  @Post('listings')
  @ApiOperation({ summary: 'Create a new listing' })
  @ApiResponse({ status: 201, description: 'Listing created' })
  @ApiResponse({ status: 404, description: 'Trim not found' })
  async createListing(@Body() dto: CreateListingDto) {
    return this.adminService.createListing(dto);
  }

  @Get('listings')
  @ApiOperation({ summary: 'Get all listings' })
  @ApiQuery({ name: 'mode', required: false, enum: ['IN_STOCK', 'ON_ORDER', 'IN_TRANSIT'] })
  @ApiQuery({ name: 'status', required: false, enum: ['ACTIVE', 'INACTIVE', 'OUT_OF_STOCK'] })
  @ApiResponse({ status: 200, description: 'List of listings' })
  async getAllListings(
    @Query('mode') mode?: string,
    @Query('status') status?: string,
  ) {
    return this.adminService.getAllListings(mode, status);
  }

  @Get('listings/:id')
  @ApiOperation({ summary: 'Get listing by ID with stock details' })
  @ApiResponse({ status: 200, description: 'Listing details' })
  @ApiResponse({ status: 404, description: 'Listing not found' })
  async getListing(@Param('id') id: string) {
    return this.adminService.getListing(id);
  }

  @Put('listings/:id')
  @ApiOperation({ summary: 'Update listing' })
  @ApiResponse({ status: 200, description: 'Listing updated' })
  @ApiResponse({ status: 404, description: 'Listing not found' })
  async updateListing(@Param('id') id: string, @Body() dto: UpdateListingDto) {
    return this.adminService.updateListing(id, dto);
  }

  @Delete('listings/:id')
  @ApiOperation({ summary: 'Delete listing' })
  @ApiResponse({ status: 200, description: 'Listing deleted' })
  @ApiResponse({ status: 404, description: 'Listing not found' })
  async deleteListing(@Param('id') id: string) {
    return this.adminService.deleteListing(id);
  }

  @Post('listings/:id/adjust-stock')
  @ApiOperation({ summary: 'Manually adjust stock quantity' })
  @ApiResponse({ status: 200, description: 'Stock adjusted' })
  @ApiResponse({ status: 400, description: 'Cannot reduce below reserved' })
  @ApiResponse({ status: 404, description: 'Listing not found' })
  async adjustStock(@Param('id') id: string, @Body() dto: AdjustStockDto) {
    return this.adminService.adjustStock(id, dto);
  }

  // ============ STOCK LEDGER ============

  @Get('stock-ledger')
  @ApiOperation({ summary: 'View stock movement ledger' })
  @ApiQuery({ name: 'listingId', required: false })
  @ApiResponse({ status: 200, description: 'Stock movements' })
  async getStockLedger(@Query('listingId') listingId?: string) {
    return this.adminService.getStockLedger(listingId);
  }

  // ============ ORDERS ============

  @Post('orders')
  @ApiOperation({ summary: 'Create a new order (admin only)' })
  @ApiResponse({ status: 201, description: 'Order created with stock reserved' })
  @ApiResponse({ status: 400, description: 'Insufficient stock' })
  @ApiResponse({ status: 404, description: 'Buyer or listing not found' })
  async createOrder(@Body() dto: CreateOrderDto) {
    return this.adminService.createOrder(dto);
  }

  @Get('orders')
  @ApiOperation({ summary: 'Get all orders' })
  @ApiQuery({ name: 'status', required: false })
  @ApiResponse({ status: 200, description: 'List of orders' })
  async getAllOrders(@Query('status') status?: string) {
    return this.adminService.getAllOrders(status);
  }

  @Get('orders/:id')
  @ApiOperation({ summary: 'Get order by ID' })
  @ApiResponse({ status: 200, description: 'Order details' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async getOrder(@Param('id') id: string) {
    return this.adminService.getOrder(id);
  }

  @Patch('orders/:id/status')
  @ApiOperation({ summary: 'Update order status (handles stock automatically)' })
  @ApiResponse({ status: 200, description: 'Order status updated' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async updateOrderStatus(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.adminService.updateOrderStatus(id, dto);
  }

  @Post('orders/:id/tracking')
  @ApiOperation({ summary: 'Add tracking event to order' })
  @ApiResponse({ status: 201, description: 'Tracking event added' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async addTrackingEvent(@Param('id') id: string, @Body() dto: AddTrackingEventDto) {
    return this.adminService.addTrackingEvent(id, dto);
  }

  // ============ SUPPLIER OFFERS ============

  @Get('offers/grouped')
  @ApiOperation({ summary: 'Get supplier offers grouped by vehicle model' })
  @ApiQuery({ name: 'status', required: false, enum: ['PENDING', 'APPROVED', 'REJECTED'] })
  @ApiResponse({ status: 200, description: 'List of vehicle models with offer stats' })
  async getOffersGrouped(@Query('status') status?: string) {
    return this.adminService.getOffersGroupedByVehicle(status);
  }

  @Get('offers/by-vehicle/:vehicleModelId')
  @ApiOperation({ summary: 'Get offers for a vehicle model, grouped by trim' })
  @ApiQuery({ name: 'status', required: false, enum: ['PENDING', 'APPROVED', 'REJECTED'] })
  @ApiResponse({ status: 200, description: 'Vehicle model with offers grouped by trim' })
  @ApiResponse({ status: 404, description: 'Vehicle model not found' })
  async getOffersByVehicle(
    @Param('vehicleModelId') vehicleModelId: string,
    @Query('status') status?: string,
  ) {
    return this.adminService.getOffersByVehicleModel(vehicleModelId, status);
  }

  @Get('offers')
  @ApiOperation({ summary: 'Get all supplier offers' })
  @ApiQuery({ name: 'status', required: false, enum: ['PENDING', 'APPROVED', 'REJECTED'] })
  @ApiResponse({ status: 200, description: 'List of supplier offers' })
  async getAllOffers(@Query('status') status?: string) {
    return this.adminService.getAllOffers(status);
  }

  @Post('offers/:id/approve')
  @ApiOperation({ summary: 'Approve supplier offer (creates/updates listing)' })
  @ApiResponse({ status: 200, description: 'Offer approved, listing updated' })
  @ApiResponse({ status: 400, description: 'Offer already processed' })
  @ApiResponse({ status: 404, description: 'Offer not found' })
  async approveOffer(@Param('id') id: string, @Body() dto: ApproveOfferDto) {
    return this.adminService.approveOffer(id, dto);
  }

  @Post('offers/:id/reject')
  @ApiOperation({ summary: 'Reject supplier offer' })
  @ApiResponse({ status: 200, description: 'Offer rejected' })
  @ApiResponse({ status: 400, description: 'Offer already processed' })
  @ApiResponse({ status: 404, description: 'Offer not found' })
  async rejectOffer(@Param('id') id: string, @Body() dto: RejectOfferDto) {
    return this.adminService.rejectOffer(id, dto);
  }
}
