import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { RentalsService } from './rentals.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateRentalCarDto, UpdateRentalCarDto, CreateRentalDto, CheckAvailabilityDto } from './dto/rentals.dto';

@ApiTags('rentals')
@Controller('api/v1/rentals')
export class RentalsController {
  constructor(private readonly rentalsService: RentalsService) {}

  @Get('cars/public')
  @ApiOperation({ summary: 'Get all rental cars for public view' })
  @ApiResponse({ status: 200, description: 'List of all rental cars' })
  async findPublicCars() {
    return this.rentalsService.findPublicCars();
  }

  @Get('cars')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all rental cars (Admin only)' })
  @ApiResponse({ status: 200, description: 'List of all rental cars' })
  async findAllCars() {
    return this.rentalsService.findAllCars();
  }

  @Get('cars/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a rental car by ID (Admin only)' })
  @ApiResponse({ status: 200, description: 'Rental car details' })
  @ApiResponse({ status: 404, description: 'Rental car not found' })
  async findCarById(@Param('id') id: string) {
    return this.rentalsService.findCarById(id);
  }

  @Post('cars')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new rental car (Admin only)' })
  @ApiResponse({ status: 201, description: 'Rental car created' })
  async createCar(@Body() dto: CreateRentalCarDto) {
    return this.rentalsService.createCar(dto);
  }

  @Patch('cars/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a rental car (Admin only)' })
  @ApiResponse({ status: 200, description: 'Rental car updated' })
  async updateCar(@Param('id') id: string, @Body() dto: UpdateRentalCarDto) {
    return this.rentalsService.updateCar(id, dto);
  }

  @Delete('cars/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a rental car (Admin only)' })
  @ApiResponse({ status: 200, description: 'Rental car deleted' })
  async deleteCar(@Param('id') id: string) {
    return this.rentalsService.deleteCar(id);
  }

  @Get('cars/:id/booked-ranges')
  @ApiOperation({ summary: 'Get booked date ranges for a specific car' })
  @ApiResponse({ status: 200, description: 'List of booked intervals' })
  async getBookedRanges(@Param('id') id: string) {
    return this.rentalsService.getBookedRanges(id);
  }

  @Post('check-availability')
  @ApiOperation({ summary: 'Check if a car is available for a specific date range' })
  @ApiResponse({ status: 200, description: 'Availability status' })
  async checkAvailability(@Body() dto: CheckAvailabilityDto) {
    return this.rentalsService.checkAvailability(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all rentals/bookings (Admin only)' })
  @ApiResponse({ status: 200, description: 'List of all rentals' })
  async findAllRentals() {
    return this.rentalsService.findAllRentals();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new rental booking (Admin only)' })
  @ApiResponse({ status: 201, description: 'Rental booking created' })
  async createRental(@Body() dto: CreateRentalDto) {
    return this.rentalsService.createRental(dto);
  }
}
